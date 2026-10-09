# Stage 5: designed MVP

The host leaderboard now supports all five reference themes: Summit, Grand Prix, Tour de Quiz, Moonshot and Treasure. Selection is uniform on the server (all five on the first leaderboard, the other four thereafter), persisted with the state transition and idempotent command receipt. There is no host picker. Decorative scenes share an accessible standings list. Positions combine normalized scores with a small rank-based separation; all-equal scores spread by the distinct server ranks so markers do not stack. Motion respects the device's reduced-motion preference.

## Final results and awards

Migration `004_final_results.sql` adds a frozen final-summary record and player ratings. Closing a completed or interrupted game saves its summary in the same transaction as the terminal state. Existing local terminal games receive a summary when first read. Final player snapshots expose only that player's private metrics, plus public award winners. Host reports require ownership.

Final cards show unique rank, total points, percentile, accuracy, average accepted response time, best streak and awards. Speed Demon uses the lowest average correct-response time; Hot Streak uses the highest positive best streak; Comeback Kid uses positive improvement from first-question to final rank, with at least one correct answer. Award ties use final rank. One player can win multiple awards. Ineligible awards are omitted, and interrupted games receive none. Top-three completed players get confetti; partial cards are marked provisional.

**Save my card** renders a 1080×1440 PNG locally using canvas. It downloads as `quizzzz-my-card.png`; Share / save image uses native file sharing when available, with download and a touch-and-hold image preview as fallback. No image upload or public card URL is created. The exported layout is tailored for saving and contains the same frozen metrics as the onscreen card. Physical iOS/Android save/share behavior is still a Stage 6 check.

Completed players can submit one optional ease rating from 1 (very hard) to 5 (very easy). Same-value retries return the saved rating; changed values are rejected. Reload restores the saved value. Rating counts/averages update in host reports without changing frozen scores or awards.

## Basic reports

Reports are available from the navigation and final host screen. History is owner-only and paginated, including archived source quizzes. Cancelled lobbies have no analytics. Summary metrics include frozen roster count, completion, overall accuracy, average response time, toughest question and ease-rating average/count. Question breakdowns show correct, answered and unanswered counts; player details show selected options, correctness, time and points.

Completion means answering every included question. Accuracy includes unanswered questions in its denominator. Partial reports include closed questions only; when no question closed, derived metrics are null. Toughest-question ties resolve by question order.

Player breakdowns are paginated at 25 players. CSV export streams the entire roster, including per-question prompt/selection/status/correctness/time/points. Unanswered nullable fields are blank. User text is quoted and spreadsheet-formula/control prefixes are escaped. The export is protected by the host session and ownership check.

API additions: `GET /api/v1/sessions` (history), `GET /api/v1/sessions/:id/report?offset=0` (25-player report), `POST /api/v1/sessions/:id/rating`, and `GET /api/reports/:id/csv`. Pages are `/reports` and `/reports/:id?page=0`.

## Verification and next stage

Database tests exercise awards (including tied streaks and comeback), metric denominators, unanswered/partial/cancelled games, private snapshots, owner boundaries, rating retries, frozen summaries, pagination and CSV escaping. Browser tests exercise all five responsive scenes through snapshot fixtures, PNG download and signature, rating persistence, report rendering, CSV download and guest denial, alongside existing authoring/recovery flows. Screenshots and exported PNGs are inspected locally under ignored `test-results`.

Stage 6 remains real-device/browser/accessibility checks, Neon/Ably/Workflow integration on Vercel, provider quotas, monitoring/backups/retention and measured 500-player/two-room capacity and recovery. No deployment or capacity result is claimed by this stage.
