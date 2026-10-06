# Developer handoff

How the UI design relates to the PRD ([`../quiz-platform-mvp-prd.md`](../quiz-platform-mvp-prd.md)), what extra data and events it needs, and a suggested build order.

## Deviations from the PRD

1. **Answer colors.** PRD §3.4 specifies Red Triangle, Blue Diamond, Yellow Circle, Green Square. The design keeps the four **shapes** (the accessibility requirement) but uses a different palette: Triangle **tangerine**, Diamond **cobalt**, Circle **sun**, Square **mint**. Shapes still carry the meaning. The `color` field in the `QUESTION_START` payload should become a token name (`tangerine`, `cobalt`, `sun`, `mint`) or be dropped in favor of deriving color from the option's position. **Needs product approval.**
2. **Multiple choice is single-select** in the UI. PRD FR-1 allows "at least 1" correct option, but the `SUBMIT_ANSWER` payload carries one `selectedOptionId`. The builder lets the host mark exactly one answer correct.
3. **Light visual theme on the big screen**, with cobalt as the stage color. A dark projector mode is not designed.

## Features added by the design (not in the PRD)

| Feature | Where | Needed from the backend |
| :--- | :--- | :--- |
| **Blob avatar** | Join, lobby, leaderboard, winner cards | Per participant: `avatarBody` (0–5), `avatarMood` (`smile`, `grin`, `o`) |
| **Streak** (cosmetic) | Phone correct/wrong, winner stats | Per answer: current streak, per participant: best streak. Does not affect points. |
| **Rank movement** | Leaderboard, phone result | Previous rank and current rank per participant per question |
| **"Fastest correct"** | Reveal | Fastest correct response `{participantId, ms}` per question |
| **Per-question stats** | Reveal, winner cards | Vote counts per option, % correct; per participant: accuracy %, average response ms |
| **Awards** | Winner screen | Speed Demon (lowest avg time), Hot Streak (best streak), Comeback Kid (biggest rank gain). Computed at session end. |
| **Themed leaderboard** | Host leaderboard | A `theme` id per leaderboard event (`summit`, `gp`, `tour`, `moon`, `map`) |
| **Score breakdown** | Phone correct | Base points, speed multiplier, points earned, total |
| **Gap to next place** | Phone result | Points to the next higher rank |

### Suggested schema additions

```sql
ALTER TABLE session_participants
  ADD COLUMN avatar_body SMALLINT NOT NULL DEFAULT 0,   -- 0..5
  ADD COLUMN avatar_mood VARCHAR(8) NOT NULL DEFAULT 'smile', -- smile | grin | o
  ADD COLUMN best_streak SMALLINT NOT NULL DEFAULT 0;
```

Rank and streak can live in Redis during the session and be written to Postgres at the end. The `quizzes` table still needs a `language` column (PRD FR-1 lists a Language field but the schema does not have one).

### Suggested payload additions

`POST /api/v1/sessions/join` request:

```json
{ "pin": "839201", "nickname": "Alex_Trainer", "avatar": { "body": 0, "mood": "grin" } }
```

Question result event to each player (names indicative):

```json
{
  "event": "QUESTION_RESULT",
  "payload": {
    "questionIndex": 3,
    "correct": true,
    "correctOptionId": "opt_c",
    "pointsEarned": 1820,
    "basePoints": 2000,
    "speedMultiplier": 0.91,
    "responseMs": 1800,
    "totalScore": 3410,
    "streak": 3,
    "rank": 3,
    "rankDelta": 3,
    "gapToNext": 230
  }
}
```

Host leaderboard event:

```json
{
  "event": "LEADERBOARD",
  "payload": {
    "questionIndex": 3,
    "theme": "summit",
    "top": [
      { "participantId": "part_33d8a1", "nickname": "Priya", "avatar": { "body": 1, "mood": "grin" },
        "score": 3790, "gain": 1950, "rankDelta": 2 }
    ]
  }
}
```

## Screen to endpoint and event map

