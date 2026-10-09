# Neon setup for Quizzzz

Create one isolated staging database first. Here, **staging** means a test environment for this application before real users are invited; it is a naming choice, not a Neon paid feature. These steps do not create a production database or import existing local data.

## 1. Create the project

1. Sign up or sign in at [Neon Console](https://console.neon.tech).
2. Select **New Project**, or use the initial project creation screen shown during signup.
3. Set **Project name** to `quizzzz-staging`.
4. Select **AWS Asia Pacific (Singapore)**, region ID `aws-ap-southeast-1`. This matches the application's Vercel `sin1` configuration. A project's region cannot be changed after creation; moving regions requires a new project and data migration. [Region documentation](https://neon.com/docs/introduction/regions).
5. Keep **Postgres database** enabled and use the default supported Postgres version. Quizzzz uses ordinary PostgreSQL tables and does not require additional Neon services. Neon Auth, Functions, Object Storage and AI Gateway are not required for this build.
6. Click **Create project**. For initial setup, use the available Free plan; this does not establish that its capacity is sufficient for the 500-player release.

The labels above follow [Neon's project creation documentation](https://neon.com/docs/manage/projects). The first-account onboarding screen may arrange the same selections differently.

## 2. Choose the database target

Open **Connect** and select the branch, database and database role. You can use the default branch and the default `neondb` database/owner role for this isolated staging project. Record their names so you select the same target in the SQL editor later. There is no need to rename the default branch to `staging`: the entire `quizzzz-staging` project is dedicated to testing.

Keep the initial read-write compute settings for the first smoke test. Measure cold starts, compute consumption and burst performance before changing its size or treating this configuration as production-ready.

## 3. Copy two connection strings

Within **Connect**, keep the same branch/database/role selected:

| Connection selection | Where it goes | How to recognize it |
| --- | --- | --- |
| Connection pooling enabled | `DATABASE_URL` | Hostname contains `-pooler`. Used by the running app and Vercel functions. |
| Connection pooling disabled / direct | `MIGRATION_DATABASE_URL` | Hostname does not contain `-pooler`. Used for applying schema migrations. |

Copy the complete PostgreSQL URLs, including the password and all SSL/query parameters supplied by Neon. Copy the raw URL rather than a `psql` command or an entire language snippet. Do not manually replace the hostname or remove SSL parameters. Both URLs contain credentials. [Connection documentation](https://neon.com/docs/get-started/connect-neon).

## 4. Store credentials locally

In your IDE, create **`.env.neon`** in the repository root, beside `package.json`. Enter:

```dotenv
DATABASE_URL="PASTE_THE_COMPLETE_POOLED_URL_HERE"
MIGRATION_DATABASE_URL="PASTE_THE_COMPLETE_DIRECT_URL_HERE"
```

Replace only the placeholder text, keeping quotes around the values. `.env.neon` is ignored by this repository's `.gitignore`. This dedicated file lets you apply migrations without switching your normal local development app away from embedded storage. Next.js does not automatically load `.env.neon`.

In the IDE terminal, run:

```bash
cd /Users/shashankt/Quizzzz/Quizzzz
git check-ignore .env.neon
```

Expected output: `.env.neon`. Keep this file out of Git and do not paste its contents into chat. The Neon database URL is sufficient; no Neon API key is required for this application's database connection.

## 5. Apply the schema

Use Node.js 22.13 or newer and the project's installed dependencies. From the repository root:

```bash
node --env-file=.env.neon --import=tsx scripts/migrate.ts
```

This explicitly loads the credential file, runs the existing migration script and prefers `MIGRATION_DATABASE_URL`. It creates the application schema and records migrations under a database lock. Expected output:

```text
Database migrations applied.
```

Do not run plain `npm run db:migrate` and assume it reads `.env.neon` or `.env.local`: the existing script only reads process environment variables. With neither URL loaded, local mode would migrate embedded storage instead. The command above avoids that mistake.

Running the command again skips migrations already recorded. No application account, sample quiz or existing `.data` record is copied to Neon; register a new staging host later through the app.

## 6. Verify in Neon

Open **SQL Editor** and select the same branch/database used for both connection strings. Run:

```sql
SELECT current_database(), current_user;

SELECT name, applied_at
FROM schema_migrations
ORDER BY name;
```

Expect these five migration names:

```text
001_foundations.sql
002_expiry_indexes.sql
003_live_sessions.sql
004_final_results.sql
005_delivery_claims.sql
```

Then inspect the tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Among the results you should see `users`, `quizzes`, `quiz_sessions`, `participants`, `responses`, `question_results`, `live_outbox`, `scheduled_jobs` and `player_ratings`. Seeing five recorded migrations in Neon, rather than only the terminal success message, confirms the intended database was migrated.

## 7. Connect Vercel when ready

In the Vercel project, open **Settings → Environment Variables**. Add the **pooled** URL as `DATABASE_URL` for the deployment environment that will serve the staging site. If you deploy staging from the default branch to Vercel's Production environment, select Production there; the Vercel environment label and the app's `staging` label are independent.

The deployed app does not need `MIGRATION_DATABASE_URL`; keep the direct URL in your protected local migration environment. Add the other variables from [the hosted setup guide](stage-6-setup.md#3-vercel) and redeploy for changes to take effect. Neon alone does not complete the Ably, Workflow or email setup.

Visit `https://YOUR-STAGING-HOST/api/health`. Expected response is HTTP 200 and:

```json
{"status":"ok"}
```

Then register a staging host and create a quiz. Refresh and confirm it persists. In Neon's SQL editor, you can verify data without exposing account details:

```sql
SELECT count(*) AS host_accounts FROM users;
SELECT count(*) AS saved_quizzes FROM quizzes;
```

These counts should increase after the corresponding app actions. The health endpoint only verifies database reachability; it does not prove schema completeness or game capacity.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `.env.neon` not found | Run from the repository root and verify the filename. |
| Node rejects `--env-file` | Use Node.js 22.13 or newer. |
| Cannot find `tsx` | Install this repository's dependencies with `npm install`. |
| Migration failed | Recopy the direct URL, confirm the selected branch has a read-write compute, retain SSL parameters and check your network permits PostgreSQL connections. Do not print credential values while debugging. |
| Terminal says success but Neon has no tables | Verify the SQL editor's branch/database and that the command explicitly loaded `.env.neon`. |
| Vercel health returns 503 | Check `DATABASE_URL` is set in the environment actually deployed, then redeploy. Inspect server logs without sharing credentials. |
| App says a table/relation does not exist | Apply all five migrations to the same database used by Vercel. |
| Signup says origin is not permitted | Set `APP_ORIGIN` to the exact deployed HTTPS origin and redeploy; this is an app origin setting, not a Neon setting. |

Before production, create a separately managed production database, confirm backup/restore coverage and exercise recovery. Keep synthetic load data separate from real user records. Hosted 500-player capacity remains an open validation step.
