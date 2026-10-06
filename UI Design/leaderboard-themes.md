# Leaderboard themes

The leaderboard is a **themed scene** beside a plain standings list. The list is identical in every theme so the numbers stay readable; the scene is the fun part. **The theme is picked at random for every question** (confirmed product decision); the host has no control over it.

Reference file: `source/Leaderboard.dc.html` (geometry below is taken from its script).

## Common rules

- **Scene canvas:** 880×560 px inside a 886×566 card (3px outline, 28px radius, 6px hard shadow).
- **Standings panel:** 354px wide, top 5 players. Each row: rank, blob (46px), name, "+points this round" (or "no points this round"), total, rank-change chip. The leader's row has a sun tint.
- **Leader sticker:** top-left of the scene, sun fill: crown icon, "{name} · {theme tag}".
- **Markers:** each top-5 player is drawn as a blob plus a theme accessory, with a **name pill** (rank circle plus name) above or below, alternating by rank to reduce overlap.
- **Progress:** a player's position along the route is `t = 0.2 + 0.6 × (score − 2600) / 1300`, clamped by design to the sample range. **In production, derive `t` from the real scores in the room** (see the next section), so the leader is always ahead and the rest are spread across the route.
- **Entrance:** markers fade and rise in with a 0.12s stagger per rank.

## Position scaling (build note)

The mock's formula is tuned to the sample scores (2,980 to 3,790). For a real game, normalize:

```
t = 0.15 + 0.7 × (score − minScoreInTop5) / max(1, maxScoreInTop5 − minScoreInTop5)
```

Clamp the result to 0.15–0.85 so nobody sits on the start or finish line before the final question. After the final question, the winner may be moved to the finish. This keeps the five blobs distinct when scores are close, so **position is relative, not proportional to score**; the standings list carries the real numbers.

## Themes

Names, header text and the leader tag come from this table.

| id | Chip label | Headline | Leader tag | Footer line |
| :--- | :--- | :--- | :--- | :--- |
| `summit` | Summit | The summit push | Leads the climb | Climb the trail. First to the flag wins the mountain. |
| `gp` | Grand Prix | Grand Prix finale | Pole position | Every point is another corner. Ten questions make a full race. |
| `tour` | Tour de Quiz | The final climb | Yellow jersey | The peloton is stretching out. Win the climb, win the stage. |
| `moon` | Moonshot | Mission to the Moon | Closest to the Moon | Rockets are in orbit. Keep your fuel up for the last burn. |
| `map` | Treasure | Hunt for the X | Nearest the treasure | Follow the route. The first ship to the X takes the chest. |

### `summit`

- **Scene:** pale sky, a sun, two ranges of tinted background peaks, clouds, a mint ground strip, and one big cobalt mountain with a white snowcap, a darker right face and pine trees. A tangerine flag stands on the peak. Labels: BASE CAMP, SUMMIT.
- **Route (polyline, scene px):** `(110,505) (760,480) (240,430) (700,375) (350,325) (650,285) (460,240) (630,200) (575,150) (640,98)`. Drawn twice: a 12px ink casing and a 5px sun dotted line (`dasharray: 1 12`, round caps).
- **Placement:** interpolate along the polyline by arc length; marker center is 22px above the point.
- **Accessory:** a small tangerine backpack behind the blob and a ground shadow ellipse. No rotation.

### `gp` (Grand Prix)

- **Scene:** mint-tint infield, a circuit drawn as an ellipse stroke (center 440,285, rx 330, ry 190; 102px ink outline, 90px `#3B4152` asphalt, dashed white center line), the words GRAND PRIX and "LAP n / N" in the infield, three start lights, a sun grandstand at the top, a bubblegum pit building at the bottom, and a **checkered finish bar** across the track at the bottom center (28×98px).
- **Placement:** clockwise from the finish line. Angle `θ = 90° + t × 360°`; position `(cx + rx·cosθ, cy + ry·sinθ)`. Rotate the kart to the tangent `atan2(ry·cosθ, −rx·sinθ)`, flipped by 180° when it would be upside down so the blob stays upright.
- **Accessory:** a kart body in the player's blob color with two ink wheel blocks; blob head at 40px.

