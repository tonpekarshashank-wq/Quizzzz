import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { database } from "../src/lib/db";
import {
  createQuiz,
  getQuiz,
  saveQuiz,
  archiveQuiz,
  listQuizzes,
} from "../src/lib/repository";
import {
  draftSchema,
  emptyDraft,
  newQuestion,
  launchErrors,
} from "../src/lib/model";
import {
  hashPassword,
  verifyPassword,
  createSession,
  digest,
  limit,
} from "../src/lib/security";
const dir = await mkdtemp(path.join(tmpdir(), "quizzzz-unit-"));
process.env.DATA_DIR = dir;
const db = await database();
const alice = crypto.randomUUID(),
  bob = crypto.randomUUID();
for (const id of [alice, bob])
  await db.query(
    "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,'Host','unused')",
    [id, `${id}@example.com`],
  );
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
test("owner isolation, atomic concurrent saves, archive", async () => {
  const q = await createQuiz(alice, emptyDraft);
  await assert.rejects(() => getQuiz(bob, q.id), { status: 404 });
  await assert.rejects(
    () => saveQuiz(bob, q.id, { ...emptyDraft, title: "Stolen" }, 1),
    { status: 404 },
  );
  await assert.rejects(() => archiveQuiz(bob, q.id), { status: 404 });
  const results = await Promise.allSettled([
    saveQuiz(alice, q.id, { ...emptyDraft, title: "A" }, 1),
    saveQuiz(alice, q.id, { ...emptyDraft, title: "B" }, 1),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal((await getQuiz(alice, q.id)).revision, 2);
  await archiveQuiz(alice, q.id);
  await assert.rejects(() => getQuiz(alice, q.id), { status: 404 });
  assert.equal((await listQuizzes(alice)).items.length, 0);
});
test("single correct option membership, true/false and launch validation", () => {
  const q = newQuestion("mc");
  assert.equal(
    draftSchema.safeParse({ ...emptyDraft, questions: [q] }).success,
    true,
  );
  assert.equal(launchErrors({ ...emptyDraft, questions: [q] }).length, 3);
  assert.equal(
    draftSchema.safeParse({
      ...emptyDraft,
      questions: [{ ...q, correctOptionId: crypto.randomUUID() }],
    }).success,
    false,
  );
  const tf = newQuestion("tf");
  assert.equal(tf.timeLimit, 30);
  tf.options[0].label = "Changed";
  assert.equal(
    draftSchema.safeParse({ ...emptyDraft, questions: [tf] }).success,
    false,
  );
  assert.equal(
    draftSchema.safeParse({
      ...emptyDraft,
      coverImageUrl: "http://unsafe.example",
    }).success,
    false,
  );
});
test("password hashes and durable session tokens", async () => {
  const hash = await hashPassword("a-good-password");
  assert.ok(await verifyPassword("a-good-password", hash));
  assert.equal(await verifyPassword("a-wrong-password", hash), false);
  const raw = await createSession(db, alice);
  const stored = await db.query(
    "SELECT token_hash FROM host_sessions WHERE token_hash=$1",
    [digest(raw)],
  );
  assert.equal(stored.rows.length, 1);
  assert.notEqual(stored.rows[0].token_hash, raw);
});
test("rate limit is persisted and atomic", async () => {
  await limit("test-key", 2);
  await limit("test-key", 2);
  await assert.rejects(() => limit("test-key", 2), { status: 429 });
});
