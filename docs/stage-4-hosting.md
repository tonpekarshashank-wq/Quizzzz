# Stage 4: authoring and host recovery

The library now lists up to 20 open games owned by the signed-in host, with a direct Resume game link. This works even after the source quiz is archived. Terminal rooms leave the list; a stale room is reconciled when opened. This is a recovery list, not the session report/history planned for Stage 5.

Each browser document gets its own fenced hosting controller. Opening or duplicating another tab cannot silently share authority. Reloading a controlled room can require explicit Restore control, which creates a new generation and disables the earlier controller. The screen remains readable while another tab controls it. Heartbeats run only while the host page is visible.

Host commands retain their exact request ID and payload in session storage until confirmed or definitively rejected. If an acknowledgement is lost, Retry action checks the original command receipt—even across a reload and after terminal closure. Other commands stay disabled while that outcome is uncertain. Temporary service failures keep the pending command; stale control/state errors refresh the screen before another action.

Authoring already supports metadata, two-to-four choices, fixed true/false choices, single correct selection, delete/reorder, mobile preview, revision-safe autosave, conflict backup and failed-save recovery. Hosting supports confirmation before lobby removal/cancellation or early ending. An active game ended early closes its current question and preserves accepted answers and scores as partial results.

## Verification

Browser checks cover a 320px host lobby, resume from the library, cancelling removal, removing a guest/revoking access, a second tab taking over, the earlier tab losing controls, reload/restore and cancellation whose acknowledgement is lost and retried after reload. The playable-flow check covers active questions, reveal, leaderboard and final results; existing checks cover mobile authoring and autosave failures.

Database checks cover owner isolation of the recovery list and early interruption retaining scores and replay acknowledgements. Provider/device checks are still pending: emulated Chromium is not a physical mobile device, and Neon/Ably/Vercel durable scheduling have not been configured or exercised. Stage 5 remains themes, awards, richer cards/PNG export, ratings and basic reports/CSV.
