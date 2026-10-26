import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { database } from "../src/lib/db";
import { createQuiz } from "../src/lib/repository";
import { emptyDraft, newQuestion } from "../src/lib/model";
import {
  createGame,
  claimControl,
  joinGame,
  command,
  submitAnswer,
  snapshot,
} from "../src/lib/game";
import { runScheduledJob } from "../src/lib/live-delivery";
const db = await database(),
  file = path.join(process.env.DATA_DIR!, "recovery-fixture.json");
if (process.argv[2] === "seed") {
  const owner = crypto.randomUUID();
  await db.query(
    "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,'Recovery','unused')",
    [owner, `${owner}@example.com`],
  );
  const q = newQuestion("tf");
  q.prompt = "Recovery keeps my answer.";
  q.timeLimit = 10;
  q.correctOptionId = q.options[0].id;
  const quiz = await createQuiz(owner, {
    ...emptyDraft,
    title: "Process recovery",
    questions: [q],
  });
  const room = await createGame(
    owner,
    { quizId: quiz.id, expectedQuizRevision: 1, key: crypto.randomUUID() },
    "http://localhost:3000",
  );
  const controllerId = crypto.randomUUID(),
    lease = await claimControl(room.id, owner, controllerId);
  const player = await joinGame({
    pin: room.pin,
    nickname: "Persistent player",
    avatar: { body: 0, mood: "smile" },
    joinRequestId: crypto.randomUUID(),
  });
  const before = await snapshot(room.id, { role: "host", id: owner });
  await command(room.id, owner, {
    controllerId,
    generation: lease.generation,
    expectedRevision: before.revision,
    commandId: crypto.randomUUID(),
    action: "START_GAME",
  });
  await db.query(
    "UPDATE quiz_sessions SET intro_ends_at=now()-interval '1 second' WHERE id=$1 AND state='QUESTION_INTRO'",
    [room.id],
  );
  const active = await snapshot(room.id, {
    role: "player",
    token: player.token,
  });
  const answer = {
    questionId: active.question!.id,
    selectedOptionId: active.question!.options[0].id,
    submissionId: crypto.randomUUID(),
  };
  const ack = await submitAnswer(room.id, player.token, answer);
  await db.query(
    "UPDATE session_questions SET ends_at=now()-interval '1 second' WHERE id=$1",
    [answer.questionId],
  );
  await db.query(
    "UPDATE scheduled_jobs SET due_at=now()-interval '1 second' WHERE session_id=$1 AND kind='deadline'",
    [room.id],
  );
  const introRoom = await createGame(
    owner,
    { quizId: quiz.id, expectedQuizRevision: 1, key: crypto.randomUUID() },
    "http://localhost:3000",
  );
  const introLease = await claimControl(introRoom.id, owner, controllerId);
  const introPlayer = await joinGame({
    pin: introRoom.pin,
    nickname: "Intro recovery",
    avatar: { body: 0, mood: "smile" },
    joinRequestId: crypto.randomUUID(),
  });
  await command(introRoom.id, owner, {
    controllerId,
    generation: introLease.generation,
    expectedRevision: (
      await snapshot(introRoom.id, { role: "host", id: owner })
    ).revision,
    commandId: crypto.randomUUID(),
    action: "START_GAME",
  });
  await writeFile(
    file,
    JSON.stringify({
      owner,
      room,
      player,
      answer,
      ack,
      introRoom,
      introPlayer,
    }),
  );
  console.log("Synthetic answer committed; process exiting before closure.");
} else {
  const { owner, room, player, answer, ack, introRoom, introPlayer } =
    JSON.parse(await readFile(file, "utf8"));
  assert.equal(
    (
      await db.query<{ state: string }>(
        "SELECT state FROM quiz_sessions WHERE id=$1",
        [introRoom.id],
      )
    ).rows[0].state,
    "QUESTION_INTRO",
  );
  assert.equal(
    (
      await db.query<{ starts_at: Date | null }>(
        "SELECT starts_at FROM session_questions WHERE session_id=$1",
        [introRoom.id],
      )
    ).rows[0].starts_at,
    null,
  );
  await db.query(
    "UPDATE quiz_sessions SET intro_ends_at=now()-interval '1 second' WHERE id=$1",
    [introRoom.id],
  );
  await db.query(
    "UPDATE scheduled_jobs SET due_at=now()-interval '1 second' WHERE session_id=$1 AND kind='intro'",
    [introRoom.id],
  );
  const introJob = (
    await db.query<{ id: string }>(
      "SELECT id FROM scheduled_jobs WHERE session_id=$1 AND kind='intro'",
      [introRoom.id],
    )
  ).rows[0];
  await Promise.all([
    runScheduledJob(introJob.id),
    runScheduledJob(introJob.id),
  ]);
  const resumed = await snapshot(introRoom.id, {
    role: "player",
    token: introPlayer.token,
  });
  assert.equal(resumed.state, "QUESTION_ACTIVE");
  assert.equal(
    new Date(resumed.question!.endsAt!).getTime() -
      new Date(resumed.question!.startsAt!).getTime(),
    10000,
  );
  const jobs = (
    await db.query<{ id: string }>(
      "SELECT id FROM scheduled_jobs WHERE session_id=$1 AND kind='deadline'",
      [room.id],
    )
  ).rows;
  await Promise.all([runScheduledJob(jobs[0].id), runScheduledJob(jobs[0].id)]);
  const recovered = await snapshot(room.id, {
    role: "player",
    token: player.token,
  });
  assert.equal(recovered.state, "RESULT_REVEAL");
  assert.equal(recovered.result!.status, "correct");
  assert.ok(recovered.self!.score > 0);
  assert.deepEqual(await submitAnswer(room.id, player.token, answer), ack);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM responses WHERE session_id=$1",
        [room.id],
      )
    ).rows[0].count,
    1,
  );
  await db.query(
    "UPDATE quiz_sessions SET host_last_seen_at=now()-interval '16 minutes' WHERE id=$1",
    [room.id],
  );
  assert.equal(
    (await snapshot(room.id, { role: "host", id: owner })).state,
    "INTERRUPTED",
  );
  assert.deepEqual(await submitAnswer(room.id, player.token, answer), ack);
  console.log(
    "Restart recovered closure, score, idempotent acknowledgement and interruption.",
  );
}
process.exit(0);
