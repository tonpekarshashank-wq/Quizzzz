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

### 2.1 Technical Architecture Overview
The platform operates as a modern single-page web application backed by a real-time event-driven backend. The system comprises four primary architectural layers designed to ensure sub-200ms latency between the presenter display and mobile participants:

*   **Presenter Web UI**: React and Next.js single-page application providing the quiz authoring suite and the live hosting control dashboard.
*   **Participant Mobile Client**: Lightweight, mobile-first Progressive Web App optimized for mobile browser execution, rendering live questions, interactive answer buttons, and rank feedback.
*   **Real-Time State Gateway**: Node.js backend managing persistent WebSocket connections and Server-Sent Events (SSE) for real-time game state broadcasting.
*   **Database & Session Store**: PostgreSQL relational database for persistent user accounts, quiz definitions, and historical reports, paired with Redis for in-memory live session state, participant lobbies, and real-time leaderboard aggregation.

The structural interaction between these system components is detailed in the architecture summary below:

| System Layer | Core Technology | Primary Responsibility |
| :--- | :--- | :--- |
| **Presenter Dashboard** | React / Next.js SPA | Quiz authoring, room creation, state orchestration, live leaderboard projection |
| **Participant Client** | Mobile PWA (React) | Instant room entry, single-tap answer submission, real-time feedback rendering |
| **Real-Time Gateway** | Node.js / WebSockets | Bi-directional state broadcasting, timer synchronization, heartbeats |
| **In-Memory Session Cache** | Redis | Ephemeral session state, active PIN registry, atomic score aggregation |
| **Relational Database** | PostgreSQL | User accounts, quiz definitions, historical session logs, CSV export records |

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
> **Step 1: Multi-Channel Entry** \\(\rightarrow\\) Participant scans the display QR code, clicks a shared URL link (`https://app.quiz.com/join/839201`), or navigates to `app.quiz.com` and inputs the 6-digit PIN.
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
    *   *Multiple Choice*: 2 to 4 answer options with at least 1 designated correct option.
    *   *True / False*: Pre-populated binary options where exactly 1 option is marked correct.
*   **Question Configuration Parameters**:
    *   *Question Prompt*: Rich text or plain text prompt up to 250 characters.
    *   *Time Limit*: Selectable countdown timer per question (options: 10s, 20s, 30s, 60s, 90s, 120s; default: 30s).
    *   *Point Allocation*: Selectable scoring weight per question (Standard: 1,000 pts max; Double Points: 2,000 pts max; No Points: 0 pts).
*   **Reordering & Persistence**: Button-based reordering of questions within a quiz deck and auto-saving draft states to prevent content loss.

### 3.2 FR-2: Access & Multi-Channel Joining Engine
The joining engine handles live session creation, code generation, and incoming participant connections without requiring participant authentication.

The table below outlines the core specifications governing session access and joining channels:

| Dimension | Specification Standard | Implementation Details |
| :--- | :--- | :--- |
| **Unique Quiz PIN** | 6-Digit Numeric Code | Random non-colliding numeric PIN (e.g., `839 201`); verified against Redis active session registry |
| **Dynamic QR Code** | Vector SVG / PNG Payload | High-contrast QR code generated on presenter screen; auto-navigates mobile camera to pre-filled join URL |
| **Direct Share Link** | HTTPS URL Route | Structured route (`https://app.quiz.com/join?pin=839201`); copyable via one-click presenter button |
| **Access Protocol** | WebSockets (WSS) | Persistent bi-directional socket connection with automatic fallback to HTTP long-polling |
| **Guest Registration** | Anonymous Nickname Entry | 1–25 character display name; sanitized via profanity filter; duplicate names assigned auto-suffix (e.g., `Alex_42`) |

### 3.3 FR-3: Live Hosting & Orchestration Dashboard
The hosting dashboard serves as the presenter's command center, providing real-time room controls, participant tracking, and state orchestration.

The live session moves deterministically through five room states managed by the WebSocket gateway:

1.  **Lobby State**: Displays room PIN, QR code, share link, real-time joined player counter, nickname grid, and a "Kick Participant" moderation control.
2.  **Question Active State**: Broadcasts question prompt, answer options, and active countdown timer; displays live submission counter indicating how many participants have submitted responses.
3.  **Result Reveal State**: Halts timer, locks answer inputs, reveals the correct option, and displays a response distribution bar chart across all options.
4.  **Leaderboard State**: Projects current top 5 participant rankings, points earned, and position delta indicators (+/- rank changes).
5.  **Final Podium State**: Concludes the quiz session, displays top 3 overall winners with visual celebration animations, and enables CSV report downloading.

