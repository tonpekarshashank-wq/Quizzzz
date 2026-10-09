import { database } from "@/lib/db";
import { maintenanceAuthorized } from "@/lib/maintenance-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!maintenanceAuthorized(request.headers.get("authorization")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await database();
    const outbox = (
      await db.query<{ pending: number; oldest_seconds: number | null }>(
        "SELECT count(*)::int AS pending,extract(epoch FROM now()-min(created_at))::float AS oldest_seconds FROM live_outbox WHERE delivered_at IS NULL",
      )
    ).rows[0];
    const jobs = (
      await db.query<{ overdue: number; oldest_seconds: number | null }>(
        "SELECT count(*)::int AS overdue,extract(epoch FROM now()-min(due_at))::float AS oldest_seconds FROM scheduled_jobs WHERE completed_at IS NULL AND due_at<now()",
      )
    ).rows[0];
    const unscheduled = (
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM scheduled_jobs WHERE completed_at IS NULL AND scheduled_at IS NULL AND due_at>now()",
      )
    ).rows[0].count;
    const healthy =
      (outbox.oldest_seconds ?? 0) < 30 && (jobs.oldest_seconds ?? 0) < 30;
    return Response.json(
      {
        status: healthy ? "ok" : "degraded",
        outbox,
        jobs,
        unscheduled,
        services: {
          database: true,
          ablyConfigured: !!process.env.ABLY_API_KEY,
          workflowEnabled: process.env.WORKFLOW_ENABLED === "true",
        },
      },
      { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
