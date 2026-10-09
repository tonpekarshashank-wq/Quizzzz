import { database } from "./db";
import { ApiError } from "./security";
import type { Draft, Quiz } from "./model";
type Row = {
  id: string;
  draft: Draft;
  revision: number;
  created_at: Date;
  updated_at: Date;
};
function quiz(row: Row): Quiz {
  return {
    id: row.id,
    draft: row.draft,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
export async function listQuizzes(owner: string, offset = 0) {
  const db = await database();
  const r = await db.query<Row>(
    "SELECT id,draft,revision,created_at,updated_at FROM quizzes WHERE host_id=$1 AND archived_at IS NULL ORDER BY updated_at DESC,id LIMIT 21 OFFSET $2",
    [owner, offset],
  );
  return { items: r.rows.slice(0, 20).map(quiz), hasMore: r.rows.length > 20 };
}
export type OpenGame = {
  id: string;
  title: string;
  pin: string;
  state: string;
};
export async function listOpenGames(owner: string) {
  const db = await database();
  return (
    await db.query<OpenGame>(
      "SELECT id,title,pin,state FROM quiz_sessions WHERE host_id=$1 AND state NOT IN ('COMPLETED','CANCELLED','INTERRUPTED') ORDER BY created_at DESC LIMIT 20",
      [owner],
    )
  ).rows;
}
export async function getQuiz(owner: string, id: string) {
  const db = await database();
  const r = await db.query<Row>(
    "SELECT id,draft,revision,created_at,updated_at FROM quizzes WHERE id=$1 AND host_id=$2 AND archived_at IS NULL",
    [id, owner],
  );
  if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Quiz not found.");
  return quiz(r.rows[0]);
}
export async function createQuiz(owner: string, draft: Draft) {
  const db = await database();
  const r = await db.query<Row>(
    "INSERT INTO quizzes(id,host_id,draft) VALUES($1,$2,$3::jsonb) RETURNING id,draft,revision,created_at,updated_at",
    [crypto.randomUUID(), owner, JSON.stringify(draft)],
  );
  return quiz(r.rows[0]);
}
export async function saveQuiz(
  owner: string,
  id: string,
  draft: Draft,
  revision: number,
) {
  const db = await database();
  const r = await db.query<Row>(
    "UPDATE quizzes SET draft=$3::jsonb, revision=revision+1,updated_at=now() WHERE id=$1 AND host_id=$2 AND revision=$4 AND archived_at IS NULL RETURNING id,draft,revision,created_at,updated_at",
    [id, owner, JSON.stringify(draft), revision],
  );
  if (!r.rows.length) {
    await getQuiz(owner, id);
    throw new ApiError(
      409,
      "SAVE_CONFLICT",
      "This quiz changed in another tab. Your edits are kept here; download a copy before loading the latest version.",
    );
  }
  return quiz(r.rows[0]);
}
export async function archiveQuiz(owner: string, id: string) {
  const db = await database();
  const r = await db.query(
    "UPDATE quizzes SET archived_at=now(),revision=revision+1 WHERE id=$1 AND host_id=$2 AND archived_at IS NULL RETURNING id",
    [id, owner],
  );
  if (!r.rows.length) throw new ApiError(404, "NOT_FOUND", "Quiz not found.");
}
