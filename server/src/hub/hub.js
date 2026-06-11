// A Hub belongs to ONE user. It holds that user's connected clients (overlay +
// dashboard preview) and a small backlog so a freshly-opened overlay isn't blank.
// Messages are pushed in by the SharedSourceRegistry (one upstream connection per
// channel, fanned out to every hub watching it) via broadcast().

export class Hub {
  constructor({ backlogSize = 50, onMessage = null } = {}) {
    this.clients = new Set()
    this.backlog = []
    this.backlogSize = backlogSize
    this.onMessage = onMessage // analytics tap: called for every broadcast message
  }

  addClient(ws) {
    this.clients.add(ws)
    this.send(ws, { type: 'backlog', messages: this.backlog })
  }

  removeClient(ws) {
    this.clients.delete(ws)
  }

  broadcast(msg) {
    if (this.onMessage) { try { this.onMessage(msg) } catch { /* analytics must never break chat */ } }
    this.backlog.push(msg)
    if (this.backlog.length > this.backlogSize) this.backlog.shift()

    const payload = JSON.stringify({ type: 'message', message: msg })
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload)
    }
  }

  send(ws, obj) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj))
  }
}
