import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./security";
export async function sendReset(to: string, url: string) {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject: "Reset your Quizzzz password",
        text: `Reset your password within 30 minutes: ${url}
If you didn't request this, ignore this message.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok)
      throw new ApiError(
        503,
        "EMAIL_UNAVAILABLE",
        "Password recovery is temporarily unavailable.",
      );
    return;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new ApiError(
      503,
      "EMAIL_UNAVAILABLE",
      "Password recovery is temporarily unavailable.",
    );
  const dir = path.resolve(process.env.DATA_DIR ?? ".data", "mail");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(dir, `${crypto.randomUUID()}.json`),
    JSON.stringify({ to, url }),
    { mode: 0o600 },
  );
}
export function emailAvailable() {
  return (
    !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) ||
    (!process.env.VERCEL && process.env.NODE_ENV !== "production")
  );
}
