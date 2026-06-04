# Rokit

**One chat to rule your stream.** Rokit merges your **Twitch**, **Kick**, and **X**
live chat into a single real‑time feed and renders it as a transparent **OBS
Browser Source overlay** — plus a dashboard to read, moderate, and customize it.

Each user signs up, connects their own channels, customizes the look, and gets a
private overlay URL to drop into OBS.

```
                         ┌──────────────────────── per user ────────────────────────┐
 sign up / log in   →    dashboard: add channels · style overlay · read live feed
                                              │
 Twitch IRC ─┐                                ▼
 Kick Pusher ─┤→  per-user hub (on-demand)  →  /ws?token=…  ┬→  /overlay?token=…  (OBS source)
 X  chatman  ─┘                                             └→  Live tab (read / moderate)
```

> ⚠️ **Heads-up:** Twitch uses an official anonymous endpoint. **Kick and X are
> unofficial** (reverse-engineered) and may break when those platforms change
> things — and using them at scale / commercially is your call re: their ToS.
> Both are fully isolated, so if one breaks the others keep working.

---

## Features

- **Three platforms, one feed** — Twitch + Kick + X live chat merged in real time.
- **Custom emotes** render as images — Twitch (IRC emote tags) and Kick (`[emote:…]`),
  plus native unicode emoji. 
- **OBS overlay** — transparent browser source, driven by a secret per-user token.
- **Live overlay customizer** (real-time preview): font size, max messages,
  platform tag (full label / logo-only / hidden), plain vs boxed logos, message
  background (clean / card), backdrop transparency, text outline, badges, channel labels.
- **Live tab** for reading/moderating: per-platform filters, keyword search,
  **slow mode**, **pause-on-hover**, **pin-to-save** (persisted), top-chatter +
  message-rate stats, and per-channel connection status.
- **Accounts** — email/password **and** "Login with Twitch", email verification,
  password reset, profile management.
- **Built to scale (per-user)** — platform connections spin up on demand and tear
  down when idle; WebSocket keepalive; batched rendering that survives firehose chats.

## Architecture

- **`server/`** — Node/Express + `ws`, PostgreSQL. Hashed-password + signed-cookie
  sessions (optional Twitch OAuth). A **per-user hub manager** opens a user's
  platform connections only while an overlay/preview is connected and tears them
  down after an idle timeout.
- **`web/`** — React + Vite. Dark, terminal-modern UI (Geist Mono, cyan accent).
  Token-driven overlay + a full dashboard.
- Every message is normalized to one shape (`{ platform, channel, user, text,
  fragments, timestamp }`), so adding a platform is one source file — the UI
  needs no changes.

## Platform support

| Platform | Status | How it works |
|----------|--------|--------------|
| **Twitch** | ✅ Official, stable | Anonymous IRC-over-WebSocket. No API key. Emotes via IRC tags. |
| **Kick** | ⚠️ Unofficial | Public Pusher socket. The channel→chatroom lookup sits behind Cloudflare and can 403 from servers — use the per-source chatroom-id override. Emotes via `[emote:id:name]`. |
| **X / Twitter** | 🧪 Experimental / unofficial | Periscope **chatman** (guest-only, no login): `guest → broadcasts/show → live_video_stream/status → accessChatPublic → poll /chatapi/v1/history` (~2s latency). Add a **live broadcast URL**. Against X's ToS; will break when X changes internals. |

## Quick start (local)

```bash
# 0. install everything (root + server + web)
npm run install:all

# 1. start Postgres (Docker). Already using 5432? pick another host port:
#    PG_HOST_PORT=5440 docker compose up -d
docker compose up -d

# 2. configure the server
cp server/.env.example server/.env
#    edit DATABASE_URL if you changed PG_HOST_PORT; set a strong SESSION_SECRET

# 3. create the tables
npm --prefix server run db:migrate

# 4a. development (Vite + auto-reloading API, proxied together)
npm run dev          # → http://localhost:5173

# 4b. production (build the frontend, server serves it on one port)
npm run build && npm start   # → http://localhost:8080
```

Then: **register → add a channel → open the Overlay tab → copy the overlay URL →
add it as a Browser source in OBS.**

- **Twitch:** dropdown → Twitch → channel name (e.g. `xqc`)
- **Kick:** dropdown → Kick → channel slug
- **X:** dropdown → "X (live)" → paste a **currently-live** broadcast URL
  (`https://x.com/i/broadcasts/<id>`)

## Configuration (`server/.env`)

