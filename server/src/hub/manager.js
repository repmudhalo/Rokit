import { Hub } from './hub.js'
import { config } from '../config.js'
import * as sourcesRepo from '../repos/sources.js'
import { buildSource } from '../sources/factory.js'

// Owns one Hub per active user and manages its lifecycle on demand:
//   • first client for a user  → load their enabled sources from DB & connect
//   • last client disconnects   → tear down after `idleMs` of inactivity
// This keeps idle users from holding open platform sockets, which matters once
// many users exist.
class UserHubManager {
  constructor({ idleMs = config.idleMs, backlogSize = config.backlogSize } = {}) {
    this.idleMs = idleMs
    this.backlogSize = backlogSize
    this.entries = new Map() // userId -> { hub, clients, idleTimer, starting }
  }

  // Called when a client (overlay/preview) connects. Ensures sources are live
  // and returns the user's hub.
  async acquire(userId) {
    let entry = this.entries.get(userId)
    if (!entry) {
      entry = { hub: new Hub({ backlogSize: this.backlogSize }), clients: 0, idleTimer: null, starting: null }
      this.entries.set(userId, entry)
    }
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = null
    }
    entry.clients++
    if (!entry.started) {
      // Guard against concurrent connects racing the initial start.
      entry.starting ??= this.#startSources(entry, userId).then(() => {
        entry.started = true
        entry.starting = null
      })
      await entry.starting
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

  // Re-read sources from DB and reconnect (called when a user edits sources).
  async reload(userId) {
    const entry = this.entries.get(userId)
    if (!entry || !entry.started) return
    await entry.hub.removeAllSources()
    await this.#startSources(entry, userId)
  }

  async #startSources(entry, userId) {
    const rows = await sourcesRepo.listEnabled(userId)
    for (const row of rows) entry.hub.addSource(buildSource(row))
    await entry.hub.startAll()
    console.log(`[hub] user ${userId}: started ${rows.length} source(s)`)
  }

  async #stop(userId) {
    const entry = this.entries.get(userId)
    if (!entry) return
    entry.idleTimer = null
    if (entry.clients > 0) return // a client reconnected before the timer fired
    await entry.hub.removeAllSources()
    // A client may have reattached during the async teardown above. If so,
    // restart its sources instead of orphaning it on a dead hub.
    if (entry.clients > 0) {
      await this.#startSources(entry, userId)
      return
    }
    this.entries.delete(userId)
    console.log(`[hub] user ${userId}: idle, torn down`)
  }

  // Snapshot of a user's live hub for debugging ("are sources connected?").
  inspect(userId) {
    const entry = this.entries.get(userId)
    if (!entry) return { active: false, clients: 0, sources: [] }
    return {
      active: true,
      started: Boolean(entry.started),
      clients: entry.clients,
      idleScheduled: Boolean(entry.idleTimer),
      sources: entry.hub.sources.map((s) => ({
        platform: s.platform,
        channel: s.channel,
        connected: Boolean(s.connected),
      })),
    }
  }
}

export const manager = new UserHubManager()
