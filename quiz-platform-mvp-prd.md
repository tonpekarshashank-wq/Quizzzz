> Revised 2026-10-07 for Stage 1. Section 9 and the linked technical/UX contracts settle the updated MVP rules and take precedence over illustrative descriptions. Artboard data is fictional.

# Product Requirement Document: Live Quiz & Assessment Platform MVP

## 1. Document Overview & Product Vision

### 1.1 Problem Statement
Existing interactive quiz and presentation platforms enforce severe operational and financial constraints on creators, educators, and presenters. Market leaders frequently cap free account participation at restrictive levels—such as 3 to 10 participants per session or 50 participants per month—while forcing users into expensive annual subscriptions or high-volume team seat minimums. On the participant side, onboarding friction remains a primary barrier to audience engagement when platforms require native mobile application downloads, user account creation, or multi-step navigation prior to entering a live session. Presenters in classrooms, corporate workshops, and live events require a zero-friction, web-based live quiz engine that enables instant quiz creation, seamless online hosting, and one-click participant entry across multiple channels.

### 1.2 Product Mission & Value Proposition
The Live Quiz Platform MVP is engineered to deliver a high-performance, web-first assessment and engagement engine. The platform empowers hosts to create structured quizzes in minutes and project them online via a real-time presenter dashboard. Participants join live sessions instantaneously without downloading an application or creating an account, entering via a direct URL link, an on-screen QR code, or a unique 6-digit quiz ID/PIN. The platform prioritizes low-latency state synchronization, mobile responsiveness, and robust network reconnection resilience.

### 1.3 Target Personas
The initial platform build targets three core user personas across education, corporate training, and event management:

*   **Educators & Lecturers**: Teachers and university instructors requiring quick formative assessment checks, exit tickets, and interactive review sessions during live lectures.
*   **Corporate Trainers & Presenters**: L&D managers and workshop facilitators conducting team icebreakers, compliance knowledge checks, and live meeting polls.
*   **Event Hosts & Community Organizers**: Independent trivia hosts, meetup organizers, and presenters who need reliable, self-service audience engagement tools without recurring contract lock-ins.

---

## 2. System Architecture & High-Level User Workflows

### 2.1 Vercel architecture

Next.js/TypeScript hosts both desktop and mobile host/player experiences on Vercel Free. Vercel APIs own authentication, commands, answer validation and scoring. Ably provides managed realtime delivery with scoped room/private-channel tokens; players cannot publish authoritative events. Neon PostgreSQL is the durable source of truth; Upstash Redis caches snapshots/PIN lookups and provides configurable abuse limits. Durable deadline/inactivity jobs initially use Vercel Workflows, subject to integration timing validation. No correctness depends on a browser timer, process memory, or serverless setTimeout.

User imports GitHub into Vercel. Neon, Ably and Redis accounts will be configured later. Prefer available APJ regions and colocate compute/database. Free plans are development/pilot choices, not proof of 500-player capacity. Validate provider quotas and concurrent rooms before release.

### 2.2 Host User Journey
The presenter workflow follows a four-stage linear progression from quiz authoring to post-game analysis:

1.  **Quiz Creation & Setup**: The host logs into their account, initiates a new quiz deck, defines the quiz title, and configures multiple-choice or true/false questions with answer choices, correct designations, and time limits.
2.  **Lobby Initialization**: The host launches a live session. The system assigns a unique 6-digit PIN, renders a dynamic QR code, and generates a direct shareable URL on the display screen.
3.  **Live Presentation & Control**: The host starts the session once participants have joined. The host advances questions, observes submission counters, locks answers automatically upon timer expiration, and presents response breakdown charts and leaderboards.
4.  **Session Completion & Analytics**: Upon concluding the final question, the host triggers the final podium display, ends the session, and reviews or exports participant score breakdowns as a CSV file.

### 2.3 Participant User Journey
The audience workflow eliminates entry friction by enabling immediate participation through three parallel entry channels:

> **Participant Onboarding Pipeline**
>
> **Step 1: Multi-Channel Entry** \\(\rightarrow\\) Participant scans the display QR code, clicks a shared URL link (`https://app.quiz.com/join?pin=839201`), or navigates to `app.quiz.com` and inputs the 6-digit PIN.
>
> **Step 2: Nickname Registration** \\(\rightarrow\\) Participant enters a display nickname (1–25 characters) and receives an automated session token without account sign-up.
>
> **Step 3: Waiting Lobby** \\(\rightarrow\\) Client displays connection confirmation and holds in sync until the host initiates the session.
>
> **Step 4: Live Gameplay** \\(\rightarrow\\) Participant views synchronized questions, selects answer options on their mobile device, and receives instant score and rank feedback upon question closure.

