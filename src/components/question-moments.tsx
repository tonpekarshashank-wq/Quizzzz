"use client";
import { useEffect, useRef, useState } from "react";
export function LockInBadge({
  remaining,
  locked = false,
}: {
  remaining: number;
  locked?: boolean;
}) {
  const visible = remaining > 0 && remaining <= 3000;
  const announced = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (visible && !announced.current) {
      announced.current = true;
      setAnnouncement(
        locked
          ? "Answer locked."
          : "Three seconds remaining. Lock in your answer.",
      );
    }
  }, [visible, locked]);
  return (
    <div className="lock-badge-slot">
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {visible && (
        <span
          className={`lock-badge ${locked ? "locked" : ""}`}
          aria-hidden="true"
        >
          {locked
            ? "Answer locked ✓"
            : `Lock it in! ${Math.ceil(remaining / 1000)}`}
        </span>
      )}
    </div>
  );
}
export function RevealFact({ fact }: { fact?: string }) {
  return fact ? (
    <div className="reveal-fact">
      <strong>Fun fact</strong>
      <span>{fact}</span>
    </div>
  ) : null;
}
export function FinalQuestionIntro({
  endsAt,
  serverNow,
  single,
}: {
  endsAt: string;
  serverNow: number;
  single: boolean;
}) {
  const [elapsed] = useState(() =>
    Math.max(
      0,
      Math.min(1500, 1500 - (new Date(endsAt).getTime() - serverNow)),
    ),
  );
  return (
    <section className="question-intro" aria-label="Question introduction">
      <div
        className="final-question-banner"
        style={{ animationDelay: `-${elapsed}ms` }}
      >
        <h1>{single ? "ONE QUESTION. MAKE IT COUNT." : "FINAL QUESTION"}</h1>
        <p>Get ready. Your full answering time starts next.</p>
      </div>
    </section>
  );
}
