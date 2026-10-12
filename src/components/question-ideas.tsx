"use client";
import { useState } from "react";
import { MAX_QUESTIONS, type Question } from "@/lib/model";
import {
  ideaCategories,
  questionIdeas,
  type IdeaCategory,
  type QuestionIdea,
} from "@/lib/question-ideas";
import { AnswerKey, Chip } from "./ui";
export function QuestionIdeas({
  questions,
  onAdd,
  visible,
}: {
  questions: Question[];
  onAdd: (idea: QuestionIdea) => void;
  visible: boolean;
}) {
  const [category, setCategory] = useState<IdeaCategory>("All");
  const ideas = questionIdeas.filter(
    (idea) => category === "All" || idea.category === category,
  );
  const added = new Set(questions.map((q) => q.sourceIdeaId));
  const full = questions.length >= MAX_QUESTIONS;
  return (
    <aside
      id="question-ideas"
      aria-labelledby="ideas-heading"
      className={`ideas-panel ${visible ? "visible" : ""}`}
    >
      <div className="ideas-heading">
        <h2 id="ideas-heading">Question ideas</h2>
        <Chip>{ideas.length} ideas</Chip>
      </div>
      <p className="ideas-help">
        Tap Add to drop one into your quiz. Edit it after.
      </p>
      <div className="idea-filters" role="group" aria-label="Idea categories">
        {ideaCategories.map((item) => (
          <button
            key={item}
            className="button secondary small"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {full && (
        <p className="ideas-limit" role="status">
          Quiz limit reached ({MAX_QUESTIONS} questions). Delete a question to
          add another.
        </p>
      )}
      <div className="ideas-list" tabIndex={0} aria-label="Question ideas list">
        {ideas.map((idea) => (
          <article
            className="card idea-card"
            key={idea.id}
            aria-label={idea.prompt}
          >
            <div className="idea-meta">
              <Chip>{idea.category}</Chip>
              <span>
                {idea.type === "mc" ? "Multiple choice" : "True / False"}
              </span>
            </div>
            <p className="idea-settings">
              {idea.timeLimit}s · {idea.basePoints / 1000}× pts
            </p>
            <h3>{idea.prompt}</h3>
            <div className="idea-answers">
              {idea.answers.map((answer, index) => (
                <div
                  key={index}
                  className={`idea-answer ${index === idea.correctIndex ? "correct" : ""}`}
                >
                  <AnswerKey
                    index={idea.type === "tf" ? (index === 0 ? 1 : 0) : index}
                  />
                  <span>{answer}</span>
                  {index === idea.correctIndex && (
                    <span aria-label="Correct answer">✓</span>
                  )}
                </div>
              ))}
            </div>
            {added.has(idea.id) ? (
              <span className="chip idea-added">✓ Added</span>
            ) : (
              <button
                className="button primary small"
                disabled={full}
                aria-label={`Add: ${idea.prompt}`}
                onClick={() => onAdd(idea)}
              >
                Add
              </button>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