---

## 3. Detailed Functional Requirements

### 3.1 FR-1: Quiz Authoring Suite
The authoring suite provides hosts with an intuitive interface to build, edit, and organize interactive quiz content prior to hosting online.

*   **Quiz Metadata Management**: Hosts assign a required Quiz Title (1–120 characters), an optional Description (up to 500 characters), a primary Language selection, and an optional Cover Image URL.
*   **Question Formats**: The MVP supports two core question formats:
    *   *Multiple Choice*: 2 to 4 answer options with exactly 1 designated correct option.
    *   *True / False*: Pre-populated binary options where exactly 1 option is marked correct.
*   **Question Configuration Parameters**:
    *   *Question Prompt*: Plain text prompt up to 250 characters.
    *   *Time Limit*: Selectable countdown timer per question (options: 10s, 20s, 30s, 60s, 90s, 120s; default: 30s).
    *   *Point Allocation*: Selectable scoring weight per question (Standard: 1,000 pts max; Double Points: 2,000 pts max; No Points: 0 pts).
*   **Reordering & Persistence**: Button-based reordering of questions within a quiz deck and auto-saving draft states to prevent content loss.

### 3.2 FR-2: Access & Multi-Channel Joining Engine
The joining engine handles live session creation, code generation, and incoming participant connections without requiring participant authentication.

The table below outlines the core specifications governing session access and joining channels:

| Dimension | Specification Standard | Implementation Details |
| :--- | :--- | :--- |
| **Unique Quiz PIN** | 6-Digit Numeric Code | Random non-colliding numeric PIN (e.g., `839 201`); enforced by PostgreSQL for nonterminal sessions, with a Redis lookup cache |
| **Dynamic QR Code** | Vector SVG / PNG Payload | High-contrast QR code generated on presenter screen; auto-navigates mobile camera to pre-filled join URL |
| **Direct Share Link** | HTTPS URL Route | Structured route (`https://app.quiz.com/join?pin=839201`); copyable via one-click presenter button |
| **Access Protocol** | WebSockets (WSS) | Managed realtime delivery using provider-supported fallback; HTTP answers and snapshot polling provide recovery |
| **Guest Registration** | Anonymous Nickname Entry | 1–25 character display name; sanitized via profanity filter; duplicate names assigned auto-suffix (e.g., `Alex_42`) |

### 3.3 FR-3: Live Hosting & Orchestration Dashboard
The hosting dashboard serves as the presenter's command center, providing real-time room controls, participant tracking, and state orchestration.

The live session moves deterministically through five visible room states managed by the authoritative API:

1.  **Lobby State**: Displays room PIN, QR code, share link, real-time joined player counter, nickname grid, and a "Kick Participant" moderation control.
2.  **Question Active State**: Broadcasts question prompt, answer options, and active countdown timer; displays live submission counter indicating how many participants have submitted responses.
3.  **Result Reveal State**: Halts timer, locks answer inputs, reveals the correct option, and displays a response distribution bar chart across all options.
4.  **Leaderboard State**: Projects current top 5 participant rankings, points earned, and position delta indicators (+/- rank changes).
5.  **Final Podium State**: Concludes the quiz session, displays top 3 overall winners with visual celebration animations, and enables CSV report downloading.

### 3.4 FR-4: Real-Time Participant Web Client
The participant client is an ultra-lightweight, mobile-responsive interface optimized for fast rendering and low latency on iOS and Android browsers.

*   **Lobby Waiting State**: Displays connection confirmation, participant nickname, host branding, and a confirmation message.
*   **Question Active State**: Renders color-coded and shape-coded answer selection buttons (Tangerine Triangle, Cobalt Diamond, Sun Circle, Mint Square) matching the host display, alongside a server-synchronized countdown timer bar.
*   **Answer Submission Mechanics**: Single-tap selection registers response instantly, displaying a locked "Response Submitted" screen to prevent duplicate submissions.
*   **Result Reveal & Feedback State**: Screen updates instantly upon question closure:
    *   *Correct*: Mint feedback, points earned for the question, speed bonus, and updated total score.
    *   *Incorrect*: Bubblegum feedback, correct answer indication, and current leaderboard rank.
*   **Connection Resilience & Recovery**: Background heartbeat pings monitor connectivity every 3,000ms. If cellular or Wi-Fi connectivity drops, the client executes exponential backoff with jitter and snapshot reconnection using a stored ephemeral token, preserving score and room state without kicking the player.

