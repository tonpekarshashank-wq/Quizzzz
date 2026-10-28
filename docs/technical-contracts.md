# Technical contracts

Stage 1, 2026-10-07. Normative together with PRD section 9. Stage 2 adds migrations for accounts and drafts; live-session entities remain planned.

Stage 2 physical authoring storage uses validated ordered JSONB on quizzes for atomic revision-safe autosaves, rather than separate editable question/option tables. Session snapshot/response tables remain relational in Stage 3. See stage-2-foundations.md.

## API conventions

Base `/api/v1`. JSON success `{data, serverTime}`; error `{error:{code,message,fields?,retryAfterSeconds?},serverTime}`. Host uses secure HttpOnly session cookie with CSRF/origin checks on writes. Guest uses a scoped bearer token, never URL parameters. All identifiers are UUIDs except PIN, event and idempotency strings. Timestamps are UTC ISO strings; durations are integer milliseconds; questionIndex is one-based. Percent accuracy is represented as a fraction 0–1; percentile is an integer 1–100. No secrets enter Git or ordinary logs.

| Method / route | Access | Contract |
| :--- | :--- | :--- |
| POST /auth/register, /auth/login | Public, limited | Establish host cookie; no password hash returned |
| POST /auth/logout | Host | Invalidate session |
| POST /auth/forgot-password | Public, limited | Generic response prevents email enumeration |
| POST /auth/reset-password | Reset token | One-use reset; revoke old host sessions |
| GET /auth/me | Host | Host identity |
| GET /question-ideas | Host | Curated active ideas filtered by category, bounded limit and category-scoped cursor; payload below |
| GET /quizzes | Host | Own paginated unarchived library |
| POST /quizzes | Host | Create incomplete draft |
| GET /quizzes/:id | Owner | Full editable draft and revision |
| PUT /quizzes/:id | Owner | Entire draft + expectedRevision; atomic revision increment |
| POST /quizzes/:id/archive | Owner | Hide from library, preserve historical sessions |
| POST /sessions | Owner | quizId + expectedQuizRevision + Idempotency-Key; validate, freeze, return PIN/link |
| GET /rooms/:pin | Public, limited | Title, joinable, capacity status only; no roster/questions |
| POST /sessions/join | Public, limited | PIN, nickname, avatar, joinRequestId; retry returns same participant/token scope |
| POST /sessions/:id/realtime-token | Host/guest | Short-lived subscribe/presence token for permitted channels only |
| GET /sessions/:id/snapshot | Host/guest | Role-filtered authoritative state, own answer and latest finalized results |
| POST /sessions/:id/answers | Guest | Idempotent answer acceptance, below |
| POST /sessions/:id/control/claim | Owner | Acquire/explicitly take over controller; new lease generation |
| POST /sessions/:id/control/heartbeat | Controller | Renew matching generation; record host activity |
| POST /sessions/:id/commands | Controller | expectedRevision, generation, commandId, action, optional participantId |
| GET /sessions | Host | Own paginated session history |
| GET /sessions/:id/report | Owner | Terminal summary + 25-player paginated standings/answer matrix, offset parameter; partial label for interruption |
| GET /api/reports/:id/csv | Owner | Downloadable terminal CSV; cancelled lobby returns REPORT_UNAVAILABLE; dedicated route outside /api/v1 |
| POST /sessions/:id/rating | Guest | Completed session only; 1–5, insert-once; same retry succeeds, changed retry conflicts |

Auth/register/login/join limits are independently configurable. Errors: 400 malformed; 401 missing/expired credentials; 403 wrong role/revoked/lease; 404 unknown resource (also nonowned IDs); 409 revision/state/capacity/already-answered conflict; 422 field validation; 429 limited with Retry-After; 503 dependency unavailable with retry hint. Domain codes include INVALID_PIN, ROOM_FULL, ROOM_CLOSED, NAME_REJECTED, SAVE_CONFLICT, QUESTION_EXPIRED, ALREADY_ANSWERED, CONTROL_LOST and REPORT_UNAVAILABLE.

## Answer transaction

Example request:

```json
{"questionId":"UUID","selectedOptionId":"UUID","submissionId":"UUID"}
```

