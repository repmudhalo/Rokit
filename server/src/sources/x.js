// X (Twitter) live-broadcast chat — UNOFFICIAL / EXPERIMENTAL.
//
// X has no official API for the chat inside a live broadcast. It still runs on
// Periscope's ("pscp.tv") chatman infrastructure. Verified working pipeline,
// GUEST-ONLY (no login / no per-user token):
//
//   1. POST api.x.com/1.1/guest/activate.json                 -> guest_token
//   2. GET  api.x.com/1.1/broadcasts/show.json?ids=<id>       -> media_key
//   3. GET  api.x.com/1.1/live_video_stream/status/<mk>.json  -> chatToken (+ status)
//   4. GET  proxsee.pscp.tv/api/v2/accessChatPublic?chat_token=…  -> access_token + endpoint
//   5. POST <endpoint>/chatapi/v1/history { access_token, … }  -> chat events (poll)
//
// History polling (~2s) is used instead of the chatman WebSocket: the WS
// rejects our subscribe handshake, while history is reliable and gives the
// same data. Chat events are { kind:1, payload:{ sender, body } } where
// body (a JSON string) = { type:1, body:<text>, username, displayName, uuid, timestamp }.
//
// ⚠ Undocumented, against X's ToS, and WILL break when X changes things. Fully
// isolated: any failure here never affects Twitch/Kick. Labeled "experimental".

import { ChatSource } from './base.js'
import { makeMessage } from '../normalize.js'

// Public X web app bearer (not a secret — shipped in x.com's JS).
const WEB_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const POLL_MS = 2000
const BACKLOG_MS = 20000 // on connect, grab the last ~20s of chat

export class XSource extends ChatSource {
  constructor({ channel }) {
    super({ platform: 'x', channel: parseBroadcastId(channel) })
    this.stopped = false
    this.timer = null
    this.guestToken = null
    this.access = null
    this.seen = new Set()
    this.sinceNs = 0 // forward-polling cursor, in NANOSECONDS
    this.reconnectDelay = 3000
  }

  async start() {
    this.stopped = false
    if (!this.channel) {
      this.log('no broadcast id — expected an x.com/i/broadcasts/<id> URL')
      return
    }
    await this.connect()
  }

  async connect() {
    if (this.stopped) return
    try {
      this.access = await this.getChatAccess()
      if (!this.access) return this.scheduleReconnect()
      this.connected = true
      this.reconnectDelay = 3000
      this.sinceNs = (Date.now() - BACKLOG_MS) * 1e6 // ms → ns
      this.log('connected (history polling)')
      this.poll()
    } catch (err) {
      this.log('connect error:', err.message)
      this.scheduleReconnect()
    }
  }

  headers(extra) {
    return {
      Authorization: `Bearer ${WEB_BEARER}`,
      'User-Agent': UA,
      Origin: 'https://x.com',
      Referer: 'https://x.com/',
      ...(this.guestToken ? { 'x-guest-token': this.guestToken } : {}),
      ...extra,
    }
  }

  async json(url, opts) {
    const res = await fetch(url, opts)
    if (!res.ok) return { _status: res.status }
    return res.json().catch(() => null)
  }

  // Steps 1–4: resolve a fresh chatman access_token + endpoint (guest-only).
  async getChatAccess() {
    if (!this.guestToken) {
      const g = await this.json('https://api.x.com/1.1/guest/activate.json', { method: 'POST', headers: this.headers() })
      this.guestToken = g?.guest_token || null
      if (!this.guestToken) return this.log('guest activate failed'), null
    }

    const show = await this.json(`https://api.x.com/1.1/broadcasts/show.json?ids=${this.channel}`, { headers: this.headers() })
    const media = show?.broadcasts?.[this.channel]?.media_key
    if (!media) return this.log('broadcast not found (ended?)'), null

    const status = await this.json(`https://api.x.com/1.1/live_video_stream/status/${media}.json`, { headers: this.headers() })
    if (!status?.chatToken) return this.log('no chatToken (status', status?.source?.status, ')'), null
    if (status.source?.status && !String(status.source.status).includes('LIVE')) {
      this.log('broadcast not live —', status.source.status)
    }

    const acc = await this.json(
      `https://proxsee.pscp.tv/api/v2/accessChatPublic?chat_token=${encodeURIComponent(status.chatToken)}`,
      { headers: this.headers() },
    )
    if (!acc?.access_token || !acc?.endpoint) return this.log('accessChatPublic failed'), null
    return { access_token: acc.access_token, endpoint: acc.endpoint.replace(/\/+$/, '') }
  }