| Screen | Reads | Writes |
| :--- | :--- | :--- |
| Quiz builder | `GET /quizzes`, `GET /quizzes/:id` (add if missing) | `POST /quizzes`, `PUT /quizzes/:id` (autosave, debounced) |
| Go live | | `POST /sessions` returns PIN, join URL |
| Lobby | `PLAYER_JOINED`, `PLAYER_LEFT` | `START_GAME`, `KICK_PLAYER` |
| Question live | `QUESTION_START`, timer sync, `ANSWER_COUNT` | `NEXT` / `SKIP` (host) |
| Answer reveal | `QUESTION_END` with distribution | `SHOW_LEADERBOARD` |
| Leaderboard | `LEADERBOARD` | `NEXT_QUESTION` |
| Winner cards | `GAME_END` with top 3, awards | `GET /sessions/:id/export` (CSV) |
| Enter code and Make your blob | | `POST /sessions/join` |
| Waiting room | `PLAYER_COUNT`, `GAME_STARTING` | |
| Answer | `QUESTION_START`, timer | `SUBMIT_ANSWER` |
| Correct and Wrong | `QUESTION_RESULT` | |

Event names other than `QUESTION_START` and `SUBMIT_ANSWER` are placeholders; align them with the gateway design.

## Build order (suggested)

1. **Tokens and primitives:** `tokens.css`, sticker button, chip, segmented control, answer key, blob avatar. These are used everywhere.
2. **Player join path:** Enter code, Make your blob, Waiting room. Gets the join flow and WebSocket connection testable end to end.
3. **Host lobby:** ticket, QR code, live player list.
4. **Question loop, host and phone together:** Question live, Answer, Reveal, Correct, Wrong. This is the product's core.
5. **Quiz builder:** can be built in parallel with 2–4 since it only needs the REST API.
6. **Leaderboard** with one theme first (Summit), then the theme switcher and the rest.
7. **Winner cards, awards, CSV export, analytics summary.**
8. **Polish:** motion, reduced motion, sound hooks (not designed), 320px phone width, projector readability.

## Implementation notes

- **Rendering:** the designs use no raster images. Shapes, blobs, scenes, confetti and the QR placeholder are CSS and inline SVG; keep it that way for fast loading on phones. The QR in the design is a placeholder pattern. Generate a real QR code from the join URL.
- **Fonts:** self-host or preload the three fonts; use `font-display: swap`.
- **Timing:** the server owns time. Clients animate the fuse from the server's `endsAt` timestamp, so late joiners and reconnects stay in sync. Do not trust `clientTimestampMs` for scoring.
- **Optimistic lock:** on tap, lock the answer row locally right away, send `SUBMIT_ANSWER`, and roll back only if the server rejects it.
- **Reconnect:** show a slim "Reconnecting…" bar on the phone without losing the current screen; the design does not include this state yet.
- **Scale on the host display:** design is 1360×820. Scale uniformly to the window (`transform: scale()` on a fixed stage or fluid units) and keep the 16:9 feel; scenes are 880×560 and must scale as one unit.

## Open items and not yet designed

- Validation and error states in the builder (empty prompt, no correct answer, fewer than 2 answers, over-length text).
- Login and register screens, quiz library ("My quizzes"), and the post-game analytics page (total joined, completion rate, average accuracy, toughest question).
- Player-side final screen (final rank and share). Currently only the host sees the winner cards.
- Kick participant confirmation, empty lobby, game-already-started, bad PIN, rate-limited and reconnecting states.
- Sound and haptics.
- Light and dark host modes; localization (the PRD has a quiz language field but not UI translations).
- Reduced-motion variants of every animation.
- Verification at 320px phone width and with large text.

## Questions for product

1. Approve the new answer colors (deviation 1)?
2. Is the blob customization in scope for the MVP, or should every player get an auto-assigned blob?
3. Who chooses the leaderboard theme: the host per game, per question, or random only?
4. Should streaks ever affect scoring? (Today they are cosmetic.)
5. Do players see their own final rank and a shareable card at the end?