Capture receipt time in server request handling. Authenticate scoped guest, validate current question, option membership and deadline. Acquire the same session/question lock closure uses. Check an existing response first: identical retry returns its acknowledgement even after closure; different payload cannot replace it. Validate deadline and active state again inside the transaction. Persist response + score + durable outbox event in one commit. Return acceptance only after commit:

```json
{"data":{"submissionId":"UUID","questionId":"UUID","selectedOptionId":"UUID","accepted":true,"acceptedAt":"2026-10-07T10:00:03.000Z"},"serverTime":"2026-10-07T10:00:03.050Z"}
```

Never return correctness/points before closure, including through snapshots. Answer receipt is not a promise of acceptance if the closure transaction wins. For retry after unknown outcome, lookup existing accepted submission before revalidating deadline. Reusing submissionId with different data is IDEMPOTENCY_CONFLICT. Simultaneous answers with different IDs still hit one unique participant/question constraint. Reject responses belonging to another session or option/question.

Database receipt/deadline precision and lock contention are part of the Stage 3 spike; avoid one heavyweight score recalculation for every answer. Compute totals transactionally, finalize full rank/stats once at closure.

## State transitions and jobs

| State | Action | Result |
| :--- | :--- | :--- |
| LOBBY | START_GAME | Freeze roster; QUESTION_ACTIVE with first question |
| LOBBY | KICK_PLAYER | Revoke access/remove membership; remain LOBBY |
| LOBBY | CANCEL | CANCELLED |
| QUESTION_ACTIVE | Deadline job/API reconciliation | RESULT_REVEAL; finalized stats and ranks |
| RESULT_REVEAL | SHOW_LEADERBOARD | LEADERBOARD; stored theme selected once |
| RESULT_REVEAL or LEADERBOARD, more questions | NEXT_QUESTION | QUESTION_ACTIVE (QUESTION_INTRO before the final question) |
| LEADERBOARD, last question | FINISH_GAME | COMPLETED; final awards/reports |
| Any nonterminal started game | END_EARLY or inactivity | INTERRUPTED |
| LOBBY | Inactivity | INTERRUPTED with no question metrics |
| Any terminal state | Any advancement | Reject; same original command retry returns original outcome |

The host may skip the intermediate leaderboard using Next Question from the reveal. The last reveal keeps See the leaderboard and the existing final-results flow. Skipping does not change finalized scores or ranks; no database migration is required.

Command revision check, lease fencing, state update and command receipt/outbox insertion occur atomically. Accepted answers do not increment the command stateRevision; counters have separate event sequencing. Deadline closure does not require host lease. Stale/duplicate jobs compare session/question/deadline IDs and cannot close a newer question. Inactivity job compares hostLastSeenAt and reschedules if host returned. If interruption occurs during a question, close and finalize that question first, including committed answers; remaining future questions are not included in partial metrics.

Durable scheduling: commit deadline/inactivity intent to outbox, then retry job scheduling. Reconcile expired state on snapshot/command/answer reads and run an overdue-job sweep. Duplicate reconciliation is safe. Scheduler delivery may lag; APIs reject late answers independently. Workflow timing is measured before relying on it for the reveal latency target; choose another managed scheduler if needed.

## Realtime and snapshot contract

Envelope `{eventId, event, sessionId, stateRevision, emittedAt, payload}`. Event IDs deduplicate deliveries; stateRevision orders state transitions only. Snapshot includes serverTime, state, stateRevision, current questionIndex, deadlines, recoveryStatus, counts and finalized result. Host snapshot has controller generation/expiry and authorized roster. Player snapshot contains self and own accepted option/result, never another player's private answers or unrevealed correctness. Personalized events and room events may share a revision; do not drop a valid private event merely because the room event arrived first.

Stage 3 transport: one versioned room channel carries only safe invalidation metadata (event ID, session ID, revision and emitted time). Clients fetch role-filtered authenticated snapshots for gameplay, roster and personal results. Private results never appear in broadcast payloads. Only API/outbox workers publish. Tokens permit subscribe-only access for one minute. Kicks revoke database access and rotate channel scope. Expired, kicked or terminal-invalid credentials cannot mint new tokens. Full role-specific event channels below remain the planned expansion if needed after capacity tests.

