"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Quiz } from "@/lib/model";
import type { OpenGame } from "@/lib/repository";
import { Dialog } from "./dialog";
import { Blob, Chip } from "./ui";
export function Library({
  initial,
  openGames,
}: {
  initial: { items: Quiz[]; hasMore: boolean };
  openGames: OpenGame[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [more, setMore] = useState(initial.hasMore);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [archive, setArchive] = useState<Quiz | null>(null);
  async function create() {
    setBusy("create");
    setError("");
    try {
      const q = await api<Quiz>("quizzes", "POST", {});
      router.push(`/quizzes/${q.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  return (
    <main id="main" className="workspace">
      <div className="page-heading">
        <div>
          <Chip>YOUR QUIZ CORNER</Chip>
          <h1>
            My quizzes<span className="heading-dot">.</span>
          </h1>
          <p>A good question is the start of a great time.</p>
        </div>
        <button className="button primary" disabled={!!busy} onClick={create}>
          {busy === "create" ? "Creating…" : "+ Create a quiz"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!!openGames.length && (
        <section className="card open-games" aria-label="Open games">
          <h2>Return to your game.</h2>
          <p>Your room and accepted answers are kept.</p>
          {openGames.map((game) => (
            <div className="open-game" key={game.id}>
              <div>
                <b>{game.title}</b>
                <p className="hint">
                  PIN {game.pin} ·{" "}
                  {game.state === "LOBBY" ? "Lobby" : "In progress"}
                </p>
              </div>
              <Link
                className="button secondary small"
                href={`/host/${game.id}`}
              >
                Resume game ↗
              </Link>
            </div>
          ))}
        </section>
      )}
      {!items.length ? (
        <section className="card empty-library">
          <div className="empty-blobs">
            <Blob body={4} size={95} />
            <Blob body={3} size={105} mood="grin" />
            <Blob body={1} size={85} />
          </div>
          <h2>Your first quiz starts here.</h2>
          <p>Add a few questions. Make them curious. Make them yours.</p>
          <button className="button primary" disabled={!!busy} onClick={create}>
            Make my first quiz ↗
          </button>
        </section>
      ) : (
        <div className="quiz-grid">
          {items.map((q, i) => (
            <article className="card quiz-card" key={q.id}>
              <div className={`quiz-cover cover-${i % 4}`}>
                <Blob
                  body={[0, 2, 4, 1][i % 4]}
                  size={76}
                  mood={i % 2 ? "o" : "grin"}
                />
                <span className="chip">DRAFT</span>
              </div>
              <div className="quiz-card-content">
                <h2>
                  <Link href={`/quizzes/${q.id}`}>
                    {q.draft.title || "Untitled quiz"}
                  </Link>
                </h2>
                <p>
                  {q.draft.questions.length} question
                  {q.draft.questions.length === 1 ? "" : "s"} ·{" "}
                  {q.draft.language.toUpperCase()}
                </p>
                <p className="hint">
                  Edited{" "}
                  {new Date(q.updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                </p>
                <div className="card-actions">
                  <Link
                    className="button secondary small"
                    href={`/quizzes/${q.id}`}
                  >
                    Edit quiz ↗
                  </Link>
                  <button
                    className="text-button"
                    aria-label={`Archive ${q.draft.title}`}
                    onClick={() => setArchive(q)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {more && (
        <button
          className="button secondary load-more"
          disabled={!!busy}
          onClick={async () => {
            setBusy("more");
            try {
              const page = await api<{ items: Quiz[]; hasMore: boolean }>(
                `quizzes?offset=${items.length}`,
              );
              setItems([...items, ...page.items]);
              setMore(page.hasMore);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
        >
          Load more
        </button>
      )}
      {archive && (
        <Dialog label="archive-title" onClose={() => setArchive(null)}>
          <h2 id="archive-title">Archive this quiz?</h2>
          <p>
            {archive.draft.title} will leave your library. Its history will be
            kept.
          </p>
          <div className="card-actions">
            <button
              autoFocus
              className="button secondary"
              onClick={() => setArchive(null)}
            >
              Keep quiz
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy("archive");
                try {
                  await api(`quizzes/${archive.id}/archive`, "POST", {});
                  setItems(items.filter((q) => q.id !== archive.id));
                  setArchive(null);
                } catch (e) {
                  setError((e as Error).message);
                  setArchive(null);
                } finally {
                  setBusy("");
                }
              }}
            >
              Archive
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
