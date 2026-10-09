import { maintenanceAuthorized } from "@/lib/maintenance-auth";
import { drainLive } from "@/lib/live-delivery";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!maintenanceAuthorized(request.headers.get("authorization")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await drainLive();
  return Response.json(
    { reconciled: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
