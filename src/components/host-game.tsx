"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useGame } from "./use-game";
import { gameApi } from "@/lib/game-client";
import { ClientError } from "@/lib/client";
import { AnswerKey, Blob, Chip } from "./ui";
import { Dialog } from "./dialog";
import { LeaderboardScene } from "./leaderboard-scene";
import { themes, type Theme } from "@/lib/themes";
import { terminal } from "@/lib/game-model";
import { Confetti } from "./confetti";
// A document gets its own controller, including duplicated tabs. Reloads explicitly restore control.
const documentController =
  typeof window === "undefined" ? "" : crypto.randomUUID();
export function HostGame({ id }: { id: string }) {
  const { snap, error, fatal, refresh, remaining } = useGame(id);
  const [controller, setController] = useState("");
  const [generation, setGeneration] = useState(0);
  const [controlError, setControlError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    participantId?: string;
  } | null>(null);
  const pending = useRef<{
    commandId: string;
    action: string;
    participantId?: string;
    controllerId: string;
    generation: number;
    expectedRevision: number;
  } | null>(null);
  useEffect(() => {
    setController(documentController);
    try {
      const raw = sessionStorage.getItem(`quizzzz-command:${id}`);
      if (raw) {
        pending.current = JSON.parse(raw);
        setRecovering(true);
      }
    } catch {
      sessionStorage.removeItem(`quizzzz-command:${id}`);
    }
  }, [id]);
  const claim = useCallback(
    async (takeover = false) => {
      if (!controller) return;
      setClaiming(true);
      try {
        const r = await gameApi<{ generation: number }>(
          `sessions/${id}/control/claim`,
          "POST",
          { controllerId: controller, takeover },
        );
        setGeneration(r.generation);
        setControlError("");
        await refresh();
      } catch (e) {
        setControlError((e as Error).message);
      } finally {
        setClaiming(false);
      }
    },
    [controller, id, refresh],
  );
  useEffect(() => {
    void claim();
  }, [claim]);
  useEffect(() => {
    if (!generation || !controller || terminal(snap?.state ?? "LOBBY")) return;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await gameApi(`sessions/${id}/control/heartbeat`, "POST", {
          controllerId: controller,
          generation,
        });
      } catch (e) {
        setControlError((e as Error).message);
        setGeneration(0);
      }
    };
    const timer = setInterval(() => void beat(), 10000);
    const visible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [generation, controller, id, snap?.state]);
  useEffect(() => {
    if (!snap?.pin) return;
    const url = `${location.origin}/join?pin=${snap.pin}`;
    setJoinUrl(url);
    void QRCode.toDataURL(url, {
      margin: 2,
      width: 230,
      color: { dark: "#12131A", light: "#FFFFFF" },
    }).then(setQr);
  }, [snap?.pin]);
  const owns =
    !!snap?.controller &&
    snap.controller.id === controller &&
    snap.controller.generation === generation &&
    !!generation;
  async function act(action: string, participantId?: string) {
    if (!snap || busy) return;
    setBusy(true);
    setActionError("");
    const request = pending.current ?? {
      action,
      participantId,
      controllerId: controller,
      generation,
      expectedRevision: snap.revision,
      commandId: crypto.randomUUID(),
    };
    pending.current = request;
    sessionStorage.setItem(`quizzzz-command:${id}`, JSON.stringify(request));
    try {
      await gameApi(`sessions/${id}/commands`, "POST", request);
      pending.current = null;
      sessionStorage.removeItem(`quizzzz-command:${id}`);
      setRecovering(false);
      setConfirmAction(null);
      await refresh();
    } catch (e) {
      setActionError(
        e instanceof ClientError
          ? e.message
          : "Connection lost. Retry the same action to check its outcome.",
      );
      if (
        e instanceof ClientError &&
        !["SERVICE_UNAVAILABLE", "RATE_LIMITED"].includes(e.code)
      ) {
        pending.current = null;
        sessionStorage.removeItem(`quizzzz-command:${id}`);
        setRecovering(false);
        if (e.code === "CONTROL_LOST") {
          setGeneration(0);
          setControlError(e.message);
        }
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  if (!snap)
    return (
      <main id="main" className="status-page card">
        <h1>{fatal ? "Game unavailable" : "Opening your game…"}</h1>
        {error && <p role="alert">{error}</p>}
        <Link href="/quizzes">My quizzes</Link>
      </main>
    );
  const q = snap.question;
  const canAct = owns && !busy && !error && !pending.current;
  const final = terminal(snap.state);
  return (
    <>
      <header className="nav">
        <Link className="brand" href="/quizzes">
          quizzzz<span>✳</span>
        </Link>
        <span className="host-title">{snap.title}</span>
        <Chip>
          {snap.state === "LOBBY"
            ? "LOBBY"
            : final
              ? "GAME OVER"
              : `Q ${q?.index} / ${snap.questionCount}`}
        </Chip>
        {!final && (
          <button
            className="text-button"
            disabled={!canAct}
            onClick={() =>
              setConfirmAction({
                action: snap.state === "LOBBY" ? "CANCEL" : "END_EARLY",
              })
            }
          >
            {snap.state === "LOBBY" ? "Cancel game" : "End game"}
          </button>
        )}
      </header>
      <main id="main" className="live-host">
        {error && (
          <div className="error" role="status">
            {error}
          </div>
        )}
        {!final && (!owns || controlError) && (
          <div className="control-banner" role="status">
            <span>
              {controlError || "Restore hosting control to continue."}
            </span>
            <button
              className="button secondary small"
              disabled={claiming || busy}
              onClick={() => void claim(true)}
            >
              Take over / restore control
            </button>
          </div>
        )}
        {(actionError || recovering) && (
          <div className="error" role="alert">
            {actionError ||
              "Check the outcome of your previous action before continuing."}
            {pending.current && (
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() =>
                  void act(
                    pending.current!.action,
                    pending.current!.participantId,
                  )
                }
              >
                Retry action
              </button>
            )}
          </div>
        )}
        {snap.state === "LOBBY" && (
          <>
            <div className="live-heading">
              <Chip>LET THE GOOD QUESTIONS BEGIN</Chip>
              <h1>Bring your people in.</h1>
              <p>
                {snap.questionCount}{" "}
                {snap.questionCount === 1 ? "question" : "questions"}. A little
                friendly competition.
              </p>
            </div>
            <div className="lobby-ticket card">
              <div className="qr-stub">
                {qr && (
                  <img
                    src={qr}
                    width={200}
                    height={200}
                    alt="Scan to join this quiz"
                  />
                )}
                <span className="eyebrow">SCAN WITH CAMERA</span>
              </div>
              <div className="pin-panel">
                <span className="eyebrow">
                  OPEN THE LINK OR ENTER THIS CODE
                </span>
                <strong className="room-pin">
                  {snap.pin.slice(0, 3)} {snap.pin.slice(3)}
                </strong>
                <Chip>
                  {snap.playerCount} / {snap.capacity} PLAYERS
                </Chip>
                <button
                  className="button secondary small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(joinUrl);
                      setCopied(true);
                    } catch {
                      setActionError("Copy the join link shown below.");
                    }
                  }}
                >
                  {copied ? "Copied ✓" : "Copy join link"}
                </button>
                <a
                  className="join-link"
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {joinUrl}
                </a>
              </div>
            </div>
            <div className="lobby-roster-heading">
              <h2>Who's here?</h2>
              <span>{snap.connectedCount} connected</span>
            </div>
            <div className="roster-grid">
              {snap.roster?.map((p) => (
                <div className="roster-player" key={p.id}>
                  <Blob body={p.avatar.body} mood={p.avatar.mood} size={64} />
                  <span className="chip">{p.nickname}</span>
                  <button
                    className="text-button"
                    disabled={!canAct}
                    aria-label={`Remove ${p.nickname}`}
                    onClick={() =>
                      setConfirmAction({
                        action: "KICK_PLAYER",
                        participantId: p.id,
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {!snap.playerCount && (
              <p className="empty-roster">
                Share your code to bring players in.
              </p>
            )}
            <div className="host-action">
              <button
                className="button primary"
                disabled={!canAct || !snap.playerCount}
                onClick={() => void act("START_GAME")}
              >
                Start game ↗
              </button>
            </div>
          </>
        )}
        {(snap.state === "QUESTION_ACTIVE" || snap.state === "RESULT_REVEAL") &&
          q && (
            <div className="question-stage">
              <section className="stage-question">
                <Chip>
                  {snap.state === "RESULT_REVEAL"
                    ? "TIME'S UP"
                    : `QUESTION ${q.index}`}
                </Chip>
                {q.basePoints === 2000 && (
                  <span className="points-sticker">2× POINTS</span>
                )}
                <h1>{q.prompt}</h1>
                {snap.state === "QUESTION_ACTIVE" ? (
                  <>
                    <strong className="big-timer">
                      {Math.ceil(remaining / 1000)}
                    </strong>
                    <div className="fuse">
                      <span
                        style={{
                          width: `${(remaining / (q.timeLimit * 1000)) * 100}%`,
                        }}
                      />
                    </div>
                    <p>
                      {remaining ? "Every second counts." : "Locking answers…"}
                    </p>
                  </>
                ) : (
                  <>
                    <strong className="big-timer">
                      {Math.round((snap.reveal?.percentCorrect ?? 0) * 100)}%
                    </strong>
                    <p>of the room got it</p>
                    {snap.reveal?.fastestCorrect ? (
                      <div className="fastest">
                        <Blob
                          {...{
                            body: snap.reveal.fastestCorrect.avatar.body,
                            mood: snap.reveal.fastestCorrect.avatar.mood,
                          }}
                          size={44}
                        />
                        <span>
                          {snap.reveal.fastestCorrect.nickname} ·{" "}
                          {(
                            snap.reveal.fastestCorrect.responseMs / 1000
                          ).toFixed(2)}
                          s<br />
                          <small>Fastest correct answer</small>
                        </span>
                      </div>
                    ) : (
                      <p>No correct answers this round. Next one's yours.</p>
                    )}
                    <button
                      className="button primary"
                      disabled={!canAct}
                      onClick={() => void act("SHOW_LEADERBOARD")}
                    >
                      See the leaderboard ↗
                    </button>
                  </>
                )}
              </section>
              <section className="stage-answers">
                <div className="submission-count">
                  {snap.answeredCount} of {snap.playerCount} locked in
                </div>
                {q.options.map((o) => (
                  <div
                    className={`stage-answer card ${snap.reveal?.correctOptionId === o.id ? "right" : ""}`}
                    key={o.id}
                  >
                    {snap.reveal && (
                      <span
                        className="vote-fill"
                        style={{
                          width: `${((snap.reveal.counts[o.id] ?? 0) / Math.max(1, snap.playerCount)) * 100}%`,
                        }}
                      />
                    )}
                    <AnswerKey index={o.key} />
                    <span>{o.label}</span>
                    {snap.reveal && (
                      <strong>
                        {snap.reveal.counts[o.id] ?? 0}
                        {snap.reveal.correctOptionId === o.id && (
                          <small> ✓ RIGHT</small>
                        )}
                      </strong>
                    )}
                  </div>
                ))}
                {snap.reveal && <p>{snap.reveal.unanswered} unanswered</p>}
              </section>
            </div>
          )}
        {snap.state === "LEADERBOARD" && (
          <>
            <div className="live-heading">
              <Chip>
                AFTER QUESTION {q?.index} OF {snap.questionCount}
              </Chip>
              <h1>
                {
                  themes[
                    (snap.theme in themes ? snap.theme : "summit") as Theme
                  ].headline
                }
              </h1>
            </div>
            <div className="leaderboard-layout">
              <LeaderboardScene
                theme={snap.theme}
                players={snap.top}
                index={q?.index ?? 1}
                total={snap.questionCount}
              />
              <div className="standings">
                {snap.top.map((p) => (
                  <div className="standing card" key={p.id}>
                    <strong>{p.rank}</strong>
                    <Blob body={p.avatar.body} mood={p.avatar.mood} size={46} />
                    <div>
                      <b>{p.nickname}</b>
                      <small>
                        +{p.gain} this round{" "}
                        {p.rankDelta === null
                          ? ""
                          : p.rankDelta > 0
                            ? `· ↑ ${p.rankDelta}`
                            : p.rankDelta < 0
                              ? `· ↓ ${-p.rankDelta}`
                              : "· ="}
                      </small>
                    </div>
                    <span>{p.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="host-action">
              <button
                className="button primary"
                disabled={!canAct}
                onClick={() =>
                  void act(
                    q?.index === snap.questionCount
                      ? "FINISH_GAME"
                      : "NEXT_QUESTION",
                  )
                }
              >
                {q?.index === snap.questionCount
                  ? "Final results ↗"
                  : "Next question ↗"}
              </button>
            </div>
          </>
        )}
        {final && (
          <>
            {snap.state === "COMPLETED" && !!snap.top.length && <Confetti />}
            <div className="live-heading">
              <Chip>
                {snap.state === "COMPLETED" ? "FINAL RESULTS" : "GAME CLOSED"}
              </Chip>
              <h1>
                {snap.state === "COMPLETED"
                  ? `${snap.top[0]?.nickname ?? "Everyone"} takes the crown.`
                  : snap.state === "CANCELLED"
                    ? "This lobby is closed."
                    : "We'll call it here."}
              </h1>
              {snap.state === "INTERRUPTED" && (
                <p>
                  Partial results. Your accepted answers and scores are kept.
                </p>
              )}
            </div>
            <div
              className={`winner-grid ${snap.state === "COMPLETED" ? "completed-podium" : ""}`}
            >
              {snap.state !== "CANCELLED" &&
                snap.top.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className={`card winner-card place-${p.rank}`}
                  >
                    <Chip>
                      {snap.state === "INTERRUPTED"
                        ? "PROVISIONAL"
                        : p.rank === 1
                          ? "CHAMPION"
                          : p.rank === 2
                            ? "RUNNER-UP"
                            : "PODIUM"}
                    </Chip>
                    <strong className="winner-place">#{p.rank}</strong>
                    <Blob
                      body={p.avatar.body}
                      mood={p.avatar.mood}
                      size={110}
                    />
                    <h2>{p.nickname}</h2>
                    <strong>{p.score.toLocaleString()} pts</strong>
                    {snap.podium?.find((stats) => stats.id === p.id) &&
                      (() => {
                        const stats = snap.podium!.find(
                          (stats) => stats.id === p.id,
                        )!;
                        return (
                          <div className="final-stats">
                            <span>
                              <b>
                                {stats.accuracy === null
                                  ? "—"
                                  : `${Math.round(stats.accuracy * 100)}%`}
                              </b>
                              Accuracy
                            </span>
                            <span>
                              <b>
                                {stats.averageMs === null
                                  ? "—"
                                  : `${(stats.averageMs / 1000).toFixed(2)}s`}
                              </b>
                              Average response
                            </span>
                            <span>
                              <b>{stats.bestStreak}</b>Best streak
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                ))}
            </div>
            {!!snap.awardWinners?.length && (
              <section className="card report-panel">
                <h2>A little extra glory.</h2>
                {snap.awardWinners.map((p) => (
                  <p key={p.id}>
                    <b>{p.nickname}</b> · {p.awards.join(" · ")}
                  </p>
                ))}
              </section>
            )}
            <div className="host-action">
              {snap.state !== "CANCELLED" && (
                <Link className="button secondary" href={`/reports/${id}`}>
                  View report / CSV ↗
                </Link>
              )}
              <Link className="button primary" href="/quizzes">
                Back to my quizzes
              </Link>
            </div>
          </>
        )}
      </main>
      {confirmAction && (
        <Dialog label="game-confirm" onClose={() => setConfirmAction(null)}>
          <h2 id="game-confirm">
            {confirmAction.action === "KICK_PLAYER"
              ? "Remove this player?"
              : "End this game?"}
          </h2>
          <p>
            {confirmAction.action === "KICK_PLAYER"
              ? "They'll lose access to this room."
              : "Accepted answers will be kept. Players will see that the game has ended."}
          </p>
          <div className="card-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmAction(null)}
            >
              Keep playing
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void act(confirmAction.action, confirmAction.participantId)
              }
            >
              Confirm
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
