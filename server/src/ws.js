import { WebSocketServer } from 'ws'
import * as users from './repos/users.js'
import * as settingsRepo from './repos/settings.js'
import { manager } from './hub/manager.js'

// Overlay & dashboard-preview clients connect to /ws?token=<overlayToken>.
// The token resolves to a user; the client is attached to that user's hub,
// which spins up their platform connections on demand.
const HEARTBEAT_MS = 30000

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Keepalive: ping every client periodically. Browsers auto-reply with pong,
  // which (a) keeps the connection warm so idle proxies (Railway, nginx) don't
  // drop it during quiet chat, and (b) lets us reap truly-dead sockets so the
  // hub's client count never leaks and strands platform connections.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      try {
        ws.ping()
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS)
  wss.on('close', () => clearInterval(heartbeat))

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

    let token
    try {
      token = new URL(req.url, 'http://localhost').searchParams.get('token')
    } catch {
      /* ignore */
    }
    if (!token) return ws.close(4001, 'missing token')

    const user = await users.findByOverlayToken(token).catch(() => null)
    if (!user) return ws.close(4003, 'invalid token')

    // Push the user's overlay appearance settings before any chat frames.
    const settings = await settingsRepo.get(user.id).catch(() => null)
    if (settings && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'config', settings }))
    }

    const hub = await manager.acquire(user.id)
    hub.addClient(ws)

    ws.on('close', () => {
      hub.removeClient(ws)
      manager.release(user.id)
    })
    ws.on('error', () => {})
  })

  return wss
}
