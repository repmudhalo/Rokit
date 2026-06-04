import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import 'express-async-errors' // route async throws → error middleware (no crash)
import cookieParser from 'cookie-parser'

import { config, oauthEnabled } from './config.js'
import { attachUser, requireAuth } from './auth/middleware.js'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { sourcesRouter } from './routes/sources.js'
import { settingsRouter } from './routes/settings.js'
import { overlayRouter } from './routes/overlay.js'
import { attachWebSocket } from './ws.js'
import { manager } from './hub/manager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(attachUser) // resolves req.user from the session cookie (or null)

// ── API ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))
// Live hub state for the signed-in user — per-source connection status + viewers.
app.get('/api/live', requireAuth, (req, res) => res.json(manager.inspect(req.user.id)))
app.get('/api/debug/hub', requireAuth, (req, res) => res.json(manager.inspect(req.user.id)))
app.use('/api/auth', authRouter)
app.use('/api/profile', requireAuth, profileRouter)
app.use('/api/sources', requireAuth, sourcesRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/overlay', requireAuth, overlayRouter)

// Unknown API routes should 404 as JSON, not fall through to the SPA.
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }))

// ── static frontend + SPA fallback ───────────────────────────────────────────
app.use(express.static(publicDir))
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))

// ── error handler: turn any thrown/rejected route error into JSON 500 ─────────
// (with express-async-errors above, this also catches async handler rejections,
// so a single failing request can never crash the process.)
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, '-', err.stack || err.message)
  if (res.headersSent) return next(err)
  res.status(err.status || 500).json({ error: 'internal server error' })
})

// Last-resort safety nets so the server logs instead of dying silently.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason))
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err))

const server = http.createServer(app)
attachWebSocket(server)

server.listen(config.port, () => {
  console.log(`\nRokit server on http://localhost:${config.port}`)
  console.log(`  twitch oauth : ${oauthEnabled() ? 'enabled' : 'disabled (email/password only)'}`)
  console.log(`  db           : ${config.databaseUrl.replace(/:[^:@/]+@/, ':****@')}\n`)
})
