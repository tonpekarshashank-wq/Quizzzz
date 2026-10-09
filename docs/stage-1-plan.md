# Stage 1 review and implementation plan

2026-10-07. Deliverables are specifications; no application deployment or migration is claimed.

## Agreed scope

500-player rooms; single correct answer; configurable shared-IP limits; points-first distinct rankings with response-time resolution; host/player recovery; basic analytics; desktop/mobile hosting; device PNG saving. Vercel Free with user-managed GitHub import, APJ Neon later, new Ably/Redis later and initial Upstash Free. Preserve confirmed design features and replace mock statistics with actual calculations.

## Implementation defaults

Unspecified choices settled for implementation: lobby-only new joining/moderation, full timer before reveal, integer rounding, deterministic ranking fallback, 15-minute host inactivity cutoff, fenced 30-second host lease, uniform themes, plain text prompts, private drafts, multiple eligible awards/player. These defaults are editable configuration/rules, not additional infrastructure approvals. Public-release retention and actual provider region/plan limits remain release gates.

## Review package

| Deliverable | Content |
| :--- | :--- |
| [Revised PRD](../quiz-platform-mvp-prd.md) | Product scope, authoritative rules, metrics, recovery and launch targets |
| [Technical contracts](technical-contracts.md) | Endpoints, events, state transitions, idempotency, persistence and permission boundaries |
| [UX specification](../UI%20Design/stage-1-ux.md) | Mobile host arrangements, missing screens and validation/error/recovery behavior |

Original artboards remain visual references. Their sample data and prototype controls do not define backend contracts. Section 9 reconciles the original PRD narrative; technical and UX documents resolve implementation details.

## Ordered backlog and acceptance gates

| Stage | Implementation | Exit gate |
| :--- | :--- | :--- |
| 2 Foundations | Next.js/TypeScript, environment examples, secret ignore rules, token/components, responsive shells, database migrations, accounts and draft/library CRUD | Owner boundaries, revision conflicts and mobile layouts verified locally |
| 3 Playable slice | Service adapters/local fakes, seeded quiz, immutable session, real joins/PIN/QR, control lease, answer transaction/outbox, deadline job, snapshot recovery, scoring/reveal/one theme | Real devices complete a game; retries, deadline races and interruption preserve acknowledged results |
| 4 Authoring/hosting | Metadata, option/delete/reorder, autosave failures, mobile controls, moderation/takeover, cancellation | Host creates and runs own quiz on desktop and mobile |
| 5 Designed MVP | Five themes, streaks/rank movement/awards, podium/player cards, local PNG, rating, reports and safe CSV | Displays, snapshot and CSV agree with durable responses |
| 6 Hardening/pilot | 500-player burst, shared-IP joins, two rooms, browser/accessibility, recovery/outages/deployments, monitoring/backups, retention and quota gates | Publish measured capacity/latency, choose upgrade thresholds, complete real pilot |

Credentials/accounts are not required for initial scaffolding. Configure services when adapters are exercised in staging. The scheduler timing, database contention, provider throughput and free-tier budgets are explicit Stage 3/6 experiments, not assumptions. No public launch until quota/commercial-use eligibility, retention and recovery checks are resolved.
