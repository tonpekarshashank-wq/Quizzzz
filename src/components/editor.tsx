"use client";
import { useRouter } from "next/navigation";
import { gameApi } from "@/lib/game-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientError } from "@/lib/client";
import {
  MAX_QUESTIONS,
  launchErrors,
  newQuestion,
  points,
  times,
  type Draft,
  type Question,
  type Quiz,
} from "@/lib/model";
import { Dialog } from "./dialog";
import { AnswerKey, Blob, Chip, Segments } from "./ui";
import { QuestionIdeas } from "./question-ideas";
import { questionFromIdea, type QuestionIdea } from "@/lib/question-ideas";
type Status = "saved" | "waiting" | "saving" | "failed" | "conflict";
export function Editor({ initial }: { initial: Quiz }) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const launchRequest = useRef<{ revision: number; key: string } | null>(null);
  const [draft, setDraft] = useState(initial.draft);
  const [selected, setSelected] = useState(
    initial.draft.questions[0]?.id ?? "",
  );
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState("");
  const [ideasVisible, setIdeasVisible] = useState(false);
  const [checks, setChecks] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addAnnouncement, setAddAnnouncement] = useState("");
  const pendingFocus = useRef<string | null>(null);
  const current = useRef(initial.draft);
  const revision = useRef(initial.revision);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const saving = useRef(false);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), 750);
  }, []);
  const save = useCallback(async () => {
    if (
      saving.current ||
      blocked.current ||
      version.current === savedVersion.current
    )
      return;
    saving.current = true;
    const sentVersion = version.current;
    const sent = current.current;
    setStatus("saving");
    setError("");
    try {
      const q = await api<Quiz>(`quizzes/${initial.id}`, "PUT", {
        draft: sent,
        expectedRevision: revision.current,
      });
      revision.current = q.revision;
      savedVersion.current = sentVersion;
      if (mounted.current) {
        setStatus(version.current === sentVersion ? "saved" : "waiting");
        if (version.current !== sentVersion) schedule();
      }
    } catch (e) {
      blocked.current = true;
      if (mounted.current) {
        setStatus(
          e instanceof ClientError && e.code === "SAVE_CONFLICT"
            ? "conflict"
            : "failed",
        );
        setError(
          e instanceof ClientError && e.fields
            ? Object.values(e.fields).join(" ")
            : (e as Error).message,
        );
      }
    } finally {
      saving.current = false;
    }
  }, [initial.id, schedule]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    mounted.current = true;
    const warn = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("beforeunload", warn);
    };
  }, []);
  function change(next: Draft) {
    current.current = next;
    version.current++;
    setDraft(next);
    if (!blocked.current) {
      setStatus("waiting");
      schedule();
    }
  }
  function update(id: string, patch: Partial<Question>) {
    change({
      ...current.current,
      questions: current.current.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  }
  function append(q: Question) {
    if (current.current.questions.length >= MAX_QUESTIONS) return;
    pendingFocus.current = q.id;
    change({
      ...current.current,
      questions: [...current.current.questions, q],
    });
    setSelected(q.id);
    setAddAnnouncement(
      `Question added as number ${current.current.questions.length}`,
    );
  }
  function add(type: "mc" | "tf") {
    append(newQuestion(type));
  }
  function addIdea(idea: QuestionIdea) {
    if (current.current.questions.some((q) => q.sourceIdeaId === idea.id))
      return;
    append(questionFromIdea(idea));
  }
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const field = document.getElementById(`prompt-${id}`);
    if (field) {
      pendingFocus.current = null;
      field.scrollIntoView({ block: "center" });
      field.focus({ preventScroll: true });
    }
  }, [draft.questions, selected]);
  function move(id: string, dir: number) {
    const qs = [...current.current.questions];
    const i = qs.findIndex((q) => q.id === id),
      j = i + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    change({ ...current.current, questions: qs });
  }
  function download() {
    const url = URL.createObjectURL(
      new window.Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "quizzzz-draft-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const errors = checks ? launchErrors(draft) : [];
  return (
    <>
      <header className="nav editor-nav">
        <Link
          className="brand"
          href="/quizzes"
          onClick={(e) => {
            if (
              version.current !== savedVersion.current &&
              !confirm("Your latest edits have not saved. Leave this page?")
            )
              e.preventDefault();
          }}
        >
          quizzzz<span>✳</span>
        </Link>
        <div className="editor-title">
          <strong>{draft.title || "Untitled quiz"}</strong>
        </div>
        <div className="editor-nav-actions">
          <span className={`save-status ${status}`} role="status">
            {status === "saved"
              ? "✓ Saved"
              : status === "saving"
                ? "Saving…"
                : status === "waiting"
                  ? "Unsaved changes"
                  : status === "conflict"
                    ? "Save conflict"
                    : "Save failed"}
          </span>
          <button
            className="button secondary small"
            disabled={launching || status !== "saved"}
            onClick={async () => {
              setChecks(true);
              if (
                launchErrors(current.current).length ||
                version.current !== savedVersion.current
              )
                return;
              setLaunching(true);
              setError("");
              if (launchRequest.current?.revision !== revision.current)
                launchRequest.current = {
                  revision: revision.current,
                  key: crypto.randomUUID(),
                };
              try {
                const room = await gameApi<{ id: string }>(
                  "sessions",
                  "POST",
                  {
                    quizId: initial.id,
                    expectedQuizRevision: revision.current,
                  },
                  undefined,
                  launchRequest.current.key,
                );
                router.push(`/host/${room.id}`);
              } catch (e) {
                setError((e as Error).message);
                setLaunching(false);
              }
            }}
          >
            {launching ? "Opening lobby…" : "Go live ↗"}
          </button>
        </div>
      </header>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {addAnnouncement}
      </span>
      <main id="main" className="builder">
        <section className="builder-content">
          <Link
            href="/quizzes"
            className="text-link back-link"
            onClick={(e) => {
              if (
                version.current !== savedVersion.current &&
                !confirm("Your latest edits have not saved. Leave this page?")
              )
                e.preventDefault();
            }}
          >
            ← My quizzes
          </Link>
          <div className="builder-heading">
            <div>
              <h1>Make it a good question.</h1>
              <p>
                {draft.questions.length}{" "}
                {draft.questions.length === 1 ? "question" : "questions"} ·
                about{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    draft.questions.reduce((n, q) => n + q.timeLimit + 8, 0) /
                      60,
                  ),
                )}{" "}
                min · up to{" "}
                {draft.questions
                  .reduce((n, q) => n + q.basePoints, 0)
                  .toLocaleString()}{" "}
                pts
              </p>
            </div>
            <button
              className="button secondary small ideas-toggle"
              aria-expanded={ideasVisible}
              aria-controls="question-ideas"
              onClick={() => setIdeasVisible(!ideasVisible)}
            >
              Question ideas
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
              {status === "failed" && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    blocked.current = false;
                    void save();
                  }}
                >
                  Retry save
                </button>
              )}
              {status === "conflict" && (
                <div className="card-actions">
                  <button className="button secondary small" onClick={download}>
                    Download my edits
                  </button>
                  <button
                    className="button secondary small"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Load the latest saved quiz? Download your edits first to keep them.",
                        )
                      )
                        return;
                      try {
                        const q = await api<Quiz>(`quizzes/${initial.id}`);
                        revision.current = q.revision;
                        current.current = q.draft;
                        version.current = 0;
                        savedVersion.current = 0;
                        blocked.current = false;
                        setDraft(q.draft);
                        setStatus("saved");
                        setError("");
                        setSelected(q.draft.questions[0]?.id ?? "");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Load latest
                  </button>
                </div>
              )}
            </div>
          )}
          {errors.length > 0 && (
            <div className="error" role="alert">
              <strong>A few things to finish:</strong>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="metadata card" open>
            <summary>Quiz details</summary>
            <div className="metadata-fields">
              <label>
                Quiz name
                <input
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) => change({ ...draft, title: e.target.value })}
                />
                <span className="hint">{draft.title.length}/120</span>
              </label>
            </div>
          </details>
          {!draft.questions.length && (
            <div className="card builder-empty">
              <Blob body={3} size={85} mood="grin" />
              <h2>Every quiz starts with one.</h2>
              <p>
                Add a multiple choice question or a true/false statement below.
              </p>
            </div>
          )}
          <div className="question-stack">
            {draft.questions.map((q, i) => {
              const open = selected === q.id;
              return (
                <section
                  className={`question-card card ${open ? "open" : ""}`}
                  key={q.id}
                >
                  <div className="question-header">
                    <button
                      className="question-select"
                      aria-expanded={open}
                      onClick={() => setSelected(open ? "" : q.id)}
                    >
                      <span className={`number number-${i % 4}`}>{i + 1}</span>
                      <span>
                        {open
                          ? q.type === "mc"
                            ? "MULTIPLE CHOICE"
                            : "TRUE / FALSE"
                          : q.prompt || "Your next question"}
                      </span>
                    </button>
                    <div className="reorder">
                      <button
                        aria-label={`Move question ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => move(q.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move question ${i + 1} down`}
                        disabled={i === draft.questions.length - 1}
                        onClick={() => move(q.id, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className="question-body">
                      <label className="prompt-label">
                        Question{" "}
                        <span className="hint">{q.prompt.length}/250</span>
                        <textarea
                          id={`prompt-${q.id}`}
                          aria-label={`Question ${i + 1} prompt`}
                          placeholder="What will you ask?"
                          value={q.prompt}
                          maxLength={250}
                          onChange={(e) =>
                            update(q.id, { prompt: e.target.value })
                          }
                          aria-invalid={checks && !q.prompt.trim()}
                        />
                      </label>
                      <div className="answer-grid">
                        {q.options.map((o, j) => {
                          const key = q.type === "tf" ? (j === 0 ? 1 : 0) : j;
                          return (
                            <div
                              className={`answer-tile ${q.correctOptionId === o.id ? "correct" : ""}`}
                              key={o.id}
                            >
                              <AnswerKey index={key} />
                              <label className="sr-only" htmlFor={o.id}>
                                Question {i + 1} answer {j + 1}
                              </label>
                              <input
                                id={o.id}
                                placeholder={`Answer ${j + 1}`}
                                value={o.label}
                                maxLength={150}
                                readOnly={q.type === "tf"}
                                onChange={(e) =>
                                  update(q.id, {
                                    options: q.options.map((opt) =>
                                      opt.id === o.id
                                        ? { ...opt, label: e.target.value }
                                        : opt,
                                    ),
                                  })
                                }
                                aria-invalid={checks && !o.label.trim()}
                              />
                              <button
                                className="mark"
                                aria-label={`Mark answer ${j + 1} correct for question ${i + 1}`}
                                aria-pressed={q.correctOptionId === o.id}
                                onClick={() =>
                                  update(q.id, { correctOptionId: o.id })
                                }
                              >
                                {q.correctOptionId === o.id
                                  ? "✓ Correct"
                                  : "Mark"}
                              </button>
                              {q.type === "mc" && q.options.length > 2 && (
                                <button
                                  className="remove-answer"
                                  aria-label={`Remove answer ${j + 1} from question ${i + 1}`}
                                  onClick={() =>
                                    update(q.id, {
                                      options: q.options.filter(
                                        (opt) => opt.id !== o.id,
                                      ),
                                      correctOptionId:
                                        q.correctOptionId === o.id
                                          ? null
                                          : q.correctOptionId,
                                    })
                                  }
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {q.type === "mc" && q.options.length < 4 && (
                        <button
                          className="text-button"
                          onClick={() =>
                            update(q.id, {
                              options: [
                                ...q.options,
                                { id: crypto.randomUUID(), label: "" },
                              ],
                            })
                          }
                        >
                          + Add answer
                        </button>
                      )}
                      <label className="reveal-fact-editor">
                        Reveal fact (optional)
                        <textarea
                          aria-label={`Question ${i + 1} reveal fact`}
                          value={q.revealFact ?? ""}
                          maxLength={160}
                          onChange={(e) =>
                            update(q.id, { revealFact: e.target.value })
                          }
                          placeholder="A short, accurate fact shown after answers close."
                        />
                        <span className="hint">
                          {(q.revealFact ?? "").length}/160 · Check this fact if
                          you change the question or correct answer.
                        </span>
                      </label>
                      <div className="question-settings">
                        <Segments
                          label="Time"
                          values={times}
                          value={q.timeLimit}
                          onChange={(v) => update(q.id, { timeLimit: v })}
                        />
                        <Segments
                          label="Points"
                          values={points}
                          value={q.basePoints}
                          onChange={(v) => update(q.id, { basePoints: v })}
                        />
                      </div>
                      <button
                        className="text-button delete-question"
                        onClick={() => setDeleting(q.id)}
                      >
                        Delete question
                      </button>
                    </div>
                  ) : (
                    <div className="collapsed-meta">
                      <Chip>{q.timeLimit}s</Chip>
                      <span>
                        {q.basePoints === 0
                          ? "No points"
                          : q.basePoints === 2000
                            ? "Double points"
                            : "Standard points"}
                      </span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <div className="add-questions">
            <button
              className="button dashed"
              disabled={draft.questions.length >= MAX_QUESTIONS}
              onClick={() => add("mc")}
            >
              + Multiple choice
            </button>
            <button
              className="button dashed"
              disabled={draft.questions.length >= MAX_QUESTIONS}
              onClick={() => add("tf")}
            >
              + True / False
            </button>
          </div>
        </section>
        <QuestionIdeas
          questions={draft.questions}
          onAdd={addIdea}
          visible={ideasVisible}
        />
      </main>
      {deleting && (
        <Dialog label="delete-title" onClose={() => setDeleting(null)}>
          <h2 id="delete-title">Delete this question?</h2>
          <p>This removes the question and its answers from your draft.</p>
          <div className="card-actions">
            <button
              autoFocus
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Keep it
            </button>
            <button
              className="button primary"
              onClick={() => {
                change({
                  ...draft,
                  questions: draft.questions.filter((q) => q.id !== deleting),
                });
                setDeleting(null);
              }}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
