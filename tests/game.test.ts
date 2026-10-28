import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { database } from "../src/lib/db";
import { createQuiz, saveQuiz } from "../src/lib/repository";
import { emptyDraft, newQuestion } from "../src/lib/model";
import {
  claimControl,
  command,
  createGame,
  joinGame,
  snapshot,
  submitAnswer,
  reconcileSession,
} from "../src/lib/game";
import { rankPlayers, scoreAnswer } from "../src/lib/game-model";
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "quizzzz-game-"));
process.env.GAME_TOKEN_SECRET = "test-only-secret-32-characters-long";
const db = await database(),
  owner = crypto.randomUUID(),
  other = crypto.randomUUID();
for (const id of [owner, other])
  await db.query(
    "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,'Host','unused')",
    [id, `${id}@example.com`],
  );
async function setup() {
  const q = newQuestion("mc");
  q.prompt = "Which is correct?";
  q.timeLimit = 10;
  q.options.forEach((o, i) => (o.label = `Answer ${i + 1}`));
  q.correctOptionId = q.options[0].id;
  const quiz = await createQuiz(owner, {
    ...emptyDraft,
    title: "Live test",
    questions: [q],
  });
  const room = await createGame(
    owner,
    { quizId: quiz.id, expectedQuizRevision: 1, key: crypto.randomUUID() },
    "http://localhost:3000",
  );
  const controllerId = crypto.randomUUID();
  const lease = await claimControl(room.id, owner, controllerId);
  return { q, quiz, room, controllerId, generation: lease.generation };
}
async function player(pin: string, name = "Maya") {
  return joinGame({
    pin,
    nickname: name,
    avatar: { body: 0, mood: "grin" },
    joinRequestId: crypto.randomUUID(),
  });
}
async function action(s: Awaited<ReturnType<typeof setup>>, name: string) {
  const snap = await snapshot(s.room.id, { role: "host", id: owner });
  const result = await command(s.room.id, owner, {
    controllerId: s.controllerId,
    generation: s.generation,
    expectedRevision: snap.revision,
    commandId: crypto.randomUUID(),
    action: name,
  });
  // Existing domain tests begin after the presentation-only intro. New tests below exercise it directly.
  if (result.state === "QUESTION_INTRO") {
    await db.query(
      "UPDATE quiz_sessions SET intro_ends_at=now()-interval '1 second' WHERE id=$1",
      [s.room.id],
    );
    await reconcileSession(s.room.id);
  }
  return result;
}
test("points rounding and distinct response-time ordering", () => {
  assert.equal(scoreAnswer(1000, 30000, 3000, true).points, 950);
  assert.equal(scoreAnswer(2000, 10000, 1800, true).points, 1820);
  assert.equal(scoreAnswer(2000, 30000, 1800, true).points, 1940);
  assert.equal(scoreAnswer(2000, 10000, 0, false).points, 0);
  const rows = [
    {
      id: "b",
      score: 950,
      correctScored: 1,
      correctMs: 3001,
      lastCorrectAt: 100,
    },
    {
      id: "a",
      score: 950,
      correctScored: 1,
      correctMs: 3000,
      lastCorrectAt: 100,
    },
  ];
  assert.equal(rankPlayers(rows)[0].id, "a");
  assert.equal(
    rankPlayers(
      rows.map((r) => ({
        ...r,
        score: 0,
        correctScored: 0,
        correctMs: 0,
        lastCorrectAt: null,
      })),
    )[0].id,
    "a",
  );
});
test("immutable launch, join retry, duplicate nickname, capacity and ownership", async () => {
  const s = await setup();
  await saveQuiz(
    owner,
    s.quiz.id,
    { ...s.quiz.draft, title: "Changed later" },
    1,
  );
  const req = {
    pin: s.room.pin,
    nickname: "A".repeat(25),
    avatar: { body: 2, mood: "smile" as const },
    joinRequestId: crypto.randomUUID(),
  };
  const first = await joinGame(req),
    retry = await joinGame(req);
  assert.equal(retry.token, first.token);
  const second = await player(s.room.pin, req.nickname);
  assert.ok(second.nickname.endsWith("_2"));
  assert.equal(second.nickname.length, 25);
  await db.query("UPDATE quiz_sessions SET capacity=2 WHERE id=$1", [
    s.room.id,
  ]);
  await assert.rejects(() => player(s.room.pin, "Extra"), {
    code: "ROOM_FULL",
  });
  const snap = await snapshot(s.room.id, {
    role: "player",
    token: first.token,
  });
  assert.equal(snap.title, "Live test");
  assert.equal(snap.playerCount, 2);
  assert.equal(snap.roster, undefined);
  assert.equal(snap.controller, undefined);
  await assert.rejects(() => snapshot(s.room.id, { role: "host", id: other }), {
    status: 404,
  });
});
test("answer exactly once, deadline closure, private results, unique final ranks", async () => {
  const s = await setup(),
    a = await player(s.room.pin),
    b = await player(s.room.pin, "Alex");
  await action(s, "START_GAME");
  await assert.rejects(() => player(s.room.pin, "Late"), {
    code: "ROOM_CLOSED",
  });
  const snap = await snapshot(s.room.id, { role: "player", token: a.token });
  assert.equal(snap.reveal, undefined);
  assert.equal(snap.result, undefined);
  assert.equal(JSON.stringify(snap).includes("correctOptionId"), false);
  const answer = {
    questionId: snap.question!.id,
    selectedOptionId: snap.question!.options[0].id,
    submissionId: crypto.randomUUID(),
  };
  const receivedAt = new Date(
    new Date(snap.question!.startsAt!).getTime() + 1800,
  );
  const acknowledged = await submitAnswer(
    s.room.id,
    a.token,
    answer,
    receivedAt,
  );
  const again = await submitAnswer(s.room.id, a.token, answer, new Date());
  assert.deepEqual(again, acknowledged);
  await assert.rejects(
    () =>
      submitAnswer(s.room.id, a.token, {
        ...answer,
        submissionId: crypto.randomUUID(),
      }),
    { code: "ALREADY_ANSWERED" },
  );
  assert.equal(
    (await snapshot(s.room.id, { role: "player", token: a.token })).self!.score,
    0,
  );
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE id=$1",
    [answer.questionId],
  );
  await reconcileSession(s.room.id);
  const result = await snapshot(s.room.id, { role: "player", token: a.token });
  assert.equal(result.state, "RESULT_REVEAL");
  assert.equal(result.result!.pointsEarned, 910);
  assert.equal(result.result!.status, "correct");
  assert.equal(result.result!.rank, 1);
  assert.equal(
    (await snapshot(s.room.id, { role: "player", token: b.token })).result!
      .status,
    "unanswered",
  );
  assert.deepEqual(
    await submitAnswer(s.room.id, a.token, answer),
    acknowledged,
  );
  await action(s, "SHOW_LEADERBOARD");
  await action(s, "FINISH_GAME");
  const final = await snapshot(s.room.id, { role: "host", id: owner });
  assert.equal(final.state, "COMPLETED");
  assert.deepEqual(
    final.top.map((p) => p.rank),
    [1, 2],
  );
});
test("control fencing, command retries, kicks and host inactivity", async () => {
  const s = await setup(),
    p = await player(s.room.pin);
  const original = await snapshot(s.room.id, { role: "host", id: owner });
  const kick = {
    controllerId: s.controllerId,
    generation: s.generation,
    expectedRevision: original.revision,
    commandId: crypto.randomUUID(),
    action: "KICK_PLAYER",
    participantId: p.participantId,
  };
  const outcome = await command(s.room.id, owner, kick);
  assert.deepEqual(await command(s.room.id, owner, kick), outcome);
  await assert.rejects(
    () => snapshot(s.room.id, { role: "player", token: p.token }),
    { status: 401 },
  );
  const second = crypto.randomUUID();
  await assert.rejects(() => claimControl(s.room.id, owner, second), {
    code: "CONTROL_HELD",
  });
  await claimControl(s.room.id, owner, second, true);
  await assert.rejects(
    () =>
      command(s.room.id, owner, {
        ...kick,
        commandId: crypto.randomUUID(),
        action: "CANCEL",
      }),
    { code: "CONTROL_LOST" },
  );
  await db.query(
    "UPDATE quiz_sessions SET host_last_seen_at=now()-interval '16 minutes' WHERE id=$1",
    [s.room.id],
  );
  const ended = await snapshot(s.room.id, { role: "host", id: owner });
  assert.equal(ended.state, "INTERRUPTED");
});
test("concurrent joins cannot overfill a lobby", async () => {
  const s = await setup();
  await db.query("UPDATE quiz_sessions SET capacity=1 WHERE id=$1", [
    s.room.id,
  ]);
  const joins = await Promise.allSettled([
    player(s.room.pin, "One"),
    player(s.room.pin, "Two"),
  ]);
  assert.equal(joins.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(joins.filter((r) => r.status === "rejected").length, 1);
});

test("ending an active game keeps accepted scores and isolates open-room recovery", async () => {
  const { listOpenGames } = await import("../src/lib/repository");
  const s = await setup();
  assert.ok((await listOpenGames(owner)).some((game) => game.id === s.room.id));
  assert.ok(
    !(await listOpenGames(other)).some((game) => game.id === s.room.id),
  );
  const p = await player(s.room.pin);
  await action(s, "START_GAME");
  const active = await snapshot(s.room.id, { role: "player", token: p.token });
  const answer = {
    questionId: active.question!.id,
    selectedOptionId: active.question!.options[0].id,
    submissionId: crypto.randomUUID(),
  };
  const ack = await submitAnswer(s.room.id, p.token, answer);
  await action(s, "END_EARLY");
  const ended = await snapshot(s.room.id, { role: "player", token: p.token });
  assert.equal(ended.state, "INTERRUPTED");
  assert.ok(ended.self!.score > 0);
  assert.deepEqual(await submitAnswer(s.room.id, p.token, answer), ack);
  assert.ok(
    !(await listOpenGames(owner)).some((game) => game.id === s.room.id),
  );
});

test("late rejection commits deadline recovery and duplicate jobs finalize only once", async () => {
  const { runScheduledJob, dispatchOutbox } =
    await import("../src/lib/live-delivery");
  const s = await setup(),
    p = await player(s.room.pin);
  await action(s, "START_GAME");
  const active = await snapshot(s.room.id, { role: "player", token: p.token });
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE id=$1",
    [active.question!.id],
  );
  await assert.rejects(
    () =>
      submitAnswer(s.room.id, p.token, {
        questionId: active.question!.id,
        selectedOptionId: active.question!.options[0].id,
        submissionId: crypto.randomUUID(),
      }),
    { code: "QUESTION_EXPIRED" },
  );
  assert.equal(
    (
      await db.query<{ state: string }>(
        "SELECT state FROM quiz_sessions WHERE id=$1",
        [s.room.id],
      )
    ).rows[0].state,
    "RESULT_REVEAL",
  );
  const job = (
    await db.query<{ id: string }>(
      "SELECT id FROM scheduled_jobs WHERE session_id=$1 AND kind='deadline'",
      [s.room.id],
    )
  ).rows[0];
  assert.ok(await runScheduledJob(job.id));
  assert.equal(
    (
      await db.query<{ completed_at: Date | null }>(
        "SELECT completed_at FROM scheduled_jobs WHERE id=$1",
        [job.id],
      )
    ).rows[0].completed_at,
    null,
  );
  await db.query(
    "UPDATE scheduled_jobs SET due_at=now()-interval '1 second' WHERE id=$1",
    [job.id],
  );
  await Promise.all([runScheduledJob(job.id), runScheduledJob(job.id)]);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM question_results WHERE session_id=$1",
        [s.room.id],
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(() =>
    dispatchOutbox(async () => {
      throw new Error("Injected provider outage");
    }),
  );
  assert.ok(
    (await db.query("SELECT id FROM live_outbox WHERE delivered_at IS NULL"))
      .rows.length > 0,
  );
  const notices: unknown[] = [];
  await Promise.all([
    dispatchOutbox(async (_channel, notice) => {
      notices.push(notice);
    }),
    dispatchOutbox(async (_channel, notice) => {
      notices.push(notice);
    }),
  ]);
  assert.ok(notices.length > 0);
  for (const notice of notices)
    assert.deepEqual(Object.keys(notice as object).sort(), [
      "emittedAt",
      "eventId",
      "kind",
      "sessionId",
      "stateRevision",
    ]);
  assert.equal(
    (await db.query("SELECT id FROM live_outbox WHERE delivered_at IS NULL"))
      .rows.length,
    0,
  );
});