| Event | Safe payload |
| :--- | :--- |
| ROSTER_UPDATED | Host roster delta; public count only, batched |
| QUESTION_START | questionId, index/total, prompt, options with explicit answer-key token/shape, basePoints, startsAt, endsAt |
| ANSWER_COUNT | questionId, acknowledged count, rosterCount; batched/coalesced, no choices |
| QUESTION_END | correctOptionId, option counts, unanswered count, percentCorrect, fastestCorrect or null |
| QUESTION_RESULT | Private status correct/incorrect/unanswered, selected/correct option, basePoints, multiplier, points, total, streak, rank/delta/gap |
| LEADERBOARD | theme, top up to five with avatar, score, round gain, rank/delta |
| GAME_END | Public top three/awards; private rank/card data including awards array |
| SESSION_INTERRUPTED / SESSION_CANCELLED | Reason and partial-result availability |
| CONTROL_CHANGED | Host-only generation/expiry; public recovery status if required |

QUESTION_RESULT and GAME_END are available in snapshot if notifications were missed. Unknown/missing state version triggers snapshot fetch. Answer count updates are cumulative and never regress for the same question. App uses provider connection health and bounded HTTP snapshot polling during degraded delivery; no per-player Redis heartbeat loops. Reconnect backoff has jitter to avoid a 500-client thundering herd.

Outbox events commit with their triggering transaction. Dispatch is at least once; consumers deduplicate. An outbox drain retries independently of the originating request, with periodic reconciliation. An API that commits then loses its response returns the stored result on retry. The database remains correct even if notification delivery is delayed.

## Persistence

| Entity | Required data and constraints |
| :--- | :--- |
| users, host_sessions, reset_tokens | Unique normalized email, password hash; hashed expiring/revocable session/reset tokens; one-use reset |
| quizzes | Owner, title/description/language/cover, revision, archivedAt |
| questions/options | Ordered within quiz; type, timer enum, base points enum, prompt/options; correct option reference |
| quiz_sessions | Owner, sourceQuizId, immutable metadata snapshot, state/revision, PIN, current index, capacity, timestamps, host lease generation/expiry/lastSeen |
| session_questions/options | Immutable text/type/order/timer/points and correct option; startsAt/endsAt/closedAt, finalized distribution/theme |
| participants | Session, normalized unique nickname, avatar enums, token revocation, roster status, joinedAt, total points, streak stats, ranking aggregates, final rank |
| responses | Session/participant/snapshot question/option, submissionId, acceptedAt/serverReceivedAt, responseMs, correctness, points; one per participant/question |
| question_results | Frozen per-question rank, rank delta, streak and score summaries; recomputable from responses |
| command_receipts, join_receipts | Actor/key uniqueness, request fingerprint, outcome; retry-safe creation/commands |
| ratings | Unique session/participant, integer 1–5 |
| awards | Session/type/winner, unique session/type; multiple types per player |
| outbox, scheduled_intents | Unique event/job identifiers, payload, delivery/retry status, dueAt |

Partial unique index on PIN for LOBBY/QUESTION_ACTIVE/RESULT_REVEAL/LEADERBOARD. Composite foreign keys ensure participant/question/option belong to the same session/question. Unique question/option ordering; deferrable checks support reordering. Drafts allow missing prompt/correct selection; launch transaction enforces 2–4 options and exactly one correct answer. Prefer one nullable correctOptionId plus membership validation rather than independent booleans permitting multiple correct answers.

Join transaction locks session, rechecks lobby/capacity, assigns nickname, creates token identity and receipt. START_GAME uses same lock so no late joins slip in. Archives never cascade historical snapshots. Ranking aggregates can be rebuilt from responses and use the PRD comparator; UUID is a final deterministic fallback, not a scoring bonus.

Redis keys are namespaced by environment and session: PIN cache, snapshot revision, abuse counters, ephemeral aggregates. Cache values include revision; older writes cannot overwrite newer state. Expire session cache six hours after termination, remove PIN promptly, and use PostgreSQL lookup on cache miss. Redis failure must not bypass abuse controls: return retriable service error for new joins if safe limits cannot be enforced; existing identity/results remain recoverable from PostgreSQL.

Retention of durable reports is a public-release decision. Guest-token expiry and cache TTL do not authorize deleting reports. Cross-service delivery has explicit retry/reconciliation, not a distributed transaction assumption.

## Question ideas provenance

Editable draft questions may include optional `sourceIdeaId` (up to 80 characters), persisted within existing draft JSONB. The builder uses it to prevent adding the same library idea while its copied question remains in the draft, even after edits or reload. Deleting the copy restores eligibility. Library templates are local static data; copying generates independent question and option UUIDs and follows ordinary revision-safe autosave. No new database migration or runtime canvas scripts are required. Maximum question count remains 100.

