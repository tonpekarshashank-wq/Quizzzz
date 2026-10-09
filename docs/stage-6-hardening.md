# Stage 6: reliability and release validation

Status: local hardening implemented; hosted acceptance remains pending provider setup. This stage does not certify 500-player production capacity.

## Changes

- A late-answer rejection now commits deadline recovery before returning its error. Future scheduled jobs remain pending and durable steps retry at the correct deadline; repeated jobs are idempotent.
- Migration 005 adds delivery leases and pending-work indexes. Outbox dispatch claims work safely across concurrent invocations, coalesces room invalidations, retries failures, and never includes private answers in notices. Local mode clears delivery records in batches.
- Connected Ably clients use a slower recovery poll, and players skip answer-count-only invalidations. Concurrent refresh requests queue a follow-up rather than losing updates.
- Added a public database health endpoint and secret-protected aggregate delivery/job status. Maintenance authentication handles malformed Unicode safely.
- Added process-restart recovery tests, provider-failure injection, cross-browser/accessibility checks and a repeatable HTTP load harness. Corrected the report chart's accessible role.
- Vercel functions are configured for Singapore, alongside the planned Neon region.

## Local load evidence

Local automated validation: 20 unit/integration tests passed, including an actual process restart. All 24 browser scenarios passed across Chromium, Firefox and WebKit (23 in the full run, plus the corrected WebKit keyboard check in a focused rerun). Automated WCAG A/AA checks cover public account/join screens, quiz authoring, host lobby, player waiting/final results and reports. Type, formatting and production build checks passed, including Workflow compilation. Health returned 200 locally; unauthenticated internal status returned 401.

Run on 7 October 2026 with Next development mode and serialized embedded PGlite, two rooms of 500 players each. A first burst exposed transport failures; the repeat used exact-payload transport retries. This is an integrity exercise, not a Neon, Vercel or Ably benchmark.

| Measurement | Result |
| --- | --- |
| Accepted players / answers | 1,000 / 1,000 |
| Capacity enforcement | 501st player rejected in each room |
| Answer scores and unique report ranks | All 1,000 verified against server acknowledgement timestamps |
| Exact duplicate acknowledgement replays | 100 verified |
| Answer burst dispatch duration | 50 ms |
| Answer acknowledgement p50 / p95 | 6,457 / 11,980 ms |
| Transport retries | 411 |
| Server receipt span by room | 12,336 / 8,299 ms |
| Join p50 / p95 | 723 / 1,518 ms |
| Report page p50 / p95 | 35 / 42 ms |

The answer latency and arrival spread **fail** the planned warm p95 150 ms and two-second arrival-spread targets. Local serialization, development compilation and burst transport pressure are material limitations; they do not establish the eventual hosted result. Investigate transaction/session-lock contention against Neon during hosted measurement. The harness reports retries explicitly and cannot demonstrate fairness by hiding delayed receipt behind successful eventual acknowledgements. Raw output is written to ignored `test-results/load-http.json`.

## Release gates still open

- Configure Neon, Ably and a Vercel staging preview, then verify migrations and email recovery.
- Measure hosted 500-player and two-room bursts, actual realtime connections, message fanout, warm/cold latency and APJ mobile rendering. Ably Free's 200-connection cap must be addressed before full-room realtime testing.
- Prove durable Workflow execution without browser traffic, deployment recovery, provider outages and automatic/operator delivery retries on the hosted stack.
- Verify actual iOS/Android hosting and image saving, plus assistive-technology navigation. Automated axe checks do not replace manual screen-reader testing.
- Set monitoring, backup/recovery ownership, retention policy and provider quota alerts; restore a database copy before production.

Follow [hosted setup steps](stage-6-setup.md) to make these checks possible. No external account, deployment, upgrade or production cleanup has been performed.
