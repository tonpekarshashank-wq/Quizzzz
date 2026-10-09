import { Blob } from "./ui";
import { sceneProgress } from "@/lib/themes";
import type { Player } from "@/lib/game-model";
export function Summit({ players }: { players: Player[] }) {
  return (
    <div
      className="summit-scene"
      role="img"
      aria-label={
        players[0]
          ? `${players[0].nickname} leads the climb with ${players[0].score} points`
          : "Mountain leaderboard"
      }
    >
      <svg viewBox="0 0 880 560" aria-hidden="true">
        <rect width="880" height="560" fill="#D3EEFF" />
        <circle
          cx="100"
          cy="85"
          r="40"
          fill="#FFD43B"
          stroke="#12131A"
          strokeWidth="4"
        />
        <path
          d="M0 450 180 210 360 450 630 170 880 440V560H0Z"
          fill="#C9D2FF"
        />
        <path
          d="M100 540 555 90 850 540Z"
          fill="#2B4BFF"
          stroke="#12131A"
          strokeWidth="5"
        />
        <path
          d="m555 90-90 90 55-8 35 20 35-30 43 14Z"
          fill="white"
          stroke="#12131A"
          strokeWidth="3"
        />
        <path
          d="M110 505 760 480 240 430 700 375 350 325 650 285 460 240 630 200 575 150 640 98"
          fill="none"
          stroke="#12131A"
          strokeWidth="12"
        />
        <path
          d="M110 505 760 480 240 430 700 375 350 325 650 285 460 240 630 200 575 150 640 98"
          fill="none"
          stroke="#FFD43B"
          strokeWidth="5"
          strokeDasharray="1 12"
          strokeLinecap="round"
        />
        <path
          d="M640 100V42l60 16-60 18"
          fill="#FF6A2B"
          stroke="#12131A"
          strokeWidth="4"
        />
        <text x="35" y="540" fontSize="16" fontFamily="monospace">
          BASE CAMP
        </text>
        <text x="680" y="115" fontSize="16" fontFamily="monospace">
          SUMMIT
        </text>
      </svg>
      {players.map((p, i) => {
        const t = sceneProgress(players, i);
        const route = [
          [110, 505],
          [760, 480],
          [240, 430],
          [700, 375],
          [350, 325],
          [650, 285],
          [460, 240],
          [630, 200],
          [575, 150],
          [640, 98],
        ];
        const lengths = route
          .slice(1)
          .map((point, j) =>
            Math.hypot(point[0] - route[j][0], point[1] - route[j][1]),
          );
        let distance = t * lengths.reduce((a, b) => a + b, 0),
          segment = 0;
        while (segment < lengths.length - 1 && distance > lengths[segment]) {
          distance -= lengths[segment++];
        }
        const k = distance / lengths[segment],
          x =
            route[segment][0] + (route[segment + 1][0] - route[segment][0]) * k,
          y =
            route[segment][1] + (route[segment + 1][1] - route[segment][1]) * k;
        return (
          <div
            className="summit-player"
            key={p.id}
            style={{
              left: `${(x / 880) * 100}%`,
              top: `${((y - 25 + (i % 2 ? 12 : -12)) / 560) * 100}%`,
              marginLeft: i % 2 ? 12 : -12,
            }}
          >
            <Blob body={p.avatar.body} mood={p.avatar.mood} size={44} />
            <span className="chip">
              {p.rank}. {p.nickname}
            </span>
          </div>
        );
      })}
    </div>
  );
}
