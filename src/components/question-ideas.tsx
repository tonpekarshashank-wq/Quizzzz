"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_QUESTIONS, type Question } from "@/lib/model";
import {
  ideaCategories,
  toQuestionIdea,
  type IdeasPage,
  type IdeaCategory,
  type QuestionIdea,
} from "@/lib/question-ideas";
import { api } from "@/lib/client";
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
  const [ideas, setIdeas] = useState<QuestionIdea[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  async function load(cursor: string | null, requestId = generation.current) {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ category, limit: "30" });
    if (cursor) query.set("cursor", cursor);
    try {
      const page = await api<IdeasPage>(`question-ideas?${query}`);
      if (generation.current !== requestId) return;
      setIdeas((previous) =>
        cursor
          ? [...previous, ...page.items.map(toQuestionIdea)].filter(
              (item, index, all) =>
                all.findIndex((i) => i.id === item.id) === index,
            )
          : page.items.map(toQuestionIdea),
      );
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch {
      if (generation.current === requestId)
        setError("Couldn't load question ideas. Please try again.");
    } finally {
      if (generation.current === requestId) setLoading(false);
    }
  }
  useEffect(() => {
    const requestId = ++generation.current;
    setIdeas([]);
    setTotal(0);
    setNextCursor(null);
    void load(null, requestId);
    return () => {
      generation.current++;
    };
  }, [category]);
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
        <Chip>{loading && !ideas.length ? "Loading…" : `${total} ideas`}</Chip>
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
      <div
        className="ideas-list"
        tabIndex={0}
        aria-label="Question ideas list"
        aria-busy={loading}
      >
        {loading && (
          <>
            <span className="sr-only">Loading question ideas</span>
            {[0, 1, 2].map((i) => (
              <div
                className="card idea-card idea-skeleton"
                aria-hidden="true"
                key={`skeleton-${i}`}
              >
                <div />
                <div />
                <div />
              </div>
            ))}
          </>
        )}
        {!loading && !error && ideas.length === 0 && (
          <p>No ideas in this category yet</p>
        )}
        {error && (
          <div className="card idea-card" role="alert">
            <p>{error}</p>
            <button
              className="button secondary small"
              onClick={() => void load(ideas.length ? nextCursor : null)}
            >
              Retry
            </button>
          </div>
        )}
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
        {nextCursor && !error && (
          <button
            className="button secondary small idea-more"
            disabled={loading}
            onClick={() => void load(nextCursor)}
          >
            Load more ideas
          </button>
        )}
      </div>
    </aside>
  );
}
