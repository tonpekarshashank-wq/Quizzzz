import { test } from "node:test";
import assert from "node:assert/strict";
import { questionIdeas, questionFromIdea } from "../src/lib/question-ideas";
import { draftSchema, emptyDraft, launchErrors } from "../src/lib/model";
test("idea library creates independently editable, valid questions with stable provenance", () => {
  assert.equal(
    new Set(questionIdeas.map((i) => i.id)).size,
    questionIdeas.length,
  );
  for (const idea of questionIdeas) {
    const a = questionFromIdea(idea),
      b = questionFromIdea(idea);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.options[0].id, b.options[0].id);
    assert.equal(a.correctOptionId, a.options[idea.correctIndex].id);
    const draft = draftSchema.parse({ ...emptyDraft, questions: [a] });
    assert.deepEqual(launchErrors(draft), []);
    assert.equal(draft.questions[0].sourceIdeaId, idea.id);
    a.options[0].label = "Edited";
    assert.notEqual(b.options[0].label, "Edited");
    assert.notEqual(idea.answers[0], "Edited");
  }
});
