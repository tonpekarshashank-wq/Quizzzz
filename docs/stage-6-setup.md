# Stage 6: hosted staging setup

No provider projects have been created or connected. Keep credentials in local ignored environment files and Vercel settings, never chat or Git. Use synthetic players for capacity testing.

## 1. Neon

Follow the [detailed Neon walkthrough](neon-setup.md) for the exact console selections, credential file, migration command and verification SQL.

Create a staging project in **AWS Asia Pacific (Singapore), `aws-ap-southeast-1`**. See [Neon regions](https://neon.com/docs/introduction/regions). Keep production data separate from staging.

Copy the pooled connection string into `DATABASE_URL`. Keep the direct connection string in `MIGRATION_DATABASE_URL` for migrations. Both must retain the provider's SSL parameters. After loading those variables into your local shell, run `npm run db:migrate`. This applies migrations 001–006 under a migration lock; it does not seed demo accounts. The migration command does not automatically load `.env.local`, so load it through your environment manager first. Do not place credentials in command arguments.

Verify all six entries in `schema_migrations` using Neon's SQL editor. Do not run migrations against an unintended branch. Before production, document the selected backup/PITR allowance and demonstrate recovery into a separate branch, including accounts, quiz versions, accepted answers and frozen reports. Agree a retention period before scheduling destructive cleanup.

## 2. Ably

Follow the [detailed Ably walkthrough](ably-setup.md) for application creation, restricted API key permissions, local/Vercel environment settings and realtime verification.

Create a staging application and a server API key permitting publish and subscribe within `quizzzz:staging:*`. Set `ABLY_API_KEY` only on the server. Guests receive short-lived, subscribe-only room tokens from the application; never expose the API key to browsers. Production must use a separate application or namespace.

**Ably Free currently permits 200 concurrent connections.** It can support small smoke tests but cannot validate a 500-player room. Arrange an allowance above 501 connections for one full room, or above 1,002 for two simultaneous rooms, plus reconnect/test headroom. Review message, channel and monthly quotas too. No paid plan has been selected or purchased. Source: [Ably Free limits](https://ably.com/docs/platform/pricing/free).

## 3. Vercel

Follow the [detailed Vercel walkthrough](vercel-setup.md) from GitHub preparation through the first deployment, exact origin configuration and hosted verification.

Import the GitHub repository as a Next.js project, with the repository root as the root directory and a supported Node.js version of at least 22.13. Run the standard `npm run build` command. The checked-in `vercel.json` selects Singapore (`sin1`) to align application functions with Neon. See [Vercel regions](https://vercel.com/docs/regions).

Use a stable staging URL and set these variables for that environment before redeploying:

| Variable | Value / purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS staging origin, without a trailing slash. Update it when changing domains; arbitrary preview domains are not trusted automatically. |
| `DATABASE_URL` | Neon pooled staging connection string. |
| `GAME_TOKEN_SECRET` | Stable random secret of at least 32 characters; preserve across deployments so reconnect tokens remain valid. |
| `ABLY_API_KEY` | Staging server key. |
| `APP_ENV` | `staging`, matching the Ably namespace. |
| `WORKFLOW_ENABLED` | `true`, enabling durable deadline/host-interruption jobs through the installed Workflow integration. |
| `CRON_SECRET` | Independent random secret protecting maintenance and status endpoints. |
| `ROOM_CAPACITY` | `500`. |
| `JOIN_IP_PER_MINUTE` | `1200`, allowing shared-network joins across two rooms. Configurable. |
| `JOIN_BROWSER_PER_MINUTE` | `20`. |
| `JOIN_INVALID_PIN_PER_MINUTE` | `30`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verified email sender configuration for deployed password recovery. |

Do not set `DATA_DIR` on Vercel. Embedded local storage is deliberately disabled in production. Migrations are an explicit release step, not part of every function invocation. Check the deployment's Workflow integration and execution dashboard after building. See [Vercel Workflows](https://vercel.com/docs/workflows).

Vercel Hobby is for personal, non-commercial use; check plan eligibility before a commercial pilot. Provider quotas should be reviewed before full-room testing. Source: [Hobby plan](https://vercel.com/docs/plans/hobby).

## 4. Redis

Redis is optional at this point: the current application stores durable rate limits in PostgreSQL and has no Redis adapter. You do not need to create an account to run the first hosted smoke test. Upstash Redis Free currently includes 256 MB and 500,000 commands/month; it is a possible starting tier if measurements justify adding a cache/rate-limit adapter. This is not a capacity guarantee. Source: [Upstash pricing](https://upstash.com/pricing/redis).

## 5. Verify before inviting users

1. Visit `/api/health`: expect 200 with `status: ok`. Confirm signup, login, quiz authoring and email recovery through the actual staging URL.
2. Play a short game with a desktop host and mobile player. Verify Ably is connected, question deadlines advance without refreshing, and reloading either screen preserves the game.
3. Start a question and close every browser. Reopen after its deadline: the durable job must have closed the question without inbound requests. Repeat with a deployment during the question, and with a 15-minute host absence. Preserve accepted answers and verify the interruption result.
4. Monitor `/api/internal/status` using an `Authorization: Bearer` header containing `CRON_SECRET` in a secure monitoring tool. It exposes aggregate backlog counts, not player data. Overdue jobs or undelivered notices older than 30 seconds return 503. `/api/health` alone only proves database reachability.
5. An operator can retry delivery/scheduling with protected `POST /api/internal/live-maintenance`. Workflow is the primary scheduler; do not depend on a once-daily Hobby cron for question deadlines. Alert on repeated delivery failures and overdue jobs; prove retry recovery on staging.
6. On an isolated staging project, load environment variables `LOAD_BASE_URL`, `LOAD_ALLOW_REMOTE=true`, `LOAD_PLAYERS=500`, `LOAD_ROOMS=2`, then run `npm run test:load`. This creates synthetic accounts/games and tests HTTP integrity. It does not open 1,000 browser/Ably connections. Also run a hosted realtime/browser load test and measure warm/cold acknowledgement latency, deadline burst arrival spread and client render latency from APJ networks.
7. Physically verify iOS Safari and Android Chrome: joining, reconnecting, host controls, keyboard/screen-reader navigation and locally saving/sharing the card image. WebKit automation is not physical Safari coverage.

Share the staging URL once configured. Remaining hosted checks and their release gates are recorded in [Stage 6 hardening](stage-6-hardening.md).
