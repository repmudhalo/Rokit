# chataggr

A multi-user service that merges **Twitch** and **Kick** live chat into one feed
and renders it as a transparent **OBS Browser Source overlay**. Each user signs
up, connects their own channels in a dashboard, and gets a private overlay URL.
(X/Twitter is stubbed — see [Platform support](#platform-support).)

```
                      ┌───────────────────────────── per user ─────────────────────────────┐
sign up / log in  →   dashboard: add channels, style overlay, copy overlay URL
                                          │
Twitch IRC ─┐                             ▼
Kick Pusher ─┤→  per-user hub (on-demand)  →  /ws?token=…  →  /overlay?token=…  (OBS source)
```

## Architecture

- **server/** — Node/Express + `ws`. PostgreSQL for users/sources/settings.
  Auth via hashed passwords + signed-cookie sessions, plus optional Twitch
  OAuth. A **per-user hub manager** opens a user's platform connections only
  while their overlay/preview is connected, and tears them down after an idle
  timeout — so idle accounts don't hold sockets open.
- **web/** — React + Vite. Dashboard, auth pages, and the token-driven overlay.
- Every chat message is normalized to one shape, so adding a platform is one
  source file — no frontend changes.

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| **Twitch** | ✅ Works | Anonymous IRC-over-WebSocket, no API key. |
| **Kick** | ⚠️ Unofficial | Public Pusher socket; channel→chatroom lookup is behind Cloudflare and can 403 from servers (use the per-source chatroom-id override). **At service scale, expect rate-limits/blocks from one server IP, and review Kick's ToS before charging for it.** |
| **X / Twitter** | 🔌 Disabled | No free official live-chat API. The API rejects adding X sources; [`server/src/sources/x.js`](server/src/sources/x.js) is a ready-to-implement stub. |

## Quick start (local)

```bash
# 0. install everything (root + server + web)
npm run install:all

# 1. start Postgres (Docker). If you already run Postgres on 5432, pick another
#    host port:  PG_HOST_PORT=5440 docker compose up -d
docker compose up -d

# 2. configure the server
cp server/.env.example server/.env
#    edit DATABASE_URL if you changed PG_HOST_PORT; set a SESSION_SECRET

# 3. create tables
npm --prefix server run db:migrate

# 4a. development (Vite + auto-reloading API, proxied together)
npm run dev
#     → app at http://localhost:5173

# 4b. production (build frontend, server serves it on one port)
npm run build
npm start
#     → app at http://localhost:8080
```

Then: register → add a Twitch/Kick channel → copy your **overlay URL** → add it
as a Browser source in OBS.

## Configuration (`server/.env`)

| Variable | Meaning |
|----------|---------|
| `PORT` | HTTP + WebSocket port (default 8080). |
| `DATABASE_URL` | Postgres connection string. |
| `SESSION_SECRET` | **Change in production** (`openssl rand -hex 32`). Signs session cookies. |
| `COOKIE_SECURE` | `true` behind HTTPS so cookies are marked Secure. |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Enable "Login with Twitch" (optional). |
| `OAUTH_REDIRECT_BASE` | Public base URL; Twitch callback is `<base>/api/auth/twitch/callback`. |
| `APP_URL` | Public base URL used in email links (verify/reset). Dev: `http://localhost:5173`. |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | Mail transport. **If `SMTP_HOST` is blank, emails print to the server console** (zero-setup local testing). |
| `MAIL_FROM` | From address on outgoing email. |
| `BACKLOG_SIZE` | Recent messages replayed to a new overlay/preview. |
| `HUB_IDLE_MS` | How long platform connections persist after the last viewer disconnects. |
| `MAX_SOURCES_PER_USER` | Abuse guard on channels per account. |

`docker-compose.yml` reads `PG_HOST_PORT` (default 5432) for the host port only.

## "Login with Twitch" (optional)

1. Create an app at <https://dev.twitch.tv/console/apps>.
2. Set the OAuth Redirect URL to `<OAUTH_REDIRECT_BASE>/api/auth/twitch/callback`
   (e.g. `http://localhost:8080/api/auth/twitch/callback`).
3. Put the Client ID/Secret in `server/.env` and restart.

When unset, only email/password is shown. A Twitch login is matched to an
existing account by email (if the email is shared) or creates a new account.

## API surface

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `POST /api/auth/register` `/login` `/logout` | cookie | account + session |
| `GET /api/auth/me` | — | current user (incl. `emailVerified`) + enabled OAuth providers |
| `POST /api/auth/verify-email` · `/verify-email/resend` | token / ✅ | confirm email / resend link |
| `POST /api/auth/forgot-password` · `/reset-password` | — / token | request + complete password reset |
| `GET /api/auth/twitch` · `/twitch/callback` | — | Twitch OAuth flow |
| `PUT /api/profile`, `POST /api/profile/password` | ✅ | update name/email (re-verifies), change/set password |
| `GET/POST /api/sources`, `PATCH/DELETE /api/sources/:id` | ✅ | manage channels |
| `GET/PUT /api/settings` | ✅ | overlay appearance |
| `GET /api/overlay`, `POST /api/overlay/rotate` | ✅ | overlay URL + token rotation |
| `WS /ws?token=<overlayToken>` | token | merged chat feed + appearance config |

## OBS setup

1. Copy your overlay URL from the dashboard (it embeds a secret token).
2. OBS: **+ → Browser**, paste the URL, set Width/Height to your scene.
3. The background is transparent. Appearance follows your dashboard settings;
   you can also override per-source with `?size=` / `?max=` on the URL.

## Production / deployment notes

- Run behind HTTPS and set `COOKIE_SECURE=true`. Put a strong `SESSION_SECRET`.
- This server is **stateful per process** (in-memory hubs). To scale horizontally
  you'd add sticky sessions or move fan-out to a shared bus (Redis pub/sub) — fine
  to defer until you have load.
- `docker compose` here is for local Postgres only; use a managed Postgres in prod.
- Back up the database (users, sources, settings live there).

## Adding a platform

1. Create `server/src/sources/<platform>.js` extending `ChatSource`, emitting
   `makeMessage({ platform, channel, name, displayName, color, badges, text, timestamp })`.
2. Register it in [`server/src/sources/factory.js`](server/src/sources/factory.js)
   and add it to `SUPPORTED_PLATFORMS`.
3. Optional: add a glyph/color in [`web/src/ChatMessage.jsx`](web/src/ChatMessage.jsx).

## Project layout

```
server/src/
  index.js            express app, routes, static, ws
  config.js           env config
  ws.js               token → user → hub; pushes appearance config
  db/                 pool, schema.sql, migrate
  repos/              users, sources, settings (data access)
  auth/               password, session (JWT cookie), middleware, twitch-oauth
  mail/               mailer (SMTP or dev-console), templates (verify/reset)
  routes/             auth, profile, sources, settings, overlay
  repos/              users, sources, settings, tokens (single-use, hashed)
  hub/                hub.js (per-user fan-in/out), manager.js (lifecycle)
  sources/            base, twitch, kick, x (stub), factory
web/src/
  main.jsx            router (overlay public; dashboard gated)
  auth.jsx            auth context (me/login/register/logout)
  api.js              fetch wrapper (cookies + JSON)
  useChatSocket.js    /ws client: backlog + live + appearance config
  ChatList / ChatMessage
  pages/              Login, Register, Dashboard, Overlay
```

## Limitations

- Read-only chat aggregation; does not send messages.
- Emotes/badges render as text/initials in v1 (no emote images yet).
- Kick uses undocumented endpoints and may break without notice.
- No billing — every account currently gets everything.
```
