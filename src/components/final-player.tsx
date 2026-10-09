"use client";
import { useEffect, useState } from "react";
import { Blob, Chip } from "./ui";
import { cardImage } from "@/lib/card-image";
import { gameApi } from "@/lib/game-client";
import type { Snapshot } from "@/lib/game-model";
import { Confetti } from "./confetti";
export function FinalPlayerCard({
  snap,
  token,
  refresh,
}: {
  snap: Snapshot;
  token: string;
  refresh: () => Promise<void>;
}) {
  const p = snap.finalPlayer;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [image, setImage] = useState(""),
    [rating, setRating] = useState<number | null>(snap.rating ?? null);
  useEffect(() => {
    setRating(snap.rating ?? null);
  }, [snap.rating]);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  if (!p) return null;
  const partial = snap.state !== "COMPLETED";
  async function save(share = false) {
    if (!p || busy) return;
    setBusy(true);
    setError("");
    try {
      const blob = await cardImage(p, snap.title, snap.playerCount, partial),
        file = new File([blob], "quizzzz-my-card.png", { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: "My Quizzzz card" });
      else {
        const url = URL.createObjectURL(blob);
        setImage(url);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.append(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!partial && p.rank !== null && p.rank <= 3 && <Confetti />}
      <div className={`card player-final-card place-${p.rank}`}>
        <Chip>
          {partial ? "PROVISIONAL · " : ""}
          {p.rank ? `#${p.rank} / ${snap.playerCount} PLAYERS` : "YOUR PLAYER"}
        </Chip>
        <Blob body={p.avatar.body} mood={p.avatar.mood} size={140} />
        <h2>{p.nickname}</h2>
        <strong>{p.score.toLocaleString()} pts</strong>
        {p.rank && !partial && (
          <p>
            TOP {Math.ceil((p.rank / Math.max(1, snap.playerCount)) * 100)}%
          </p>
        )}
        <div className="final-stats">
          <span>
            <b>
              {p.accuracy === null ? "—" : `${Math.round(p.accuracy * 100)}%`}
            </b>
            Accuracy
          </span>
          <span>
            <b>{p.bestStreak}</b>Best streak
          </span>
          <span>
            <b>
              {p.averageMs === null
                ? "—"
                : `${(p.averageMs / 1000).toFixed(2)}s`}
            </b>
            Average response
          </span>
        </div>
        {!!p.awards.length && (
          <div className="award-tags">
            {p.awards.map((a) => (
              <Chip key={a}>{a}</Chip>
            ))}
          </div>
        )}
      </div>
      <button
        className="button primary full"
        disabled={busy}
        onClick={() => void save()}
      >
        Save my card ↓
      </button>
      <button
        className="button secondary full"
        disabled={busy}
        onClick={() => void save(true)}
      >
        Share / save image
      </button>
      {image && (
        <details className="saved-image">
          <summary>Image preview · touch and hold to save</summary>
          <img src={image} alt={`Quizzzz results card for ${p.nickname}`} />
        </details>
      )}
      {!partial && (
        <section className="card ease-rating">
          <h2>How easy was this quiz?</h2>
          <p>1 = very hard · 5 = very easy</p>
          {rating ? (
            <p role="status">Thanks! Your rating: {rating}/5</p>
          ) : (
            <div role="group" aria-label="Quiz ease rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className="button secondary small"
                  disabled={busy}
                  key={value}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await gameApi(
                        `sessions/${snap.id}/rating`,
                        "POST",
                        { value },
                        token,
                      );
                      setRating(value);
                      await refresh();
                    } catch (e) {
                      setError((e as Error).message);
                      await refresh();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
