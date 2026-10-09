import { currentHost } from "@/lib/auth";
import { getReport, reportCsvLines } from "@/lib/reports";
import { ApiError } from "@/lib/security";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const host = await currentHost();
  if (!host)
    return Response.json(
      { error: "Sign in to download this report." },
      { status: 401 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const report = await getReport(host.id, id, { allPlayers: true });
    const rows = reportCsvLines(report),
      encoder = new TextEncoder();
    const stream = new ReadableStream({
      pull(controller) {
        const row = rows.next();
        if (row.done) controller.close();
        else controller.enqueue(encoder.encode(row.value));
      },
      cancel() {
        rows.return();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="quizzzz-${id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof ApiError ? e.message : "Report unavailable" },
      { status: e instanceof ApiError ? e.status : 503 },
    );
  }
}
