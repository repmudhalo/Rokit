import { buildSource } from '../sources/factory.js'

// Owns ONE upstream ChatSource per distinct channel — keyed by
// platform:channel(:chatroomId for Kick) — shared across every user-hub watching
// it. Each incoming message fans out to all subscribed hubs, so 100 viewers of
// the same channel cost ONE platform connection instead of 100.
//
// Lifecycle: first hub to watch a channel opens the connection; when the last
// hub stops watching, the connection closes after a short grace period (so quick
// reconnects / page navigations reuse it).
const RECENT_SIZE = 40

export class SharedSourceRegistry {
  constructor({ idleMs = 15000 } = {}) {
    this.idleMs = idleMs
    this.entries = new Map() // key -> { source, hubs:Set<Hub>, recent:[], idleTimer, started, starting }
  }

  keyOf(spec) {
    const cr = spec.platform === 'kick' && spec.chatroomId ? `:${spec.chatroomId}` : ''
    return `${spec.platform}:${spec.channel}${cr}`
  }

  async subscribe(spec, hub) {
    const key = this.keyOf(spec)
    let e = this.entries.get(key)
    if (!e) {
      const source = buildSource(spec)
      if (!source) return
      e = { source, hubs: new Set(), recent: [], idleTimer: null, started: false, starting: null }
      this.entries.set(key, e)
      // Single fan-out listener for this upstream → every subscribed hub.
      source.on('message', (msg) => {
        e.recent.push(msg)
        if (e.recent.length > RECENT_SIZE) e.recent.shift()
        for (const h of e.hubs) h.broadcast(msg)
      })
      console.log(`[shared] open ${key}`)
    }
    if (e.idleTimer) {
      clearTimeout(e.idleTimer)
      e.idleTimer = null
    }
    e.hubs.add(hub)
    if (!e.started) {
      e.starting ??= e.source
        .start()
        .then(() => { e.started = true; e.starting = null })
        .catch((err) => console.error(`[shared] ${key} start failed:`, err.message))
      await e.starting
    } else {
      // Joining an already-running channel: replay its recent history into this
      // hub so the new viewer isn't blank (client dedups by message id).
      for (const msg of e.recent) hub.broadcast(msg)
    }
  }

  unsubscribe(spec, hub) {
    const e = this.entries.get(this.keyOf(spec))
    if (!e) return
    e.hubs.delete(hub)
    if (e.hubs.size === 0 && !e.idleTimer) {
      e.idleTimer = setTimeout(() => this.#stop(this.keyOf(spec)), this.idleMs)
    }
  }

  async #stop(key) {
    const e = this.entries.get(key)
    if (!e || e.hubs.size > 0) return
    await e.source.stop().catch(() => {})
    this.entries.delete(key)
    console.log(`[shared] close ${key}`)
  }

  // For /api/live: connection status + how many hubs share each upstream.
  statusFor(specs) {
    return specs.map((spec) => {
      const e = this.entries.get(this.keyOf(spec))
      return {
        platform: spec.platform,
        channel: spec.channel,
        connected: Boolean(e?.source?.connected),
        viewers: e ? e.hubs.size : 0,
      }
    })
  }

  get size() {
    return this.entries.size
  }
}
