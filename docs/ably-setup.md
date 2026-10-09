# Ably setup for Quizzzz

Ably delivers realtime game-state notifications to hosts and players. PostgreSQL remains the source of truth for answers, scores and deadlines. The application already includes the Ably SDK, server-side token issuance and client subscriptions; no SDK installation or custom auth endpoint is needed.

Here, **staging** is the application's test environment name. Use the same spelling in the key's channel restriction and `APP_ENV`.

## 1. Create an account and application

1. Sign up or sign in at [Ably dashboard](https://ably.com/dashboard).
2. Open your applications list and choose the action to create a new app. Dashboard labels may appear as **Create app** or **Create new app**.
3. Name it `quizzzz-staging` and create it. Use Ably's Pub/Sub / Realtime service for this application.
4. Open the newly created app. Keep the default settings for the initial smoke test. No Chat, Spaces, push notifications, webhook or queue integration is required.
5. Start on Free for a small host/player smoke test. Do not purchase a plan just to complete these setup steps.

Ably apps group their keys, connections, channels and usage. See [account and app management](https://ably.com/docs/platform/account).

## 2. Create a restricted server API key

Within `quizzzz-staging`, open **API Keys** and create a new key:

| Setting | Value |
| --- | --- |
| Key name | `quizzzz-staging-server` |
| Permissions / capabilities | **Publish** and **Subscribe** |
| Resource/channel restriction | `quizzzz:staging:*` |

If the dashboard offers a choice between all channels and selected resources, choose selected resources and enter the pattern above. If it shows a JSON capability editor, the equivalent is:

```json
{
  "quizzzz:staging:*": ["publish", "subscribe"]
}
```

Save the key. Presence, history, stats, push administration and channel metadata permissions are not required by the current application. Do not substitute a publish-only key: browsers need tokens that permit subscribing.

The trailing wildcard covers all room IDs and channel versions under this prefix. The running application generates names such as:

```text
quizzzz:staging:ROOM_UUID:v1
```

You do not need to create those channels manually. Room channel versions can change after a player is kicked. Resource restrictions and token permissions follow [Ably capabilities](https://ably.com/docs/auth/capabilities).

## 3. Copy the complete key

Reveal/copy the newly created **API key**, not just its name, app ID or an account access token. The full value has this general form:

```text
KEY_NAME:SECRET
```

Keep it in server environment settings. Never name the variable `NEXT_PUBLIC_ABLY_API_KEY`: variables with `NEXT_PUBLIC_` are intended for browser exposure. The app uses `ABLY_API_KEY` only on the server and gives each browser a short-lived, subscribe-only token scoped to its room. Current token lifetime is 60 seconds, with renewal handled by the client's auth callback. See [Ably authentication](https://ably.com/docs/auth).

## 4. Configure a local smoke test

In your IDE, create or edit **`.env.local` at the repository root**, beside `package.json`. Add these entries without removing any existing configuration:

```dotenv
ABLY_API_KEY="PASTE_THE_COMPLETE_API_KEY_HERE"
APP_ENV="staging"
APP_ORIGIN="http://127.0.0.1:3218"
```

Replace the key placeholder. Both `.env.local` and `.env.neon` belong at the repository root, not inside `docs/`. `.env.local` is automatically loaded by Next.js; the dedicated `.env.neon` file from the Neon walkthrough is not.

For this local Ably check you can keep the existing embedded database. To test Neon and Ably together, also add the **pooled** Neon `DATABASE_URL` to `.env.local` after applying the migrations to Neon. The app does not need the direct migration URL in its runtime settings. Neon starts with separate data from local embedded storage, so register a staging host if necessary.

Verify the local file is ignored:

```bash
cd /Users/shashankt/Quizzzz/Quizzzz
git check-ignore .env.local
```

Expected output: `.env.local`. Do not print the file's contents or paste the key into chat.

Stop the existing local dev server if it occupies port 3218, then start/restart it:

```bash
npm run dev -- --port 3218
```

Open `http://127.0.0.1:3218`. If you choose a different port, update `APP_ORIGIN` to match it. A restart is required after editing server environment variables.

## 5. Verify realtime with a host and player

1. Log in as a host, create a valid quiz and launch a lobby.
2. Open an incognito/private browser window or a second device and join with the PIN. For a physical device, use the hosted URL rather than this loopback-only local address.
3. On the host or player tab, open browser developer tools → **Network**. Filter for `realtime-token`.
4. The request to `/api/v1/sessions/ROOM_UUID/realtime-token` should return HTTP 200 with `mode: "ably"` and a channel beginning `quizzzz:staging:`. A `mode: "polling"` response means the running server did not load `ABLY_API_KEY`.
5. Look for a connected Ably WebSocket in the network panel. A successful token request by itself does not prove the connection attached successfully.
6. In Ably's app dashboard, inspect current connections and message activity. Expect host/player activity during the active lobby/game; unused tabs, temporary reconnects and monitoring tools can affect the exact count.
7. Start a question, submit an answer and advance through results. Both screens should update. The host receives answer-count notifications; players intentionally ignore answer-count-only notifications.
8. Keep the game open for more than a minute. Verify token renewal succeeds and subsequent question transitions still arrive.
9. Temporarily disconnect a player, restore connectivity and confirm the room recovers and accepted answers remain. Finish the game; terminal screens deliberately close realtime subscriptions.

Quizzzz also has HTTP polling recovery, so screens updating alone is insufficient evidence that Ably works. Verify the `ably` mode, a live WebSocket and dashboard activity together. Do not share token response bodies, WebSocket authentication URLs or unredacted network exports: they may contain temporary credentials.

## 6. Configure Vercel

In your Vercel project, open **Settings → Environment Variables** and add:

| Variable | Value |
| --- | --- |
| `ABLY_API_KEY` | Full restricted key from `quizzzz-staging`. |
| `APP_ENV` | `staging`. |

Select the Vercel environment that serves your staging deployment. If staging is deployed from the default branch into Vercel's Production environment, select Production there; the platform label does not force `APP_ENV=production`.

Complete the remaining variables in [Stage 6 hosted setup](stage-6-setup.md#3-vercel), including `DATABASE_URL`, `APP_ORIGIN`, stable `GAME_TOKEN_SECRET` and `WORKFLOW_ENABLED=true`. Redeploy after saving changes, then repeat the smoke test through the actual HTTPS URL.

Ably does not run Quizzzz's durable deadline jobs. Vercel Workflow handles those, so Ably configuration alone does not complete hosted game recovery. No callback URL, webhook or browser API key needs to be configured for the current Ably implementation.

## 7. Capacity before a 500-player test

Ably Free currently includes:

| Limit | Allowance |
| --- | --- |
| Concurrent connections | 200 |
| Concurrent channels | 200 |
| Message rate | 500 per second |
| Monthly messages | 6 million |

These are provider limits, independent of Quizzzz's `ROOM_CAPACITY=500`. A full room needs at least 501 connections for 500 players plus one host. Two simultaneous rooms need at least 1,002, with additional allowance for reconnect overlap and operator tabs. Confirm an appropriate connection allowance with Ably before attempting those tests. Also check message fanout, per-channel limits and monthly usage; a larger connection allowance alone does not certify game performance. Source: [Ably Free package](https://ably.com/docs/platform/pricing/free).

Use Free for the first few-player test. Review billing and actual limits before upgrading; no upgrade is part of this walkthrough.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Token endpoint says `mode: polling` | `ABLY_API_KEY` is absent in the running process. Check root `.env.local` or the correct Vercel environment, then restart/redeploy. |
| Token request succeeds but channel attachment fails | Confirm Subscribe permission and the exact `quizzzz:staging:*` restriction. Check `APP_ENV` matches `staging`. |
| Permission/authentication error | Confirm the complete `KEY_NAME:SECRET` value belongs to the intended app and has not been revoked. Inspect error codes without printing the key. |
| Works locally but not on Vercel | Verify environment scope, redeploy and confirm HTTPS `APP_ORIGIN`. Check WebSocket failures in the browser and delivery errors in server logs. |
| Existing connections still fail after editing permissions | Reload the host/player tabs so they request new tokens and reconnect. |
| Works with a few tabs but fails at larger numbers | Check current connection, channel and message-rate quotas in Ably. Close unused test tabs and do not exceed Free limits. |
| Game updates slowly | Confirm WebSocket connectivity; HTTP polling may be masking an Ably failure. Inspect protected delivery status using the setup guide. |
| Question does not close without open browsers | Check Workflow configuration and scheduled jobs; this is a durable scheduler check. |

For production, use a separate Ably app/key and `APP_ENV=production`, with resource restriction `quizzzz:production:*`. Keep production and synthetic load testing separate. Preserve secrets in settings and rotate any key accidentally exposed.
