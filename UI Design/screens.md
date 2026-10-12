> Stage 1: [responsive and error-state supplement](stage-1-ux.md) and [revised PRD](../quiz-platform-mvp-prd.md) govern actual behavior. Samples below are visual references.

# Screens

All sample data is invented. Host screens are 1360×820 reference; phone screens are 390×844. Corresponding PRD sections are in brackets.

Room states from the PRD map to screens like this:

| PRD room state | Host screen | Player screen |
| :--- | :--- | :--- |
| Lobby | Lobby | Enter code, Make your blob, Waiting room |
| Question Active | Question live | Answer |
| Result Reveal | Answer reveal | Correct or Wrong |
| Leaderboard | Themed leaderboard | Correct or Wrong (rank shown) |
| Final Podium | Winner cards | Final rank card |

---

## Host

### 1. Quiz builder (`Main.dc.html`, interactive) [FR-1]

**Purpose:** create and edit a quiz quickly.

**Layout:** top bar; center column of question cards; right-hand cobalt Question ideas panel.

- **Top bar:** logo, quiz name input (1–120 chars), "Autosaved" indicator, primary **Go live**.
- **Header row:** "N questions", plus an estimate ("about 3 min · up to 6,000 pts each player").
- **Question cards:** one card is **open** (expanded) at a time; others are collapsed rows.
  - Collapsed row: number badge, prompt (single line, ellipsis), time chip, points chip, up/down reorder buttons. Click to open.
  - Open card: number and type label, character counter (max 250), large prompt textarea, answer tiles in a 2-column grid, then **Time** and **Points** segmented controls.
- **Answer tile:** shape key badge, text input, and a **Mark / Correct** toggle button. Marking one answer correct unmarks the others (single-select).
- **Time options:** 10, 20, 30, 60, 90, 120 seconds (default 30).
- **Points options:** Standard (1,000), Double (2,000), None (0).
- **Add buttons:** "+ Multiple choice" (4 answers) and "+ True / False" (2 answers). A new card opens immediately.
#### Question ideas panel

Replaces the phone preview. Desktop uses the right-hand cobalt column; at mobile widths a **Question ideas** toggle reveals it below the question list (supports 320px).

- Database-backed curated library (30 initial ideas, six per content category), loaded through the host-authenticated API; skeleton, empty category, inline Retry and pagination states.
- Header, filtered count badge and help: "Tap Add to drop one into your quiz. Edit it after."
- Category toggle chips: All (default), Science, Tech, Geography, Work safety, General; instant filtering with `aria-pressed`.
- Vertically scrolling sticker cards show category/type, allowed time/points, prompt and a 2-column answer grid using existing shape/color keys. Correct answer has a check and mint tint.
- **Add** appends an independent editable copy, opens it, scrolls it into view and focuses its prompt. Uses normal revision-safe autosave.
- A non-interactive mint **✓ Added** state prevents duplicates while that question exists, including after editing/reload. Deleting the copied question restores Add.
- At 100 questions, remaining Add buttons are disabled with an explanatory message. Ideas obey the application's question schema.


**States to build:** empty quiz, a card with validation errors (prompt empty, fewer than 2 answers, no correct answer), saving, save failed, 100% of fields at their max length.

**Interactions in the prototype:** open a card, mark correct, change time and points, edit prompt and answers, reorder, add questions.

### 2. Lobby (`Lobby.dc.html`) [FR-2, FR-3 Lobby state]

**Purpose:** let players join, then start the game.

- A wide **ticket**: orange QR stub on the left (with a perforated divider and notches), and on the right "GO TO QUIZZZZ.APP AND ENTER" with the **6-digit PIN** at 168px in mono, a sun-colored player counter sticker (rotated 3°), and **Copy link**.
- **Who's here:** every joined player appears as their blob with a name pill; the newest drops in with a bounce; "N just joined" ticker; "+ N more" when the list overflows.
- **Start game** (primary, bottom right). **Cancel game** (top right).
- Moderation: clicking a blob removes that player (PRD "Kick Participant"). The kick UI itself (confirm, undo) is not designed yet.

