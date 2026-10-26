import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { database } from "../src/lib/db";
import { createQuiz } from "../src/lib/repository";
import { emptyDraft, newQuestion } from "../src/lib/model";
import {
  createGame,
  joinGame,
  claimControl,
  command,
  snapshot,
  submitAnswer,
  reconcileSession,
  rateGame,
} from "../src/lib/game";
import { getReport, reportCsv } from "../src/lib/reports";
import { csvCell } from "../src/lib/game-summary";
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "quizzzz-results-"));
process.env.GAME_TOKEN_SECRET = "test-only-results-secret-32-characters";
const db = await database(),
  owner = crypto.randomUUID(),
  other = crypto.randomUUID();
for (const id of [owner, other])
  await db.query(
    "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,'Host','unused')",
    [id, `${id}@example.com`],
  );
async function setup() {
  const questions = [newQuestion("mc"), newQuestion("mc")];
  for (const [i, q] of questions.entries()) {
    q.prompt = `Question ${i + 1}, \"ready\"?`;
    q.timeLimit = 10;
    q.basePoints = i === 0 ? 1000 : 2000;
    q.options.forEach((o, j) => (o.label = j === 0 ? "=SUM(1,2)" : "Wrong"));
    q.correctOptionId = q.options[0].id;
  }
  const quiz = await createQuiz(owner, {
    ...emptyDraft,
    title: "Reports",
    questions,
  });
  const room = await createGame(
    owner,
    { quizId: quiz.id, expectedQuizRevision: 1, key: crypto.randomUUID() },
    "http://localhost:3000",
  );
  const controllerId = crypto.randomUUID(),
    lease = await claimControl(room.id, owner, controllerId);
  const act = async (action: string) => {
    const result = await command(room.id, owner, {
      controllerId,
      generation: lease.generation,
      expectedRevision: (await snapshot(room.id, { role: "host", id: owner }))
        .revision,
      commandId: crypto.randomUUID(),
      action,
    });
    if (result.state === "QUESTION_INTRO") {
      await db.query(
        "UPDATE quiz_sessions SET intro_ends_at=now()-interval '1 second' WHERE id=$1",
        [room.id],
      );
      await reconcileSession(room.id);
    }
    return result;
  };
  const join = async (nickname: string) =>
    joinGame({
      pin: room.pin,
      nickname,
      avatar: { body: 0, mood: "smile" },
      joinRequestId: crypto.randomUUID(),
    });
  const answer = async (token: string, correct: boolean, ms: number) => {
    const snap = await snapshot(room.id, { role: "player", token });
    await submitAnswer(
      room.id,
      token,
      {
        questionId: snap.question!.id,
        selectedOptionId: snap.question!.options[correct ? 0 : 1].id,
        submissionId: crypto.randomUUID(),
      },
      new Date(new Date(snap.question!.startsAt!).getTime() + ms),
    );
  };
  const close = async () => {
    await db.query(
      "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE session_id=$1 AND closed_at IS NULL AND starts_at IS NOT NULL",
      [room.id],
    );
    await reconcileSession(room.id);
  };
  return { room, act, join, answer, close };
}
test("frozen reports, awards, private cards, non-repeating themes and one rating agree", async () => {
  const s = await setup(),
    a = await s.join("A"),
    b = await s.join("=Luna");
  await s.act("START_GAME");
  await assert.rejects(() => getReport(owner, s.room.id), {
    code: "REPORT_UNAVAILABLE",
  });
  await s.answer(a.token, true, 9000);
  await s.answer(b.token, false, 1000);
  await s.close();
  await s.act("SHOW_LEADERBOARD");
  const first = (await snapshot(s.room.id, { role: "host", id: owner })).theme;
  await s.act("NEXT_QUESTION");
  await s.answer(a.token, false, 1000);
  await s.answer(b.token, true, 1000);
  await s.close();
  await s.act("SHOW_LEADERBOARD");
  assert.notEqual(
    (await snapshot(s.room.id, { role: "host", id: owner })).theme,
    first,
  );
  await s.act("FINISH_GAME");
  const report = await getReport(owner, s.room.id),
    winner = report.summary.players[0];
  assert.equal(winner.id, b.participantId);
  assert.equal(winner.score, 1900);
  assert.deepEqual(winner.awards, [
    "Speed Demon",
    "Hot Streak",
    "Comeback Kid",
  ]);
  assert.equal(report.summary.accuracy, 0.5);
  assert.equal(report.summary.completion, 1);
  assert.equal(report.summary.averageMs, 3000);
  assert.equal(report.summary.toughest!.index, 1);
  const personal = await snapshot(s.room.id, {
    role: "player",
    token: b.token,
  });
  assert.deepEqual(personal.finalPlayer, winner);
  assert.equal(personal.podium, undefined);
  assert.deepEqual(
    (await snapshot(s.room.id, { role: "host", id: owner })).podium,
    report.summary.players.slice(0, 3),
  );
  assert.equal(personal.roster, undefined);
  await assert.rejects(() => getReport(other, s.room.id), {
    code: "NOT_FOUND",
  });
  assert.match(reportCsv(report), /"'=Luna"/);
  assert.match(reportCsv(report), /"'=SUM\(1,2\)"/);
  assert.deepEqual(await rateGame(s.room.id, b.token, 4), { value: 4 });
  assert.deepEqual(await rateGame(s.room.id, b.token, 4), { value: 4 });
  await assert.rejects(() => rateGame(s.room.id, b.token, 5), {
    code: "ALREADY_RATED",
  });
  const rated = await getReport(owner, s.room.id);
  assert.deepEqual(rated.summary, report.summary);
  assert.deepEqual(rated.rating, { count: 1, average: 4 });
});
test("partial reports omit future questions and awards; cancelled lobbies have no analytics", async () => {
  const s = await setup(),
    a = await s.join("Only answer"),
    b = await s.join("Unanswered");
  await s.act("START_GAME");
  await s.answer(a.token, true, 2000);
  await s.act("END_EARLY");
  const report = await getReport(owner, s.room.id);
  assert.equal(report.summary.questionCount, 1);
  assert.equal(report.summary.partial, true);
  assert.equal(report.summary.accuracy, 0.5);
  assert.equal(report.summary.completion, 0.5);
  assert.equal(
    report.summary.players.find((p) => p.id === b.participantId)!.averageMs,
    null,
  );
  assert.ok(report.summary.players.every((p) => p.awards.length === 0));
  assert.match(reportCsv(report), /"unanswered","","",""/);
  await assert.rejects(() => rateGame(s.room.id, a.token, 3), {
    code: "RATING_UNAVAILABLE",
  });
  const lobby = await setup();
  await lobby.act("CANCEL");
  await assert.rejects(() => getReport(owner, lobby.room.id), {
    code: "REPORT_UNAVAILABLE",
  });
  const empty = await setup();
  await db.query(
    "UPDATE quiz_sessions SET host_last_seen_at=now()-interval '16 minutes' WHERE id=$1",
    [empty.room.id],
  );
  const none = await getReport(owner, empty.room.id);
  assert.equal(none.summary.accuracy, null);
  assert.equal(none.summary.completion, null);
});
test("CSV escapes quotes, formulas and leading control characters", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(" \t@SUM(1)"), '"\' \t@SUM(1)"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(null), '""');
});

test("reports paginate players while a full CSV keeps the entire frozen roster", async () => {
  const s = await setup();
  for (let i = 0; i < 26; i++) await s.join(`Player ${i + 1}`);
  await s.act("START_GAME");
  await s.act("END_EARLY");
  const first = await getReport(owner, s.room.id),
    last = await getReport(owner, s.room.id, { offset: 25 }),
    full = await getReport(owner, s.room.id, { allPlayers: true });
  assert.equal(first.summary.players.length, 25);
  assert.equal(first.hasMore, true);
  assert.equal(last.summary.players.length, 1);
  assert.equal(last.hasMore, false);
  assert.equal(full.summary.players.length, 26);
  assert.equal(full.summary.playerCount, 26);
  assert.equal(reportCsv(full).trim().split("\r\n").length, 27);
  assert.ok(
    !first.summary.players.some((p) => p.id === last.summary.players[0].id),
  );
});
