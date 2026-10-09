import { Blob } from "./ui";
import { Summit } from "./summit";
import { themes, sceneProgress, type Theme } from "@/lib/themes";
import type { Player } from "@/lib/game-model";
const tour = [
  [0, 505],
  [110, 470],
  [220, 492],
  [340, 430],
  [450, 452],
  [560, 372],
  [670, 384],
  [770, 300],
  [830, 262],
  [880, 262],
];
const treasure = Array.from({ length: 49 }, (_, i) => {
  const u = i / 48;
  return [70 + u * 740, 420 - 220 * u + 58 * Math.sin(3.2 * Math.PI * u)];
});
function path(points: number[][]) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.join(" ")}`).join(" ");
}
function interpolate(points: number[][], t: number) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let d = t * lengths.reduce((a, b) => a + b, 0),
    i = 0;
  while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
  const k = d / lengths[i],
    dx = points[i + 1][0] - points[i][0],
    dy = points[i + 1][1] - points[i][1];
  return {
    x: points[i][0] + k * dx,
    y: points[i][1] + k * dy,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
export function LeaderboardScene({
  theme,
  players,
  index,
  total,
}: {
  theme: string;
  players: Player[];
  index: number;
  total: number;
}) {
  const selected = (theme in themes ? theme : "summit") as Theme;
  if (selected === "summit") return <Summit players={players} />;
  return (
    <div
      className={`summit-scene theme-${selected}`}
      role="img"
      aria-label={`${themes[selected].label}: ${players[0]?.nickname ?? "No player"} leads with ${players[0]?.score ?? 0} points`}
    >
      <svg viewBox="0 0 880 560" aria-hidden="true">
        <rect
          width="880"
          height="560"
          fill={
            selected === "moon"
              ? "#12131A"
              : selected === "map"
                ? "#FBF1D6"
                : selected === "gp"
                  ? "#D4F8E9"
                  : "#D3EEFF"
          }
        />
        {selected === "gp" && (
          <>
            <rect
              x="270"
              y="18"
              width="340"
              height="58"
              rx="12"
              fill="#FFD43B"
              stroke="#12131A"
              strokeWidth="4"
            />
            <ellipse
              cx="440"
              cy="285"
              rx="330"
              ry="190"
              fill="none"
              stroke="#12131A"
              strokeWidth="102"
            />
            <ellipse
              cx="440"
              cy="285"
              rx="330"
              ry="190"
              fill="none"
              stroke="#3B4152"
              strokeWidth="90"
            />
            <ellipse
              cx="440"
              cy="285"
              rx="330"
              ry="190"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray="20 16"
            />
            <rect
              x="280"
              y="502"
              width="320"
              height="40"
              fill="#FFA9C9"
              stroke="#12131A"
              strokeWidth="4"
            />
            {Array.from({ length: 14 }, (_, i) => (
              <rect
                key={i}
                x={426 + (i % 2) * 14}
                y={426 + Math.floor(i / 2) * 14}
                width="14"
                height="14"
                fill={i % 4 < 2 ? "white" : "#12131A"}
              />
            ))}
            <text
              x="440"
              y="280"
              textAnchor="middle"
              fontSize="36"
              fontWeight="900"
            >
              GRAND PRIX
            </text>
            <text x="440" y="315" textAnchor="middle" fontSize="20">
              LAP {index} / {total}
            </text>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={400 + i * 40}
                cy="355"
                r="12"
                fill={i === 2 ? "#24DEA4" : "#FF6A2B"}
                stroke="#12131A"
                strokeWidth="3"
              />
            ))}
          </>
        )}
        {selected === "tour" && (
          <>
            <circle
              cx="130"
              cy="90"
              r="40"
              fill="#FFD43B"
              stroke="#12131A"
              strokeWidth="4"
            />
            <path
              d="M0 420 180 160 380 410 620 170 880 420V560H0Z"
              fill="#C9D2FF"
            />
            <path d={`${path(tour)} L880 560 L0 560Z`} fill="#24DEA4" />
            <path
              d={path(tour)}
              fill="none"
              stroke="#12131A"
              strokeWidth="18"
            />
            <path
              d={path(tour)}
              fill="none"
              stroke="#3B4152"
              strokeWidth="11"
            />
            <path
              d={path(tour)}
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeDasharray="12 10"
            />
            <path
              d="M795 265V155H865V265"
              fill="none"
              stroke="#12131A"
              strokeWidth="10"
            />
            <rect
              x="760"
              y="130"
              width="110"
              height="48"
              fill="#FFD43B"
              stroke="#12131A"
              strokeWidth="4"
            />
            <text
              x="815"
              y="162"
              textAnchor="middle"
              fontSize="20"
              fontWeight="900"
            >
              FINISH
            </text>
            <text x="35" y="545" fontSize="18">
              START
            </text>
            <text x="320" y="100" fontSize="26" fontWeight="900">
              CATEGORY 1 CLIMB
            </text>
          </>
        )}
        {selected === "moon" && (
          <>
            {Array.from({ length: 28 }, (_, i) => (
              <circle
                key={i}
                cx={25 + ((i * 137) % 820)}
                cy={25 + ((i * 83) % 485)}
                r={i % 3 === 0 ? 4 : 2}
                fill={i % 2 ? "white" : "#FFD43B"}
              />
            ))}
            <circle
              cx="100"
              cy="500"
              r="100"
              fill="#2B4BFF"
              stroke="white"
              strokeWidth="4"
            />
            <path d="m30 480 60-50 55 25-15 45-65 20Z" fill="#24DEA4" />
            <circle cx="760" cy="112" r="85" fill="#F5F2E9" />
            <circle cx="730" cy="90" r="20" fill="#CCC9C0" />
            <circle cx="790" cy="136" r="27" fill="#CCC9C0" />
            <path
              d="M760 50V10l45 12-45 16"
              fill="#FF6A2B"
              stroke="white"
              strokeWidth="3"
            />
            <path
              d="M100 500Q130 150 760 112"
              fill="none"
              stroke="#FFD43B"
              strokeWidth="5"
              strokeDasharray="1 14"
              strokeLinecap="round"
            />
            <text x="30" y="385" fill="white" fontSize="20">
              EARTH
            </text>
            <text x="650" y="235" fill="white" fontSize="20">
              THE MOON
            </text>
          </>
        )}
        {selected === "map" && (
          <>
            <path
              d="m160 150 70-55 100 40-15 65-100 20Zm350 240 65-50 90 45-15 75-105 15Z"
              fill="#24DEA4"
              stroke="#12131A"
              strokeWidth="4"
            />
            {[220, 590].map((x, i) => (
              <g key={x}>
                <path
                  d={`M${x} ${150 + i * 225}v-50`}
                  stroke="#12131A"
                  strokeWidth="5"
                />
                <path
                  d={`m${x - 30} ${115 + i * 225} 30-20 30 20-30-8Z`}
                  fill="#FFD43B"
                  stroke="#12131A"
                  strokeWidth="3"
                />
              </g>
            ))}
            <path
              d={path(treasure)}
              fill="none"
              stroke="#FF6A2B"
              strokeWidth="6"
              strokeDasharray="12 12"
            />
            <path
              d="m780 180 60 60m0-60-60 60"
              stroke="#12131A"
              strokeWidth="12"
            />
            <text x="680" y="280" fontSize="22" fontWeight="900">
              X MARKS IT
            </text>
            <path
              d="M70 80V160M30 120H110m-65-25 50 50m0-50-50 50"
              stroke="#12131A"
              strokeWidth="3"
            />
            <text x="60" y="68" fontSize="18">
              N
            </text>
            {Array.from({ length: 7 }, (_, i) => (
              <path
                key={i}
                d={`m${70 + i * 105} 505q15-14 30 0t30 0`}
                fill="none"
                stroke="#7AB9CD"
                strokeWidth="3"
              />
            ))}
          </>
        )}
      </svg>
      {players.map((p, i) => {
        const t = sceneProgress(players, i),
          alt = i % 2 ? 1 : -1;
        let position: { x: number; y: number; angle: number };
        if (selected === "gp") {
          const a = Math.PI / 2 + t * 2 * Math.PI;
          position = {
            x: 440 + 330 * Math.cos(a),
            y: 285 + 190 * Math.sin(a),
            angle: 0,
          };
        } else if (selected === "moon") {
          const x = (1 - t) ** 2 * 100 + 2 * (1 - t) * t * 130 + t * t * 760,
            y = (1 - t) ** 2 * 500 + 2 * (1 - t) * t * 150 + t * t * 112;
          position = { x: x + alt * 22, y: y + alt * 18, angle: 0 };
        } else position = interpolate(selected === "tour" ? tour : treasure, t);
        return (
          <div
            key={p.id}
            className={`summit-player vehicle vehicle-${selected}`}
            style={{
              left: `${(position.x / 880) * 100}%`,
              top: `${((position.y - 28 + alt * 10) / 560) * 100}%`,
              animationDelay: `${i * 0.12}s`,
            }}
          >
            <div className="vehicle-body">
              <Blob
                body={p.avatar.body}
                mood={p.avatar.mood}
                size={selected === "moon" ? 30 : 40}
              />
              <svg viewBox="0 0 90 60" aria-hidden="true">
                {selected === "gp" && (
                  <>
                    <rect
                      x="10"
                      y="28"
                      width="70"
                      height="24"
                      rx="8"
                      fill="#FF6A2B"
                      stroke="#12131A"
                      strokeWidth="3"
                    />
                    <rect
                      x="7"
                      y="30"
                      width="10"
                      height="26"
                      rx="3"
                      fill="#12131A"
                    />
                    <rect
                      x="73"
                      y="30"
                      width="10"
                      height="26"
                      rx="3"
                      fill="#12131A"
                    />
                  </>
                )}
                {selected === "tour" && (
                  <>
                    <circle
                      cx="17"
                      cy="42"
                      r="14"
                      fill="white"
                      stroke="#12131A"
                      strokeWidth="4"
                    />
                    <circle
                      cx="73"
                      cy="42"
                      r="14"
                      fill="white"
                      stroke="#12131A"
                      strokeWidth="4"
                    />
                    <path
                      d="m17 42 20-22 18 22H17l15-28h25l16 28"
                      fill="none"
                      stroke="#FF6A2B"
                      strokeWidth="4"
                    />
                  </>
                )}
                {selected === "moon" && (
                  <>
                    <path
                      d="M25 48 45 5 65 48Z"
                      fill="white"
                      stroke="#12131A"
                      strokeWidth="3"
                    />
                    <path d="m30 48 15 12 15-12" fill="#FF6A2B" />
                    <path
                      d="m25 35-10 18 20-5m30-13 10 18-20-5"
                      fill="#2B4BFF"
                    />
                  </>
                )}
                {selected === "map" && (
                  <>
                    <path
                      d="M7 36H83l-15 20H22Z"
                      fill="white"
                      stroke="#12131A"
                      strokeWidth="3"
                    />
                    <path
                      d="M45 38V0l28 30H45"
                      fill="#FFD43B"
                      stroke="#12131A"
                      strokeWidth="3"
                    />
                  </>
                )}
              </svg>
            </div>
            <span className="chip">
              {p.rank}. {p.nickname}
            </span>
          </div>
        );
      })}
    </div>
  );
}
