# Quizzzz UI Design

UI design for the Live Quiz & Assessment Platform MVP described in [`../quiz-platform-mvp-prd.md`](../quiz-platform-mvp-prd.md).

## Stage 1 update

The [revised PRD](../quiz-platform-mvp-prd.md), [technical contracts](../docs/technical-contracts.md), and [responsive/error UX specification](stage-1-ux.md) settle mobile hosting, ranking, recovery and API behavior. Artboard sources remain unchanged visual references with fictional data.

## Concept

A light, tactile **"stickers, tickets and blobs"** look: chalk ground, 3px ink outlines, hard offset shadows, and a small set of loud colors. Every player gets a **blob** character that appears in the lobby, races on the leaderboard and gets a winner card at the end. That character is the core of the gamification.

Goals the design serves:

- **Easy quiz creation:** one stack of cards, edited in place, with a live phone preview.
- **Zero-friction joining:** a 6-digit code (or QR) and a nickname. No account.
- **Excitement:** big-screen moments (ticket lobby, fuse timer, animated reveal, themed leaderboard, winner cards) and phone feedback (score receipt, streaks, rank arrows).

## Product decisions (confirmed)

| Question | Decision |
| :--- | :--- |
| New answer colors (tangerine, cobalt, sun, mint with the four shapes) | **Approved.** This replaces the PRD's red, blue, yellow, green. |
| Blob avatars | **In MVP scope.** Players pick a body and a mood at join. |
| Leaderboard theme | **Random** each question, no immediate repeats. There is no host picker. |
| Streaks | **Cosmetic only.** They never affect scoring. |
| Final rank for players | **Yes.** Each player sees their own final rank card (screen 13). |

## Contents

| File | What it is |
| :--- | :--- |
| [`screens.md`](screens.md) | Every screen: purpose, layout, states, data it needs, interactions |
| [`design-system.md`](design-system.md) | Colors, type, spacing, borders, shadows, motion, accessibility rules |
| [`components.md`](components.md) | Reusable parts: blob avatar, answer key, buttons, chips, ticket, score receipt |
| [`leaderboard-themes.md`](leaderboard-themes.md) | The five themed leaderboard scenes and how to add more |
| [`developer-handoff.md`](developer-handoff.md) | Mapping to the PRD, extra data/events the UI needs, build order, open questions |
| [`tokens/tokens.json`](tokens/tokens.json) | Design tokens (machine-readable) |
| [`tokens/tokens.css`](tokens/tokens.css) | The same tokens as CSS custom properties |
| [`source/`](source) | The design source files (see below) |

## Viewing the designs

The designs were authored on a Claude design canvas: https://claude.ai/artifact/2KbtWEdREw7KKGN8JkoEwp

That link is **private to its owner**. Ask the owner to share it, or use the files in `source/`.

`source/` holds 14 `.dc.html` artboard files plus `canvas.json` (the canvas index with each artboard's position and size). They are the exact files that produce the canvas, so inline styles and the small logic blocks in them are accurate references for sizes, colors and geometry. They need the canvas runtime (`support.js`) to render, so they will **not** open correctly in a plain browser. Treat them as a precise reference, not as production code.

| Artboard file | Screen | Size |
| :--- | :--- | :--- |
| `Main.dc.html` | Host: quiz builder (interactive) | 1360×820 |
| `Lobby.dc.html` | Host: lobby ticket | 1360×820 |
| `Foundations.dc.html` | Design language sheet | 1360×820 |
| `Question.dc.html` | Host: question live | 1360×820 |
| `Reveal.dc.html` | Host: answer reveal | 1360×820 |
| `Leaderboard.dc.html` | Host: themed leaderboard (interactive) | 1360×820 |
| `Podium.dc.html` | Host: final winner cards | 1360×820 |
| `PhoneJoin.dc.html` | Player: enter code | 390×844 |
| `PhoneName.dc.html` | Player: make your blob | 390×844 |
| `PhoneWait.dc.html` | Player: waiting room | 390×844 |
| `PhoneAnswer.dc.html` | Player: answer (interactive) | 390×844 |
| `PhoneCorrect.dc.html` | Player: correct result | 390×844 |
| `PhoneWrong.dc.html` | Player: wrong result | 390×844 |
| `PhoneFinal.dc.html` | Player: final rank card | 390×844 |

## Status and caveats

- This is a **design**, not a built app. All names, scores and counts are sample data, consistent across screens (for example Maya is 3rd with 3,410 points).
- The four answer colors differ from the PRD. The change is approved (see [`developer-handoff.md`](developer-handoff.md#deviations-from-the-prd)).
- Phone screens are drawn at 390px wide. The PRD requires support down to 320px, which still needs to be checked during build.
