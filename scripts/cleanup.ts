import { database } from "../src/lib/db";
async function main() {
  const db = await database();
  await db.transaction(async (c) => {
    await c.query("DELETE FROM host_sessions WHERE expires_at<now()");
    await c.query("DELETE FROM reset_tokens WHERE expires_at<now()");
    await c.query(
      "DELETE FROM rate_buckets WHERE resets_at<now()-interval '1 day'",
    );
  });
  console.log("Expired authentication data removed.");
  process.exit(0);
}
main().catch(() => {
  console.error("Cleanup failed. Check database configuration.");
  process.exit(1);
});
