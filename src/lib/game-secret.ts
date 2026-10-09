import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
let secretPromise: Promise<string> | undefined;
async function secret() {
  if (process.env.GAME_TOKEN_SECRET) {
    if (process.env.GAME_TOKEN_SECRET.length < 32)
      throw new Error("GAME_TOKEN_SECRET must be at least 32 characters");
    return process.env.GAME_TOKEN_SECRET;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("GAME_TOKEN_SECRET is required");
  const dir = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR ?? ".data",
  );
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "game-secret");
  try {
    await writeFile(file, randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFile(file, "utf8");
}
export async function guestToken(requestId: string, participantId: string) {
  const key = await (secretPromise ??= secret());
  return createHmac("sha256", key)
    .update(`${requestId}:${participantId}`)
    .digest("hex");
}
