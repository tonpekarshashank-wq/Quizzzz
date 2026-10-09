import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
export interface Connection {
  exec?(sql: string): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Connection {
  transaction<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;
}
export async function migrate(c: Connection) {
  await c.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  for (const name of (await readdir(path.join(process.cwd(), "db/migrations")))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const r = await c.query(
      "SELECT name FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (!r.rows.length) {
      const sql = await readFile(
        path.join(process.cwd(), "db/migrations", name),
        "utf8",
      );
      if (c.exec) await c.exec(sql);
      else await c.query(sql);
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    }
  }
}
let queue = Promise.resolve();
const globalDb = globalThis as unknown as { quizDb?: Promise<Database> };
export function database(): Promise<Database> {
  return (globalDb.quizDb ??= createDatabase().catch((error) => {
    delete globalDb.quizDb;
    throw error;
  }));
}
async function createDatabase(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
    });
    return {
      query: async (sql, params) => pool.query(sql, params),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const result = await fn(c);
          await c.query("COMMIT");
          return result;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    };
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is required outside local development");
  const dir = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR ?? ".data",
  );
  await mkdir(dir, { recursive: true });
  const pg = new PGlite(path.join(dir, "postgres"));
  await pg.waitReady;
  // Serialize all local access so reads cannot accidentally run inside another transaction.
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.then(fn, fn);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const db: Database = {
    query: (sql, params) => run(() => pg.query(sql, params)),
    transaction: (fn) =>
      run(() =>
        pg.transaction((tx) =>
          fn({
            query: (sql, params) => tx.query(sql, params),
            exec: async (sql) => {
              await tx.exec(sql);
            },
          }),
        ),
      ),
  };
  await db.transaction(migrate);
  return db;
}