### 3.4 FR-4: Real-Time Participant Web Client
The participant client is an ultra-lightweight, mobile-responsive interface optimized for fast rendering and low latency on iOS and Android browsers.

*   **Lobby Waiting State**: Displays connection confirmation, participant nickname, host branding, and a confirmation message.
*   **Question Active State**: Renders color-coded and shape-coded answer selection buttons (Red Triangle, Blue Diamond, Yellow Circle, Green Square) matching the host display, alongside a server-synchronized countdown timer bar.
*   **Answer Submission Mechanics**: Single-tap selection registers response instantly, displaying a locked "Response Submitted" screen to prevent duplicate submissions.
*   **Result Reveal & Feedback State**: Screen updates instantly upon question closure:
    *   *Correct*: Green visual flash, points earned for the question, speed bonus, and updated total score.
    *   *Incorrect*: Red visual flash, correct answer indication, and current leaderboard rank.
*   **Connection Resilience & Recovery**: Background heartbeat pings monitor connectivity every 3,000ms. If cellular or Wi-Fi connectivity drops, the client executes exponential backoff reconnection using a stored ephemeral token, preserving score and room state without kicking the player.

### 3.5 FR-5: Scoring Engine & Real-Time Leaderboard
The scoring engine computes participant scores dynamically based on accuracy and response velocity.

#### Scoring Algorithm
Incorrect responses receive 0 points. Correct responses calculate points using a time-decay accuracy formula that rewards faster answers while guaranteeing at least 50% of base points for any correct submission:

$$\text{Points} = \text{BasePoints} \times \left( 0.5 + \left( 0.5 \times \frac{\text{TimeRemaining}}{\text{TotalTime}} \right) \right)$$

For example, on a 1,000 BasePoint question with a 30-second timer, a participant submitting the correct answer in 3 seconds (27 seconds remaining) earns 950 points:

$$\text{Points} = 1000 \times \left( 0.5 + \left( 0.5 \times \frac{27}{30} \right) \right) = 1000 \times (0.5 + 0.45) = 950 \text{ points}$$

#### Leaderboard Aggregation
Redis sorted sets (`ZADD` and `ZREVRANGE`) aggregate participant scores in real time upon answer receipt. The presenter display renders animated rank changes and presents top score updates after each question, culminating in the 3-tier winner podium at session completion.

### 3.6 FR-6: Post-Session Analytics & CSV Export
At the conclusion of a session, hosts access structured summary metrics and downloadable reports:

*   **Summary Metrics**: Total joined participants, completion rate percentage, average accuracy percentage across all questions, and identification of the "Toughest Question" (lowest percentage of correct answers).
*   **CSV Data Export**: One-click export providing a structured CSV file containing participant nicknames, total scores, final ranks, and a question-by-question matrix of selected options, correctness booleans, response times in milliseconds, and points awarded.

---

## 4. REST API & WebSocket Interface Specifications

### 4.1 REST API Endpoint Contract
The core API manages host authentication, quiz content management, live session initialization, and post-game data retrieval:

| Method | Endpoint Path | Primary Purpose | Authentication Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new host account | None |
| `POST` | `/api/v1/auth/login` | Host login issuing JWT bearer token | None |
| `GET` | `/api/v1/quizzes` | Fetch host's saved quiz library | Host JWT |
| `POST` | `/api/v1/quizzes` | Create a new quiz deck | Host JWT |
| `PUT` | `/api/v1/quizzes/:id` | Update existing quiz definition | Host JWT |
| `POST` | `/api/v1/sessions` | Initialize live session & generate PIN | Host JWT |
| `POST` | `/api/v1/sessions/join` | Validate PIN & register guest participant | None (Public) |
| `GET` | `/api/v1/sessions/:id/export` | Download CSV report for completed session | Host JWT |

#### Sample API Payloads

##### Join Session Endpoint (`POST /api/v1/sessions/join`)
To join a session, the participant client submits the room PIN and display nickname to the public join endpoint:

```json
{
  "pin": "839201",
  "nickname": "Alex_Trainer"
}
```

