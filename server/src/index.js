import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import 'express-async-errors' // route async throws → error middleware (no crash)
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import compression from 'compression'

import { config, oauthEnabled } from './config.js'
import { pool } from './db/pool.js'
import { attachUser, requireAuth } from './auth/middleware.js'
import { cors } from './middleware/cors.js'
import { apiLimiter } from './middleware/ratelimit.js'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { sourcesRouter } from './routes/sources.js'
import { settingsRouter } from './routes/settings.js'
import { overlayRouter } from './routes/overlay.js'
import { analyticsRouter } from './routes/analytics.js'
import { clipsRouter } from './routes/clips.js'
import { attachWebSocket } from './ws.js'
import { manager } from './hub/manager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The built frontend (web/dist). Present for integrated/local deploys; absent
// when this runs as an API-only backend (e.g. frontend hosted on Vercel).
const publicDir = path.join(__dirname, '..', '..', 'web', 'dist')
const indexHtml = path.join(publicDir, 'index.html')
const hasFrontend = fs.existsSync(indexHtml)

const app = express()
// Behind a proxy (Railway etc.) so req.ip / rate-limit see the real client IP.
app.set('trust proxy', config.trustProxy)
// Security headers. CSP + COEP are disabled because the overlay loads emote
// images and fonts from external CDNs (Twitch/Kick/X, Google Fonts).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
// Credentialed CORS for cross-origin frontends (no-op for same-origin deploys).
app.use(cors)
app.use(compression())
app.use(express.json({ limit: '64kb' }))
app.use(cookieParser())
app.use(attachUser) // resolves req.user from the session cookie (or null)

// ── liveness / readiness (unthrottled, for load balancers) ───────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ready: true })
  } catch {
    res.status(503).json({ ready: false, error: 'database unavailable' })
  }
})

// ── API (rate-limited) ────────────────────────────────────────────────────────
app.use('/api', apiLimiter)
app.get('/api/live', requireAuth, (req, res) => res.json(manager.inspect(req.user.id)))
app.get('/api/debug/hub', requireAuth, (req, res) => res.json(manager.inspect(req.user.id)))
app.use('/api/auth', authRouter)
app.use('/api/profile', requireAuth, profileRouter)
app.use('/api/sources', requireAuth, sourcesRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/overlay', requireAuth, overlayRouter)
app.use('/api/analytics', requireAuth, analyticsRouter)
app.use('/api/clips', requireAuth, clipsRouter)

// Unknown API routes should 404 as JSON, not fall through to the SPA.
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }))

// ── static frontend + SPA fallback ───────────────────────────────────────────
// Only when a build exists. API-only deploys (frontend elsewhere) 404 non-API
// routes as JSON instead of trying to serve a missing index.html.
if (hasFrontend) {
  app.use(express.static(publicDir))
  app.get('*', (_req, res) => res.sendFile(indexHtml))
} else {
  app.get('*', (_req, res) => res.status(404).json({ error: 'not found' }))
}

// ── error handler: turn any thrown/rejected route error into JSON 500 ─────────
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, '-', err.stack || err.message)
  if (res.headersSent) return next(err)
  res.status(err.status || 500).json({ error: 'internal server error' })
})

// Last-resort safety nets so the server logs instead of dying silently.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason))
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err))

const server = http.createServer(app)
const wss = attachWebSocket(server)

server.listen(config.port, () => {
  console.log(`\nRokit server on http://localhost:${config.port}`)
  console.log(`  twitch oauth : ${oauthEnabled() ? 'enabled' : 'disabled (email/password only)'}`)
  console.log(`  db           : ${config.databaseUrl.replace(/:[^:@/]+@/, ':****@')}\n`)
})

// ── graceful shutdown (Railway/Docker send SIGTERM on deploy) ─────────────────
let closing = false
async function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`\n${signal} received — shutting down gracefully…`)
  server.close(() => console.log('  http server closed'))
  for (const ws of wss.clients) {
    try { ws.close(1001, 'server restarting') } catch { /* ignore */ }
  }
  try {
    await pool.end()
    console.log('  database pool closed')
  } catch { /* ignore */ }
  // Hard exit if something hangs.
  setTimeout(() => process.exit(0), 4000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
