import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
test("committed answers and due jobs survive an actual process restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "quizzzz-restart-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: "",
    NODE_ENV: "test",
    WORKFLOW_ENABLED: "false",
    DATA_DIR: dir,
    GAME_TOKEN_SECRET: "restart-test-secret-32-characters-long",
  };
  for (const phase of ["seed", "recover"])
    await exec(
      process.execPath,
      ["--import", "tsx", "scripts/recovery-probe.ts", phase],
      { env, timeout: 45000 },
    );
});
