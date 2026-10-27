# Vercel setup for Quizzzz

This walkthrough creates a hosted **staging** site from GitHub. It does not certify production readiness or 500-player performance. No project creation, Git push or deployment has been performed by writing this guide.

For simplicity, use one Vercel project named `quizzzz-staging` and its stable Production domain for testing. **Production is Vercel's deployment label; the application still uses `APP_ENV=staging`, your staging Neon database and your staging Ably app.** A separate production database/app can be configured later.

## 1. Prepare the GitHub repository

The repository remote configured locally is:

```text
https://github.com/tonpekarshashank-wq/Quizzzz
```

Vercel builds files committed and pushed to GitHub, not unsaved or uncommitted files on your Mac. At the time this guide was prepared, the application implementation had uncommitted files. Before importing:

1. Review the changes in your IDE's Source Control view.
2. Ensure application files are included: `src/`, `db/migrations/`, `scripts/`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example` and `vercel.json`.
3. Confirm `.env.local`, `.env.neon`, `.data/` and `node_modules/` are excluded. Only `.env.example`, containing placeholders, belongs in Git.
4. Commit the reviewed application changes and push to `main` through your IDE or Git workflow.
5. Open the repository on GitHub and verify `package.json`, `src/` and `vercel.json` exist on `main`.

You can check that the credential files are ignored without displaying their contents:

```bash
git check-ignore .env.local .env.neon
```

Expected output includes both paths if those files exist. Do not upload environment files to GitHub or paste their contents into chat.

## 2. Confirm Neon and Ably prerequisites

Complete [Neon setup](neon-setup.md) and [Ably setup](ably-setup.md). Have these available privately:

- Neon **pooled** connection URL for the staging database.
- Confirmation that migrations 001–008 were applied to that same database.
- Complete Ably staging API key, with Publish/Subscribe permissions restricted to `quizzzz:staging:*`.

Vercel does not automatically copy your local `.env.local` or create the database schema. No Neon Marketplace integration is necessary for this manual connection method.

## 3. Create the Vercel project

1. Sign in at [Vercel](https://vercel.com) using your existing account.
2. Select your personal Hobby account/workspace.
3. Choose **Add New → Project**.
4. Connect GitHub if prompted. Authorize access to the `Quizzzz` repository; repository-specific access is sufficient.
5. In **Import Git Repository**, locate `tonpekarshashank-wq/Quizzzz` and select **Import**.
6. Set the project name to `quizzzz-staging`, or another available name you prefer.
7. Review the build settings below before deploying.

If the repository is missing, use the GitHub integration's permission settings to grant access and refresh the import list. See [Vercel project management](https://vercel.com/docs/projects/managing-projects).

## 4. Build settings

| Setting | Selection |
| --- | --- |
| Framework Preset | **Next.js** |
| Root Directory | Repository root (`./`), where `package.json` lives; not `src` or `docs`. |
| Build Command | `npm run build`, or the equivalent detected Next.js default. |
| Install Command | Keep automatic npm detection using `package-lock.json`. |
| Output Directory | Keep the Next.js preset default; no custom override. |
| Production Branch | `main`. |

Use the current supported Node.js LTS default, **24.x**. The repository's `engines.node` range is `>=22.13.0`, which can select the latest available matching LTS on Vercel; setting 22.x in the dashboard alone may not pin it. Node settings are under **Settings → Build and Deployment** after import. See [Node.js versions and overrides](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

The committed `vercel.json` contains `{"regions":["sin1"]}`, selecting Singapore alongside the planned Neon region. Retain it. Do not configure a persistent `npm run dev` server or use static export: this app needs server functions and PostgreSQL.

## 5. Generate two secrets locally

Generate two independent random values in your terminal, running this command twice:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Save the first securely as `GAME_TOKEN_SECRET` and the second as `CRON_SECRET`. Each output is 64 characters. Do not paste either into chat or Git. Keep `GAME_TOKEN_SECRET` stable across deployments so existing game reconnect tokens stay valid.

## 6. Add environment variables

Expand **Environment Variables** on the import screen. Add each variable individually. Enter raw values without surrounding quotes; quotes in `.env.local` are file syntax, not part of these dashboard values.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Complete pooled Neon staging URL, retaining all SSL parameters. |
| `ABLY_API_KEY` | Complete staging key, including `KEY_NAME:SECRET`. |
| `APP_ENV` | `staging` |
| `WORKFLOW_ENABLED` | `true` |
| `GAME_TOKEN_SECRET` | First generated secret. |
| `CRON_SECRET` | Second generated secret. |
| `ROOM_CAPACITY` | `500` |
| `JOIN_IP_PER_MINUTE` | `1200` |
| `JOIN_BROWSER_PER_MINUTE` | `20` |
| `JOIN_INVALID_PIN_PER_MINUTE` | `30` |
| `APP_ORIGIN` | Initially your anticipated stable URL, e.g. `https://quizzzz-staging.vercel.app`; verify and correct it in Step 8. |

