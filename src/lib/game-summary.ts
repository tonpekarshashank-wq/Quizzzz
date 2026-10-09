import type { Connection } from "./db";
import type { Avatar, PlayerResult } from "./game-model";
export type Award = "Speed Demon" | "Hot Streak" | "Comeback Kid";
export type FinalPlayer = {
  id: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  rank: number | null;
  correct: number;
  accuracy: number | null;
  averageMs: number | null;
  bestStreak: number;
  awards: Award[];
};
export type FinalSummary = {
  partial: boolean;
  playerCount: number;
  questionCount: number;
  completion: number | null;
  accuracy: number | null;
  averageMs: number | null;
  toughest: {
    id: string;
    index: number;
    prompt: string;
    accuracy: number;
  } | null;
  questions: {
    id: string;
    index: number;
    prompt: string;
    correct: number;
    answered: number;
  }[];
  players: FinalPlayer[];
};
export async function buildSummary(
  c: Connection,
  id: string,
  state: string,
): Promise<FinalSummary> {
  const questions = (
    await c.query<{ id: string; question_index: number; prompt: string }>(
      "SELECT id,question_index,prompt FROM session_questions WHERE session_id=$1 AND closed_at IS NOT NULL ORDER BY question_index",
      [id],
    )
  ).rows;
  const participants = (
    await c.query<{
      id: string;
      nickname: string;
      avatar_body: number;
      avatar_mood: Avatar["mood"];
      score: number;
      best_streak: number;
    }>(
      "SELECT * FROM participants WHERE session_id=$1 AND revoked=false ORDER BY id",
      [id],
    )
  ).rows;
  const responses = (
    await c.query<{
      participant_id: string;
      question_id: string;
      correct: boolean;
      response_ms: number;
    }>(
      "SELECT r.* FROM responses r JOIN session_questions q ON q.id=r.question_id WHERE r.session_id=$1 AND q.closed_at IS NOT NULL",
      [id],
    )
  ).rows;
  const results = (
    await c.query<{
      participant_id: string;
      question_id: string;
      result: PlayerResult;
    }>("SELECT * FROM question_results WHERE session_id=$1", [id])
  ).rows;
  const first = questions[0]?.id,
    last = questions.at(-1)?.id;
  const players = participants
    .map((p) => {
      const own = responses.filter((r) => r.participant_id === p.id),
        correct = own.filter((r) => r.correct);
      const rank =
        results.find((r) => r.participant_id === p.id && r.question_id === last)
          ?.result.rank ?? null;
      const firstRank =
        results.find(
          (r) => r.participant_id === p.id && r.question_id === first,
        )?.result.rank ?? null;
      return {
        id: p.id,
        nickname: p.nickname,
        avatar: { body: p.avatar_body, mood: p.avatar_mood },
        score: p.score,
        rank,
        correct: correct.length,
        accuracy: questions.length ? correct.length / questions.length : null,
        averageMs: own.length
          ? own.reduce((s, r) => s + r.response_ms, 0) / own.length
          : null,
        bestStreak: p.best_streak,
        awards: [] as Award[],
        speed: correct.length
          ? correct.reduce((s, r) => s + r.response_ms, 0) / correct.length
          : null,
        comeback: firstRank !== null && rank !== null ? firstRank - rank : 0,
        answered: own.length,
      };
    })
    .sort(
      (a, b) =>
        (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.id.localeCompare(b.id),
    );
  if (state === "COMPLETED") {
    const speed = players
      .filter((p) => p.speed !== null)
      .sort((a, b) => a.speed! - b.speed! || a.rank! - b.rank!)[0];
    const streak = players
      .filter((p) => p.bestStreak > 0)
      .sort((a, b) => b.bestStreak - a.bestStreak || a.rank! - b.rank!)[0];
    const comeback = players
      .filter((p) => p.comeback > 0 && p.correct > 0)
      .sort((a, b) => b.comeback - a.comeback || a.rank! - b.rank!)[0];
    speed?.awards.push("Speed Demon");
    streak?.awards.push("Hot Streak");
    comeback?.awards.push("Comeback Kid");
  }
  const qs = questions.map((q) => ({
    id: q.id,
    index: q.question_index,
    prompt: q.prompt,
    correct: responses.filter((r) => r.question_id === q.id && r.correct)
      .length,
    answered: responses.filter((r) => r.question_id === q.id).length,
  }));
  const toughest = [...qs].sort(
    (a, b) => a.correct - b.correct || a.index - b.index,
  )[0];
  const denom = participants.length * questions.length;
  return {
    partial: state !== "COMPLETED",
    playerCount: participants.length,
    questionCount: questions.length,
    completion: denom
      ? players.filter((p) => p.answered === questions.length).length /
        participants.length
      : null,
    accuracy: denom ? responses.filter((r) => r.correct).length / denom : null,
    averageMs: responses.length
      ? responses.reduce((s, r) => s + r.response_ms, 0) / responses.length
      : null,
    toughest:
      toughest && participants.length
        ? {
            id: toughest.id,
            index: toughest.index,
            prompt: toughest.prompt,
            accuracy: toughest.correct / participants.length,
          }
        : null,
    questions: qs,
    players: players.map(({ speed, comeback, answered, ...p }) => p),
  };
}
export async function ensureSummary(c: Connection, id: string, state: string) {
  const stored = (
    await c.query<{ final_summary: FinalSummary | null }>(
      "SELECT final_summary FROM quiz_sessions WHERE id=$1",
      [id],
    )
  ).rows[0]?.final_summary;
  if (stored) return stored;
  const summary = await buildSummary(c, id, state);
  await c.query(
    "UPDATE quiz_sessions SET final_summary=$2::jsonb WHERE id=$1 AND final_summary IS NULL",
    [id, JSON.stringify(summary)],
  );
  return summary;
}
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n]|^\s*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
