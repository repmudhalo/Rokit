import { Hub } from './hub.js'
import { config } from '../config.js'
import * as sourcesRepo from '../repos/sources.js'
import { SharedSourceRegistry } from './registry.js'
import { SessionTracker } from '../analytics/tracker.js'

const toSpec = (row) => ({ platform: row.platform, channel: row.channel, chatroomId: row.chatroom_id || null })
const specKey = (s) => `${s.platform}:${s.channel}${s.platform === 'kick' && s.chatroomId ? ':' + s.chatroomId : ''}`

// Owns one Hub per active user (their clients + backlog) and connects each hub
// to SHARED upstream sources via the registry — so the platform-connection count
// scales with distinct channels, not users.
//   • first client for a user → subscribe their hub to each channel's upstream
//   • last client disconnects  → release after `idleMs`
class UserHubManager {
  constructor({ idleMs = config.idleMs, backlogSize = config.backlogSize } = {}) {
    this.idleMs = idleMs
    this.backlogSize = backlogSize
    this.entries = new Map() // userId -> { hub, clients, idleTimer, specs, subscribed, subscribing }
    this.registry = new SharedSourceRegistry({ idleMs: Math.min(idleMs, 15000) })
  }

  async acquire(userId) {
    let entry = this.entries.get(userId)
    if (!entry) {
      const tracker = new SessionTracker(userId)
      entry = {
        hub: new Hub({ backlogSize: this.backlogSize, onMessage: (m) => tracker.record(m) }),
        tracker,
        clients: 0,
        idleTimer: null,
        specs: [],
        subscribed: false,
        subscribing: null,
      }
      this.entries.set(userId, entry)
    }
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = null
    }
    entry.clients++
    if (!entry.subscribed) {
      entry.subscribing ??= this.#subscribeAll(entry, userId).then(() => {
        entry.subscribed = true
        entry.subscribing = null
      })
      await entry.subscribing
    }
    return entry.hub
  }

  release(userId) {
    const entry = this.entries.get(userId)
    if (!entry) return
    entry.clients = Math.max(0, entry.clients - 1)
    if (entry.clients === 0 && !entry.idleTimer) {
      entry.idleTimer = setTimeout(() => this.#stop(userId), this.idleMs)
    }
  }

  async #subscribeAll(entry, userId) {
    const rows = await sourcesRepo.listEnabled(userId)
    entry.specs = rows.map(toSpec)
    await Promise.all(entry.specs.map((spec) => this.registry.subscribe(spec, entry.hub)))
    console.log(`[hub] user ${userId}: watching ${entry.specs.length} channel(s) · ${this.registry.size} shared upstream(s)`)
  }

  // Re-read sources and update subscriptions (diff add/remove only).
  async reload(userId) {
    const entry = this.entries.get(userId)
    if (!entry || !entry.subscribed) return
    const next = (await sourcesRepo.listEnabled(userId)).map(toSpec)
    const nextKeys = new Set(next.map(specKey))
    const prevKeys = new Set(entry.specs.map(specKey))
    for (const spec of entry.specs) {
      if (!nextKeys.has(specKey(spec))) this.registry.unsubscribe(spec, entry.hub)
    }
    await Promise.all(
      next.filter((spec) => !prevKeys.has(specKey(spec))).map((spec) => this.registry.subscribe(spec, entry.hub)),
    )
    entry.specs = next
  }

  async #stop(userId) {
    const entry = this.entries.get(userId)
    if (!entry) return
    entry.idleTimer = null
    if (entry.clients > 0) return // reconnected before the timer fired
    for (const spec of entry.specs) this.registry.unsubscribe(spec, entry.hub)
    entry.tracker?.stop()
    this.entries.delete(userId)
    console.log(`[hub] user ${userId}: idle, released`)
  }

  // Live analytics snapshot for the current session (or inactive if no hub).
  analyticsFor(userId) {
    const entry = this.entries.get(userId)
    return entry?.tracker ? entry.tracker.snapshot() : { active: false }
  }

  // Snapshot for /api/live: per-channel connection status + shared-viewer count.
  inspect(userId) {
    const entry = this.entries.get(userId)
    if (!entry) return { active: false, clients: 0, sources: [] }
    return {
      active: true,
      clients: entry.clients,
      sharedUpstreams: this.registry.size,
      sources: this.registry.statusFor(entry.specs),
    }
  }
}

export const manager = new UserHubManager()
