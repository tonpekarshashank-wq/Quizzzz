import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const origin = new URL(process.env.LOAD_BASE_URL ?? "http://127.0.0.1:3220")
  .origin;
if (
  !["127.0.0.1", "localhost"].includes(new URL(origin).hostname) &&
  process.env.LOAD_ALLOW_REMOTE !== "true"
)
  throw new Error(
    "Remote runs require LOAD_ALLOW_REMOTE=true and a synthetic staging environment.",
  );
const players = Number(process.env.LOAD_PLAYERS ?? 500),
  rooms = Number(process.env.LOAD_ROOMS ?? 2);
if (
  !Number.isInteger(players) ||
  players < 1 ||
  players > 500 ||
  ![1, 2].includes(rooms)
)
  throw new Error("Use 1–500 players and 1–2 rooms.");
let cookie = "";
let transportRetries = 0;
const measurements: Record<string, number[]> = {};
async function request(
  route: string,
  method = "GET",
  body?: unknown,
  opts: { token?: string; host?: boolean; key?: string; metric?: string } = {},
) {
  const before = performance.now();
  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(opts.host && cookie ? { Cookie: cookie } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.key ? { "Idempotency-Key": opts.key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  };
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await fetch(`${origin}/api/v1/${route}`, init);
      break;
    } catch (e) {
      if (
        !opts.token ||
        method !== "POST" ||
        !route.endsWith("/answers") ||
        attempt === 3
      )
        throw new Error(
          `Transport failure at ${route}: ${(e as { cause?: { code?: string } }).cause?.code ?? (e as Error).message}`,
        );
      transportRetries++;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  if (!response) throw new Error("No response");
  if (opts.metric)
    (measurements[opts.metric] ??= []).push(performance.now() - before);
  const value = await response.json();
  const setCookie = response.headers.getSetCookie();
  if (opts.host && setCookie.length)
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { status: response.status, data: value.data, error: value.error };
}
async function good(...args: Parameters<typeof request>) {
  const r = await request(...args);
  if (r.status >= 400)
    throw new Error(`${args[0]}: ${r.status} ${r.error?.code}`);
  return r.data;
}
async function parallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const out: R[] = Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
async function main() {
  const runId = crypto.randomUUID();
  await good(
    "auth/register",
    "POST",
    {
      fullName: "Synthetic load host",
      email: `load-${runId}@example.com`,
      password: crypto.randomUUID() + "test",
    },
    { host: true },
  );
  const games = [];
  for (let i = 0; i < rooms; i++) {
    const options = ["Correct", "Incorrect"].map((label) => ({
      id: crypto.randomUUID(),
      label,
    }));
    const quiz = await good(
      "quizzes",
      "POST",
      {
        draft: {
          title: `Synthetic room ${i + 1}`,
          description: "Synthetic Stage 6 test",
          language: "en",
          coverImageUrl: "",
          questions: [
            {
              id: crypto.randomUUID(),
              type: "mc",
              prompt: "Select Correct.",
              timeLimit: 90,
              basePoints: 1000,
              options,
              correctOptionId: options[0].id,
            },
          ],
        },
      },
      { host: true },
    );
    const room = await good(
      "sessions",
      "POST",
      { quizId: quiz.id, expectedQuizRevision: 1 },
      { host: true, key: crypto.randomUUID() },
    );
    games.push({
      ...room,
      controllerId: crypto.randomUUID(),
      players: [] as any[],
      snap: null as any,
    });
  }
  const jobs = games.flatMap((game) =>
    Array.from({ length: players }, (_, i) => ({ game, index: i })),
  );
  const joinStart = performance.now();
  const joined = await parallel(jobs, 50, async ({ game, index }) => {
    const input = {
      pin: game.pin,
      nickname: `Player ${index + 1}`,
      avatar: { body: index % 6, mood: "smile" },
      joinRequestId: crypto.randomUUID(),
    };
    const identity = await good("sessions/join", "POST", input, {
      metric: "join",
    });
    const person = { ...identity, input };
    game.players.push(person);
    return person;
  });
  const joinDuration = performance.now() - joinStart;
  console.log(
    `Joined ${joined.length} synthetic players across ${rooms} room(s).`,
  );
  for (const game of games) {
    const retry = await good("sessions/join", "POST", game.players[0].input);
    assert.equal(retry.participantId, game.players[0].participantId);
    if (players === 500) {
      const overflow = await request("sessions/join", "POST", {
        ...game.players[0].input,
        nickname: "Overflow",
        joinRequestId: crypto.randomUUID(),
      });
      assert.equal(overflow.error?.code, "ROOM_FULL");
    }
    game.snap = await good(`sessions/${game.id}/snapshot`, "GET", undefined, {
      host: true,
    });
    assert.equal(game.snap.playerCount, players);
  }
  async function command(game: any, action: string) {
    const lease = await good(
      `sessions/${game.id}/control/claim`,
      "POST",
      { controllerId: game.controllerId, takeover: true },
      { host: true },
    );
    const snap = await good(`sessions/${game.id}/snapshot`, "GET", undefined, {
      host: true,
    });
    return good(
      `sessions/${game.id}/commands`,
      "POST",
      {
        controllerId: game.controllerId,
        generation: lease.generation,
        expectedRevision: snap.revision,
        commandId: crypto.randomUUID(),
        action,
      },
      { host: true },
    );
  }
  for (const game of games) {
    await command(game, "START_GAME");
    game.snap = await good(`sessions/${game.id}/snapshot`, "GET", undefined, {
      host: true,
    });
    const waitUntil = Date.now() + 15000;
    while (game.snap.state === "QUESTION_INTRO" && Date.now() < waitUntil) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      game.snap = await good(`sessions/${game.id}/snapshot`, "GET", undefined, {
        host: true,
      });
    }
    assert.equal(game.snap.state, "QUESTION_ACTIVE");
    assert.equal(game.snap.question.correctOptionId, undefined);
  }
  const burstStart = performance.now();
  let lastDispatch = burstStart;
  const answers = await Promise.all(
    games.flatMap((game) =>
      game.players.map((p: any, index: number) => {
        const question = game.snap.question;
        const body = {
          questionId: question.id,
          selectedOptionId: question.options[index % 5 === 0 ? 1 : 0].id,
          submissionId: crypto.randomUUID(),
        };
        lastDispatch = performance.now();
        return good(`sessions/${game.id}/answers`, "POST", body, {
          token: p.token,
          metric: "answer",
        }).then((ack) => ({ game, p, body, ack }));
      }),
    ),
  );
  const answerDuration = performance.now() - burstStart;
  console.log(
    `Accepted ${answers.length} answers; dispatch ${Math.round(lastDispatch - burstStart)}ms, total ${Math.round(answerDuration)}ms.`,
  );
  await parallel(
    answers.filter((_, i) => i % 10 === 0),
    25,
    async (a) => {
      assert.deepEqual(
        await good(`sessions/${a.game.id}/answers`, "POST", a.body, {
          token: a.p.token,
          metric: "retry",
        }),
        a.ack,
      );
    },
  );
  for (const game of games) {
    await command(game, "END_EARLY");
    const snap = await good(`sessions/${game.id}/snapshot`, "GET", undefined, {
      host: true,
    });
    assert.equal(snap.state, "INTERRUPTED");
  }
  let verified = 0;
  for (const game of games) {
    const reports = [];
    for (let offset = 0; offset < players; offset += 25)
      reports.push(
        await good(
          `sessions/${game.id}/report?offset=${offset}`,
          "GET",
          undefined,
          { host: true, metric: "report" },
        ),
      );
    const final = reports.flatMap((r) => r.summary.players);
    assert.equal(new Set(final.map((p) => p.rank)).size, players);
    assert.equal(final.length, players);
    const records = new Map(final.map((p) => [p.id, p]));
    for (const a of answers.filter((a) => a.game.id === game.id)) {
      const elapsed = Math.max(
        0,
        new Date(a.ack.acceptedAt).getTime() -
          new Date(game.snap.question.startsAt).getTime(),
      );
      const correct =
        a.body.selectedOptionId === game.snap.question.options[0].id;
      const expected = correct
        ? Math.floor(1000 * (1 - (0.5 * elapsed) / 90000) + 0.5)
        : 0;
      assert.equal(records.get(a.p.participantId)!.score, expected);
      verified++;
    }
    const personal = await good(
      `sessions/${game.id}/snapshot`,
      "GET",
      undefined,
      { token: game.players[0].token },
    );
    assert.equal(personal.roster, undefined);
    assert.equal(personal.podium, undefined);
    const late = await request(
      `sessions/${game.id}/answers`,
      "POST",
      {
        questionId: game.snap.question.id,
        selectedOptionId: game.snap.question.options[0].id,
        submissionId: crypto.randomUUID(),
      },
      { token: game.players[0].token },
    );
    assert.equal(late.error?.code, "ALREADY_ANSWERED");
  }
  const metrics = Object.fromEntries(
    Object.entries(measurements).map(([name, times]) => {
      times.sort((a, b) => a - b);
      return [
        name,
        {
          count: times.length,
          p50Ms: Math.round(times[Math.floor(times.length * 0.5)]),
          p95Ms: Math.round(
            times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
          ),
          maxMs: Math.round(times.at(-1)!),
        },
      ];
    }),
  );
  const result = {
    at: new Date().toISOString(),
    target: new URL(origin).hostname,
    mode: process.env.LOAD_MODE ?? "local-development-embedded-postgres",
    rooms,
    playersPerRoom: players,
    verifiedScores: verified,
    joinDurationMs: Math.round(joinDuration),
    answerDispatchMs: Math.round(lastDispatch - burstStart),
    answerDurationMs: Math.round(answerDuration),
    transportRetries,
    serverReceiveSpanMs: games.map((game) => {
      const times = answers
        .filter((a) => a.game.id === game.id)
        .map((a) => new Date(a.ack.acceptedAt).getTime());
      return Math.max(...times) - Math.min(...times);
    }),
    metrics,
    checks: {
      capacity: true,
      sharedIpJoins: true,
      idempotentRetries: true,
      uniqueRanks: true,
      exactScores: true,
      privateSnapshot: true,
    },
    limitations: [
      "HTTP harness; not 1000 browser/WebSocket connections",
      "Local embedded DB results are not Neon/Vercel capacity evidence",
      "Early closure; unattended scheduler and commit-to-render latency measured separately",
    ],
  };
  const dir = path.resolve("test-results");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "load-http.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Load verification failed");
  process.exitCode = 1;
});