**Data:** PIN, join URL, QR payload, quiz title and question count, ordered list of `{id, nickname, avatar}`.

### 3. Question live (`Question.dc.html`) [FR-3 Question Active state]

**Purpose:** show the question and keep the room tense.

- **Left panel (cobalt, 500px):** `Q n / N` chip, optional **2× POINTS** sticker (wobbles), the question at 64px, large countdown number (sun) and a **fuse bar** that empties as time runs out.
- **Right panel (chalk):** "17 of 24 locked in" with a row of dots (one per player; filled with a blob color once answered, dashed when pending), then four white **answer cards** stacked, each with a color-and-shape key badge and the answer text at 46px.
- True/False questions show two cards.
- Answers stay secret until time is up; the screen shows only counts.

**Data:** question index and total, prompt, time limit and remaining time (server-synced), points multiplier, options, answered count, player count.

### 4. Answer reveal (`Reveal.dc.html`) [FR-3 Result Reveal state]

**Purpose:** show the right answer and how the room voted.

- Same split layout. **Left panel:** "TIME'S UP" chip, the question (smaller), a giant percentage "of the room got it" (sun), the **fastest correct** player (blob and time), and the primary button **See the leaderboard**.
- **Right panel:** the answer cards become bars. Each card has a colored fill sized to its share of votes, a count, and the correct card is highlighted (mint fill, thicker outline, larger shadow, a `RIGHT` tag).
- Bars animate in from the left.

**Data:** per-option vote counts, correct option, percent correct, fastest correct `{player, ms}`.

### 5. Themed leaderboard (`Leaderboard.dc.html`, interactive) [FR-3 Leaderboard state, FR-5]

**Purpose:** show standings as a scene the room enjoys watching. Full detail in [`leaderboard-themes.md`](leaderboard-themes.md).

- **Header:** "AFTER QUESTION n OF N" and a theme-specific headline. In the product the theme is **chosen at random** for each question (no immediate repeats) and there is **no picker**. The **theme chips** (Summit, Grand Prix, Tour de Quiz, Moonshot, Treasure) exist only so reviewers can preview each theme in the prototype; the design labels them "PREVIEW ONLY · IN THE GAME A RANDOM THEME PLAYS EACH QUESTION". Do not build them.
- **Scene (886×566):** the themed illustration with each top-player blob placed by score, plus a sun sticker naming the leader and their title.
- **Standings (right):** top 5 rows with rank, blob, name, points this round, total, and a rank-change chip (mint up arrow, bubblegum down arrow, or `=`).
- **Next question** (primary).

The PRD says the leaderboard shows the top 5, so five blobs are drawn.

### 6. Winner cards (`Podium.dc.html`) [FR-3 Final Podium state, FR-6]

**Purpose:** celebrate the top 3 and offer next steps.

- Header "FINAL RESULTS" and a headline naming the winner.
- Three **trading cards**: 2nd (left, tilted −3°), 1st (center, larger, crown, hopping blob), 3rd (right, tilted 3°). Each has a place number, a role tag (RUNNER-UP, CHAMPION, PODIUM), the blob, nickname, score, and three stats: **accuracy, average time, best streak**.
- Confetti falls across the screen.
- Award stickers at the bottom: Speed Demon, Hot Streak, Comeback Kid.
- Buttons: **Download CSV** (PRD export) and **Play again**.

**Data:** top 3 with `{nickname, avatar, score, accuracy, avgMs, bestStreak}`, award winners. The PRD's summary metrics (total joined, completion rate, average accuracy, toughest question) are **not yet laid out**; see the handoff for open items. Players see their own result on the phone at the same moment (screen 13).

---

## Player (phone)

### 7. Enter code (`PhoneJoin.dc.html`) [FR-2]