Upon validation, the server returns the session identifiers and an ephemeral token required for WebSocket connection:

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_99f82a1b-4c21",
    "participantId": "part_33d8a1",
    "nickname": "Alex_Trainer",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "wsEndpoint": "wss://app.quiz.com/ws/session/sess_99f82a1b-4c21"
  }
}
```

### 4.2 WebSocket Message Payload Protocol
Real-time state communication between server and clients utilizes structured JSON frames containing an `event` identifier and a data `payload`.

#### Server-to-Client: Question Active Event (`QUESTION_START`)
When a question begins, the server broadcasts the question prompt, timer limit, and answer option metadata to all connected clients:

```json
{
  "event": "QUESTION_START",
  "sessionId": "sess_99f82a1b-4c21",
  "payload": {
    "questionIndex": 1,
    "totalQuestions": 10,
    "questionPrompt": "Which protocol is utilized for real-time bi-directional communication in this platform?",
    "timeLimitSeconds": 30,
    "options": [
      { "id": "opt_a", "label": "HTTP/1.1", "color": "red", "shape": "triangle" },
      { "id": "opt_b", "label": "WebSockets", "color": "blue", "shape": "diamond" },
      { "id": "opt_c", "label": "FTP", "color": "yellow", "shape": "circle" },
      { "id": "opt_d", "label": "SMTP", "color": "green", "shape": "square" }
    ]
  }
}
```

#### Client-to-Server: Answer Submission Event (`SUBMIT_ANSWER`)
When a participant taps an answer button, the client transmits the option ID and client timestamp:

```json
{
  "event": "SUBMIT_ANSWER",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "payload": {
    "questionIndex": 1,
    "selectedOptionId": "opt_b",
    "clientTimestampMs": 1727680025112
  }
}
```

---

## 5. Data Model & Database Schema

The database architecture uses a PostgreSQL relational schema for persistent data storage paired with Redis key-value structures for real-time session state.

The relational schema maps host accounts, quiz content, live session instances, participant rosters, and individual answer submissions:

```sql
-- Users / Hosts Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes Table
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_order INT NOT NULL,
    prompt_text VARCHAR(250) NOT NULL,
    time_limit_seconds INT NOT NULL DEFAULT 30,
    point_multiplier DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Options Table
CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text VARCHAR(150) NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    option_order INT NOT NULL
);

-- Quiz Sessions Table
CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id),
    host_id UUID NOT NULL REFERENCES users(id),
    pin_code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'LOBBY',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Participants Table
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    nickname VARCHAR(25) NOT NULL,
    total_score INT NOT NULL DEFAULT 0,
    final_rank INT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Participant Responses Table
CREATE TABLE participant_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    selected_option_id UUID REFERENCES options(id),
    is_correct BOOLEAN NOT NULL,
    response_time_ms INT NOT NULL,
    points_awarded INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Non-Functional Requirements (NFRs)

### 6.1 Performance & Concurrency
*   **Capacity Boundary**: A single live room supports up to 200 concurrent connected participants without degradation in state broadcast latency.
*   **State Latency**: Host state transitions (question start, answer lock) broadcast and render on participant screens within <200ms under standard 4G/Wi-Fi conditions.
*   **Database Query Bounds**: API endpoint responses (quiz fetch, room creation) return within <150ms at the 95th percentile.

### 6.2 Network Resilience & Offline Sync
*   **Heartbeat Monitoring**: WebSocket connection ping/pong executed every 3,000ms.
*   **Disconnection Grace Period**: If a participant experiences network loss, the system retains their session state and score in Redis for 120 seconds.
*   **Reconnection Handling**: Upon network restoration, the client transmits the stored ephemeral token to re-sync state automatically without re-entering nickname or PIN.

### 6.3 Security & Data Privacy
*   **Authentication**: Host actions protected via JWT bearer tokens over HTTPS/TLS 1.3.
*   **Participant Input Sanitization**: Nicknames and textual inputs sanitized against HTML/Script injection attacks.
*   **Ephemeral Data Handling**: Guest participant tokens expire 6 hours post-session; no Personally Identifiable Information (PII) is requested or stored for participants.
*   **Rate Limiting**: Joining endpoints restricted to 10 requests per IP per minute to prevent automated bot joining.

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
*   [ ] **Load & Concurrency Testing**: Simulated 200 concurrent WebSocket participants submitting answers within a 2-second window with zero dropped frames.
*   [ ] **Multi-Channel Verification**: Confirmed join flows via Direct Link click, QR Code mobile scan, and manual 6-digit PIN entry.
*   [ ] **Resilience Testing**: Simulated abrupt Wi-Fi disconnection mid-session and verified successful reconnection and score preservation.
