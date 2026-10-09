import { liveApi } from "@/lib/live-api";
import { validateOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { database } from "@/lib/db";
import {
  ApiError,
  createSession,
  digest,
  hashPassword,
  limit,
  token,
  verifyPassword,
} from "@/lib/security";
import { cookieName, requireHost, setSession } from "@/lib/auth";
import {
  archiveQuiz,
  createQuiz,
  getQuiz,
  listQuizzes,
  saveQuiz,
} from "@/lib/repository";
import { draftSchema, emptyDraft } from "@/lib/model";
import { emailAvailable, sendReset } from "@/lib/mail";
export const runtime = "nodejs";
const credential = z.object({
  email: z
    .email()
    .max(255)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});
const registration = credential.extend({
  fullName: z.string().trim().min(1).max(100),
});
const uuid = z.uuid();
function success(data: unknown, status = 200) {
  return NextResponse.json(
    { data, serverTime: new Date().toISOString() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function checkOrigin(req: NextRequest) {
  return validateOrigin({
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    requestUrl: req.url,
    configuredOrigin: process.env.APP_ORIGIN,
    deployed: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  });
}
async function body(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(400, "INVALID_JSON", "Send JSON content.");
  const text = await req.text();
  if (Buffer.byteLength(text) > 256000)
    throw new ApiError(413, "TOO_LARGE", "Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Invalid JSON.");
  }
}
function networkKey(req: NextRequest) {
  return process.env.VERCEL
    ? (req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
    : "local";
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const receivedAt = new Date();
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const method = req.method;
    const requestOrigin = method !== "GET" ? checkOrigin(req) : undefined;
    const live = await liveApi(
      req,
      path,
      () => body(req),
      requestOrigin,
      receivedAt,
    );
    if (live) return success(live.data, live.status ?? 200);
    if (route.startsWith("auth/") && method === "POST") {
      await limit(
        `auth:${networkKey(req)}:${route}`,
        route === "auth/forgot-password" ? 10 : 30,
      );
      const input = await body(req);
      const db = await database();
      if (route === "auth/register") {
        const v = registration.parse(input);
        await limit(`register:${v.email}`, 5, 3600);
        const hashed = await hashPassword(v.password);
        const id = crypto.randomUUID();
        let raw: string;
        try {
          raw = await db.transaction(async (c) => {
            await c.query(
              "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,$3,$4)",
              [id, v.email, v.fullName, hashed],
            );
            return createSession(c, id);
          });
        } catch (e) {
          if ((e as { code?: string }).code === "23505")
            throw new ApiError(
              409,
              "ACCOUNT_EXISTS",
              "Unable to create this account. Try signing in or resetting your password.",
            );
          throw e;
        }
        await setSession(raw);
        return success({ id, email: v.email, fullName: v.fullName }, 201);
      }
      if (route === "auth/login") {
        const v = credential.parse(input);
        await limit(`login:${v.email}`, 10, 900);
        const r = await db.query<{
          id: string;
          email: string;
          full_name: string;
          password_hash: string;
        }>(
          "SELECT id,email,full_name,password_hash FROM users WHERE email=$1",
          [v.email],
        );
        const user = r.rows[0];
        // Hash even nonexistent-user requests to avoid a fast enumeration path.
        const stored =
          user?.password_hash ??
          "00000000000000000000000000000000:" + "00".repeat(64);
        if (!(await verifyPassword(v.password, stored)) || !user)
          throw new ApiError(
            401,
            "INVALID_CREDENTIALS",
            "Email or password is incorrect.",
          );
        await setSession(await createSession(db, user.id));
        return success({
          id: user.id,
          email: user.email,
          fullName: user.full_name,
        });
      }
      if (route === "auth/logout") {
        const raw = (await cookies()).get(cookieName)?.value;
        if (raw)
          await db.query("DELETE FROM host_sessions WHERE token_hash=$1", [
            digest(raw),
          ]);
        (await cookies()).delete(cookieName);
        return success({ signedOut: true });
      }
      if (route === "auth/forgot-password") {
        const v = z
          .object({
            email: z
              .email()
              .max(255)
              .transform((s) => s.trim().toLowerCase()),
          })
          .parse(input);
        await limit(`reset:${v.email}`, 3, 3600);
        if (!emailAvailable())
          throw new ApiError(
            503,
            "EMAIL_UNAVAILABLE",
            "Password recovery is temporarily unavailable.",
          );
        const r = await db.query<{ id: string }>(
          "SELECT id FROM users WHERE email=$1",
          [v.email],
        );
        if (r.rows[0]) {
          const raw = token();
          await db.query(
            "INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
            [digest(raw), r.rows[0].id],
          );
          try {
            await sendReset(
              v.email,
              `${requestOrigin}/reset-password#token=${raw}`,
            );
          } catch {
            await db.query("DELETE FROM reset_tokens WHERE token_hash=$1", [
              digest(raw),
            ]); /* generic response prevents account enumeration through delivery errors */
          }
        }
        return success({
          message:
            "If an account exists for that email, a reset link has been sent.",
        });
      }
      if (route === "auth/reset-password") {
        const v = z
          .object({
            token: z.string().regex(/^[a-f0-9]{64}$/),
            password: z.string().min(10).max(128),
          })
          .parse(input);
        const hashed = await hashPassword(v.password);
        await db.transaction(async (c) => {
          const r = await c.query<{ user_id: string }>(
            "DELETE FROM reset_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
            [digest(v.token)],
          );
          if (!r.rows[0])
            throw new ApiError(
              422,
              "RESET_EXPIRED",
              "This reset link has expired or was already used.",
            );
          const id = r.rows[0].user_id;
          await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
            hashed,
            id,
          ]);
          await c.query("DELETE FROM host_sessions WHERE user_id=$1", [id]);
          await c.query("DELETE FROM reset_tokens WHERE user_id=$1", [id]);
        });
        (await cookies()).delete(cookieName);
        return success({ reset: true });
      }
      throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
    }
    const host = await requireHost();
    if (route === "auth/me" && method === "GET") return success(host);
    if (route === "quizzes" && method === "GET") {
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(req.nextUrl.searchParams.get("offset") ?? 0);
      return success(await listQuizzes(host.id, offset));
    }
    if (route === "quizzes" && method === "POST") {
      await limit(`create:${host.id}`, 30);
      const v = z
        .object({ draft: draftSchema.optional() })
        .parse(await body(req));
      return success(
        await createQuiz(
          host.id,
          v.draft ? draftSchema.parse(v.draft) : emptyDraft,
        ),
        201,
      );
    }
    if (path[0] === "quizzes" && path.length === 2) {
      const id = uuid.parse(path[1]);
      if (method === "GET") return success(await getQuiz(host.id, id));
      if (method === "PUT") {
        const v = z
          .object({
            draft: draftSchema,
            expectedRevision: z.number().int().positive(),
          })
          .parse(await body(req));
        return success(
          await saveQuiz(host.id, id, v.draft, v.expectedRevision),
        );
      }
    }
    if (
      path[0] === "quizzes" &&
      path[2] === "archive" &&
      path.length === 3 &&
      method === "POST"
    ) {
      await archiveQuiz(host.id, uuid.parse(path[1]));
      return success({ archived: true });
    }
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (e) {
    let error: ApiError;
    if (e instanceof ApiError) error = e;
    else if (e instanceof z.ZodError)
      error = new ApiError(
        422,
        "VALIDATION_FAILED",
        "Please check the highlighted fields.",
        Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message])),
      );
    else {
      console.error(
        "API dependency failure",
        e instanceof Error ? e.name : "unknown",
      );
      error = new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Service is temporarily unavailable. Please retry.",
      );
    }
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        serverTime: new Date().toISOString(),
      },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
