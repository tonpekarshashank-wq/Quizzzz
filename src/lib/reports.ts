import { database } from "./db";
import { snapshot } from "./game";
import { ApiError } from "./security";
import { ensureSummary, csvCell, type FinalSummary } from "./game-summary";
export type ReportAnswer = {
  participant_id: string;
  question_id: string;
  label: string;
  correct: boolean;
  response_ms: number;
  points: number;
};
export type Report = {
  id: string;
  title: string;
  state: string;
  endedAt: string;
  summary: FinalSummary;
  answers: ReportAnswer[];
  rating: { count: number; average: number | null };
  offset: number;
  hasMore: boolean;
};
export async function listReports(owner: string, offset = 0) {
  const db = await database();
  const rows = (
    await db.query<{
      id: string;
      title: string;
      state: string;
      ended_at: Date;
    }>(
      "SELECT id,title,state,ended_at FROM quiz_sessions WHERE host_id=$1 AND ended_at IS NOT NULL ORDER BY ended_at DESC,id LIMIT 21 OFFSET $2",
      [owner, offset],
    )
  ).rows;
  return {
    items: rows.slice(0, 20).map((r) => ({
      id: r.id,
      title: r.title,
      state: r.state,
      endedAt: new Date(r.ended_at).toISOString(),
    })),
    hasMore: rows.length > 20,
  };
}
export async function getReport(
  owner: string,
  id: string,
  options: { offset?: number; allPlayers?: boolean } = {},
): Promise<Report> {
  const snap = await snapshot(id, { role: "host", id: owner });
  if (!["COMPLETED", "INTERRUPTED"].includes(snap.state))
    throw new ApiError(
      409,
      "REPORT_UNAVAILABLE",
      snap.state === "CANCELLED"
        ? "Cancelled lobbies have no game analytics."
        : "Reports open when this game ends.",
    );
  const db = await database();
  return db.transaction(async (c) => {
    const session = (
      await c.query<{ title: string; state: string; ended_at: Date }>(
        "SELECT title,state,ended_at FROM quiz_sessions WHERE id=$1 AND host_id=$2 FOR UPDATE",
        [id, owner],
      )
    ).rows[0];
    if (!session) throw new ApiError(404, "NOT_FOUND", "Game not found.");
    const summary = await ensureSummary(c, id, session.state);
    const offset = options.allPlayers ? 0 : Math.max(0, options.offset ?? 0);
    const selected = options.allPlayers
      ? summary.players
      : summary.players.slice(offset, offset + 25);
    const answers = (
      await c.query<ReportAnswer>(
        "SELECT r.participant_id,r.question_id,o.label,r.correct,r.response_ms,r.points FROM responses r JOIN session_options o ON o.id=r.selected_option_id JOIN session_questions q ON q.id=r.question_id WHERE r.session_id=$1 AND q.closed_at IS NOT NULL AND r.participant_id=ANY($2::uuid[])",
        [id, selected.map((p) => p.id)],
      )
    ).rows;
    const ratings = (
      await c.query<{ value: number }>(
        "SELECT value FROM player_ratings WHERE session_id=$1",
        [id],
      )
    ).rows;
    return {
      id,
      title: session.title,
      state: session.state,
      endedAt: new Date(session.ended_at).toISOString(),
      summary: { ...summary, players: selected },
      offset,
      hasMore: !options.allPlayers && offset + 25 < summary.players.length,
      answers,
      rating: {
        count: ratings.length,
        average: ratings.length
          ? ratings.reduce((s, r) => s + r.value, 0) / ratings.length
          : null,
      },
    };
  });
}
export function* reportCsvLines(report: Report) {
  const headers = [
    "Nickname",
    "Score",
    "Rank",
    "Report status",
    "Accuracy",
    "Awards",
    ...report.summary.questions.flatMap((q) => [
      `Q${q.index} prompt`,
      `Q${q.index} selected option`,
      `Q${q.index} status`,
      `Q${q.index} correct`,
      `Q${q.index} response ms`,
      `Q${q.index} points`,
    ]),
  ];
  yield "\uFEFF" + headers.map(csvCell).join(",") + "\r\n";
  const answers = new Map(
    report.answers.map((a) => [`${a.participant_id}:${a.question_id}`, a]),
  );
  for (const p of report.summary.players) {
    const row = [
      p.nickname,
      p.score,
      p.rank,
      report.summary.partial ? "Partial" : "Completed",
      p.accuracy === null ? null : p.accuracy * 100,
      p.awards.join("; "),
      ...report.summary.questions.flatMap((q) => {
        const a = answers.get(`${p.id}:${q.id}`);
        return [
          q.prompt,
          a?.label,
          a ? (a.correct ? "correct" : "incorrect") : "unanswered",
          a?.correct,
          a?.response_ms,
          a?.points,
        ];
      }),
    ];
    yield row.map(csvCell).join(",") + "\r\n";
  }
}
export function reportCsv(report: Report) {
  return [...reportCsvLines(report)].join("");
}