test("final intro hides content, preserves full answering time, freezes reveal facts and tolerates job retries", async () => {
  const s = await setup();
  s.q.revealFact = "A short fact shown only after the question closes.";
  const quiz = await saveQuiz(
    owner,
    s.quiz.id,
    { ...s.quiz.draft, questions: [s.q] },
    1,
  );
  // A fresh launch captures the new fact; the earlier launch stays immutable.
  const room = await createGame(
    owner,
    {
      quizId: quiz.id,
      expectedQuizRevision: quiz.revision,
      key: crypto.randomUUID(),
    },
    "http://localhost:3000",
  );
  const guest = await player(room.pin);
  const controllerId = crypto.randomUUID();
  const lease = await claimControl(room.id, owner, controllerId);
  const input = {
    controllerId,
    generation: lease.generation,
    expectedRevision: (await snapshot(room.id, { role: "host", id: owner }))
      .revision,
    commandId: crypto.randomUUID(),
    action: "START_GAME",
  };
  const first = await command(room.id, owner, input);
  assert.equal(first.state, "QUESTION_INTRO");
  const intro = await snapshot(room.id, { role: "player", token: guest.token });
  assert.equal(intro.question, null);
  assert.equal(intro.reveal, undefined);
  assert.equal(intro.intro?.questionIndex, 1);
  const deadline = intro.intro!.endsAt;
  await command(room.id, owner, input);
  assert.equal(
    (await snapshot(room.id, { role: "player", token: guest.token })).intro!
      .endsAt,
    deadline,
  );
  const raw = (
    await db.query<{
      id: string;
      correct_option_id: string;
      starts_at: Date | null;
    }>("SELECT * FROM session_questions WHERE session_id=$1", [room.id])
  ).rows[0];
  assert.equal(raw.starts_at, null);
  await assert.rejects(
    submitAnswer(room.id, guest.token, {
      questionId: raw.id,
      selectedOptionId: raw.correct_option_id,
      submissionId: crypto.randomUUID(),
    }),
  );
  const { runScheduledJob } = await import("../src/lib/live-delivery");
  const job = (
    await db.query<{ id: string }>(
      "SELECT id FROM scheduled_jobs WHERE session_id=$1 AND kind='intro'",
      [room.id],
    )
  ).rows[0];
  assert.ok(await runScheduledJob(job.id));
  await db.query(
    "UPDATE quiz_sessions SET intro_ends_at=now()-interval '5 seconds' WHERE id=$1",
    [room.id],
  );
  await db.query(
    "UPDATE scheduled_jobs SET due_at=now()-interval '5 seconds' WHERE id=$1",
    [job.id],
  );
  const resumedAt = Date.now();
  await Promise.all([runScheduledJob(job.id), runScheduledJob(job.id)]);
  const active = await snapshot(room.id, {
    role: "player",
    token: guest.token,
  });
  assert.equal(active.state, "QUESTION_ACTIVE");
  assert.equal(active.intro, undefined);
  assert.equal(active.reveal, undefined);
  assert.equal(
    (active.question as unknown as Record<string, unknown>).revealFact,
    undefined,
  );
  assert.equal(
    new Date(active.question!.endsAt!).getTime() -
      new Date(active.question!.startsAt!).getTime(),
    10000,
  );
  assert.ok(new Date(active.question!.startsAt!).getTime() >= resumedAt);
  await assert.rejects(
    submitAnswer(
      room.id,
      guest.token,
      {
        questionId: raw.id,
        selectedOptionId: raw.correct_option_id,
        submissionId: crypto.randomUUID(),
      },
      new Date(new Date(active.question!.startsAt!).getTime() - 1),
    ),
  );
  const start = active.question!.startsAt;
  await runScheduledJob(job.id);
  assert.equal(
    (await snapshot(room.id, { role: "player", token: guest.token })).question!
      .startsAt,
    start,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM scheduled_jobs WHERE session_id=$1 AND kind='deadline'",
        [room.id],
      )
    ).rows[0].count,
    1,
  );
  await saveQuiz(
    owner,
    quiz.id,
    {
      ...quiz.draft,
      questions: [{ ...s.q, revealFact: "An edited draft fact." }],
    },
    quiz.revision,
  );
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE session_id=$1",
    [room.id],
  );
  const reveal = await snapshot(room.id, {
    role: "player",
    token: guest.token,
  });
  assert.equal(reveal.reveal!.fact, s.q.revealFact);
  assert.equal(
    (
      await db.query<{ reveal_fact: string | null }>(
        "SELECT reveal_fact FROM session_questions WHERE session_id=$1",
        [s.room.id],
      )
    ).rows[0].reveal_fact,
    null,
  );
});

