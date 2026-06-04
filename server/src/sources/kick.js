// Kick chat. Kick has NO official public chat API, so this is unofficial and
// may break if Kick changes things:
//   1. Resolve the numeric chatroom id from kick.com/api/v2/channels/<slug>.
//      (That endpoint is behind Cloudflare and can 403 from servers — in which
//       case set KICK_CHATROOM_OVERRIDE so we skip the lookup entirely.)
//   2. Connect to Kick's public Pusher WebSocket and subscribe to the room.
//   3. Translate "ChatMessageEvent" into our normalized message shape.

import WebSocket from 'ws'
import { ChatSource } from './base.js'
import { makeMessage } from '../normalize.js'

// Public Pusher app key Kick's web client uses (not a secret).
const PUSHER_KEY = '32cbd69e4b950bf97679'
const PUSHER_CLUSTER = 'us2'
const PUSHER_URL = `wss://ws-${PUSHER_CLUSTER}.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`

const BROWSERY_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

export class KickSource extends ChatSource {
  constructor({ channel, chatroomId = null }) {
    super({ platform: 'kick', channel: channel.toLowerCase() })
    this.chatroomId = chatroomId // may be pre-set via override
    this.ws = null
    this.stopped = false
    this.reconnectDelay = 1000
  }

  async start() {
    this.stopped = false
    if (!this.chatroomId) {
      this.chatroomId = await this.resolveChatroomId()
    }
    if (!this.chatroomId) {
      this.log(
        'could not resolve chatroom id (Cloudflare?). Set KICK_CHATROOM_OVERRIDE="' +
          this.channel +
          ':<id>" in .env. Skipping Kick.',
      )
      return
    }
    this.log(`using chatroom id ${this.chatroomId}`)
    this.connect()
  }

  async resolveChatroomId() {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${this.channel}`, {
        headers: BROWSERY_HEADERS,
      })
      if (!res.ok) {
        this.log(`channel lookup HTTP ${res.status}`)
        return null
      }
      const data = await res.json()
      return data?.chatroom?.id ?? null
    } catch (err) {
      this.log('channel lookup failed:', err.message)
      return null
    }
  }

  connect() {
    if (this.stopped) return
    this.ws = new WebSocket(PUSHER_URL)

    this.ws.on('open', () => this.log('pusher socket open'))

    this.ws.on('message', (raw) => this.handleEvent(raw.toString()))

    this.ws.on('close', () => {
      this.connected = false
      if (this.stopped) return
      this.log(`disconnected, reconnecting in ${this.reconnectDelay}ms`)
      setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
    })

    this.ws.on('error', (err) => this.log('socket error:', err.message))
  }

  handleEvent(raw) {
    let frame
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }

    switch (frame.event) {
      case 'pusher:connection_established':
        // Connection is up — subscribe to this room's chat channel.
        this.ws.send(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel: `chatrooms.${this.chatroomId}.v2` },
          }),
        )
        this.connected = true
        this.reconnectDelay = 1000
        this.log('subscribed')
        break

      case 'pusher:ping':
        this.ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }))
        break

      case 'App\\Events\\ChatMessageEvent':
        this.handleChatMessage(frame.data)
        break

      default:
        // Other events (subscriptions, pins, deletes) are ignored for v1.
        break
    }
  }

  handleChatMessage(dataStr) {
    let msg
    try {
      msg = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr
    } catch {
      return
    }
    const sender = msg.sender || {}
    const identity = sender.identity || {}
    const badges = Array.isArray(identity.badges)
      ? identity.badges.map((b) => b.type).filter(Boolean)
      : []

    const content = msg.content || ''
    const fragments = buildKickFragments(content)
    // Plain-text fallback: replace [emote:id:name] tokens with just the name.
    const text = content.replace(KICK_EMOTE_RE, '$2')

    this.emitMessage(
      makeMessage({
        platform: 'kick',
        channel: this.channel,
        id: msg.id,
        name: sender.slug || sender.username,
        displayName: sender.username,
        color: identity.color || '',
        badges,
        text,
        fragments,
        timestamp: msg.created_at ? Date.parse(msg.created_at) : Date.now(),
      }),
    )
  }

  async stop() {
    this.stopped = true
    try {
      this.ws?.close()
    } catch {}
  }
}

// Kick embeds custom emotes inline in the message content as [emote:ID:name].
const KICK_EMOTE_RE = /\[emote:(\d+):([^\]]+)\]/g

function buildKickFragments(content) {
  KICK_EMOTE_RE.lastIndex = 0
  const frags = []
  let last = 0
  let m
  let found = false
  while ((m = KICK_EMOTE_RE.exec(content))) {
    found = true
    if (m.index > last) frags.push({ type: 'text', text: content.slice(last, m.index) })
    frags.push({
      type: 'emote',
      name: m[2],
      url: `https://files.kick.com/emotes/${m[1]}/fullsize`,
    })
    last = m.index + m[0].length
  }
  if (!found) return null
  if (last < content.length) frags.push({ type: 'text', text: content.slice(last) })
  return frags
}
