import { Rest } from "ably";
import { database } from "./db";
import { reconcileSession, getSession, snapshot, type Actor } from "./game";
import { terminal } from "./game-model";
export function channelName(id: string, version: number) {
  return `quizzzz:${process.env.APP_ENV ?? "development"}:${id}:v${version}`;
}
export async function realtimeToken(id: string, actor: Actor) {
  const snap = await snapshot(id, actor);
  if (!process.env.ABLY_API_KEY) return { mode: "polling" as const };
  const ably = new Rest({ key: process.env.ABLY_API_KEY });
  const channel = channelName(id, snap.channelVersion);
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId:
      actor.role === "host" ? `host:${actor.id}` : `player:${snap.self!.id}`,
    ttl: 60000,
    capability: JSON.stringify({ [channel]: ["subscribe"] }),
  });
  return { mode: "ably" as const, channel, tokenRequest };
}
let draining = false;
const globals = globalThis as unknown as {
  quizWorker?: ReturnType<typeof setInterval>;
};
export function startLocalWorker() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    globals.quizWorker
  )
    return;
  globals.quizWorker = setInterval(
    () => void drainLive().catch(() => {}),
    1000,
  );
  globals.quizWorker.unref();
}
export async function runScheduledJob(id: string) {
  const db = await database();
  const r = (
    await db.query<{
      session_id: string;
      kind: string;
      completed_at: Date | null;
      due_at: Date;
    }>("SELECT * FROM scheduled_jobs WHERE id=$1", [id])
  ).rows[0];
  if (!r || r.completed_at) return null;
  if (new Date(r.due_at).getTime() > Date.now())
    return new Date(r.due_at).toISOString();
  await reconcileSession(r.session_id);
  await db.transaction(async (c) => {
    const j = (
      await c.query<{ kind: string; due_at: Date; completed_at: Date | null }>(
        "SELECT * FROM scheduled_jobs WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!j || j.completed_at) return;
    const s = await getSession(c, r.session_id);
    if (j.kind === "inactivity" && !terminal(s.state)) {
      const due = new Date(
        new Date(s.host_last_seen_at).getTime() + 15 * 60000,
      );
      await c.query(
        "INSERT INTO scheduled_jobs(id,session_id,kind,due_at) VALUES($1,$2,'inactivity',$3)",
        [crypto.randomUUID(), s.id, due],
      );
    }
    await c.query("UPDATE scheduled_jobs SET completed_at=now() WHERE id=$1", [
      id,
    ]);
  });
  return null;
}
export async function drainLive() {
  if (draining) return;
  draining = true;
  try {
    const db = await database();
    const due = (
      await db.query<{ id: string }>(
        "SELECT id FROM scheduled_jobs WHERE completed_at IS NULL AND due_at<=now() ORDER BY due_at LIMIT 20",
      )
    ).rows;
    for (const row of due) await runScheduledJob(row.id);
    if (process.env.WORKFLOW_ENABLED === "true") {
      const pending = (
        await db.query<{ id: string; due_at: Date }>(
          "UPDATE scheduled_jobs SET claimed_until=now()+interval '1 minute' WHERE id IN (SELECT id FROM scheduled_jobs WHERE completed_at IS NULL AND scheduled_at IS NULL AND due_at>now() AND (claimed_until IS NULL OR claimed_until<now()) ORDER BY due_at LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING id,due_at",
        )
      ).rows;
      const { start } = await import("workflow/api");
      const { wakeGame } = await import("../workflows/game-deadline");
      for (const row of pending) {
        try {
          await start(wakeGame, [row.id, new Date(row.due_at).toISOString()]);
          await db.query(
            "UPDATE scheduled_jobs SET scheduled_at=now() WHERE id=$1",
            [row.id],
          );
        } catch {
          await db.query(
            "UPDATE scheduled_jobs SET claimed_until=NULL WHERE id=$1",
            [row.id],
          );
        }
      }
    }
    if (!process.env.ABLY_API_KEY) {
      if (!process.env.VERCEL && process.env.NODE_ENV !== "production")
        await db.query(
          "UPDATE live_outbox SET delivered_at=now() WHERE delivered_at IS NULL",
        );
      return;
    }
    const ably = new Rest({ key: process.env.ABLY_API_KEY });
    await dispatchOutbox(async (channel, notice) => {
      await ably.channels.get(channel).publish("STATE_UPDATED", notice);
    });
  } finally {
    draining = false;
  }
}

export type LiveNotice = {
  eventId: string;
  sessionId: string;
  stateRevision: number;
  emittedAt: string;
  kind: "ANSWER_COUNT" | "STATE";
};
export async function dispatchOutbox(
  publish: (channel: string, notice: LiveNotice) => Promise<void>,
) {
  const db = await database();
  const outbox = (
    await db.query<{
      id: string;
      session_id: string;
      scope_version: number;
      event: string;
      revision: number;
    }>(
      "UPDATE live_outbox SET claimed_until=now()+interval '30 seconds' WHERE id IN (SELECT id FROM live_outbox WHERE delivered_at IS NULL AND (claimed_until IS NULL OR claimed_until<now()) ORDER BY created_at LIMIT 2000 FOR UPDATE SKIP LOCKED) RETURNING id,session_id,scope_version,event,revision",
    )
  ).rows;
  const groups = new Map<string, typeof outbox>();
  for (const row of outbox) {
    const ch = channelName(row.session_id, row.scope_version);
    groups.set(ch, [...(groups.get(ch) ?? []), row]);
  }
  for (const [channel, rows] of groups) {
    const latest = rows.reduce((a, b) => (b.revision >= a.revision ? b : a));
    try {
      await publish(channel, {
        eventId: latest.id,
        sessionId: latest.session_id,
        stateRevision: latest.revision,
        emittedAt: new Date().toISOString(),
        kind: rows.every((r) => r.event === "ANSWER_COUNT")
          ? "ANSWER_COUNT"
          : "STATE",
      });
      await db.query(
        "UPDATE live_outbox SET delivered_at=now(),claimed_until=NULL WHERE id=ANY($1::uuid[])",
        [rows.map((r) => r.id)],
      );
    } catch (e) {
      await db.query(
        "UPDATE live_outbox SET claimed_until=NULL WHERE id=ANY($1::uuid[])",
        [outbox.map((r) => r.id)],
      );
      throw e;
    }
  }
}
