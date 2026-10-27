# Curated question ideas maintenance

Migration 006 creates `question_ideas` and seeds 30 ideas: six each for Science, Tech, Geography, Work safety and General. All is a filter, not a stored category. The library is curated; no AI generation or admin UI is included.

Apply the pending migration to the intended Neon staging database before deploying this update:

```bash
node --env-file=.env.neon --import=tsx scripts/migrate.ts
```

The command reads credentials privately from the ignored root file. It skips already-recorded migrations. Do not run it against an unintended branch. Local embedded development storage migrates automatically; no Neon migration was performed as part of the implementation.

Verify with the Neon SQL editor:

```sql
SELECT name FROM schema_migrations ORDER BY name;
SELECT category, count(*) FROM question_ideas WHERE active GROUP BY category ORDER BY category;
```

Expect migrations through `008_sports_question_ideas.sql`: six rows in each original category and two Sports rows, 32 active ideas in total.

Each row has a stable text `id`, a category, unique positive `sort_order`, JSONB `content` and an `active` flag. Content has `kind`, `prompt`, `timeSeconds`, `points`, `options`, `correctIndex`. Stable IDs are used by copied draft questions to prevent duplicates; do not recycle an ID for an unrelated idea. Existing copied questions remain independent when library content changes.

Manage edits with reviewed follow-up SQL migrations so local, staging and future production stay aligned. Do not edit migration 006 after applying it. You can inspect records in Neon's SQL editor; prefer migrations for persistent updates. For example, to retire an idea without deleting its ID:

```sql
UPDATE question_ideas SET active = false WHERE id = 'science-mercury';
```

A future content revision can update `content` or add a new row with a distinct ID and sort order. Keep one correct answer, allowed values (10/20/30/60/90/120 seconds; 0/1000/2000 points), prompt ≤250 characters, answers ≤150 characters and 2–4 nonempty options. True/False uses exactly `["True","False"]`. API validation refuses invalid active content; test content changes before deployment.

Run `npm test`: the database seed test loads the actual migrated records, validates every copy against the existing draft schema, checks independent IDs/options, category counts, pagination, inactive records and malformed stored content. Extend content tests if the initial library changes through a later migration.

The Work safety category contains general account-security and data-handling advice. Password, phishing and software-update examples align with [CISA's small-business cybersecurity guidance](https://www.cisa.gov/small-and-medium-sized-business-resources). They are not legal or workplace-policy guidance. The remaining seeds use basic, uncontested science, geography, computing and arithmetic facts.

## Validation

21 unit/integration tests passed. Ten Chromium browser scenarios passed (nine in the full run and the corrected loading/retry/empty/pagination scenario in a focused rerun). Builder checks cover 320px, 390px and desktop overflow, accessible controls, adding at the end, prompt focus, saved provenance, delete/re-add and the question limit. Typecheck, formatting, whitespace checks and production build passed. This repository has no configured lint command; formatting/type checks are reported separately, not as lint. Hosted Neon/Ably capacity validation remains outside this builder change.


## Sports category

Migration 008 expands the category constraint and appends only the two reviewed Sports ideas: cricket hat-trick and tennis love. Each has one correct answer, a reveal fact, 20 seconds and 1,000 base points. The earlier ten mixed-category proposals are not seeded. API and builder categories share a single source of truth. The default 30-item page is unchanged; Sports can be accessed directly through its filter or on the next All page.

Cricket references: [ICC on the hat-trick](https://www.icc-cricket.com/news/tracing-the-origins-of-the-hat-trick), [ICC example across two overs](https://www.icc-cricket.com/tournaments/t20cricketworldcup/news/cummins-creates-history-with-second-consecutive-t20-world-cup-hat-trick). Tennis reference: [USTA scoring rules](https://www.usta.com/en/home/improve/tips-and-instruction/national/tennis-scoring-rules.html).
