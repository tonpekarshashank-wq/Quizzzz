import { database, migrate } from "../src/lib/db";
async function main() {
  if (process.env.MIGRATION_DATABASE_URL)
    process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  const db = await database();
  await db.transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(714209)");
    await migrate(c);
  });
  console.log("Database migrations applied.");
  process.exit(0);
}
main().catch(() => {
  console.error("Migration failed. Check database configuration and access.");
  process.exit(1);
});
