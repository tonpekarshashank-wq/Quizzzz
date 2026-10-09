# Stage 3: playable game

The local playable slice connects saved quizzes to host and account-free player screens. Launch with **Go live** in the editor. Share the six-digit PIN, link or QR; players join at `/join`, choose a nickname and blob, and keep their identity on the same browser. The host starts a timed question, sees its answer distribution, opens the Summit leaderboard, then advances or finishes. Basic final podium and personal score cards are included. Other themes, awards, PNG export, ratings and reports remain Stage 5.

## Game authority and recovery

Migration `003_live_sessions.sql` stores immutable launch questions/options, players, accepted responses, frozen question results, command/join receipts, outbox events and deadline jobs. Editing the source quiz does not change an existing game. Defaults are 500 places and lobby-only joining/moderation. Capacity is enforced inside the session transaction; this is not a measured 500-player capacity claim.

One correct choice earns `round(basePoints × (1 − 0.5 × responseMs / timerMs))`; incorrect and unanswered choices earn zero. Ranking orders points, scored correct answers, summed correct response time, last correct timestamp, then participant UUID. Every place is distinct. Zero-point questions do not affect scored tie-breakers. Answers are accepted once before the server deadline. Exact retries return the original acknowledgement; a different choice cannot replace it. Active snapshots never include correct-answer IDs, other players' choices or individual scores for the current question.

Host control uses a fenced 30-second lease, renewed every 10 seconds while visible. Another owner tab can explicitly take over. Losing control does not stop the question timer. After 15 minutes without host activity, the game closes with partial results; an active question closes first. Player tokens remain valid six hours after terminal closure. Reload restores the participant token, pending submission and authoritative snapshot. Clearing browser storage removes that identity.

Ably messages are safe invalidation notices. The browser fetches an authenticated, role-filtered snapshot rather than trusting event state. Kicking a participant revokes their token and rotates the channel scope. Tokens are subscribe-only with a one-minute lifetime; a kicked browser can briefly receive safe invalidations on its previous channel but cannot fetch further game data.

## Local mode and deployment

Local development needs no provider accounts. Embedded PostgreSQL persists data; snapshot polling and a local one-second worker reconcile durable jobs. The worker exists only in development. It is not used on Vercel.

Before enabling deployed live hosting, configure Neon and apply migrations as described in [Stage 2](stage-2-foundations.md), then set:

- `APP_ORIGIN`: exact deployed HTTPS origin; separate environment values for preview/staging.
- `GAME_TOKEN_SECRET`: stable randomly generated secret of at least 32 characters. Changing it prevents replaying old join credentials.
- `ABLY_API_KEY`: server-only key allowed to publish and issue subscribe tokens.
- `APP_ENV`: distinct environment name so preview and production channels do not overlap.
- `WORKFLOW_ENABLED=true`: enable durable Workflow SDK deadline/inactivity jobs; generated routes are included by `withWorkflow` during build.
- `ROOM_CAPACITY=500`, configurable `JOIN_IP_PER_MINUTE=1200`, `JOIN_BROWSER_PER_MINUTE=20`, `JOIN_INVALID_PIN_PER_MINUTE=30`.
- `CRON_SECRET`: protects optional `POST /api/internal/live-maintenance` for an operator/retry scheduler to drain unscheduled jobs and failed outbox deliveries.

Workflow uses durable sleep rather than a running timer or minute cron. A transactional job survives failures to start a workflow; subsequent live API traffic or the protected maintenance endpoint retries scheduling. Workflow steps reconcile idempotently and retry delivery failures. Configure and exercise this on Vercel before claiming unattended deadline reliability. No recurring Vercel Cron schedule or external account has been created.

Rate limits currently persist in PostgreSQL, including shared-IP and browser limits. The Upstash variables remain reserved for a later adapter; Redis is not needed for local testing. The browser cookie is supplemental abuse control, not an unforgeable identity. The APJ database, Ably latency/quotas, Workflow support and free-plan usage must be measured in staging. Stage 6 reduces recovery polling to 30 seconds while Ably is connected, with 1.5-second fallback polling when disconnected and exponential backoff on request failures.

## Verification and remaining gates

`npm test` covers immutable sessions, scoring/tie ordering, concurrent capacity, answer replay and lateness, private snapshots, control fencing, kicks and inactivity. `npm run test:e2e` covers authoring plus a desktop host/mobile player game, lost answer acknowledgement, reload recovery and timed results. `npm run build` includes compiled workflow routes.

Browser automation uses viewport emulation, not physical devices. Stage 3's external-service and real-device exit checks are pending configuration. See [Stage 6 hardening](stage-6-hardening.md) for local multi-browser and load evidence; hosted capacity and deployment recovery remain unverified.
