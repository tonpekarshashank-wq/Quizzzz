import { timingSafeEqual } from "node:crypto";
export function maintenanceAuthorized(
  header: string | null,
  secret = process.env.CRON_SECRET,
) {
  if (!secret) return false;
  const supplied = Buffer.from(header ?? ""),
    expected = Buffer.from(`Bearer ${secret}`);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
