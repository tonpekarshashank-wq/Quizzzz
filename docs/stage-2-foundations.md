# Stage 2 foundations

Implemented locally: Next.js/TypeScript, self-hosted design fonts, tokens and blob/answer/button/chip/segmented/dialog primitives; responsive landing/account/library/editor screens; account registration/login/logout/reset; hashed revocable cookie sessions; origin checks; persisted auth limits; owner-only paginated quiz library, create/read/revision-checked save/archive; incomplete draft validation and launch-readiness feedback; PostgreSQL migration and local embedded PostgreSQL.

## Local setup

Use Node 22.13+ and run:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. No credentials needed: local development initializes the PostgreSQL migration in ignored `.data/postgres`. Register your own test account; there is no shared demo password. Only one dev server may use a data directory. Embedded PostgreSQL serializes local queries and is not a production capacity benchmark.

Local password-reset messages are private JSON files in ignored `.data/mail`. Open the generated reset URL from the file; it uses a fragment token that the browser strips after reading. No email is sent in local mode. Configuring RESEND_API_KEY and EMAIL_FROM switches to real delivery; do that only with a verified sender. Deployed recovery requires email configuration, and otherwise responds unavailable. Migration and app data never enter Git.

## Neon and Vercel later

Set DATABASE_URL to the Neon pooled application connection and APP_ORIGIN to the exact HTTPS site origin. Set MIGRATION_DATABASE_URL to the direct migration connection when needed. Apply reviewed migrations explicitly with `npm run db:migrate`; production does not auto-run them. The script reads environment variables from the invoking environment (it does not load .env.local automatically). Local embedded storage is disabled when NODE_ENV=production or VERCEL is set. Vercel import can build before Neon exists, but authenticated persistence will be unavailable until the connection and migration are configured.

Migrations now include Stage 3 session/game tables. Authoring drafts store ordered questions/options in validated JSONB: one atomic draft write and revision gate prevents torn autosaves. Live session snapshots/responses are relational. Incomplete drafts intentionally allow empty text/no correct selection, but malformed IDs, type/timer/point values, true/false label changes, unsupported cover URLs and excess lengths are rejected server-side. Limit is 100 questions per draft for request-size bounds; revisit if needed. The editor's Go live action validates readiness and launches an immutable session; see [Stage 3](stage-3-live.md).

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run format:check
```

Browser tests start their own server on port 3217 with isolated `.data/e2e`. Install Playwright Chromium if not present (`npx playwright install chromium`). Tests exercise real SQL and browser/API flows: ownership, CSRF, revision conflicts, mobile editing/persistence/reorder/archive, password-reset revocation and one-use tokens. Browser screenshots are ignored under test-results. Test data directories are disposable local data, not production databases.

## Validation results

Four database/security tests and five Chromium browser tests pass, including concurrent saves, failed-save retry and edits queued during a pending save. Production build and TypeScript checks pass. Desktop and 320px editor screenshots were visually inspected. This does not yet establish Safari/Android behavior or 500-player performance.

Run `npm run db:cleanup` periodically in a configured environment to remove expired sessions/reset tokens/rate buckets; application predicates reject expired records even before cleanup.

## Next work

Stage 3 supplies joining/lobby, live questions, server scoring, real realtime credentials, durable deadline jobs and snapshot recovery. Stage 2's Check quiz validates readiness and clearly reports that live hosting is not yet available. No room creation or 500-player support is claimed by this foundation. Neon network connections, APJ provider choice, mail sender, Safari/Android QA and quotas still require integration validation.
