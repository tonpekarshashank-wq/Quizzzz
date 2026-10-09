# Stage 1 UX specification

Normative supplements to the original artboards. Real values follow PRD section 9 and [technical contracts](../docs/technical-contracts.md). This is layout/interaction design; pixel-rendered responsive verification occurs during implementation.

## Responsive layout rules

Desktop ≥1024px: original stage/builder arrangements; builder scrolls naturally, optional preview on right. Tablet 768–1023: narrower cards, preview collapses, controls wrap. Mobile 320–767: single column, no fixed-stage transform scaling; body/content scroll and sticky primary action respects safe-area inset. No horizontal scroll for long names, answers or settings. Support text zoom without clipping; timer never conceals options. Use original fonts/tokens/shapes, semantic controls, ≥44px targets, visible keyboard focus, reduced motion and textual status announcements.

Host question/reveal stack question/timer above answers; mobile standings replace the large decorative scene with a compact illustration. Desktop illustration scales independently inside its container. Long max-length prompts wrap; answer controls remain reachable on short screens. PIN permits paste and leading zeros using one labeled numeric-input-mode field; digit boxes are decorative.

## New screens and interactions

| Screen | Layout and behavior |
| :--- | :--- |
| Login/register | Centered sticker card; mobile full-width; labeled email/password/name; show/hide password; validation inline; loading prevents repeated writes; generic login failure; links to reset and alternate auth flow |
| Password recovery | Email request with generic sent state; token reset page with password/confirmation; expired/used token offers new request |
| My quizzes | Heading/Create button, quiz cards showing title/count/last updated; Edit/Go live/Archive actions; mobile list; empty state with Create; archive confirmation preserves history; session-history link |
| Builder metadata | Title at top; description/language/cover in expandable Details; live preview toggled on mobile; incomplete drafts allowed; errors link/focus offending card; delete question confirmation; add/remove options for 2–4 MC; fixed true/false labels |
| Basic analytics | Terminal status badge, four summary cards (players/completion/accuracy/toughest), question counts, paginated standings, CSV button; stack on phone; partial label on every interrupted summary; no closed questions shows no-data rather than zeros |

Draft sharing prototype button is removed for MVP. Save statuses: Saving, Saved, Save failed/Retry, Conflict/Reload latest or preserve local copy before reload. Go live waits for latest confirmed draft revision; failures retain edits. Never silently discard unsaved content.

## Existing screen adaptations

| Screen | Desktop | Mobile host/player adaptation |
| :--- | :--- | :--- |
| Host lobby | Ticket QR/PIN + roster grid | Stack PIN, copy/share, QR, player count/list; Start sticky; kick through explicit menu |
| Host question | Split question/timer and options | Stacked prompt/timer/options; acknowledged count visible; no advance before expiry |
| Host reveal | Distribution and fastest correct | Stacked bars; explicit zero-correct/no-fastest state; leaderboard action sticky |
| Host leaderboard | Theme + top-five standings | Compact theme, readable standings; next/finish button; no theme picker |
| Host podium | Up to three winner cards | Winner first, then 2nd/3rd in vertical stack; reports/CSV/play-again; fewer players omit empty winner cards |
| Player join/blob | Existing PIN/name/avatar screens | QR skips PIN; joining spinner, nickname rejection inline; assigned suffix displayed in lobby |
| Player answer | Existing rows and fuse | Submitting vs acknowledged Locked in; uncertain state Checking your answer; retries preserve selection; expired unanswered state |
| Player result | Existing correct/wrong | Wrong and No answer are distinct; server score receipt; missing time shows dash; no first-question rank movement |
| Player final | Existing card | Distinct ranks, top percentile with ceil rule, awards array; save PNG; optional one rating; interrupted result uses provisional label and no champion/confetti |

## Required states

- Empty lobby: “Share your code to bring players in”; Start disabled until a player joins.
- Bad PIN: preserve input; “We couldn't find that game.” Ended/started/full room have distinct messages and Join another game action. Rate limited: countdown based on Retry-After, no automatic retry storm.
- Kick: select explicit Remove action, confirm nickname, then server result; kicked phone shows Removed from game. No click-anywhere accidental kick and no undo that revives a revoked token.
- Realtime loss: slim Reconnecting banner, maintain screen, disable unsafe host commands; show HTTP submission/recovery status accurately. A local timer can reach zero while waiting for official reveal.
- Host absence: “Waiting for the host to return”; active timer continues; returning host sees Restore control/Take over if another controller exists. Read-only second device labels who controls, without exposing private account details.
- Interrupted: explain partial results, allow host report/CSV and player partial score; no podium awards. Cancelled lobby returns players to join flow with message.
- Save card: generating/saved/error; browser download first, save/share fallback, clear Retry; rating submission separate from image export. Image contains card only, no buttons/tokens/PIN.
- Reduced motion: static blobs/scenes, no confetti/bobbing; retain rank/correctness meaning in text. Answer shape/color always accompany a readable label.

## UI acceptance checklist

At 320px/390px/tablet/desktop, exercise maximum title/prompt/answer/nickname, 2/3/4 options and true/false, short-height landscape, large text, keyboard navigation and screen-reader status. Verify real QR scanning, PNG export on iOS/Android/desktop, all-zero and no-point games, one/two-player final screens, equal-score visual-marker offsets, and pending/rejected answers. Original 1.8s/1820 sample corresponds to a 10s double-point question, not a 30s question. Rank 2/24 renders top 9%, never the mock top 8%. Accessibility contrast assertions are verified in implementation, not assumed from token names.