"Got a code?" headline, six digit boxes (typed digits in mono, a blinking caret on the next empty box), **Join the game**, and a note that a scanned QR code skips this screen. Blobs peek from the bottom edge. A hidden numeric input drives the boxes (open the numeric keypad on mobile).

**Errors to design:** unknown or ended PIN, game already started, configurable rate limit (see PRD section 9).

### 8. Make your blob (`PhoneName.dc.html`) [FR-2 guest registration]

PIN and quiz title chip, large blob preview (bobbing), **Body** picker (6 blobs), **Mood** picker (Happy, Cheeky, Ooh), **Nickname** input (1–25 characters, counter), **Let's go**. Duplicate nicknames get an auto-suffix (for example `Alex_42`) and profanity is filtered server-side, per the PRD.

### 9. Waiting room (`PhoneWait.dc.html`) [FR-4 Lobby]

Cobalt screen. "You're in · N players" pill, the player's own blob bobbing, "Hey, Maya!", animated dots ("Waiting for the host"), a three-step **How it works** card (answer fast, keep your streak, race to the finish), and a crowd of blobs along the bottom edge.

### 10. Answer (`PhoneAnswer.dc.html`, interactive) [FR-4 Question Active]

Header (question number, 2× sticker, your score), **fuse bar**, the question text, four full-width **answer rows** (key badge plus label). Tapping a row locks the answer: that row turns cobalt with a mint check, the others fade to 45% and lose their shadows, and a pill reads "Locked in · waiting for N more". A second tap does nothing (duplicate prevention).

### 11. Correct (`PhoneCorrect.dc.html`) [FR-4, FR-5]

Mint screen with confetti and a jumping blob. "Nailed it!" and a **score receipt** (`Double points 2,000`, `Speed · 1.8s × 91%`, then **+1,820** and the running total). Under it, a dark card with the **streak** (five pips, filled ones show a flame) and **rank** with movement ("3rd, up 3 places"), plus an encouraging gap line ("Only 230 pts behind 2nd").

### 12. Wrong (`PhoneWrong.dc.html`) [FR-4]

Bubblegum screen with a wobbling sad blob. "So close!", a card with **the right answer** (key badge and text) and what the player picked, a **rank** card ("5th, down 2 places") and an empty streak ("Start a new one"), then "Only 125 pts behind 4th".

The sample shows a different player (sky blob) than the correct screen because it is a different result; in the product it is always the viewing player.

### 13. Final rank (`PhoneFinal.dc.html`) [FR-4, FR-6]

**Purpose:** every player sees how they finished, at the moment the host's winner cards appear.

- Header "GAME OVER · {quiz title}" and "You finished 2nd!" (the headline adapts: "You won!" for 1st, "You finished Nth!" otherwise).
- A **player card**, same family as the host winner cards: place and "/N players" in mono, a "TOP n%" tag, the player's hopping blob, nickname, score, and a 3-up stat grid (**accuracy, average time, best streak**). Card fill by place: 1st sun, 2nd sky, 3rd bubblegum, everyone else white. It tilts −2° and rises in. Confetti falls for ranks 1 to 3 only.
- **Award stickers** if the player earned any (Speed Demon, Hot Streak, Comeback Kid); hidden otherwise.
- **Ease rating:** "How easy was it to join and play?" with 1 to 5 buttons (PRD KPI, target 4.5 or higher). The selected value is sun; the sample shows 5.
- **Save my card** (primary): generates a PNG for local download, with mobile save/share fallback. **Join another game** returns to Enter code.

**Data:** final rank, player count, percentile, score, accuracy, average response ms, best streak, awards array, quiz title. The percentile is `ceil(rank / playerCount × 100)`.

**Edge cases to build:** ranks 4 and below (white card, no confetti); equal points (show distinct ranks using the PRD comparator); a player who disconnected before the end (show their final server-computed rank); zero correct answers (accuracy 0%, no award, keep the tone kind).

---

## Design language sheet (`Foundations.dc.html`)

A one-page reference of the palette, type, the six blobs, answer keys and button styles. See [`design-system.md`](design-system.md).
