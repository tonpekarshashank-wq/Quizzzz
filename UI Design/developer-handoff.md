# Developer handoff

How the UI design relates to the PRD ([`../quiz-platform-mvp-prd.md`](../quiz-platform-mvp-prd.md)), what extra data and events it needs, and a suggested build order.

## Stage 1 contract authority

The revised [PRD](../quiz-platform-mvp-prd.md), [technical contracts](../docs/technical-contracts.md) and [responsive/error UX](stage-1-ux.md) settle the implementation. This document retains visual data requirements, not preliminary API examples. Single correct answers and the design colors are reconciled in the PRD. Both host and player layouts are responsive; no fixed-stage transform scaling on mobile. No draft sharing or early question skip in MVP.

## Features added by the design (not in the PRD)

All of these are **in MVP scope** (confirmed).

| Feature | Where | Needed from the backend |
| :--- | :--- | :--- |
| **Blob avatar** | Join, lobby, leaderboard, winner cards, player final card | Per participant: `avatarBody` (0–5), `avatarMood` (`smile`, `grin`, `o`), chosen at join |
| **Streak** (cosmetic) | Phone correct/wrong, stats | Per answer: current streak; per participant: best streak. **Never affects points** (confirmed). Scoring stays exactly as PRD FR-5. |
| **Rank movement** | Leaderboard, phone result | Previous rank and current rank per participant per question |
| **"Fastest correct"** | Reveal | Fastest correct response `{participantId, ms}` per question |
| **Per-question stats** | Reveal, winner cards | Vote counts per option, % correct; per participant: accuracy %, average response ms |
| **Awards** | Winner screen, player final card | Speed Demon (lowest avg time), Hot Streak (best streak), Comeback Kid (biggest rank gain). Computed at session end. |
| **Themed leaderboard** | Host leaderboard | **Random theme per question**, chosen by the server, never the same theme twice in a row. Include a `theme` id in each leaderboard event (`summit`, `gp`, `tour`, `moon`, `map`). No host control. |
| **Score breakdown** | Phone correct | Base points, speed multiplier, points earned, total |
| **Gap to next place** | Phone result | Points to the next higher rank |
| **Question ideas library** | Quiz builder, right panel | A curated question library: `GET /api/v1/question-ideas?category=&limit=&cursor=` returning `{id, category, kind, prompt, timeSeconds, points, options[], correctIndex}`. Adding one copies it into the quiz through the normal `PUT /quizzes/:id`; no special endpoint is needed. Content must be written and reviewed by the team (this is not AI generation, which is out of scope in PRD §7). |
| **Player final rank card** | Phone, end of game | Per participant at `GAME_END`: final rank, player count, percentile, score, accuracy, avg ms, best streak, optional award |
| **Ease rating** | Phone, final card | One 1 to 5 rating per participant per session (PRD KPI: "How easy was it to join and play?") |

## Contract mapping

Use `/api/v1` endpoints in the technical contracts. Builder reads/writes owner quizzes with revisions. Lobby starts/moderates through HTTP host commands. Player answers are HTTP submissions with idempotent acknowledgement. Realtime is server-published Ably delivery, with role-filtered snapshot recovery. QUESTION_START/END, QUESTION_RESULT, LEADERBOARD and GAME_END payloads are specified there; do not infer backend contracts from sample artboard scripts. Final awards are arrays, not a single optional string. Session questions/options are immutable snapshots. Rank/streak/results persist in PostgreSQL, with Redis caching.

## Build order (suggested)

1. **Tokens and primitives:** `tokens.css`, sticker button, chip, segmented control, answer key, blob avatar. These are used everywhere.
2. **Player join path:** Enter code, Make your blob, Waiting room. Gets the join flow and WebSocket connection testable end to end.
3. **Host lobby:** ticket, QR code, live player list.
4. **Question loop, host and phone together:** Question live, Answer, Reveal, Correct, Wrong. This is the product's core.
5. **Quiz builder:** can be built in parallel with 2–4 since it only needs the REST API.
6. **Leaderboard** with one theme first (Summit), then the other four, then the server-side random pick (no repeats). There is no theme switcher in the product.
7. **Winner cards, player final rank card, awards, ease rating, CSV export, analytics summary.**
8. **Polish:** motion, reduced motion, 320px phone width, projector readability.

## Implementation notes

- **Rendering:** the designs use no raster images. Shapes, blobs, scenes, confetti and the QR placeholder are CSS and inline SVG; keep it that way for fast loading on phones. The QR in the design is a placeholder pattern. Generate a real QR code from the join URL.
- **Fonts:** self-host or preload the three fonts; use `font-display: swap`.
- **Timing:** the server owns time. Clients animate the fuse from the server's `endsAt` timestamp, so reconnects stay in sync; new joining closes at game start. Do not trust `clientTimestampMs` for scoring.
- **Optimistic lock:** on tap, lock the answer row locally right away, send `SUBMIT_ANSWER`, and show Submitting until durable acknowledgement; unknown outcome remains pending and retries the same ID.
- **Reconnect:** show a slim "Reconnecting…" bar on the phone without losing the current screen; the design does not include this state yet.
- **Host responsiveness:** desktop uses the stage reference; mobile stacks panels and scales decorative scenes independently. See stage-1-ux.md.

## Resolved behavior and remaining validation

Stage 1 UX defines login/library/reports, mobile hosting, builder validation, moderation, join errors, timeout, interruption and reconnect layouts. Pixel implementation and rendered browser checks remain for later stages. Uniform themes/no repeats, distinct points-first response-time ranks, generated local PNG, and all confirmed avatar/streak/card additions are settled. Sound/haptics, dark mode and UI translations are deferred. Verify 320px, large text and reduced motion during build.

Open for product: who writes and maintains the Question ideas library, how many ideas ship at launch, whether categories are fixed, and whether ideas become searchable or include a host's own past questions later.