If environment selection is shown, choose **Production** for this staging project's `main` deployment. Review the scope after import. Do not apply these credentials to arbitrary Preview branches by default.

For deployed password recovery also add `RESEND_API_KEY` and `EMAIL_FROM`, using a sender/domain verified with your email provider. You can first verify hosting without email, but password recovery remains incomplete until these are configured and tested.

Do not add `DATA_DIR`, `MIGRATION_DATABASE_URL`, `NODE_ENV`, a manually defined `VERCEL`, or `NEXT_PUBLIC_` copies of server secrets. Redis variables are not required by the current build.

Settings can subsequently be edited under **Settings → Environment Variables**. Changes apply to new deployments, so redeploy after changing them. See [environment variables](https://vercel.com/docs/environment-variables).

## 7. Deploy

1. Click **Deploy**.
2. Wait for dependency installation, Workflow compilation and the Next.js build.
3. Confirm deployment status is **Ready**. If it fails, inspect **Build Logs** before retrying.
4. Open the project dashboard and its **Domains** settings to find the actual stable Production domain assigned to this project.

Do not assume the requested project name guarantees an identical domain: names can be unavailable. The generated per-deployment URL is different from the stable project domain. Use the stable domain for host/player testing and `APP_ORIGIN`.

## 8. Set the exact origin and redeploy

1. Copy the actual stable domain, for example `quizzzz-staging-example.vercel.app`.
2. Open **Settings → Environment Variables**.
3. Edit `APP_ORIGIN` in **Production** to `https://quizzzz-staging-example.vercel.app`.
4. Include `https://`; omit a trailing slash and any path. Do not use localhost or the example URL unless it is your assigned domain.
5. Save.
6. Open **Deployments**, choose the latest `main` deployment and use its menu → **Redeploy**. Confirm it targets Production.
7. Wait for **Ready** again and visit the stable domain.

The application intentionally checks exact request origins. Opening an alternate deployment URL can show the pages but reject signup or other writes. If you later switch to a custom domain, update `APP_ORIGIN` and redeploy before testing through it.

## 9. Verify access from a player device

Open the stable domain in a private browser window and on your phone. If Vercel asks players to log into Vercel before showing Quizzzz, inspect **Settings → Deployment Protection**.

For ordinary join-by-PIN testing, the chosen staging domain must be accessible to the intended testers. Vercel's Standard Protection normally protects deployments except production domains, which is one reason this walkthrough uses the stable Production domain. Keep protected preview URLs separate. Do not enable a paid password-protection feature just to follow this guide. See [Deployment Protection](https://vercel.com/docs/deployment-protection).

## 10. Verify database and app behavior

1. Visit `https://YOUR-STABLE-DOMAIN/api/health`. Expect HTTP 200 with `{"status":"ok"}`.
2. Register a new staging host, log in, create a quiz and refresh to verify persistence. Local embedded accounts are not copied into Neon.
3. Launch a game, join from your phone, submit an answer and complete the game. Verify reports and card-image saving.
4. Check the Ably token request returns `mode: "ably"`, the browser connects and the Ably dashboard records activity. Follow the detailed Ably verification guide.
5. Confirm protected `/api/internal/status` returns 401 without authentication. Configure your operator/monitoring tool with the `CRON_SECRET` bearer header to inspect job/delivery backlogs; never put the secret in a URL.
6. Test password recovery after configuring email. Vercel has no local `.data/mail` fallback.

Health proves reachability only; successful signup and game/report actions test the migrated schema and integration.

## 11. Verify durable Workflow execution

The repo already uses `withWorkflow` in `next.config.ts` and the Workflow package. Deploy that configuration; there is no separate worker server to provision.

1. Launch a short question and close both host and player browsers.
2. Open your Vercel project → **Observability → Workflows** and inspect the scheduled run. Confirm it sleeps, resumes and completes successfully at the deadline.
3. Reopen the game after the deadline and confirm the question is closed with accepted answers preserved. Reopening alone is insufficient proof: snapshot reads can recover an overdue question too, so inspect the Workflow run before reopening.
4. Repeat with a deployment during a question, then exercise host absence/interruption and retry recovery using the Stage 6 checks.

Do not replace this with a once-daily Hobby cron. Deadline jobs require durable timed execution. See [Vercel Workflows](https://vercel.com/docs/workflows) for execution and observability details.

## 12. Future code changes

Once GitHub is connected, pushed commits to `main` normally trigger new Production deployments. Other branches/PRs can produce Preview deployments. This walkthrough configures one exact origin and one staging data environment; previews need their own deliberate origin/environment setup before write actions will work. Do not point unreviewed preview code at future real production data.

Schema changes remain an explicit migration step against the intended Neon database. Vercel's build does not automatically migrate it. Environment changes also require a new deployment. See [deployment overview](https://vercel.com/docs/deployments/overview).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No framework detected / no `package.json` | Confirm implementation was pushed to GitHub and Root Directory is the repository root. |
| Build fails | Read Build Logs; confirm `package-lock.json`, code and Workflow configuration are committed. Share a redacted error, not credentials. |
| Health returns 503 | Confirm pooled `DATABASE_URL` is valid in Production and redeploy. Inspect runtime logs for connection errors. |
| Missing database table | Apply all eight migrations to the database used by the deployment. |
| Signup says origin not permitted | Use the stable domain and set exact HTTPS `APP_ORIGIN`, then redeploy. |
| Launch says live services are unavailable | Confirm `ABLY_API_KEY`, `WORKFLOW_ENABLED=true` and stable `GAME_TOKEN_SECRET` are set on the deployed environment. |
| Player gets Vercel login screen | Check the domain's Deployment Protection scope; use the intended tester-accessible stable domain. |
| Game uses polling / no realtime | Check Ably key permissions, `APP_ENV=staging`, token endpoint and WebSocket connection. |
| Reset email fails | Configure verified `RESEND_API_KEY` / `EMAIL_FROM` and test delivery. |
| Local config works but hosted does not | Local `.env` files are ignored and are not deployed. Add values to the correct Vercel environment and redeploy. |

## Completion checklist

- GitHub contains the application and no credentials.
- Deployment is Ready at the stable domain, with the correct exact origin.
- Neon has eight migrations; host/quiz data persists.
- Host and phone player can complete a small game using Ably.
- Workflow execution is proven without browser requests.
- Email recovery, monitoring and backup/restore remain tracked until tested.

Hobby is restricted to personal, non-commercial use; review eligibility before a commercial pilot. [Hobby plan](https://vercel.com/docs/plans/hobby). Ably Free's 200-connection ceiling still prevents a full 500-player realtime test. Small-game success is not a capacity pass; see [Stage 6 release gates](stage-6-hardening.md).

After completing setup, share only the stable staging URL and any redacted errors for hosted verification.
