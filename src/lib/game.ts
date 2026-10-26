import { randomInt } from "node:crypto";
import { database, type Connection } from "./db";
import { ApiError, digest } from "./security";
import { guestToken } from "./game-secret";
import { ensureSummary } from "./game-summary";
import { draftSchema, launchErrors, type Draft } from "./model";
import {
  rankPlayers,
  scoreAnswer,
  terminal,
  type Avatar,
  type GameState,
  type Player,
  type PlayerResult,
  type Snapshot,
} from "./game-model";
type Session = {
  id: string;
  host_id: string;
  title: string;
  pin: string;
  state: GameState;
  revision: number;
  current_index: number;
  capacity: number;
  roster_count: number;
  scope_version: number;
  theme: string;
  controller_id: string | null;
  control_generation: number;
  control_expires_at: Date | null;
  host_last_seen_at: Date;
  intro_ends_at: Date | null;
  ended_at: Date | null;
};
type Q = {
  id: string;
  session_id: string;
  question_index: number;
  prompt: string;
  reveal_fact: string | null;
  type: "mc" | "tf";
  time_limit: number;
  base_points: number;
  correct_option_id: string;
  starts_at: Date | null;
  ends_at: Date | null;
  closed_at: Date | null;
};
type P = {
  id: string;
  session_id: string;
  nickname: string;
  avatar_body: number;
  avatar_mood: Avatar["mood"];
  score: number;
  streak: number;
  best_streak: number;
  revoked: boolean;
  last_seen_at: Date;
};
type R = {
  participant_id: string;
  question_id: string;
  selected_option_id: string;
  submission_id: string;
  received_at: Date;
  response_ms: number;
  correct: boolean;
  points: number;
  base_points: number;
};
export type Actor =
  { role: "host"; id: string } | { role: "player"; token: string };