  // Step 5: poll chat history on a loop.
  poll() {
    if (this.stopped) return
    this.fetchHistory()
      .catch((err) => this.log('poll error:', err.message))
      .finally(() => {
        if (!this.stopped) this.timer = setTimeout(() => this.poll(), POLL_MS)
      })
  }

  async fetchHistory() {
    // Forward poll: ask for everything since the last-seen timestamp (in ns),
    // exactly as the X web client does. quick_get:false returns real messages.
    const res = await fetch(`${this.access.endpoint}/chatapi/v1/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://x.com', 'User-Agent': UA },
      body: JSON.stringify({ access_token: this.access.access_token, cursor: '', limit: 200, since: this.sinceNs, quick_get: false }),
    })
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      // token/broadcast expired — re-acquire from scratch.
      this.log('access expired, re-acquiring')
      this.access = null
      this.guestToken = null
      return this.connect()
    }
    if (!res.ok) return this.log('history HTTP', res.status)

    const data = await res.json().catch(() => null)
    let maxTs = 0
    const fresh = []
    for (const raw of data?.messages || []) {
      const ts = eventTimestamp(raw)
      if (ts > maxTs) maxTs = ts
      const m = parseChatMessage(raw)
      if (!m || this.seen.has(m.uuid)) continue
      this.seen.add(m.uuid)
      fresh.push(m)
    }
    // Advance the cursor forward past the newest PLAUSIBLE event (ignore
    // malformed/future timestamps so a bad message can't freeze polling).
    const nowMs = Date.now()
    if (maxTs > 1e12 && maxTs <= nowMs + 60000) {
      const candidate = (maxTs + 1) * 1e6
      if (candidate > this.sinceNs) this.sinceNs = candidate
    }
    if (this.seen.size > 3000) this.seen = new Set([...this.seen].slice(-1500))

    fresh.sort((a, b) => a.timestamp - b.timestamp)
    for (const m of fresh) {
      this.emitMessage(
        makeMessage({
          platform: 'x',
          channel: this.channel,
          id: `x-${m.uuid}`,
          name: m.username,
          displayName: m.display,
          text: m.text,
          timestamp: m.timestamp,
        }),
      )
    }
  }

  scheduleReconnect() {
    if (this.stopped) return
    this.timer = setTimeout(() => this.connect(), this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
  }

  async stop() {
    this.stopped = true
    this.connected = false
    if (this.timer) clearTimeout(this.timer)
  }
}

// Extract a millisecond timestamp from any chatman event (to advance `since`).
function eventTimestamp(raw) {
  try {
    const p = JSON.parse(raw.payload)
    let b = p.body
    if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = null } }
    const ts = (b && b.timestamp) || p.timestamp
    return ts ? Number(ts) : 0
  } catch {
    return 0
  }
}

// Parse one chatman history entry into a chat message, or null if it's a
// presence/join/heartbeat event.
function parseChatMessage(raw) {
  if (!raw || raw.kind !== 1) return null
  let payload
  try {
    payload = JSON.parse(raw.payload)
  } catch {
    return null
  }
  let body = payload.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return null }
  }
  if (!body || body.type !== 1 || typeof body.body !== 'string' || !body.body) return null
  return {
    uuid: body.uuid || `${body.timestamp}-${body.username}`,
    text: body.body,
    username: body.username || payload.sender?.username || '',
    display: body.displayName || payload.sender?.display_name || body.username || 'X viewer',
    timestamp: body.timestamp ? Number(body.timestamp) : Date.now(),
  }
}

// Accept a full URL (https://x.com/i/broadcasts/<id>) or a bare id.
// Broadcast ids are CASE-SENSITIVE — never lowercase them.
export function parseBroadcastId(input) {
  if (!input) return ''
  const m = String(input).match(/broadcasts\/([A-Za-z0-9]+)/)
  return m ? m[1] : String(input).trim()
}
