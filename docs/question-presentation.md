# Question presentation

Adds a final-three-second badge, optional reveal fact and a 1.5-second final-question introduction on host/player screens. Uses the existing sticker colours and type, with reduced-motion styling. Also includes the previously prepared sticky desktop Question ideas sidebar fix.

## Creator and player behaviour

The builder provides **Reveal fact (optional)** on every expanded question, maximum 160 characters. The existing autosave/revision path stores it. Curated Question ideas carry independently editable facts; all 30 seeded ideas receive facts in migration 007. Creators should verify the fact after changing a prompt or correct answer. No AI generation or live fact lookup is performed.

Facts are frozen at launch. During active questions, neither role's snapshot includes the fact. At closure, `reveal.fact` is available; both reveal screens display it in a mint strip that wraps on mobile. Existing questions without facts have no empty strip.

The last-three-second badge uses the existing server-synchronised remaining time. It reads "Lock it in! 3", then 2, then 1; a player whose answer was accepted sees "Answer locked ✓". A polite announcement occurs once per question. Reserved space avoids moving answer targets. At zero the badge disappears and the server remains authoritative.

The final question has a persistent QUESTION_INTRO phase before its answering clock starts. Its banner reads FINAL QUESTION, or ONE QUESTION. MAKE IT COUNT. for a single-question quiz. The prompt/options are withheld during introduction. The animation accounts for elapsed server time on reload; reduced motion shows a static banner. A slow client can miss some or all of the intro; the server never replays it individually or delays an already active question.

## Database and recovery

Migration `007_question_presentation.sql`:

- Adds nullable `session_questions.reveal_fact varchar(160)`.
- Adds nullable `quiz_sessions.intro_ends_at timestamptz` and permits QUESTION_INTRO in the state constraint.
- Rebuilds the live PIN reservation index to include QUESTION_INTRO.
- Permits scheduled job kind `intro` and adds facts to the existing curated idea JSONB records.

Existing draft/idea tables and authentication do not change. Optional JSON fields keep old drafts compatible. The new deadline state uses existing durable Workflow, leases, outbox and reconciliation; no extra service is needed.

Introduction lasts at least 1.5 seconds. Once a due intro is reconciled, the server starts a full-duration question from the actual activation time. Thus a delayed worker extends the introduction rather than reducing answering time. Duplicate workers/command retries cannot restart the clock. Snapshots recover overdue work if delivery is late. A client also refreshes at the shared intro deadline rather than waiting for the steady-state recovery poll.

Host inactivity/END_EARLY during introduction leaves that question unstarted and unscored. New answer receipts before question start are rejected; accepted-answer retries remain idempotent. No scoring/ranking changes or per-player timer adjustments.

## Release steps

After local verification, apply migrations against the intended staging database before deploying new application code:

```bash
node --env-file=.env.neon --import=tsx scripts/migrate.ts
```

Verify migration 007 and fact counts in the Neon SQL editor:

```sql
SELECT name FROM schema_migrations ORDER BY name;
SELECT count(*) FROM question_ideas
WHERE active AND length(content->>'revealFact') BETWEEN 1 AND 160;
```

The initial library should return 30. Changing a seeded idea through a later migration should update its fact too. Do not modify already-applied migration files.

Set WORKFLOW_ENABLED=true on hosted environments. Deploy/redeploy, then run a two-question game: first question starts normally, final introduction precedes its full timer, facts appear only on reveal. Repeat reload during introduction, reduced motion and a session ended during introduction. Confirm an intro Workflow completes and creates one normal deadline job without browser traffic.

Existing pre-deployment sessions continue without facts; the new application adds the intro when their final question is advanced. Avoid rolling an older application version back while rooms are in QUESTION_INTRO, since older clients do not understand it. The migration is additive apart from expanded constraints and the PIN index; it does not rewrite saved quiz content or historical results.

Hosted performance, provider delivery and actual mobile-device checks remain required. Server-authoritative timing does not guarantee identical arrival times on every network. This work adds no sound, haptics or image-question functionality.

Fact references: [NASA Sun facts](https://science.nasa.gov/sun/facts/), [Royal Society of Chemistry: Gold](https://periodic-table.rsc.org/element/79/gold), and [CISA security basics](https://www.cisa.gov/small-and-medium-sized-business-resources). All seeded facts are plain text and rendered as text, never HTML.


## Verification record — 26 October 2026

- 23 unit/integration tests passed, including an actual process restart during QUESTION_INTRO, idempotent jobs, withheld content/facts, full-duration activation, pre-start receipt rejection and interruption before activation.
- 33 browser scenarios passed across Chromium, Firefox and WebKit, including countdown/accepted feedback, fact persistence/reveal, single/final banners, reduced motion, accessibility and small-screen overflow. Screenshots were visually reviewed.
- Typecheck, formatting, whitespace and production build checks passed on Next.js 16.4.3. This repository does not have a separate lint command.
- Updated load harness waits for QUESTION_ACTIVE after an intro; no new 500-player capacity claim is made.
- Next.js was patched from 16.4.0 to 16.4.3 after a verified critical advisory. The audit still reports 23 high-severity findings in the remaining dependency tree. No forced audit fix or breaking Workflow downgrade was applied; that remediation remains separate work.

The hosted Workflow/no-browser smoke test still needs the stable staging URL and release verification. Local checks and database migration do not establish deployed behaviour.