### 3.5 FR-5: Scoring Engine & Real-Time Leaderboard
The scoring engine computes participant scores dynamically based on accuracy and response velocity.

#### Scoring Algorithm
Incorrect responses receive 0 points. Correct responses calculate points using a time-decay accuracy formula that rewards faster answers while guaranteeing at least 50% of base points for any correct submission:

$$\text{Points} = \text{BasePoints} \times \left( 0.5 + \left( 0.5 \times \frac{\text{TimeRemaining}}{\text{TotalTime}} \right) \right)$$

For example, on a 1,000 BasePoint question with a 30-second timer, a participant submitting the correct answer in 3 seconds (27 seconds remaining) earns 950 points:

$$\text{Points} = 1000 \times \left( 0.5 + \left( 0.5 \times \frac{27}{30} \right) \right) = 1000 \times (0.5 + 0.45) = 950 \text{ points}$$

#### Leaderboard Aggregation
PostgreSQL durably records accepted answers; Redis can cache score totals. Complete ranking uses the deterministic comparator in section 9, not Redis score ordering alone. The presenter display renders animated rank changes and presents top score updates after each question, culminating in the 3-tier winner podium at session completion.

### 3.6 FR-6: Post-Session Analytics & CSV Export
At the conclusion of a session, hosts access structured summary metrics and downloadable reports:

*   **Summary Metrics**: Total joined participants, completion rate percentage, average accuracy percentage across all questions, and identification of the "Toughest Question" (lowest percentage of correct answers).
*   **CSV Data Export**: One-click export providing a structured CSV file containing participant nicknames, total scores, final ranks, and a question-by-question matrix of selected options, correctness booleans, response times in milliseconds, and points awarded.

---

## 4. API and realtime contracts

[Technical contracts](docs/technical-contracts.md) specify the authoritative REST commands, realtime events, snapshot recovery, permission boundaries and error handling. Answers use authenticated HTTP submission, not client-published WebSocket commands. The original preliminary payloads are superseded.

## 5. Persistence model

