export type GameState =
  | "LOBBY"
  | "QUESTION_ACTIVE"
  | "RESULT_REVEAL"
  | "LEADERBOARD"
  | "COMPLETED"
  | "CANCELLED"
  | "INTERRUPTED";
export type Avatar = { body: number; mood: "smile" | "grin" | "o" };
export type Player = {
  id: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  rank: number | null;
  rankDelta: number | null;
  gain: number;
  connected: boolean;
};
export type PublicQuestion = {
  id: string;
  index: number;
  prompt: string;
  type: "mc" | "tf";
  timeLimit: number;
  basePoints: number;
  startsAt: string | null;
  endsAt: string | null;
  options: { id: string; label: string; key: number }[];
};
export type PlayerResult = {
  status: "correct" | "incorrect" | "unanswered";
  selectedOptionId: string | null;
  correctOptionId: string;
  pointsEarned: number;
  totalScore: number;
  basePoints: number;
  speedMultiplier: number | null;
  responseMs: number | null;
  streak: number;
  rank: number;
  rankDelta: number | null;
  gapToNext: number;
};
export type Snapshot = {
  podium?: import("./game-summary").FinalPlayer[];
  finalPlayer?: import("./game-summary").FinalPlayer;
  awardWinners?: Pick<
    import("./game-summary").FinalPlayer,
    "id" | "nickname" | "avatar" | "awards"
  >[];
  rating?: number | null;
  id: string;
  title: string;
  pin: string;
  state: GameState;
  revision: number;
  channelVersion: number;
  serverTime: string;
  questionCount: number;
  playerCount: number;
  connectedCount: number;
  answeredCount: number;
  capacity: number;
  theme: string;
  hostAway: boolean;
  question: PublicQuestion | null;
  roster?: Player[];
  top: Player[];
  controller?: {
    id: string | null;
    generation: number;
    expiresAt: string | null;
  };
  self?: Player & { streak: number; bestStreak: number };
  acceptedAnswer?: { submissionId: string; selectedOptionId: string };
  result?: PlayerResult;
  reveal?: {
    correctOptionId: string;
    counts: Record<string, number>;
    unanswered: number;
    percentCorrect: number;
    fastestCorrect: {
      nickname: string;
      avatar: Avatar;
      responseMs: number;
    } | null;
  };
};
export function scoreAnswer(
  base: number,
  totalMs: number,
  elapsed: number,
  correct: boolean,
) {
  const multiplier =
    0.5 + (0.5 * (totalMs - Math.max(0, Math.min(totalMs, elapsed)))) / totalMs;
  return {
    points: correct ? Math.floor(base * multiplier + 0.5) : 0,
    multiplier,
  };
}
export type RankingInput = {
  id: string;
  score: number;
  correctScored: number;
  correctMs: number;
  lastCorrectAt: number | null;
};
export function rankPlayers<T extends RankingInput>(players: T[]): T[] {
  return [...players].sort(
    (a, b) =>
      b.score - a.score ||
      b.correctScored - a.correctScored ||
      a.correctMs - b.correctMs ||
      (a.lastCorrectAt ?? Infinity) - (b.lastCorrectAt ?? Infinity) ||
      a.id.localeCompare(b.id),
  );
}
export const terminal = (s: GameState) =>
  ["COMPLETED", "CANCELLED", "INTERRUPTED"].includes(s);