### `tour` (Tour de Quiz, cycling)

- **Scene:** sky with sun and clouds, tinted hills, a mint ground polygon under a **road profile** that climbs from left to right to a finish arch (FINISH banner). Labels: START, CATEGORY 1 CLIMB.
- **Profile (polyline):** `(0,505) (110,470) (220,492) (340,430) (450,452) (560,372) (670,384) (770,300) (830,262) (880,262)`. The ground polygon is the profile plus `(880,560) (0,560)`. The road is drawn as an 18px ink line, an 11px asphalt line and a thin dashed white center line.
- **Placement:** along the profile, 30px above it, staggered ±10px vertically by rank so riders do not overlap. Rotate to 80% of the slope angle. Scale the rider to 0.85.
- **Accessory:** two white wheels with 4px ink rims and a simple frame; blob at 40px. The leader wears the "yellow jersey" tag in the sticker.

### `moon` (Moonshot)

- **Scene:** night (`#12131A`) with white and sun stars, Earth in the bottom-left (cobalt with mint land), the Moon in the top-right (chalk with craters), a small flag on the Moon, and a **dotted flight arc** (`M100 500 Q130 150 760 112`, sun, `dasharray: 1 14`). Labels: EARTH, THE MOON.
- **Placement:** along the quadratic Bézier `P0 (100,500)`, control `C (130,150)`, `P2 (760,112)`. Offset each rocket ±34px along the normal (alternating) so they do not overlap. Rotate each rocket to the tangent angle plus 90° (rockets are drawn pointing up).
- **Accessory:** a white capsule rocket with colored fins and a tangerine flame; blob at 30px in the porthole.

### `map` (Treasure)

- **Scene:** parchment (`#FBF1D6`), mint islands with sun palm-like trees, small wave strokes, a compass rose (top left), a **dashed tangerine route**, a big ink **X** at the end (label X MARKS IT).
- **Route:** 49 points, `x = 70 + u × 740`, `y = 420 − 220u + 58·sin(3.2πu)` for `u` in 0…1, drawn as `M x y L x y …`.
- **Placement:** along that polyline, offset ±24px along the normal (alternating), 12px up. Rotate the boat to 25% of the tangent angle.
- **Accessory:** a white hull (rounded bottom) and a mast; blob at 38px.

## Adding a theme

1. Pick a **progress metaphor** with a clear "start" and "finish" (climb, race, flight, voyage, dive).
2. Define a **route**: either a polyline, a parametric curve or an ellipse. Provide start and finish points and make sure five markers fit without constant overlap.
3. Draw the scene at **880×560** using the palette only (plus one dark or paper ground if the theme needs it).
4. Define the **accessory** (what the blob rides or wears) and the marker rotation rule. Keep the blob head visible and upright wherever possible.
5. Add the row to the table above (headline, tag, footer line) and a chip label.

### Ideas ready to design

| Theme | Route | Leader title |
| :--- | :--- | :--- |
| Deep dive | Descend a vertical shaft toward a sunken chest | Deepest diver |
| Balloon festival | Rise through clouds toward a banner | Highest balloon |
| Ski slalom | Weave down gates on a snowy slope | Fastest skier |
| Marathon | A city route with crowds and a finish arch | Front runner |
| Dragon boats | River race, paddle strokes show pace | First across |
| Rollercoaster | Carts climb the first big hill; leader crests it | Top of the hill |
| Seasonal | Halloween pumpkin trail, Christmas sleigh, Diwali lantern climb | (per season) |

## Rules for production

- Theme selection is **random per question, made by the server**, with no immediate repeats, and sent as a `theme` id on the leaderboard event. There is no host picker. The theme chips in the design file are a **review-only preview** and must not be built.
- The scene is **decorative**. Always keep the standings list as the accessible source of truth, and give the scene an `aria-label` summarising the leader.
- Respect `prefers-reduced-motion`: show scenes static.
