import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { database } from "../src/lib/db";
import { listQuestionIdeas } from "../src/lib/idea-repository";
import {
  questionFromIdea,
  toQuestionIdea,
  contentCategories,
} from "../src/lib/question-ideas";
import { draftSchema, emptyDraft, launchErrors } from "../src/lib/model";
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "quizzzz-ideas-"));
test("all database-seeded ideas are valid independent copies; category/cursor pagination is bounded", async () => {
  const page = await listQuestionIdeas(new URLSearchParams({ limit: "50" }));
  assert.equal(page.total, 42);
  assert.equal(page.items.length, 42);
  assert.equal(page.nextCursor, null);
  assert.equal(new Set(page.items.map((i) => i.id)).size, 42);
  for (const item of page.items) {
    assert.ok(item.revealFact && item.revealFact.length <= 160);
    const idea = toQuestionIdea(item),
      a = questionFromIdea(idea),
      b = questionFromIdea(idea);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.options[0].id, b.options[0].id);
    assert.equal(a.revealFact, item.revealFact);
    assert.equal(a.correctOptionId, a.options[idea.correctIndex].id);
    const draft = draftSchema.parse({ ...emptyDraft, questions: [a] });
    assert.deepEqual(launchErrors(draft), []);
    assert.equal(draft.questions[0].sourceIdeaId, item.id);
    a.options[0].label = "Edited";
    assert.notEqual(b.options[0].label, "Edited");
    assert.notEqual(item.options[0], "Edited");
  }
  for (const category of contentCategories) {
    const filtered = await listQuestionIdeas(new URLSearchParams({ category }));
    assert.equal(
      filtered.total,
      {
        Science: 8,
        Tech: 8,
        Geography: 8,
        "Work safety": 7,
        General: 9,
        Sports: 2,
      }[category],
    );
    assert(filtered.items.every((i) => i.category === category));
  }
  const sports = await listQuestionIdeas(
    new URLSearchParams({ category: "Sports" }),
  );
  assert.deepEqual(
    sports.items.map((i) => i.options[i.correctIndex]),
    ["Three wickets taken by a bowler on consecutive deliveries", "Love"],
  );
  assert(
    sports.items.every(
      (i) => i.timeSeconds === 20 && i.points === 1000 && i.revealFact,
    ),
  );
  const approvedAnswers = {
    "tech-gps": "Global Positioning System",
    "science-photosynthesis": "Carbon dioxide",
    "geography-colosseum": "Rome",
    "general-chess-knight": "Knight",
    "general-bohemian-rhapsody": "Queen",
    "tech-wireless-router": "Wireless router",
    "safety-payment-verification":
      "Verify through a known, trusted contact method",
    "geography-machu-picchu": "Peru",
    "general-al-dente": "Firm to the bite",
    "science-heart": "Heart",
  };
  for (const [id, answer] of Object.entries(approvedAnswers)) {
    const item = page.items.find((i) => i.id === id)!;
    assert.ok(item);
    assert.equal(item.options[item.correctIndex], answer);
    assert.equal(item.timeSeconds, 20);
    assert.equal(item.points, 1000);
  }
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "7" });
    if (cursor) query.set("cursor", cursor);
    const result = await listQuestionIdeas(query);
    ids.push(...result.items.map((i) => i.id));
    cursor = result.nextCursor;
  } while (cursor);
  assert.deepEqual(
    ids,
    page.items.map((i) => i.id),
  );
  const first = await listQuestionIdeas(
    new URLSearchParams({ category: "Science", limit: "2" }),
  );
  await assert.rejects(
    listQuestionIdeas(
      new URLSearchParams({ category: "Tech", cursor: first.nextCursor! }),
    ),
    /Invalid cursor/,
  );
  for (const query of [
    "limit=0",
    "limit=51",
    "limit=2.5",
    "category=Unknown",
    "cursor=garbage",
  ])
    await assert.rejects(listQuestionIdeas(new URLSearchParams(query)));
  const db = await database();
  const row = page.items[0];
  await db.query("UPDATE question_ideas SET active=false WHERE id=$1", [
    row.id,
  ]);
  assert.equal((await listQuestionIdeas(new URLSearchParams())).total, 41);
  await db.query(
    "UPDATE question_ideas SET active=true, content=jsonb_set(content,'{correctIndex}','99'::jsonb) WHERE id=$1",
    [row.id],
  );
  await assert.rejects(
    listQuestionIdeas(new URLSearchParams()),
    /temporarily unavailable/,
  );
});