const date = (d: Date | null) => (d ? new Date(d).toISOString() : null);
function intConfig(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw new Error(`Invalid ${name}`);
  return n;
}
export async function getSession(c: Connection, id: string, lock = true) {
  const r = await c.query<Session>(
    `SELECT * FROM quiz_sessions WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
    [id],
  );
  if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Game not found.");
  return r.rows[0];
}
async function authorize(
  c: Connection,
  s: Session,
  actor: Actor,
): Promise<P | null> {
  if (actor.role === "host") {
    if (actor.id !== s.host_id)
      throw new ApiError(404, "NOT_FOUND", "Game not found.");
    return null;
  }
  const r = await c.query<P>(
    "SELECT * FROM participants WHERE session_id=$1 AND token_hash=$2 AND revoked=false",
    [s.id, digest(actor.token)],
  );
  if (
    !r.rows[0] ||
    (s.ended_at && Date.now() - new Date(s.ended_at).getTime() > 6 * 3600000)
  )
    throw new ApiError(
      401,
      "GUEST_EXPIRED",
      "Your place in this game is no longer available.",
    );
  return r.rows[0];
}
async function emit(c: Connection, s: Session, event: string) {
  await c.query(
    "INSERT INTO live_outbox(id,session_id,event,revision,scope_version) VALUES($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), s.id, event, s.revision, s.scope_version],
  );
}
async function job(
  c: Connection,
  id: string,
  kind: "deadline" | "inactivity" | "intro",
  due: Date,
) {
  await c.query(
    "INSERT INTO scheduled_jobs(id,session_id,kind,due_at) VALUES($1,$2,$3,$4)",
    [crypto.randomUUID(), id, kind, due],
  );
}
async function persistState(c: Connection, s: Session) {
  await c.query(
    "UPDATE quiz_sessions SET state=$2,revision=$3,current_index=$4,theme=$5,ended_at=$6,roster_count=$7,scope_version=$8,intro_ends_at=$9 WHERE id=$1",
    [
      s.id,
      s.state,
      s.revision,
      s.current_index,
      s.theme,
      s.ended_at,
      s.roster_count,
      s.scope_version,
      s.intro_ends_at,
    ],
  );
  if (terminal(s.state) && s.state !== "CANCELLED")
    await ensureSummary(c, s.id, s.state);
}
async function currentQuestion(c: Connection, s: Session) {
  return (
    (
      await c.query<Q>(
        "SELECT * FROM session_questions WHERE session_id=$1 AND question_index=$2",
        [s.id, s.current_index],
      )
    ).rows[0] ?? null
  );
}
export async function createGame(
  hostId: string,
  input: { quizId: string; expectedQuizRevision: number; key: string },
  origin: string,
) {
  const fingerprint = digest(
    JSON.stringify([input.quizId, input.expectedQuizRevision]),
  );
  const db = await database();
  return db.transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${hostId}:${input.key}`,
    ]);
    const prior = await c.query<{
      id: string;
      pin: string;
      create_fingerprint: string;
    }>(
      "SELECT id,pin,create_fingerprint FROM quiz_sessions WHERE host_id=$1 AND create_key=$2",
      [hostId, input.key],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].create_fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Launch request changed.",
        );
      return {
        id: prior.rows[0].id,
        pin: prior.rows[0].pin,
        joinUrl: `${origin}/join?pin=${prior.rows[0].pin}`,
      };
    }
    const r = await c.query<{ draft: Draft; revision: number }>(
      "SELECT draft,revision FROM quizzes WHERE id=$1 AND host_id=$2 AND archived_at IS NULL FOR SHARE",
      [input.quizId, hostId],
    );
    if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Quiz not found.");
    if (r.rows[0].revision !== input.expectedQuizRevision)
      throw new ApiError(
        409,
        "SAVE_CONFLICT",
        "Save your latest quiz before going live.",
      );
    const draft = draftSchema.parse(r.rows[0].draft),
      errors = launchErrors(draft);
    if (errors.length)
      throw new ApiError(422, "QUIZ_INCOMPLETE", errors.join(" "));
    // Serialize PIN selection, retaining leading zeros. PostgreSQL's partial unique index is the final guard.
    await c.query("SELECT pg_advisory_xact_lock(714210)");
    let pin = "";
    for (let i = 0; i < 100; i++) {
      const candidate = String(randomInt(1000000)).padStart(6, "0");
      const existing = await c.query(
        "SELECT id FROM quiz_sessions WHERE pin=$1 AND state NOT IN ('COMPLETED','CANCELLED','INTERRUPTED')",
        [candidate],
      );
      if (!existing.rows.length) {
        pin = candidate;
        break;
      }
    }
    if (!pin)
      throw new ApiError(
        503,
        "PIN_UNAVAILABLE",
        "Try launching again shortly.",
      );
    const id = crypto.randomUUID();
    await c.query(
      "INSERT INTO quiz_sessions(id,host_id,quiz_id,title,pin,capacity,create_key,create_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        hostId,
        input.quizId,
        draft.title,
        pin,
        intConfig("ROOM_CAPACITY", 500),
        input.key,
        fingerprint,
      ],
    );
    for (const [i, q] of draft.questions.entries()) {
      const qid = crypto.randomUUID();
      const options = q.options.map((o) => ({
        id: crypto.randomUUID(),
        source: o.id,
        label: o.label,
      }));
      const correct = options.find((o) => o.source === q.correctOptionId)!.id;
      await c.query(
        "INSERT INTO session_questions(id,session_id,question_index,prompt,type,time_limit,base_points,correct_option_id,reveal_fact) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          qid,
          id,
          i + 1,
          q.prompt,
          q.type,
          q.timeLimit,
          q.basePoints,
          correct,
          q.revealFact || null,
        ],
      );
      for (const [j, o] of options.entries())
        await c.query(
          "INSERT INTO session_options(id,session_id,question_id,label,option_index) VALUES($1,$2,$3,$4,$5)",
          [o.id, id, qid, o.label, j],
        );
    }
    await job(c, id, "inactivity", new Date(Date.now() + 15 * 60000));
    return { id, pin, joinUrl: `${origin}/join?pin=${pin}` };
  });
}
export async function lookupRoom(pin: string) {
  const db = await database();
  const r = await db.query<Session>(
    "SELECT * FROM quiz_sessions WHERE pin=$1 ORDER BY created_at DESC LIMIT 1",
    [pin],
  );
  if (!r.rows[0])
    throw new ApiError(404, "INVALID_PIN", "We couldn't find that game.");
  const s = r.rows[0];
  const count = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM participants WHERE session_id=$1 AND revoked=false",
    [s.id],
  );
  return {
    title: s.title,
    pin: s.pin,
    joinable: s.state === "LOBBY" && count.rows[0].count < s.capacity,
    reason:
      s.state !== "LOBBY"
        ? "ROOM_CLOSED"
        : count.rows[0].count >= s.capacity
          ? "ROOM_FULL"
          : null,
  };
}
export async function joinGame(input: {
  pin: string;
  nickname: string;
  avatar: Avatar;
  joinRequestId: string;
}) {
  const nickname = input.nickname
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim();
  if (!nickname || nickname.length > 25)
    throw new ApiError(
      422,
      "NAME_REJECTED",
      "Choose a nickname of 1–25 characters.",
    );
  if (/\b(fuck|shit|bitch|asshole)\b/i.test(nickname))
    throw new ApiError(
      422,
      "NAME_REJECTED",
      "Please choose a different nickname.",
    );
  const fingerprint = digest(
    JSON.stringify([input.pin, nickname, input.avatar]),
  );
  const db = await database();
  return db.transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      input.joinRequestId,
    ]);
    const prior = await c.query<{
      session_id: string;
      participant_id: string;
      fingerprint: string;
    }>("SELECT * FROM join_receipts WHERE request_id=$1", [
      input.joinRequestId,
    ]);
    if (prior.rows[0]) {
      const p = prior.rows[0];
      if (p.fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Join request changed. Please try again.",
        );
      const raw = await guestToken(input.joinRequestId, p.participant_id);
      const s = await getSession(c, p.session_id);
      const person = await authorize(c, s, { role: "player", token: raw });
      return {
        sessionId: s.id,
        participantId: person!.id,
        nickname: person!.nickname,
        token: raw,
      };
    }
    const r = await c.query<Session>(
      "SELECT * FROM quiz_sessions WHERE pin=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [input.pin],
    );
    if (!r.rows[0])
      throw new ApiError(404, "INVALID_PIN", "We couldn't find that game.");
    const s = r.rows[0];
    await reconcile(c, s);
    if (s.state !== "LOBBY")
      throw new ApiError(
        409,
        "ROOM_CLOSED",
        "This game has already started or ended.",
      );
    const roster = await c.query<{ nickname_key: string }>(
      "SELECT nickname_key FROM participants WHERE session_id=$1 AND revoked=false",
      [s.id],
    );
    if (roster.rows.length >= s.capacity)
      throw new ApiError(409, "ROOM_FULL", "This game is full.");
    const names = new Set(roster.rows.map((p) => p.nickname_key));
    let assigned = nickname;
    // Revoked names stay reserved in the uniqueness constraint; include them when suffixing.
    const allNames = await c.query<{ nickname_key: string }>(
      "SELECT nickname_key FROM participants WHERE session_id=$1",
      [s.id],
    );
    for (const p of allNames.rows) names.add(p.nickname_key);
    assigned = nickname;
    for (let n = 2; names.has(assigned.toLowerCase()); n++) {
      const suffix = `_${n}`;
      assigned = nickname.slice(0, 25 - suffix.length) + suffix;
    }
    const id = crypto.randomUUID(),
      raw = await guestToken(input.joinRequestId, id);
    await c.query(
      "INSERT INTO participants(id,session_id,nickname,nickname_key,avatar_body,avatar_mood,token_hash) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        s.id,
        assigned,
        assigned.toLowerCase(),
        input.avatar.body,
        input.avatar.mood,
        digest(raw),
      ],
    );
    await c.query(
      "INSERT INTO join_receipts(request_id,session_id,participant_id,fingerprint) VALUES($1,$2,$3,$4)",
      [input.joinRequestId, s.id, id, fingerprint],
    );
    await emit(c, s, "ROSTER_UPDATED");
    return {
      sessionId: s.id,
      participantId: id,
      nickname: assigned,
      token: raw,
    };
  });
}
async function closeQuestion(c: Connection, s: Session, q: Q) {
  if (q.closed_at) return;
  const ps = (
    await c.query<P>(
      "SELECT * FROM participants WHERE session_id=$1 AND revoked=false",
      [s.id],
    )
  ).rows;
  const responses = (
    await c.query<R>(
      "SELECT r.*,q.base_points FROM responses r JOIN session_questions q ON q.id=r.question_id WHERE r.session_id=$1 AND (q.closed_at IS NOT NULL OR q.id=$2)",
      [s.id, q.id],
    )
  ).rows;
  const previous = (
    await c.query<{ participant_id: string; result: PlayerResult }>(
      "SELECT participant_id,result FROM question_results WHERE session_id=$1 AND question_id=(SELECT id FROM session_questions WHERE session_id=$1 AND question_index=$2)",
      [s.id, s.current_index - 1],
    )
  ).rows;
  const previousRanks = new Map(
    previous.map((r) => [r.participant_id, r.result.rank]),
  );
  const ranked = rankPlayers(
    ps.map((p) => {
      const own = responses.filter((r) => r.participant_id === p.id);
      const correct = own.filter((r) => r.correct && r.base_points > 0);
      return {
        ...p,
        score: own.reduce((sum, r) => sum + r.points, 0),
        correctScored: correct.length,
        correctMs: correct.reduce((sum, r) => sum + r.response_ms, 0),
        lastCorrectAt: correct.length
          ? Math.max(...correct.map((r) => new Date(r.received_at).getTime()))
          : null,
      };
    }),
  );
  const updates = ranked.map((p, i) => {
    const answer = responses.find(
      (r) => r.participant_id === p.id && r.question_id === q.id,
    );
    const streak = answer?.correct ? p.streak + 1 : 0;
    const result: PlayerResult = {
      status: answer
        ? answer.correct
          ? "correct"
          : "incorrect"
        : "unanswered",
      selectedOptionId: answer?.selected_option_id ?? null,
      correctOptionId: q.correct_option_id,
      pointsEarned: answer?.points ?? 0,
      totalScore: p.score,
      basePoints: q.base_points,
      speedMultiplier: answer
        ? scoreAnswer(
            q.base_points,
            q.time_limit * 1000,
            answer.response_ms,
            answer.correct,
          ).multiplier
        : null,
      responseMs: answer?.response_ms ?? null,
      streak,
      rank: i + 1,
      rankDelta: previousRanks.has(p.id)
        ? previousRanks.get(p.id)! - (i + 1)
        : null,
      gapToNext: i ? ranked[i - 1].score - p.score : 0,
    };
    return {
      id: p.id,
      score: p.score,
      streak,
      best_streak: Math.max(p.best_streak, streak),
      result,
    };
  });
  await c.query(
    "UPDATE participants p SET score=x.score,streak=x.streak,best_streak=x.best_streak FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,score int,streak int,best_streak int) WHERE p.id=x.id",
    [JSON.stringify(updates)],
  );
  await c.query(
    "INSERT INTO question_results(session_id,question_id,participant_id,result) SELECT $1,$2,x.id,x.result FROM jsonb_to_recordset($3::jsonb) AS x(id uuid,result jsonb)",
    [s.id, q.id, JSON.stringify(updates)],
  );
  await c.query("UPDATE session_questions SET closed_at=now() WHERE id=$1", [
    q.id,
  ]);
  s.state = "RESULT_REVEAL";
  s.revision++;
  await persistState(c, s);
  await emit(c, s, "QUESTION_END");
}
async function reconcile(c: Connection, s: Session) {
  if (terminal(s.state)) return;
  if (
    s.state === "QUESTION_INTRO" &&
    s.intro_ends_at &&
    Date.now() >= new Date(s.intro_ends_at).getTime() &&
    Date.now() - new Date(s.host_last_seen_at).getTime() < 15 * 60000
  ) {
    await activateQuestion(c, s, s.current_index);
    s.revision++;
    await persistState(c, s);
    await emit(c, s, "QUESTION_START");
  }
  const q = await currentQuestion(c, s);
  if (
    s.state === "QUESTION_ACTIVE" &&
    q?.ends_at &&
    Date.now() >= new Date(q.ends_at).getTime()
  )
    await closeQuestion(c, s, q);
  if (Date.now() - new Date(s.host_last_seen_at).getTime() >= 15 * 60000) {
    if (s.state === "QUESTION_ACTIVE" && q) await closeQuestion(c, s, q);
    s.state = "INTERRUPTED";
    s.revision++;
    s.ended_at = new Date();
    await persistState(c, s);
    await emit(c, s, "SESSION_INTERRUPTED");
  }
}
export async function claimControl(
  id: string,
  hostId: string,
  controllerId: string,
  takeover = false,
) {
  const db = await database();
  return db.transaction(async (c) => {
    const s = await getSession(c, id);
    await authorize(c, s, { role: "host", id: hostId });
    await reconcile(c, s);
    if (terminal(s.state))
      return { generation: s.control_generation, expiresAt: null };
    const live =
      s.control_expires_at &&
      new Date(s.control_expires_at).getTime() > Date.now();
    if (live && s.controller_id !== controllerId && !takeover)
      throw new ApiError(
        409,
        "CONTROL_HELD",
        "This game is controlled in another tab. Take over to continue here.",
      );
    const generation =
      s.controller_id === controllerId && live
        ? s.control_generation
        : s.control_generation + 1;
    const expires = new Date(Date.now() + 30000);
    await c.query(
      "UPDATE quiz_sessions SET controller_id=$2,control_generation=$3,control_expires_at=$4,host_last_seen_at=now() WHERE id=$1",
      [id, controllerId, generation, expires],
    );
    await emit(c, s, "CONTROL_CHANGED");
    return { generation, expiresAt: date(expires) };
  });
}
function checkControl(
  s: Session,
  input: { controllerId: string; generation: number },
) {
  if (
    s.controller_id !== input.controllerId ||
    s.control_generation !== input.generation ||
    !s.control_expires_at ||
    new Date(s.control_expires_at).getTime() <= Date.now()
  )
    throw new ApiError(
      403,
      "CONTROL_LOST",
      "Hosting control expired. Restore control to continue.",
    );
}
export async function heartbeat(
  id: string,
  hostId: string,
  input: { controllerId: string; generation: number },
) {
  const db = await database();
  await db.transaction(async (c) => {
    const s = await getSession(c, id);
    await authorize(c, s, { role: "host", id: hostId });
    await reconcile(c, s);
    if (terminal(s.state)) return;
    checkControl(s, input);
    await c.query(
      "UPDATE quiz_sessions SET control_expires_at=now()+interval '30 seconds',host_last_seen_at=now() WHERE id=$1",
      [id],
    );
  });
  return { ok: true };
}
async function startQuestion(c: Connection, s: Session, index: number) {
  const count = (
    await c.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM session_questions WHERE session_id=$1",
      [s.id],
    )
  ).rows[0].count;
  if (index !== count) return activateQuestion(c, s, index);
  s.current_index = index;
  s.state = "QUESTION_INTRO";
  s.intro_ends_at = new Date(Date.now() + 1500);
  await job(c, s.id, "intro", s.intro_ends_at);
}
async function activateQuestion(c: Connection, s: Session, index: number) {
  const now = new Date();
  const q = (
    await c.query<Q>(
      "SELECT * FROM session_questions WHERE session_id=$1 AND question_index=$2",
      [s.id, index],
    )
  ).rows[0];
  if (!q)
    throw new ApiError(409, "NO_QUESTION", "There are no more questions.");
  const ends = new Date(now.getTime() + q.time_limit * 1000);
  await c.query(
    "UPDATE session_questions SET starts_at=$2,ends_at=$3 WHERE id=$1",
    [q.id, now, ends],
  );
  s.current_index = index;
  s.state = "QUESTION_ACTIVE";
  s.intro_ends_at = null;
  await job(c, s.id, "deadline", ends);
}
export async function command(
  id: string,
  hostId: string,
  input: {
    controllerId: string;
    generation: number;
    expectedRevision: number;
    commandId: string;
    action: string;
    participantId?: string;
  },
) {
  const db = await database();
  return db.transaction(async (c) => {
    const s = await getSession(c, id);
    await authorize(c, s, { role: "host", id: hostId });
    const fingerprint = digest(
      JSON.stringify([
        input.action,
        input.participantId ?? null,
        input.expectedRevision,
        input.controllerId,
        input.generation,
      ]),
    );
    const prior = (
      await c.query<{
        fingerprint: string;
        outcome: { state: GameState; revision: number };
      }>(
        "SELECT * FROM command_receipts WHERE session_id=$1 AND command_id=$2",
        [id, input.commandId],
      )
    ).rows[0];
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Command data changed.",
        );
      return prior.outcome;
    }
    await reconcile(c, s);
    checkControl(s, input);
    if (s.revision !== input.expectedRevision)
      throw new ApiError(
        409,
        "STATE_CHANGED",
        "The game changed. Refreshing the current state.",
      );
    if (terminal(s.state))
      throw new ApiError(409, "ROOM_CLOSED", "This game has ended.");
    if (input.action === "START_GAME" && s.state === "LOBBY") {
      const count = (
        await c.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM participants WHERE session_id=$1 AND revoked=false",
          [id],
        )
      ).rows[0].count;
      if (!count)
        throw new ApiError(409, "EMPTY_LOBBY", "Wait for at least one player.");
      s.roster_count = count;
      await startQuestion(c, s, 1);
    } else if (
      input.action === "KICK_PLAYER" &&
      s.state === "LOBBY" &&
      input.participantId
    ) {
      await emit(c, s, "ACCESS_CHANGED");
      s.scope_version++;
      await c.query(
        "UPDATE participants SET revoked=true WHERE id=$1 AND session_id=$2",
        [input.participantId, id],
      );
    } else if (input.action === "CANCEL" && s.state === "LOBBY") {
      s.state = "CANCELLED";
      s.ended_at = new Date();
    } else if (
      input.action === "SHOW_LEADERBOARD" &&
      s.state === "RESULT_REVEAL"
    ) {
      s.state = "LEADERBOARD";
      const themes = ["summit", "gp", "tour", "moon", "map"].filter(
        (t) => s.current_index === 1 || t !== s.theme,
      );
      s.theme = themes[randomInt(themes.length)];
    } else if (input.action === "NEXT_QUESTION" && s.state === "LEADERBOARD") {
      await startQuestion(c, s, s.current_index + 1);
    } else if (input.action === "FINISH_GAME" && s.state === "LEADERBOARD") {
      const count = (
        await c.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM session_questions WHERE session_id=$1",
          [id],
        )
      ).rows[0].count;
      if (count !== s.current_index)
        throw new ApiError(
          409,
          "QUESTIONS_REMAIN",
          "Finish the remaining questions first.",
        );
      s.state = "COMPLETED";
      s.ended_at = new Date();
    } else if (input.action === "END_EARLY" && s.state !== "LOBBY") {
      const q = await currentQuestion(c, s);
      if (s.state === "QUESTION_ACTIVE" && q) await closeQuestion(c, s, q);
      s.state = "INTERRUPTED";
      s.ended_at = new Date();
    } else
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "That action isn't available right now.",
      );
    s.revision++;
    await persistState(c, s);
    await emit(
      c,
      s,
      String(s.state) === "QUESTION_ACTIVE"
        ? "QUESTION_START"
        : s.state === "COMPLETED"
          ? "GAME_END"
          : s.state === "LEADERBOARD"
            ? "LEADERBOARD"
            : "STATE_CHANGED",
    );
    const outcome = { state: s.state, revision: s.revision };
    await c.query(
      "INSERT INTO command_receipts(session_id,command_id,fingerprint,outcome) VALUES($1,$2,$3,$4::jsonb)",
      [id, input.commandId, fingerprint, JSON.stringify(outcome)],
    );
    return outcome;
  });
}
export async function submitAnswer(
  id: string,
  raw: string,
  input: { questionId: string; selectedOptionId: string; submissionId: string },
  receivedAt = new Date(),
) {
  const db = await database();
  const outcome = await db.transaction(async (c) => {
    const s = await getSession(c, id);
    const p = await authorize(c, s, { role: "player", token: raw });
    const existing = (
      await c.query<R>(
        "SELECT * FROM responses WHERE participant_id=$1 AND (question_id=$2 OR submission_id=$3)",
        [p!.id, input.questionId, input.submissionId],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.question_id !== input.questionId ||
        existing.submission_id !== input.submissionId ||
        existing.selected_option_id !== input.selectedOptionId
      )
        throw new ApiError(
          409,
          "ALREADY_ANSWERED",
          "Your first accepted answer is already locked in.",
        );
      return {
        submissionId: existing.submission_id,
        questionId: existing.question_id,
        selectedOptionId: existing.selected_option_id,
        accepted: true,
        acceptedAt: date(existing.received_at),
      };
    }
    await reconcile(c, s);
    const q = await currentQuestion(c, s);
    if (
      s.state !== "QUESTION_ACTIVE" ||
      !q ||
      q.id !== input.questionId ||
      !q.ends_at ||
      !q.starts_at ||
      receivedAt.getTime() < new Date(q.starts_at).getTime() ||
      receivedAt.getTime() >= new Date(q.ends_at).getTime()
    )
      return new ApiError(
        409,
        "QUESTION_EXPIRED",
        "This question is closed. Waiting for the results.",
      );
    const option = await c.query(
      "SELECT id FROM session_options WHERE question_id=$1 AND id=$2",
      [q.id, input.selectedOptionId],
    );
    if (!option.rows.length)
      throw new ApiError(
        422,
        "INVALID_OPTION",
        "Choose an answer from this question.",
      );
    const elapsed = Math.max(
      0,
      receivedAt.getTime() - new Date(q.starts_at!).getTime(),
    );
    const correct = input.selectedOptionId === q.correct_option_id,
      points = scoreAnswer(
        q.base_points,
        q.time_limit * 1000,
        elapsed,
        correct,
      ).points;
    await c.query(
      "INSERT INTO responses(id,session_id,participant_id,question_id,selected_option_id,submission_id,received_at,response_ms,correct,points) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        crypto.randomUUID(),
        id,
        p!.id,
        q.id,
        input.selectedOptionId,
        input.submissionId,
        receivedAt,
        elapsed,
        correct,
        points,
      ],
    );
    await emit(c, s, "ANSWER_COUNT");
    return {
      submissionId: input.submissionId,
      questionId: q.id,
      selectedOptionId: input.selectedOptionId,
      accepted: true,
      acceptedAt: date(receivedAt),
    };
  });
  if (outcome instanceof ApiError) throw outcome;
  return outcome;
}
export async function snapshot(id: string, actor: Actor): Promise<Snapshot> {
  const db = await database();
  return db.transaction(async (c) => {
    const s = await getSession(c, id);
    let self = await authorize(c, s, actor);
    await reconcile(c, s);
    if (self) {
      await c.query(
        "UPDATE participants SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '15 seconds'",
        [self.id],
      );
      self = (
        await c.query<P>("SELECT * FROM participants WHERE id=$1", [self.id])
      ).rows[0];
    }
    const q = await currentQuestion(c, s);
    const count = (
      await c.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM session_questions WHERE session_id=$1",
        [id],
      )
    ).rows[0].count;
    const ps = (
      await c.query<P>(
        "SELECT * FROM participants WHERE session_id=$1 AND revoked=false ORDER BY joined_at,id",
        [id],
      )
    ).rows;
    const results = q
      ? (
          await c.query<{ participant_id: string; result: PlayerResult }>(
            "SELECT participant_id,result FROM question_results WHERE question_id=$1",
            [q.id],
          )
        ).rows
      : [];
    const map = new Map(results.map((r) => [r.participant_id, r.result]));
    const standings =
      q && s.state === "QUESTION_ACTIVE" && q.question_index > 0
        ? (
            await c.query<{ participant_id: string; result: PlayerResult }>(
              "SELECT r.participant_id,r.result FROM question_results r JOIN session_questions q ON q.id=r.question_id WHERE q.session_id=$1 AND q.question_index=$2",
              [id, q.question_index - 1],
            )
          ).rows
        : results;
    const rankMap = new Map(standings.map((r) => [r.participant_id, r.result]));
    const players: Player[] = ps.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: { body: p.avatar_body, mood: p.avatar_mood },
      score: p.score,
      rank: rankMap.get(p.id)?.rank ?? null,
      rankDelta: rankMap.get(p.id)?.rankDelta ?? null,
      gain: map.get(p.id)?.pointsEarned ?? 0,
      connected: Date.now() - new Date(p.last_seen_at).getTime() < 45000,
    }));
    const options = q
      ? (
          await c.query<{ id: string; label: string; option_index: number }>(
            "SELECT * FROM session_options WHERE question_id=$1 ORDER BY option_index",
            [q.id],
          )
        ).rows
      : [];
    const responses = q
      ? (
          await c.query<R>("SELECT * FROM responses WHERE question_id=$1", [
            q.id,
          ])
        ).rows
      : [];
    const output: Snapshot = {
      id,
      title: s.title,
      pin: s.pin,
      state: s.state,
      revision: s.revision,
      channelVersion: s.scope_version,
      serverTime: new Date().toISOString(),
      questionCount: count,
      playerCount: s.current_index ? s.roster_count : ps.length,
      connectedCount: players.filter((p) => p.connected).length,
      answeredCount: responses.length,
      capacity: s.capacity,
      theme: s.theme,
      hostAway:
        !terminal(s.state) &&
        (!s.control_expires_at ||
          new Date(s.control_expires_at).getTime() < Date.now()),
      intro:
        s.state === "QUESTION_INTRO" && s.intro_ends_at
          ? { endsAt: date(s.intro_ends_at)!, questionIndex: s.current_index }
          : undefined,
      question:
        q && s.state !== "QUESTION_INTRO"
          ? {
              id: q.id,
              index: q.question_index,
              prompt: q.prompt,
              type: q.type,
              timeLimit: q.time_limit,
              basePoints: q.base_points,
              startsAt: date(q.starts_at),
              endsAt: date(q.ends_at),
              options: options.map((o) => ({
                id: o.id,
                label: o.label,
                key:
                  q.type === "tf"
                    ? o.option_index === 0
                      ? 1
                      : 0
                    : o.option_index,
              })),
            }
          : null,
      top: players
        .filter((p) => p.rank !== null)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, 5),
    };
    if (actor.role === "host") {
      output.roster = players;
      output.controller = {
        id: s.controller_id,
        generation: s.control_generation,
        expiresAt: date(s.control_expires_at),
      };
    }
    if (self) {
      output.self = {
        ...players.find((p) => p.id === self!.id)!,
        streak: self.streak,
        bestStreak: self.best_streak,
      };
      const accepted = responses.find((r) => r.participant_id === self!.id);
      if (accepted)
        output.acceptedAnswer = {
          submissionId: accepted.submission_id,
          selectedOptionId: accepted.selected_option_id,
        };
      if (map.has(self.id)) output.result = map.get(self.id);
    }
    if (q?.closed_at) {
      const fastest = responses
        .filter((r) => r.correct)
        .sort(
          (a, b) =>
            a.response_ms - b.response_ms ||
            a.participant_id.localeCompare(b.participant_id),
        )[0];
      const person = fastest
        ? ps.find((p) => p.id === fastest.participant_id)
        : null;
      output.reveal = {
        ...(q.reveal_fact ? { fact: q.reveal_fact } : {}),
        correctOptionId: q.correct_option_id,
        counts: Object.fromEntries(
          options.map((o) => [
            o.id,
            responses.filter((r) => r.selected_option_id === o.id).length,
          ]),
        ),
        unanswered: Math.max(0, s.roster_count - responses.length),
        percentCorrect: s.roster_count
          ? responses.filter((r) => r.correct).length / s.roster_count
          : 0,
        fastestCorrect:
          fastest && person
            ? {
                nickname: person.nickname,
                avatar: { body: person.avatar_body, mood: person.avatar_mood },
                responseMs: fastest.response_ms,
              }
            : null,
      };
    }
    if (terminal(s.state) && s.state !== "CANCELLED") {
      const summary = await ensureSummary(c, id, s.state);
      if (actor.role === "host") output.podium = summary.players.slice(0, 3);
      output.awardWinners = summary.players
        .filter((p) => p.awards.length)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          awards: p.awards,
        }));
      if (self)
        output.finalPlayer = summary.players.find((p) => p.id === self.id);
      if (self && s.state === "COMPLETED")
        output.rating =
          (
            await c.query<{ value: number }>(
              "SELECT value FROM player_ratings WHERE participant_id=$1",
              [self.id],
            )
          ).rows[0]?.value ?? null;
    }
    return output;
  });
}
export async function reconcileSession(id: string) {
  const db = await database();
  await db.transaction(async (c) => {
    const s = await getSession(c, id);
    await reconcile(c, s);
  });
}

export async function rateGame(id: string, raw: string, value: number) {
  const db = await database();
  return db.transaction(async (c) => {
    const s = await getSession(c, id);
    const p = await authorize(c, s, { role: "player", token: raw });
    if (s.state !== "COMPLETED")
      throw new ApiError(
        409,
        "RATING_UNAVAILABLE",
        "Ratings open after a completed game.",
      );
    const existing = (
      await c.query<{ value: number }>(
        "SELECT value FROM player_ratings WHERE participant_id=$1",
        [p!.id],
      )
    ).rows[0];
    if (existing) {
      if (existing.value !== value)
        throw new ApiError(
          409,
          "ALREADY_RATED",
          "Your rating is already saved.",
        );
      return { value: existing.value };
    }
    await c.query(
      "INSERT INTO player_ratings(session_id,participant_id,value) VALUES($1,$2,$3)",
      [id, p!.id, value],
    );
    return { value };
  });
}