| Variable | Meaning |
|----------|---------|
| `PORT` | HTTP + WebSocket port (default 8080). |
| `DATABASE_URL` | Postgres connection string. |
| `SESSION_SECRET` | **Change in production** (`openssl rand -hex 32`). Signs session cookies. |
| `COOKIE_SECURE` | `true` behind HTTPS so cookies are marked Secure. |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Enable "Login with Twitch" (optional). |
| `OAUTH_REDIRECT_BASE` | Public base URL; Twitch callback is `<base>/api/auth/twitch/callback`. |
| `APP_URL` | Public base URL used in email links. Dev: `http://localhost:5173`. |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | Mail transport. **Blank `SMTP_HOST` → emails print to the server console** (zero-setup local testing). |
| `MAIL_FROM` | From address on outgoing email. |
| `BACKLOG_SIZE` | Recent messages replayed to a freshly-opened overlay/preview. |
| `HUB_IDLE_MS` | How long platform connections persist after the last viewer disconnects. |
| `MAX_SOURCES_PER_USER` | Abuse guard on channels per account. |
| `X_DEBUG` | `1` logs raw X/chatman frames (for debugging the X source). |

`docker-compose.yml` reads `PG_HOST_PORT` (default 5432) for the host port only.

## "Login with Twitch" (optional)

1. Create an app at <https://dev.twitch.tv/console/apps>.
2. Set the OAuth Redirect URL to `<OAUTH_REDIRECT_BASE>/api/auth/twitch/callback`.
3. Put the Client ID/Secret in `server/.env` and restart.

When unset, only email/password is shown. A Twitch login matches an existing
account by email, or creates a new one.

## API surface

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `POST /api/auth/register` `/login` `/logout` | cookie | account + session |
| `GET /api/auth/me` | — | current user (incl. `emailVerified`) + enabled OAuth providers |
| `POST /api/auth/verify-email` · `/verify-email/resend` | token / ✅ | confirm email / resend link |
| `POST /api/auth/forgot-password` · `/reset-password` | — / token | password reset |
| `GET /api/auth/twitch` · `/twitch/callback` | — | Twitch OAuth flow |
| `PUT /api/profile`, `POST /api/profile/password` | ✅ | update name/email, change/set password |
| `GET/POST /api/sources`, `PATCH/DELETE /api/sources/:id` | ✅ | manage channels |
| `GET/PUT /api/settings` | ✅ | overlay appearance |
| `GET /api/overlay`, `POST /api/overlay/rotate` | ✅ | overlay URL + token rotation |
| `GET /api/live` | ✅ | per-source connection status + viewer count |
| `WS /ws?token=<overlayToken>` | token | merged chat feed + appearance config |

## OBS setup

1. Copy your overlay URL from the dashboard (it embeds a secret token — keep it private).
2. OBS: **+ → Browser**, paste the URL, set Width/Height to your scene.
3. The background is transparent; appearance follows your dashboard settings.
   Optional URL overrides: `?size=` (font px), `?max=` (messages on screen).

## Production / deployment notes

- Run behind HTTPS, set `COOKIE_SECURE=true`, and a strong `SESSION_SECRET`.
- Set `APP_URL` to your public URL so email links resolve.
- **Stateful per process** (in-memory hubs). Multi-instance needs sticky sessions
  or a shared bus (e.g. Redis pub/sub).
- **Scale ceiling:** Kick/X connect/poll from the server's IP. At high concurrency
  you'll want **upstream connection sharing** (one connection per distinct channel,
  fanned out to all watchers) and/or multiple egress IPs to avoid rate-limits.
- Use a managed Postgres in prod (the bundled `docker compose` is for local only).

## Adding a platform

1. Create `server/src/sources/<platform>.js` extending `ChatSource`, emitting
   `makeMessage({ platform, channel, name, displayName, color, badges, text, fragments, timestamp })`.
2. Register it in [`server/src/sources/factory.js`](server/src/sources/factory.js)
   and add it to `SUPPORTED_PLATFORMS`.
3. Optional: add a brand mark/color in [`web/src/ChatMessage.jsx`](web/src/ChatMessage.jsx).

## Project layout

```
server/src/
  index.js            express app, routes, static, ws, error handling
  config.js           env config
  ws.js               token → user → hub; keepalive; pushes appearance config
  db/                 pool, schema.sql, migrate
  repos/              users, sources, settings, tokens (single-use, hashed)
  auth/               password, session (JWT cookie), middleware, twitch-oauth
  mail/               mailer (SMTP or dev-console), templates (verify/reset)
  routes/             auth, profile, sources, settings, overlay
  hub/                hub.js (per-user fan-in/out), manager.js (lifecycle)
  sources/            base, twitch, kick, x, factory
web/src/
  main.jsx            router (overlay public; dashboard gated)
  auth.jsx · api.js   auth context + fetch wrapper
  useChatSocket.js    /ws client: batched live feed + stats + appearance config
  appearance.js       settings → render props (overlay & preview share one source)
  ChatList / ChatMessage   message rendering (emotes, platform chips)
  components/         AppShell (icon rail), Logo
  pages/             Landing, Login, Register, Verify/Forgot/Reset, Dashboard, Overlay
```

## Limitations

- **Read-only** — aggregates chat, does not send messages.
- **Kick & X are unofficial** and may break without notice; review each platform's
  ToS before commercial use. X is experimental and has ~2s latency.
- No billing yet — every account gets everything.

---

Built with the [Claude Agent SDK](https://claude.com/claude-code).
