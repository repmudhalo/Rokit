import * as markersRepo from '../repos/markers.js'

// Per-user session analytics. One tracker lives with a user's Hub: it sees every
// merged message (via Hub.broadcast), keeps live counters + a msgs/min timeline,
// and detects chat-activity spikes — persisting a "hype clip marker" for each so
// the streamer can jump back to that moment in their VOD.

const TICK_MS = 5000 // sampling + detection cadence
const WINDOW_MS = 60000 // rolling window for msgs/min
const SHORT_MS = 12000 // burst window for spike detection
const WARMUP_MS = 30000 // let the baseline settle before marking
const FLOOR = 25 // min msgs/min to count as a spike
const FACTOR = 1.7 // burst must exceed baseline by this much
const MARKER_GAP_MS = 30000 // debounce between markers
const ALPHA = 0.15 // baseline EMA smoothing per tick
const MAX_SAMPLES = 480 // ~40 min of 5s samples
const MAX_CHATTERS = 50000

export class SessionTracker {
  constructor(userId) {
    this.userId = userId
    this.startedAt = Date.now()
    this.messages = 0
    this.byPlatform = {}
    this.chatters = new Map()
    this.times = [] // message timestamps within the rolling window
    this.samples = [] // { t: ms-into-session, rate: msgs/min }
    this.peakRate = 0
    this.baseline = null
    this.lastMarkerAt = 0
    this.timer = setInterval(() => this.tick(), TICK_MS)
    if (this.timer.unref) this.timer.unref()
  }

  record(msg) {
    if (!msg) return
    const now = Date.now()
    this.messages++
    const p = msg.platform || 'other'
    this.byPlatform[p] = (this.byPlatform[p] || 0) + 1
    const name = msg.user?.displayName || msg.user?.name
    if (name) {
      if (this.chatters.has(name)) this.chatters.set(name, this.chatters.get(name) + 1)
      else if (this.chatters.size < MAX_CHATTERS) this.chatters.set(name, 1)
    }
    this.times.push(now)
  }

  tick() {
    const now = Date.now()
    const cut = now - WINDOW_MS
    while (this.times.length && this.times[0] < cut) this.times.shift()
    const rate = this.times.length // msgs in the last 60s = msgs/min
    if (rate > this.peakRate) this.peakRate = rate

    // burst rate over the short window, extrapolated to per-minute
    const cutShort = now - SHORT_MS
    let short = 0
    for (let i = this.times.length - 1; i >= 0 && this.times[i] >= cutShort; i--) short++
    const shortRate = short * (60000 / SHORT_MS)

    this.samples.push({ t: now - this.startedAt, rate })
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()

    this.baseline = this.baseline === null ? rate : this.baseline * (1 - ALPHA) + rate * ALPHA

    const elapsed = now - this.startedAt
    if (
      elapsed > WARMUP_MS &&
      shortRate >= FLOOR &&
      shortRate >= this.baseline * FACTOR &&
      now - this.lastMarkerAt > MARKER_GAP_MS
    ) {
      this.lastMarkerAt = now
      markersRepo.insert(this.userId, { at: now, intoMs: elapsed, rate: shortRate }).catch(() => {})
    }
  }

  snapshot() {
    return {
      active: true,
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedAt,
      messages: this.messages,
      perMin: this.times.length,
      peakPerMin: this.peakRate,
      byPlatform: { ...this.byPlatform },
      topChatters: [...this.chatters.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, n]) => ({ name, n })),
      samples: this.samples.slice(),
    }
  }

  stop() {
    clearInterval(this.timer)
  }
}
