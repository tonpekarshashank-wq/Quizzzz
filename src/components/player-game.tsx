"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGame } from "./use-game";
import { gameApi } from "@/lib/game-client";
import { ClientError } from "@/lib/client";
import { AnswerKey, Blob, Chip } from "./ui";
import { terminal } from "@/lib/game-model";
import { FinalPlayerCard } from "./final-player";
type Answer = {
  questionId: string;
  selectedOptionId: string;
  submissionId: string;
};
export function PlayerGame({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem(`quizzzz-player:${id}`);
      setToken(value ? JSON.parse(value).token : null);
    } catch {
      setToken(null);
    }
    setLoaded(true);
  }, [id]);
  if (!loaded)
    return (
      <main id="main" className="status-page">
        Restoring your place…
      </main>
    );
  if (!token)
    return (
      <main id="main" className="card status-page">
        <h1>Let's get you in.</h1>
        <p>Join with your host's code on this browser.</p>
        <Link className="button primary" href="/join">
          Join a game
        </Link>
      </main>
    );
  return <PlayerSession id={id} token={token} />;
}
function PlayerSession({ id, token }: { id: string; token: string }) {
  const { snap, error, fatal, refresh, remaining } = useGame(id, token);
  const [pending, setPending] = useState<Answer | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);
  const pendingRef = useRef<Answer | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = sessionStorage.getItem(`quizzzz-answer:${id}`);
      if (raw) {
        const answer = JSON.parse(raw);
        pendingRef.current = answer;
        setPending(answer);
      }
    } catch {}
    return () => {
      mounted.current = false;
      if (retry.current) clearTimeout(retry.current);
    };
  }, [id]);
  const sendRef = useRef<(answer: Answer) => Promise<void>>(async () => {});
  async function send(answer: Answer) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitError("");
    try {
      await gameApi(`sessions/${id}/answers`, "POST", answer, token);
      if (mounted.current) {
        setUncertain(false);
        await refresh();
      }
    } catch (e) {
      if (!mounted.current) return;
      if (
        e instanceof ClientError &&
        !["SERVICE_UNAVAILABLE", "RATE_LIMITED"].includes(e.code)
      ) {
        setSubmitError(e.message);
        pendingRef.current = null;
        setPending(null);
        sessionStorage.removeItem(`quizzzz-answer:${id}`);
        setUncertain(false);
        await refresh();
      } else {
        setUncertain(true);
        setSubmitError(
          "Checking your answer… We'll retry without submitting twice.",
        );
        retry.current = setTimeout(() => {
          retry.current = null;
          void sendRef.current(answer);
        }, 2000);
      }
    } finally {
      inFlight.current = false;
    }
  }
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (!snap) return;
    const answer = pendingRef.current;
    if (
      snap.acceptedAnswer ||
      snap.question?.id !== answer?.questionId ||
      snap.state !== "QUESTION_ACTIVE"
    ) {
      if (retry.current) clearTimeout(retry.current);
      retry.current = null;
      pendingRef.current = null;
      setPending(null);
      setUncertain(false);
      sessionStorage.removeItem(`quizzzz-answer:${id}`);
    } else if (answer && !inFlight.current && !retry.current)
      void sendRef.current(answer);
  }, [snap, id]);
  function pick(optionId: string) {
    if (
      !snap?.question ||
      snap.acceptedAnswer ||
      pendingRef.current ||
      remaining <= 0
    )
      return;
    const answer = {
      questionId: snap.question.id,
      selectedOptionId: optionId,
      submissionId: crypto.randomUUID(),
    };
    pendingRef.current = answer;
    setPending(answer);
    sessionStorage.setItem(`quizzzz-answer:${id}`, JSON.stringify(answer));
    void send(answer);
  }
  if (fatal)
    return (
      <main id="main" className="status-page card">
        <h1>Your game connection ended.</h1>
        <p>{error}</p>
        <Link className="button primary" href="/join">
          Join another game
        </Link>
      </main>
    );
  if (!snap?.self)
    return (
      <main id="main" className="status-page">
        <h1>Finding your place…</h1>
        {error && <p role="status">{error}</p>}
      </main>
    );
  const me = snap.self,
    q = snap.question,
    chosen =
      snap.acceptedAnswer?.selectedOptionId ??
      (pending?.questionId === q?.id ? pending?.selectedOptionId : null),
    result = snap.result;
  return (
    <main
      id="main"
      className={`player-page ${snap.state === "LOBBY" ? "player-wait" : result && snap.state !== "QUESTION_ACTIVE" ? (result.status === "correct" ? "player-correct" : "player-wrong") : ""}`}
    >
      <div className="player-inner">
        {error && (
          <div className="error" role="status">
            {error}
          </div>
        )}
        {snap.hostAway &&
          !terminal(snap.state) &&
          snap.state !== "QUESTION_ACTIVE" && (
            <div className="player-host-away" role="status">
              Waiting for the host to return.
            </div>
          )}
        {snap.state === "LOBBY" && (
          <>
            <Chip>YOU'RE IN · {snap.playerCount} PLAYERS</Chip>
            <div className="waiting-blob">
              <Blob body={me.avatar.body} mood={me.avatar.mood} size={150} />
            </div>
            <h1>Hey, {me.nickname}!</h1>
            <p role="status">
              Waiting for the host <span className="waiting-dots">•••</span>
            </p>
            <div className="card how-to">
              <h2>Here's the game plan.</h2>
              <p>
                <b>1.</b> Pick your answer.
                <br />
                <b>2.</b> Be quick. Speed earns points.
                <br />
                <b>3.</b> Race to the finish.
              </p>
            </div>
            <p className="hint">{snap.title}</p>
          </>
        )}
        {snap.state === "QUESTION_ACTIVE" && q && (
          <>
            <div className="player-question-meta">
              <Chip>
                Q {q.index} / {snap.questionCount}
              </Chip>
              <strong>{me.score.toLocaleString()} pts</strong>
              {q.basePoints === 2000 && (
                <span className="points-sticker">2×</span>
              )}
            </div>
            <div className="fuse">
              <span
                style={{
                  width: `${(remaining / (q.timeLimit * 1000)) * 100}%`,
                }}
              />
            </div>
            <div
              className="player-time"
              aria-label={`${Math.ceil(remaining / 1000)} seconds remaining`}
            >
              {Math.ceil(remaining / 1000)}s
            </div>
            <h1 className="player-prompt">{q.prompt}</h1>
            <div className="player-options">
              {q.options.map((o) => (
                <button
                  className={`player-answer ${chosen === o.id ? "chosen" : chosen ? "not-chosen" : ""}`}
                  key={o.id}
                  disabled={!!chosen || remaining <= 0}
                  onClick={() => pick(o.id)}
                >
                  <AnswerKey index={o.key} />
                  <span>{o.label}</span>
                  {chosen === o.id && <strong>✓</strong>}
                </button>
              ))}
            </div>
            <p className="lock-message" role="status">
              {snap.acceptedAnswer
                ? `Locked in · waiting for ${Math.max(0, snap.playerCount - snap.answeredCount)} more`
                : pending
                  ? uncertain
                    ? "Checking your answer…"
                    : "Submitting…"
                  : remaining <= 0
                    ? "Time's up · waiting for results"
                    : "Tap fast. Speed earns points."}
            </p>
            {submitError && (
              <p className="error" role="alert">
                {submitError}
              </p>
            )}
          </>
        )}
        {(snap.state === "RESULT_REVEAL" || snap.state === "LEADERBOARD") &&
          result &&
          q && (
            <>
              <Chip>QUESTION {q.index} RESULTS</Chip>
              <div className="result-blob">
                <Blob
                  body={me.avatar.body}
                  mood={result.status === "correct" ? me.avatar.mood : "o"}
                  size={130}
                />
              </div>
              <h1>
                {result.status === "correct"
                  ? "Nailed it!"
                  : result.status === "unanswered"
                    ? "Time slipped away."
                    : "So close!"}
              </h1>
              <section className="card score-receipt">
                {result.status === "correct" ? (
                  <>
                    <div>
                      <span>Base points</span>
                      <b>{result.basePoints.toLocaleString()}</b>
                    </div>
                    <div>
                      <span>
                        Speed · {((result.responseMs ?? 0) / 1000).toFixed(2)}s
                      </span>
                      <b>
                        × {Math.round((result.speedMultiplier ?? 0) * 100)}%
                      </b>
                    </div>
                    <hr />
                    <strong className="earned">
                      +{result.pointsEarned.toLocaleString()}
                    </strong>
                    <div>
                      <span>Total</span>
                      <b>{result.totalScore.toLocaleString()}</b>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="eyebrow">THE RIGHT ANSWER</span>
                    <div className="correct-answer">
                      <AnswerKey
                        index={
                          q.options.find((o) => o.id === result.correctOptionId)
                            ?.key ?? 0
                        }
                      />
                      <b>
                        {
                          q.options.find((o) => o.id === result.correctOptionId)
                            ?.label
                        }
                      </b>
                    </div>
                    <p>
                      {result.status === "unanswered"
                        ? "No answer this round. You've got the next one."
                        : `You chose: ${q.options.find((o) => o.id === result.selectedOptionId)?.label}`}
                    </p>
                    <strong>0 points this round</strong>
                  </>
                )}
              </section>
              <section className="player-rank card">
                <div>
                  <span className="eyebrow">YOUR RANK</span>
                  <h2>
                    #{result.rank}
                    {result.rankDelta !== null && (
                      <small>
                        {result.rankDelta > 0
                          ? ` ↑ ${result.rankDelta}`
                          : result.rankDelta < 0
                            ? ` ↓ ${-result.rankDelta}`
                            : " ="}
                      </small>
                    )}
                  </h2>
                </div>
                <div>
                  <span className="eyebrow">STREAK</span>
                  <h2>
                    {result.streak} {result.streak > 0 ? "✳" : ""}
                  </h2>
                </div>
              </section>
              {result.rank > 1 && (
                <p>{result.gapToNext} points behind the next place.</p>
              )}
              <p className="hint">Waiting for the next question…</p>
            </>
          )}
        {terminal(snap.state) && (
          <>
            <Chip>
              {snap.state === "COMPLETED" ? "GAME OVER" : "GAME CLOSED"}
            </Chip>
            <h1>
              {snap.state === "COMPLETED"
                ? me.rank === 1
                  ? "You won!"
                  : `You finished #${me.rank}!`
                : snap.state === "CANCELLED"
                  ? "This game was cancelled."
                  : "We'll call it here."}
            </h1>
            {snap.state === "INTERRUPTED" && (
              <p>Partial results · your accepted answers are kept.</p>
            )}
            <FinalPlayerCard snap={snap} token={token} refresh={refresh} />
            <Link className="button primary full" href="/join">
              Join another game
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