[Technical contracts](docs/technical-contracts.md#persistence) define the relational entities and invariants to implement as Stage 2 migrations. Session questions/options are immutable snapshots, responses are durable, and retries cannot award points twice. Redis is recoverable cache, not the sole score store. No schema has been applied yet.

---

## 6. Non-Functional Requirements (NFRs)

### 6.1 Performance & Concurrency
*   **Capacity Boundary**: A single live room supports up to 500 concurrent connected participants without degradation in state broadcast latency.
*   **State Latency**: Host state transitions (question start, answer lock) broadcast and render on participant screens within <200ms under standard 4G/Wi-Fi conditions.
*   **Database Query Bounds**: API endpoint responses (quiz fetch, room creation) return within <150ms at the 95th percentile.

### 6.2 Network Resilience & Offline Sync
*   **Heartbeat Monitoring**: Use realtime SDK connection monitoring; do not write participant heartbeats to Redis every three seconds.
*   **Disconnection Grace Period**: If a participant experiences network loss, identity, accepted answers, and scores persist throughout the session in PostgreSQL; cache expiry does not remove them.
*   **Reconnection Handling**: Upon network restoration, the client transmits the stored ephemeral token to re-sync state automatically without re-entering nickname or PIN.

### 6.3 Security & Data Privacy
*   **Authentication**: Host actions protected via JWT bearer tokens over HTTPS/TLS 1.3.
*   **Participant Input Sanitization**: Nicknames and textual inputs sanitized against HTML/Script injection attacks.
*   **Ephemeral Data Handling**: Guest participant tokens expire 6 hours post-session; no participant email or account is required; nicknames may contain personal information.
*   **Rate Limiting**: Configurable joining limits support shared Wi-Fi; see section 9 for defaults.

### 6.4 Usability & Accessibility
*   **Device Compatibility**: Responsive UI renders across mobile viewports (minimum 320px width), tablet, and desktop displays (Chrome, Safari, Firefox, Edge).
*   **Accessibility Standards**: Screen color contrast ratios adhere to WCAG 2.1 AA standards; distinct shapes (Triangle, Diamond, Circle, Square) are paired with color codes on answer buttons to accommodate colorblind participants.

---

## 7. Out-of-Scope Exclusions (MVP Boundary)

To ensure rapid market delivery and lean initial execution, advanced feature sets are explicitly excluded from the MVP build and deferred to post-MVP releases:

| Functional Area | Excluded Post-MVP Capabilities |
| :--- | :--- |
| **Question Formats** | Open-ended text, Word Cloud clustering, Slider ranges, Pin on Image, Matching pairs |
| **AI Capabilities** | Automated PDF/PPT document parsing, AI question generation, automated distractor creation |
| **Game Modes** | Advanced Team vs Team modes, Survivor elimination, Multi-round wager mechanics |
| **System Integrations** | LMS LTI 1.3 Advantage integration, PowerPoint Add-in, Microsoft Teams / Zoom apps |
| **Monetization & Security** | Corporate Single Sign-On (SSO/SCIM), automated subscription payment gateways |
| **Advanced Media** | Embedded live streaming video frames, audio-only question clips, custom background audio uploads |

---

## 8. Success Metrics, Key Performance Indicators & Validation Plan

### 8.1 Core KPI Definitions
The success of the MVP build will be evaluated against four core operational metrics:

*   **Joining Success Rate**: Target \\(\ge 98.5\%\\) of participant join attempts successfully reach the waiting lobby in <3 seconds.
*   **Host Session Completion Rate**: Target \\(\ge 90\%\\) of launched quiz sessions progress through to the final podium screen.
*   **Connection Stability**: Target \\(\ge 97\%\\) of participants complete a full 10-question session without unrecoverable socket disconnects.
*   **Participant Ease Rating**: Post-session single-question survey ("How easy was it to join and play?") target \\(\ge 4.5 / 5.0\\).

### 8.2 Launch & Quality Assurance Checklist
Prior to public deployment, the build must pass the following validation gates:

*   [ ] **Cross-Device QA**: Verified seamless rendering on iOS Safari, Android Chrome, and Desktop Chrome.
*   [ ] **Load & Concurrency Testing**: Simulated 500 concurrent WebSocket participants submitting answers within a 2-second window with zero lost acknowledged answers and zero duplicate points.
*   [ ] **Multi-Channel Verification**: Confirmed join flows via Direct Link click, QR Code mobile scan, and manual 6-digit PIN entry.
*   [ ] **Resilience Testing**: Simulated abrupt Wi-Fi disconnection mid-session and verified successful reconnection and score preservation.

## 9. Reconciled MVP rules

### Scope and authoring

Both authoring and hosting support desktop/tablet/mobile down to 320px. Blob customization (six bodies, three moods), five uniform-random leaderboard themes with no immediate repeat/no host picker, cosmetic streaks, awards, personal final cards and ease ratings are in scope. True uses cobalt/diamond and false tangerine/triangle. UI is initially English; quiz language is metadata. Sound/haptics, dark mode, UI translations, rich text, public draft sharing and native apps are deferred alongside section 7 exclusions.

Title 1–120, description up to 500, prompt 1–250, nonempty option 1–150 characters; optional HTTPS cover URL. Exactly one correct answer for both formats. Default timer is 30s for both. Incomplete drafts may save; launch requires at least one fully valid question. Hosts add/delete/reorder questions. Revision-checked debounced autosave shows saving/saved/failed and cannot overwrite a newer draft silently. Each launch freezes quiz content. Archive rather than deleting quizzes with history. Login, logout, library and password recovery are required; reset email integration is configured during account implementation.

### Joining and limits

Default configurable room capacity: 500. Canonical link `/join?pin=839201`; path form redirects. Generate a real QR from configured HTTPS origin. PINs are six-character strings including leading zeros and unique while a session is nonterminal. New joining and moderation are lobby-only; existing players reconnect during play. Capacity counts roster members, not sockets. Joining/start must serialize. Kicking revokes access and releases a lobby place. Nicknames normalize and fit 25 characters including server-assigned duplicate suffix; prohibited names are rejected with a clear error.

Operator defaults, adjustable after shared-Wi-Fi tests: 1200 join attempts/IP/minute, burst 600; 20/browser/minute; 30 invalid PIN attempts/IP/minute. Return 429 plus Retry-After. Reconnect has its own abuse budget and does not consume a place. Browser identifiers are supplemental, not trusted security boundaries.

### States and control

LOBBY → QUESTION_ACTIVE → RESULT_REVEAL → LEADERBOARD → next QUESTION_ACTIVE or COMPLETED. COMPLETED renders final podium. CANCELLED/INTERRUPTED are terminal. Recovery status is an overlay, not a separate question state. Start requires at least one player. No early reveal/skip: question closes on its deadline even if everyone answered. Host reveals leaderboard and advances, or finishes after last leaderboard. Show fewer winners if fewer than three players. Play again creates a fresh lobby with a new join flow.

One renewable host-control lease (30s, renewed every 10s foregrounded) fences commands with a generation. Another authenticated device explicitly takes over; old commands are rejected. Host loss/backgrounding lets active question finish then holds progression. Fifteen minutes without host heartbeat closes as INTERRUPTED; preserve partial results without champion celebration. Lobby cancel is CANCELLED; early ending after start is INTERRUPTED.

### Timing, submissions and recovery

Use server startsAt/endsAt; client animates countdown without per-second server broadcasts. API accepts only an active question, correct option membership and one response per player/question, received before endsAt. At the exact deadline reject. Never trust client timestamps. Concurrent closure/acceptance serialize; a received but not yet committed answer is not acknowledged and can still be rejected if closure wins. Do not promise to accept an uncommitted response.

Tap displays Submitting and locally locks; only durable acknowledgement says Locked in. Lost acknowledgement retries the same submission ID and recovers its original outcome. Definitive rejection allows a new selection only if none accepted and question is active. Unknown transport outcome keeps Checking your answer. No offline queue submits into another question. Backoff with jitter: 1s initial, capped 30s; reconnect reads role-filtered snapshot and own accepted response. Tokens remain renewable for active session and expire six hours after termination; Redis loss does not erase participants.

Deadline/inactivity jobs are durable and retry-safe. APIs enforce expiry independently and can reconcile overdue state. If realtime delivery fails, persistent outbox and snapshot recovery restore truth. Service outage shows Reconnecting; never silently accept/score offline answers.

### Scoring, distinct ranks, statistics

`elapsedMs = clamp(serverReceivedAt - startsAt, 0, durationMs)`; `multiplier = 0.5 + 0.5 * (durationMs - elapsedMs) / durationMs`; `points = floor(basePoints * multiplier + 0.5)`. Correct accepted answers use 0/1000/2000 base points. Incorrect/unanswered = 0. Examples: 1000/30s/3s → 950; 2000/10s/1.8s → 1820; 2000/30s/1.8s → 1940. Replays return original time/score.

Rank comparator: total points descending; scored-question correct count descending; cumulative response time for those correct answers ascending; last correct accepted timestamp ascending (missing last); UUID lexical ascending. Distinct ranks for everyone, including all-zero-score games. No-point questions affect accuracy/streak, not tie-breaks. Rank delta is previous minus current, null on first question. Gap may be zero for equal points separated by response time. Finalize all results at closure before reveal.

Correct increments cosmetic streak (including no-point); incorrect/unanswered resets. Speed Demon: lowest average correct-response time, at least one correct required. Hot Streak: highest positive best streak. Comeback Kid: largest positive improvement from first-question to final rank, at least one correct required. Resolve award ties by final rank; omit award with no eligible winner. One player may earn multiple awards, stored as array. Interrupted games have no awards.

### Basic reporting and local card

Freeze roster at start, exclude lobby kicks, include disconnected players. Completed participant accuracy = correct/all questions; overall accuracy = correct/(roster × questions); unanswered counts incorrect. Completion = players answering every question/roster. Average time uses all accepted responses, null if none; award average uses correct responses only. Toughest = lowest correct/roster, tie by question order. Partial reports use closed questions only; label provisional/partial and use null metrics if none closed. Cancelled lobbies have no game analytics.

CSV includes score/rank and per-question option/status/correctness/time/points; unanswered nullable fields are blank. Escape spreadsheet formula prefixes in user text. Ease rating: optional one value 1–5/player/completed session, idempotent. Final card percentile = ceil(rank/playerCount × 100), e.g. 2/24 → top 9%. Save my card generates a local PNG with download and mobile save/share fallback; no public card hosting. Top-three confetti only.

### Validation and security

Measure state commit-to-render p95 <200ms in defined APJ Wi-Fi/4G profile; record command/API latency separately. Warm API p95 <150ms target, report cold starts separately. Validate 500 players joining from shared IP, 500 answers in two seconds, duplicate retries, deadline races, host takeover/backgrounding, reconnection, process/deployment changes and provider outages. Test two simultaneous 500-player rooms separately from per-room capacity. Verify exact scores/ranks agree across snapshots, displays and CSV.

Host cookies must be secure/HttpOnly with CSRF checks for writes; ownership and guest/realtime scopes enforced server-side. Cache TTL never deletes reports. Secret/token logging prohibited. Transactional event delivery uses durable outbox and deduplication. Provider plans/throughput/connection quotas and APJ availability must pass integration checks. Data retention/deletion policy remains a public-release decision; use synthetic data before then.
