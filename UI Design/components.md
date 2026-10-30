# Components

Reusable parts that appear on several screens. Pixel values are from the design source in `source/`.

## Blob avatar

Each player picks **one of six bodies** and **one of three moods**. The body sets color and silhouette; the mood sets the mouth.

Render with a single positioned `<div>` and three absolutely positioned children (no image assets):

```
body   : size × size, box-sizing: border-box,
         border: borderWidth solid ink,
         border-radius: <body radius>, background: <body color>
eyeL   : left  = size × 0.24, top = size × 0.34, size = size × 0.13, round, face color
eyeR   : right = size × 0.24, top = size × 0.34, size = size × 0.13, round, face color
mouth  : left 50%, translateX(-50%), top = size × 0.56
```

- `borderWidth = max(2, round(size / 22))`
- Mouth by mood:
  - `smile`: width size×0.30, height size×0.15, border `borderWidth` solid face color, **no top border**, radius `0 0 999px 999px`.
  - `grin`: same box, **filled** with the face color, radius `0 0 999px 999px`.
  - `o`: a filled circle of size×0.15.
- **Sad** (wrong-answer screen only): no mouth box; draw an upside-down arc (`border-top` only, radius `999px 999px 0 0`) lower on the face.
- Face color is **ink**, except **white** on the cobalt body.

Body table (`tokens/tokens.json` → `blobBodies`):

| id | Color | Border radius |
| :--- | :--- | :--- |
| 0 | tangerine | `50%` |
| 1 | bubblegum | `38% 62% 63% 37% / 41% 44% 56% 59%` |
| 2 | cobalt | `30%` |
| 3 | sun | `50% 50% 18% 50%` |
| 4 | mint | `62% 38% 46% 54% / 55% 60% 40% 45%` |
| 5 | sky | `50% 50% 50% 14%` |

Sizes in use: 150 (join, waiting), 130 (correct), 140 (wrong), 190 (champion card), 140 or 130 (runner-up and third cards), 64 (lobby), 58 and 46 (lists and scenes), 40 and below (accessories in scenes).

Accessory variants (kart, bike, rocket, boat, hiker backpack) are specific to leaderboard themes. See [`leaderboard-themes.md`](leaderboard-themes.md).

The crown on the leader (sun with ink outline) sits above the body at roughly `top: -0.38×size`, tilted −8°.

## Answer key

A square badge holding the card suit (heart, diamond, spade or club). Always paired with a text label.

| Context | Badge size | Radius | Shape size |
| :--- | :--- | :--- | :--- |
| Host question and reveal | 78–86px | 18–20px | 40–46px |
| Phone answer row | 58px | 14px | 30px |
| Builder tile | 38px | 10px | 20px |
| Builder preview and settings | 30px | 8px | 16px |

3px ink outline (2px at the smallest sizes). Colors and shape fills are in [`design-system.md`](design-system.md#answer-keys-color-plus-shape).

## Answer card (host)

White, 3px ink border, 26px radius, 6px hard shadow. Inside: key badge, then the answer in Bricolage 800 at 46px. In the **reveal**, add a vote bar behind the content (absolute, left-aligned, width = share of votes) with a light tint of the key color; the **correct** card uses a mint fill, 4px border and an 8px shadow, plus a `RIGHT` tag.

## Answer row (phone)

Full-width button, 3px ink border, 22px radius, 5px shadow, 58px key badge, 28px label. Flexes to fill the available height. States:

| State | Style |
| :--- | :--- |
| Default | White, 5px shadow |
| Pressed | Moves (3px, 3px), shadow 0 |
| Chosen | Cobalt background, white text, mint check circle, 5px shadow |
| Not chosen (after locking) | 45% opacity, shadow removed |

## Buttons

- **Primary:** tangerine fill, ink text and outline, hard shadow (4–6px), Bricolage 800. One per screen.
- **Secondary:** white fill, ink text and outline, hard shadow (3–4px), Instrument Sans 700.
- **Dashed (add):** transparent, 2.5px dashed ink outline.
- **Segmented control:** a bordered group (2.5px, 12px radius). The selected segment is cobalt with white text; the others are white with ink text; 2px ink dividers.
- **Toggle (Mark / Correct):** pill with 2.5px outline; correct is mint and reads "Correct", otherwise white and reads "Mark".

## Chips and stickers

- **Info chip:** white, 2–2.5px ink outline, 9–12px radius, DM Mono.
- **Points sticker** ("2× POINTS"): sun fill, ink outline, small hard shadow; wobbles on the host question screen.
- **Rank chip:** mono, 2px outline, 7–8px radius; fill is mint (up), bubblegum (down), or white (same); includes a small triangle arrow and the number.
- **Name pill:** white, 2–2.5px outline, fully rounded; in themed scenes, prefixed by a rank circle.

## Fuse (timer)

A pill track with a 3px (host) or 2.5px (phone) ink outline and a fill that shrinks linearly over the question's time limit. Host: sun fill on a cobalt-deep track, with a large mono countdown number above it. Phone: tangerine fill on a white track. The server time is the source of truth; the client only animates.

## Lobby ticket

A white card (3px outline, 30px radius, 8px shadow), 250px tall, split by a perforated dashed divider with half-circle notches (32px circles in the page color, clipped to a half). Left stub (300px): tangerine, QR code on a white tile, "SCAN WITH CAMERA". Right: PIN, counter sticker, **Copy link**.

## Score receipt (phone, correct)

White card, 3px outline, 24px radius, 6px shadow. Rows in mono: base points, speed (seconds and multiplier), a 3px **dashed** rule, the big **+points** in Bricolage 800 (56px), then the running total. The speed multiplier is `0.5 + 0.5 × timeRemaining / totalTime` shown as a percent, matching PRD FR-5.

## Streak pips

Five circles (30px on the correct screen, 20px on the wrong one). Filled pips are sun with a flame; empty pips are dashed outlines. A streak is purely cosmetic: it does not change scoring.

## Winner card

3.5px outline, 30px radius, 8px shadow. Top row: place number in mono (46px) and a role tag. Center: blob. Then nickname (Bricolage 800), score in mono, and a 3-up stat grid (white cells, 2.5px outline) for accuracy, average time and best streak. Fills: 1st sun, 2nd sky, 3rd bubblegum.

## Confetti

Small squares and circles with a 2px ink outline in the six accent colors, falling at 4–9s durations with negative delays so the screen is full from the first frame. Used on the winner screen and the correct screen only.