## Curated Question ideas API

`GET /api/v1/question-ideas?category=Science&limit=30&cursor=...` requires the existing host session cookie. No AI generation, host-managed lists or imports. Categories are `Science`, `Tech`, `Geography`, `Work safety`, `General`, `Sports`; empty/omitted category or `All` means all. Limit defaults to 30, accepts integers 1–50. Cursor is opaque, exclusive and scoped to the selected category; changing category resets pagination. Results are ordered by unique `sort_order`; only active rows are returned. Invalid filter/limit uses the existing 422 validation response; malformed or category-mismatched cursors return 400 `INVALID_CURSOR`; missing host session returns 401. Stored payloads are validated before return; invalid active content returns 503 `IDEAS_UNAVAILABLE` rather than sending malformed ideas.

Normal envelope:

```json
{"data":{"items":[{"id":"science-mercury","category":"Science","kind":"mc","prompt":"Which planet is closest to the Sun?","timeSeconds":20,"points":1000,"options":["Mercury","Venus","Earth","Mars"],"correctIndex":0}],"total":6,"nextCursor":null},"serverTime":"UTC ISO timestamp"}
```

`total` is the full active category count, not the current page size. `nextCursor` is null at the end; otherwise pass it unchanged with the same category. Library changes during paging are not a frozen snapshot. API items obey allowed timer/point values, prompt/answer limits, 2–4 answers and one in-range correct index; True/False options are exactly `True`, `False`. Copied questions get fresh UUIDs and ordinary autosave. No scoring or live-game contracts change.

Migration `006_question_ideas.sql` adds and seeds the approved table. See [library maintenance](question-ideas-maintenance.md).


## Question presentation extension (migration 007)

Question drafts and curated idea API items accept optional `revealFact` (trimmed string, maximum 160 characters). Blank or missing facts are omitted at reveal. Launch copies it into `session_questions.reveal_fact`; later draft/library edits do not change a running session. Host-only draft and idea endpoints retain their existing authentication. Session snapshots expose the frozen value only as `reveal.fact` after closure; it never appears on `question` or in invalidation notices.

The final question uses `QUESTION_INTRO` before `QUESTION_ACTIVE`, including a one-question quiz. During introduction `question` is null (for both roles), and `intro` is `{endsAt: UTC_ISO, questionIndex: number}`. No prompt, options or fact are exposed. The room's `current_index` identifies the upcoming question; `quiz_sessions.intro_ends_at` persists the shared deadline. An `intro` scheduled job invokes the existing idempotent reconciliation path. Snapshot/control reconciliation also recovers overdue intros.

At expiry, under the session lock, activate once: clear intro deadline, set actual starts_at=now and ends_at=starts_at+full duration, increment revision, emit a safe QUESTION_START invalidation and schedule the normal deadline job. A retry cannot reset starts_at. If the host is already inactive for 15 minutes, interrupt without activating. END_EARLY during intro also leaves the question unstarted. The live PIN index includes QUESTION_INTRO. No new score multipliers or ranking changes.

New answer receipts before starts_at are rejected as well as those at/after ends_at. Existing identical accepted-answer retries retain their original acknowledgement. Clients derive final-three-second feedback from the existing server clock offset; the badge never authorises an answer or changes a deadline. Clients refresh at the introduction deadline and retain polling/Ably recovery.

The one-line fun fact is allowed to wrap on small screens. Last-three-second announcements occur once, not on every clock tick. The final banner starts at its elapsed animation position on reload and is static under prefers-reduced-motion.

Migration `008_sports_question_ideas.sql` expands the category constraint to Sports and appends two reviewed ideas (cricket hat-trick and tennis love), each with a reveal fact, 20-second timer and 1,000 points. The library now contains 32 ideas. All remains a filter, giving seven chips for six content categories. The first page still defaults to 30; Load more or the Sports filter makes the two new records accessible.

Migration `009_reviewed_question_ideas.sql` appends ten approved multiple-choice questions and their reveal facts. The current library total is 42, with category counts Science 8, Tech 8, Geography 8, Work safety 7, General 9 and Sports 2. No API or scoring changes; pagination remains 30 by default.
