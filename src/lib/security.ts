import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { database, type Connection } from "./db";
const scrypt = promisify(scryptCallback);
export function token() {
  return randomBytes(32).toString("hex");
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${result.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export async function limit(key: string, max: number, periodSeconds = 60) {
  const db = await database();
  const r = await db.query<{ attempts: number; resets_at: Date }>(
    `INSERT INTO rate_buckets(key,attempts,resets_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN rate_buckets.resets_at<=now() THEN 1 ELSE rate_buckets.attempts+1 END,resets_at=CASE WHEN rate_buckets.resets_at<=now() THEN now()+$2*interval '1 second' ELSE rate_buckets.resets_at END RETURNING attempts,resets_at`,
    [digest(key), periodSeconds],
  );
  if (r.rows[0].attempts > max)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please try again shortly.",
      undefined,
      Math.max(
        1,
        Math.ceil(
          (new Date(r.rows[0].resets_at).getTime() - Date.now()) / 1000,
        ),
      ),
    );
}
export async function createSession(c: Connection, userId: string) {
  const raw = token();
  await c.query(
    "INSERT INTO host_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [digest(raw), userId],
  );
  return raw;
}
