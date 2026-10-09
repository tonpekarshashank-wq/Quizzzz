import type { CSSProperties, ReactNode } from "react";
const bodies = [
  { color: "var(--tangerine)", radius: "50%" },
  { color: "var(--bubblegum)", radius: "38% 62% 63% 37% / 41% 44% 56% 59%" },
  { color: "var(--cobalt)", radius: "30%" },
  { color: "var(--sun)", radius: "50% 50% 18% 50%" },
  { color: "var(--mint)", radius: "62% 38% 46% 54% / 55% 60% 40% 45%" },
  { color: "var(--sky)", radius: "50% 50% 50% 14%" },
];
export function Blob({
  body = 0,
  mood = "smile",
  size = 64,
}: {
  body?: number;
  mood?: "smile" | "grin" | "o";
  size?: number;
}) {
  const b = bodies[body % 6];
  return (
    <div
      aria-hidden="true"
      className={`blob mood-${mood}`}
      style={
        {
          "--blob-size": `${size}px`,
          "--face": body === 2 ? "white" : "var(--ink)",
          background: b.color,
          borderRadius: b.radius,
        } as CSSProperties
      }
    >
      <i className="eye left" />
      <i className="eye right" />
      <i className="mouth" />
    </div>
  );
}
export function AnswerKey({ index }: { index: number }) {
  return (
    <span className={`answer-key key-${index}`} aria-hidden="true">
      <span className={["triangle", "diamond", "circle", "square"][index]} />
    </span>
  );
}
export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}
export function Segments<T extends string | number>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="setting">
      <span className="eyebrow">{label}</span>
      <div className="segments" role="group" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
          >
            {label === "Time"
              ? `${v}s`
              : v === 1000
                ? "Standard"
                : v === 2000
                  ? "Double"
                  : v === 0
                    ? "None"
                    : v}
          </button>
        ))}
      </div>
    </div>
  );
}
