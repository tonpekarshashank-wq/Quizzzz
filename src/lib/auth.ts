import { cookies } from "next/headers";
import { database } from "./db";
import { digest, ApiError } from "./security";
export const cookieName = "quizzzz_session";
export type Host = { id: string; email: string; fullName: string };
export async function currentHost(): Promise<Host | null> {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return null;
  const db = await database();
  const r = await db.query<{ id: string; email: string; full_name: string }>(
    "SELECT u.id,u.email,u.full_name FROM users u JOIN host_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [digest(raw)],
  );
  return r.rows[0]
    ? {
        id: r.rows[0].id,
        email: r.rows[0].email,
        fullName: r.rows[0].full_name,
      }
    : null;
}
export async function requireHost() {
  const host = await currentHost();
  if (!host)
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return host;
}
export async function setSession(raw: string) {
  (await cookies()).set(cookieName, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
