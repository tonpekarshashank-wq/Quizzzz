"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gameApi } from "@/lib/game-client";
import { Blob, Chip } from "./ui";
import type { Avatar } from "@/lib/game-model";
export function JoinGame({ initialPin = "" }: { initialPin?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin);
  const [room, setRoom] = useState<{ title: string; pin: string } | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<Avatar>({ body: 0, mood: "smile" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  async function lookup(code: string) {
    setBusy(true);
    setError("");
    try {
      const info = await gameApi<{
        title: string;
        pin: string;
        joinable: boolean;
        reason: string;
      }>(`rooms/${code}`);
      if (!info.joinable)
        throw new Error(
          info.reason === "ROOM_FULL"
            ? "This game is full."
            : "This game has already started or ended.",
        );
      setRoom(info);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (/^\d{6}$/.test(initialPin)) void lookup(initialPin);
  }, [initialPin]);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!room || busy) return;
    setBusy(true);
    setError("");
    const key = JSON.stringify([room.pin, nickname, avatar]);
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    try {
      const identity = await gameApi<{
        sessionId: string;
        participantId: string;
        nickname: string;
        token: string;
      }>("sessions/join", "POST", {
        pin: room.pin,
        nickname,
        avatar,
        joinRequestId: request.current.id,
      });
      localStorage.setItem(
        `quizzzz-player:${identity.sessionId}`,
        JSON.stringify(identity),
      );
      router.push(`/play/${identity.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="join-page">
      <LinkHome />
      <section className="card join-card">
        <Chip>{room ? `PIN ${room.pin}` : "NO ACCOUNT. JUST PLAY."}</Chip>
        <h1>{room ? "Make your blob." : "Got a code?"}</h1>
        {room ? (
          <>
            <p className="join-quiz-title">{room.title}</p>
            <div className="join-blob">
              <Blob body={avatar.body} mood={avatar.mood} size={130} />
            </div>
            <form onSubmit={join}>
              <fieldset>
                <legend>Body</legend>
                <div className="body-picker">
                  {Array.from({ length: 6 }, (_, body) => (
                    <button
                      type="button"
                      aria-label={`Blob body ${body + 1}`}
                      aria-pressed={avatar.body === body}
                      key={body}
                      onClick={() => setAvatar({ ...avatar, body })}
                    >
                      <Blob body={body} size={36} />
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Mood</legend>
                <div className="mood-picker">
                  {(["smile", "grin", "o"] as const).map((mood, i) => (
                    <button
                      className="button secondary small"
                      type="button"
                      aria-pressed={avatar.mood === mood}
                      key={mood}
                      onClick={() => setAvatar({ ...avatar, mood })}
                    >
                      {["Happy", "Cheeky", "Ooh"][i]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                Nickname
                <input
                  autoComplete="nickname"
                  name="nickname"
                  value={nickname}
                  maxLength={25}
                  required
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <span className="hint">
                {nickname.length}/25 · Duplicate names get a small suffix.
              </span>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? "Joining…" : "Let's go ↗"}
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                setRoom(null);
                setError("");
              }}
            >
              Use another code
            </button>
          </>
        ) : (
          <>
            <p>Enter the six-digit code your host shared.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lookup(pin);
              }}
            >
              <label htmlFor="game-pin" className="sr-only">
                Game PIN
              </label>
              <input
                id="game-pin"
                className="pin-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="off"
                placeholder="000 000"
                value={pin}
                maxLength={6}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button primary full"
                disabled={busy || pin.length !== 6}
              >
                {busy ? "Finding your game…" : "Join the game ↗"}
              </button>
            </form>
            <p className="hint">
              Scanned a QR? Your code is already filled in.
            </p>
            <div className="join-crowd">
              <Blob body={1} size={68} />
              <Blob body={3} size={80} mood="grin" />
              <Blob body={4} size={65} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
function LinkHome() {
  return (
    <a className="brand" href="/">
      quizzzz<span>✳</span>
    </a>
  );
}
