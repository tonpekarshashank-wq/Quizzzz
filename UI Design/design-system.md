# Design system

Tokens live in [`tokens/tokens.json`](tokens/tokens.json) and [`tokens/tokens.css`](tokens/tokens.css). This page explains how to use them.

## Color

| Token | Hex | Role |
| :--- | :--- | :--- |
| `ink` | `#12131A` | All outlines, body text, hard shadows, dark panels |
| `chalk` | `#F4F2EC` | Page ground |
| `white` | `#FFFFFF` | Cards, inputs |
| `cobalt` | `#2B4BFF` | Stage and focus color: question side panel, selections, focus rings, the Question ideas panel |
| `cobalt-deep` | `#1B30C4` | Track of the countdown fuse on cobalt |
| `tangerine` | `#FF6A2B` | **Primary action** (Go live, Start game, Join, Next question) |
| `sun` | `#FFD43B` | Points, timers, bonuses, "2× points" stickers, leader highlight |
| `mint` | `#2EE6A6` | Correct, rank up, success |
| `bubblegum` | `#FF9AD5` | Wrong, rank down (soft, never harsh red) |
| `sky` | `#8FD3FF` | Supporting accent, scene skies |
| `muted` | `#3B4152` | Secondary text on chalk or white |

Rules:

- Ink is the only outline and text color on light surfaces. White text is used only on cobalt and ink.
- **Never use color alone** to carry meaning. Correct/wrong always pairs a check or X icon and text. Rank change always pairs an arrow and a number.
- Tangerine is reserved for the one primary action on a screen.

### Answer keys (color plus shape)

| Key | Color | Shape | Shape fill |
| :--- | :--- | :--- | :--- |
| 1 | `tangerine` | Triangle | ink |
| 2 | `cobalt` | Diamond | **white** (ink on cobalt fails contrast) |
| 3 | `sun` | Circle | ink |
| 4 | `mint` | Square | ink |

True/False questions use key 2 (diamond, cobalt) for **True** and key 1 (triangle, tangerine) for **False**.

### Blob body colors

Six bodies, in this order: `tangerine`, `bubblegum`, `cobalt`, `sun`, `mint`, `sky`. On a cobalt body the face is drawn in **white**; on all others in ink.

## Typography

| Role | Font | Weights | Notes |
| :--- | :--- | :--- | :--- |
| Display | Bricolage Grotesque | 800 (also 600) | Questions, headlines, buttons, names. Tight tracking: −0.5px to −2px at large sizes |
| Data | DM Mono | 500 | PIN, scores, timers, counts, labels. Labels are uppercase with 1–3px letter-spacing at 12–15px |
| UI and body | Instrument Sans | 500, 600, 700 | Everything else |

All three load from Google Fonts. Fallbacks: `sans-serif`, `monospace`.

Reference sizes:

| Use | Size |
| :--- | :--- |
| Host question text | 64px / 800 / line-height 1.02 |
| Host answer text | 46px / 800 |
| Lobby PIN | 168px mono |
| Phone question text | 30px / 800 |
| Phone answer text | 28px / 800 |
| Primary button label | 24–32px / 800 (host), 26px (phone) |
| Mono labels | 12–15px, uppercase, letter-spacing 1–3px |

## Shape language: "sticker"

- **Outline:** 2.5px for small controls, 3px for cards and buttons, 3.5–4px for hero cards and the finished-game cards. Always `ink`.
- **Radius:** 8–12px for chips and badges, 14–20px for buttons and rows, 22–30px for cards, 999px for pills.
- **Hard shadow:** `offset-x offset-y 0 ink`, no blur. 3px for small controls, 4–6px for cards and buttons, 8px for hero cards. A selected editing card uses a **cobalt** shadow instead of ink.
- **Press effect:** on `:active`, buttons translate by (3px, 3px) and drop their shadow to 0, so they appear to press into the page.
- **Dashed outline:** used for "add" affordances (add question) and empty states (unanswered dots, empty streak pips).

## Layout

- **Host screens:** 1360×820 reference, designed for a projector. Page padding is 44–48px. Question and reveal screens split left (500px, cobalt) and right (flex, chalk) with a 3px ink divider.
- **Phone screens:** 390×844 reference. Side padding 16–24px. Full-width rows rather than a 2×2 grid so long answers and thumbs both work.
- **Touch targets:** at least 44px high. Answer rows on the phone flex to fill the remaining height (about 130px each at 844px).

## Motion

All motion should be disabled or reduced under `prefers-reduced-motion`.

| Where | Motion |
| :--- | :--- |
| Lobby players | Bob up and down 7px, 2.8s loop, staggered; new player drops in with a bounce (0.7s) |
| Question timer | "Fuse" bar shrinks linearly over the question time |
| Reveal bars | Fill from the left in 0.9s with an ease-out overshoot |
| Leaderboard blobs | Appear with a 0.5s rise and fade, staggered 0.12s per rank; leader hops |
| Winner cards | Rise from below in 0.8s (staggered); winner blob hops; confetti falls |
| Phone correct | Blob jumps with squash and stretch (1.1s loop); confetti; receipt pops in |
| Phone wrong | Blob wobbles side to side (1.6s loop); no confetti, no shake |
| Buttons | 0.08s press translate |

Keep feedback to the phone under 200ms from the server event, per the PRD latency target.

## Accessibility

- Contrast: ink on every accent fill is 5:1 or better. White on cobalt is about 5.9:1. Do not put white text on tangerine, sun, mint or bubblegum.
- Shapes accompany every answer color (PRD requirement).
- Real elements: buttons are `<button>`, answer rows on the phone are `<button>` with an accessible name, inputs have `<label>`s. The PIN screen's digit boxes are display only; a single real input drives them.
- Focus ring: 3px `cobalt` outline with 3px offset (on cobalt backgrounds use `sun`).
- Toggle buttons (correct mark, theme chips, time and points segments) expose `aria-pressed`.
- Live updates (player joined, locked-in count, results) should be announced through an `aria-live="polite"` region on the phone.