test("only the last question has an intro; interruption during intro does not start a timer", async () => {
  const s = await setup();
  const quiz = await saveQuiz(
    owner,
    s.quiz.id,
    { ...s.quiz.draft, questions: [s.q, { ...s.q, id: crypto.randomUUID() }] },
    1,
  );
  const room = await createGame(
    owner,
    {
      quizId: quiz.id,
      expectedQuizRevision: quiz.revision,
      key: crypto.randomUUID(),
    },
    "http://localhost:3000",
  );
  await player(room.pin);
  const controllerId = crypto.randomUUID(),
    lease = await claimControl(room.id, owner, controllerId);
  const act = async (action: string) =>
    command(room.id, owner, {
      controllerId,
      generation: lease.generation,
      expectedRevision: (await snapshot(room.id, { role: "host", id: owner }))
        .revision,
      commandId: crypto.randomUUID(),
      action,
    });
  assert.equal((await act("START_GAME")).state, "QUESTION_ACTIVE");
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE session_id=$1 AND question_index=1",
    [room.id],
  );
  assert.equal((await act("NEXT_QUESTION")).state, "QUESTION_INTRO");
  const intro = await snapshot(room.id, { role: "host", id: owner });
  assert.equal(intro.intro?.questionIndex, 2);
  await act("END_EARLY");
  await reconcileSession(room.id);
  const final = await snapshot(room.id, { role: "host", id: owner });
  assert.equal(final.state, "INTERRUPTED");
  assert.equal(
    (
      await db.query<{ starts_at: Date | null }>(
        "SELECT starts_at FROM session_questions WHERE session_id=$1 AND question_index=2",
        [room.id],
      )
    ).rows[0].starts_at,
    null,
  );
});

test("next question cannot advance during answering or beyond the final reveal", async () => {
  const s = await setup();
  await player(s.room.pin);
  await action(s, "START_GAME");
  await assert.rejects(action(s, "NEXT_QUESTION"));
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE session_id=$1",
    [s.room.id],
  );
  await reconcileSession(s.room.id);
  await assert.rejects(action(s, "NEXT_QUESTION"), /no more questions/i);
  assert.equal(
    (await snapshot(s.room.id, { role: "host", id: owner })).state,
    "RESULT_REVEAL",
  );
  await action(s, "SHOW_LEADERBOARD");
  assert.equal((await action(s, "FINISH_GAME")).state, "COMPLETED");
});
