import { z } from "zod";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { getReport, listReports } from "./reports";
import { requireHost } from "./auth";
import { ApiError, limit } from "./security";
import {
  claimControl,
  command,
  createGame,
  heartbeat,
  joinGame,
  lookupRoom,
  snapshot,
  submitAnswer,
  rateGame,
  type Actor,
} from "./game";
import { drainLive, realtimeToken, startLocalWorker } from "./live-delivery";
const idSchema = z.uuid();
const joinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  nickname: z.string().min(1).max(25),
  avatar: z.object({
    body: z.number().int().min(0).max(5),
    mood: z.enum(["smile", "grin", "o"]),
  }),
  joinRequestId: z.uuid(),
});
async function actor(req: NextRequest): Promise<Actor> {
  const raw = req.headers.get("authorization");
  if (raw) {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(raw);
    if (!match)
      throw new ApiError(401, "GUEST_EXPIRED", "Please join this game again.");
    return { role: "player", token: match[1] };
  }
  return { role: "host", id: (await requireHost()).id };
}
function guest(req: NextRequest) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(
    req.headers.get("authorization") ?? "",
  );
  if (!match)
    throw new ApiError(401, "GUEST_EXPIRED", "Please join this game again.");
  return match[1];
}
function cfg(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid ${name}`);
  return n;
}
export async function liveApi(
  req: NextRequest,
  path: string[],
  readBody: () => Promise<unknown>,
  origin: string | undefined,
  receivedAt: Date,
): Promise<{ data: unknown; status?: number } | null> {
  if (!["sessions", "rooms"].includes(path[0])) return null;
  startLocalWorker();
  after(async () => {
    try {
      await drainLive();
    } catch {
      console.error("Live delivery will retry");
    }
  });
  const method = req.method;
  if (path[0] === "sessions" && path.length === 1 && method === "GET") {
    const host = await requireHost();
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(req.nextUrl.searchParams.get("offset") ?? 0);
    return { data: await listReports(host.id, offset) };
  }
  if (path[0] === "rooms" && path.length === 2 && method === "GET") {
    await limit(
      `room:${process.env.VERCEL ? req.headers.get("x-vercel-forwarded-for") : "local"}`,
      1200,
    );
    return {
      data: await lookupRoom(
        z
          .string()
          .regex(/^\d{6}$/)
          .parse(path[1]),
      ),
    };
  }
  if (path.length === 1 && method === "POST") {
    const host = await requireHost();
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      if (
        !process.env.ABLY_API_KEY ||
        process.env.WORKFLOW_ENABLED !== "true" ||
        !process.env.GAME_TOKEN_SECRET
      )
        throw new ApiError(
          503,
          "LIVE_NOT_CONFIGURED",
          "Live hosting is not configured yet.",
        );
    }
    await limit(`launch:${host.id}`, 20);
    const v = z
      .object({
        quizId: z.uuid(),
        expectedQuizRevision: z.number().int().positive(),
      })
      .parse(await readBody());
    const key = idSchema.parse(req.headers.get("idempotency-key"));
    return {
      data: await createGame(host.id, { ...v, key }, origin!),
      status: 201,
    };
  }
  if (path[1] === "join" && path.length === 2 && method === "POST") {
    const input = joinSchema.parse(await readBody());
    const ip = process.env.VERCEL
      ? (req.headers.get("x-vercel-forwarded-for") ?? "unknown")
      : "local";
    await limit(`join-ip:${ip}`, cfg("JOIN_IP_PER_MINUTE", 1200));
    const jar = await cookies();
    let browserId = jar.get("quizzzz-join-browser")?.value;
    if (!browserId || !idSchema.safeParse(browserId).success) {
      browserId = crypto.randomUUID();
      jar.set("quizzzz-join-browser", browserId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 86400,
      });
    }
    await limit(
      `join-browser:${browserId}`,
      cfg("JOIN_BROWSER_PER_MINUTE", 20),
    );
    try {
      return { data: await joinGame(input), status: 201 };
    } catch (e) {
      if (e instanceof ApiError && e.code === "INVALID_PIN")
        await limit(`bad-pin:${ip}`, cfg("JOIN_INVALID_PIN_PER_MINUTE", 30));
      throw e;
    }
  }
  if (path.length < 3)
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
  const id = idSchema.parse(path[1]);
  const resource = path.slice(2).join("/");
  if (resource === "snapshot" && method === "GET")
    return { data: await snapshot(id, await actor(req)) };
  if (resource === "realtime-token" && method === "POST")
    return { data: await realtimeToken(id, await actor(req)) };
  if (resource === "answers" && method === "POST") {
    const raw = guest(req);
    await limit(`answer:${raw}`, 120);
    const v = z
      .object({
        questionId: z.uuid(),
        selectedOptionId: z.uuid(),
        submissionId: z.uuid(),
      })
      .parse(await readBody());
    return { data: await submitAnswer(id, raw, v, receivedAt) };
  }
  if (resource === "rating" && method === "POST") {
    const raw = guest(req);
    await limit(`rating:${raw}`, 20);
    const v = z
      .object({ value: z.number().int().min(1).max(5) })
      .parse(await readBody());
    return { data: await rateGame(id, raw, v.value) };
  }
  const host = await requireHost();
  if (resource === "report" && method === "GET") {
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(req.nextUrl.searchParams.get("offset") ?? 0);
    return { data: await getReport(host.id, id, { offset }) };
  }
  if (resource === "control/claim" && method === "POST") {
    const v = z
      .object({ controllerId: z.uuid(), takeover: z.boolean().optional() })
      .parse(await readBody());
    return {
      data: await claimControl(id, host.id, v.controllerId, v.takeover),
    };
  }
  if (resource === "control/heartbeat" && method === "POST") {
    const v = z
      .object({
        controllerId: z.uuid(),
        generation: z.number().int().positive(),
      })
      .parse(await readBody());
    return { data: await heartbeat(id, host.id, v) };
  }
  if (resource === "commands" && method === "POST") {
    const v = z
      .object({
        controllerId: z.uuid(),
        generation: z.number().int().positive(),
        expectedRevision: z.number().int().positive(),
        commandId: z.uuid(),
        action: z.enum([
          "START_GAME",
          "KICK_PLAYER",
          "CANCEL",
          "SHOW_LEADERBOARD",
          "NEXT_QUESTION",
          "FINISH_GAME",
          "END_EARLY",
        ]),
        participantId: z.uuid().optional(),
      })
      .parse(await readBody());
    return { data: await command(id, host.id, v) };
  }
  throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
}
