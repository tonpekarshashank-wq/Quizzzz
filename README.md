# Quizzzz

Live quiz platform for browser-based hosts and account-free players.

Stages 2–5 are implemented locally: accounts, quiz authoring, PIN/QR joining, timed answers, scoring/recovery, five leaderboard themes, awards, player PNG cards, ratings and basic reports/CSV.

Start locally with `npm ci`, copy `.env.example` to `.env.local`, then run `npm run dev`. Open http://127.0.0.1:3000.

See [Stage 2 setup and verification](docs/stage-2-foundations.md) for database, email and deployment configuration.
See [Stage 3 live games](docs/stage-3-live.md) for the playable flow, service configuration and remaining staging checks.
See [Stage 4 hosting](docs/stage-4-hosting.md) for open-game recovery, tab takeover and mobile host verification.
See [Stage 5 designed MVP](docs/stage-5-designed-mvp.md) for themes, awards, local card saving, ratings and reports. Deployment and capacity validation remain Stage 6.

Stage 6 now includes local recovery, accessibility and load hardening. See [validation and open release gates](docs/stage-6-hardening.md) and [Neon / Ably / Vercel setup](docs/stage-6-setup.md). Hosted capacity is not yet validated.

- [Stage 1 plan and implementation stages](docs/stage-1-plan.md)
- [Revised MVP PRD](quiz-platform-mvp-prd.md)
- [API, realtime, recovery and persistence contracts](docs/technical-contracts.md)
- [Responsive and missing-state UI specification](UI%20Design/stage-1-ux.md)
- [Original UI design references](UI%20Design/README.md)
