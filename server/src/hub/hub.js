// A Hub belongs to ONE user. It fans messages in from that user's sources and
// out to that user's connected clients (overlay + dashboard preview), and keeps
// a small backlog so a freshly-opened overlay isn't blank.

export class Hub {
  constructor({ backlogSize = 50 } = {}) {
    this.sources = []
    this.clients = new Set()
    this.backlog = []
    this.backlogSize = backlogSize
  }

  addSource(source) {
    if (!source) return
    const onMessage = (msg) => this.broadcast(msg)
    source._onMessage = onMessage
    source.on('message', onMessage)
    this.sources.push(source)
  }

  async startAll() {
    await Promise.all(
      this.sources.map((s) =>
        s.start().catch((err) =>
          console.error(`[${s.platform}:${s.channel}] failed to start:`, err.message),
        ),
      ),
    )
  }

  // Stop + detach every source but keep clients and backlog (used on reload).
  async removeAllSources() {
    await Promise.all(this.sources.map((s) => s.stop().catch(() => {})))
    for (const s of this.sources) {
      if (s._onMessage) s.off('message', s._onMessage)
    }
    this.sources = []
  }

  addClient(ws) {
    this.clients.add(ws)
    this.send(ws, { type: 'backlog', messages: this.backlog })
  }

  removeClient(ws) {
    this.clients.delete(ws)
  }

  broadcast(msg) {
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
