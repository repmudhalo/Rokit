// Twitch chat via anonymous IRC-over-WebSocket. No API key or OAuth needed
// for read-only access: we log in as an anonymous "justinfan" user.
// Docs: https://dev.twitch.tv/docs/irc/

import WebSocket from 'ws'
import { ChatSource } from './base.js'
import { makeMessage } from '../normalize.js'
import { getTwitchEmotes, expandThirdPartyEmotes } from '../emotes/thirdparty.js'

const TWITCH_IRC_WS = 'wss://irc-ws.chat.twitch.tv:443'

export class TwitchSource extends ChatSource {
  constructor({ channel }) {
    super({ platform: 'twitch', channel: channel.toLowerCase().replace(/^#/, '') })
    this.ws = null
    this.stopped = false
    this.reconnectDelay = 1000
    this.emotes = new Map() // 7TV/BTTV/FFZ: code -> { url } (lazy-loaded by room-id)
    this.emoteRoomId = null
  }

  async start() {
    this.stopped = false
    this.connect()
  }

  connect() {
    if (this.stopped) return
    this.ws = new WebSocket(TWITCH_IRC_WS)

    this.ws.on('open', () => {
      // Request tags (display-name, color, badges, emotes) + membership.
      this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      // Anonymous read-only login.
      const anon = `justinfan${Math.floor(Math.random() * 80000 + 1000)}`
      this.ws.send(`NICK ${anon}`)
      this.ws.send(`JOIN #${this.channel}`)
      this.connected = true
      this.reconnectDelay = 1000
      this.log('connected')
    })

    this.ws.on('message', (data) => this.handleLines(data.toString()))

    this.ws.on('close', () => {
      this.connected = false
      if (this.stopped) return
      this.log(`disconnected, reconnecting in ${this.reconnectDelay}ms`)
      setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
    })

    this.ws.on('error', (err) => this.log('socket error:', err.message))
  }

  handleLines(raw) {
    for (const line of raw.split('\r\n')) {
      if (!line) continue
      // Twitch pings to keep the connection alive; we must pong back.
      if (line.startsWith('PING')) {
        this.ws.send('PONG :tmi.twitch.tv')
        continue
      }
      this.handleLine(line)
    }
  }

  handleLine(line) {
    const parsed = parseIRC(line)
    if (parsed.command !== 'PRIVMSG') return

    const tags = parsed.tags
    const badges = tags['badges']
      ? tags['badges'].split(',').map((b) => b.split('/')[0]).filter(Boolean)
      : []

    // The channel's Twitch user id arrives on every message; use it to lazily
    // load this channel's 7TV/BTTV/FFZ emote set (cached, one fetch per channel).
    const roomId = tags['room-id']
    if (roomId && this.emoteRoomId !== roomId) {
      this.emoteRoomId = roomId
      getTwitchEmotes(roomId).then((m) => { this.emotes = m }).catch(() => {})
    }

    // Native Twitch emotes first, then expand any third-party codes in the text.
    let fragments = buildTwitchFragments(parsed.text, tags['emotes'])
    if (this.emotes.size) {
      const expanded = expandThirdPartyEmotes(fragments || [{ type: 'text', text: parsed.text }], this.emotes)
      if (expanded.some((f) => f.type === 'emote')) fragments = expanded
    }

    this.emitMessage(
      makeMessage({
        platform: 'twitch',
        channel: this.channel,
        id: tags['id'],
        name: parsed.nick,
        displayName: tags['display-name'] || parsed.nick,
        color: tags['color'] || '',
        badges,
        text: parsed.text,
        fragments,
        timestamp: tags['tmi-sent-ts'] ? Number(tags['tmi-sent-ts']) : Date.now(),
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

// Turn Twitch's `emotes` tag into ordered text/emote fragments.
// Tag format: "<id>:<start>-<end>,<start>-<end>/<id>:<start>-<end>"
// Positions are 0-indexed, inclusive, in Unicode CODE POINTS of the message —
// so we slice via Array.from() rather than string indices.
function buildTwitchFragments(text, emotesTag) {
  if (!emotesTag) return null
  const ranges = []
  for (const part of emotesTag.split('/')) {
    const [id, positions] = part.split(':')
    if (!id || !positions) continue
    for (const pos of positions.split(',')) {
      const [s, e] = pos.split('-').map(Number)
      if (Number.isInteger(s) && Number.isInteger(e)) ranges.push({ id, start: s, end: e })
    }
  }
  if (!ranges.length) return null
  ranges.sort((a, b) => a.start - b.start)

  const chars = Array.from(text)
  const frags = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start > cursor) frags.push({ type: 'text', text: chars.slice(cursor, r.start).join('') })
    frags.push({
      type: 'emote',
      name: chars.slice(r.start, r.end + 1).join(''),
      url: `https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0`,
    })
    cursor = r.end + 1
  }
  if (cursor < chars.length) frags.push({ type: 'text', text: chars.slice(cursor).join('') })
  return frags
}

// Minimal IRCv3 parser covering the tagged PRIVMSG shape Twitch sends:
//   @tag=val;tag2=val2 :nick!nick@nick.tmi.twitch.tv PRIVMSG #chan :message
function parseIRC(line) {
  const out = { tags: {}, nick: '', command: '', params: [], text: '' }
  let rest = line

  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ')
    const tagStr = rest.slice(1, sp)
    rest = rest.slice(sp + 1)
    for (const pair of tagStr.split(';')) {
      const eq = pair.indexOf('=')
      const key = eq === -1 ? pair : pair.slice(0, eq)
      const val = eq === -1 ? '' : pair.slice(eq + 1)
      out.tags[key] = unescapeTag(val)
    }
  }

  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ')
    const prefix = rest.slice(1, sp)
    rest = rest.slice(sp + 1)
    out.nick = prefix.split('!')[0]
  }

  // command + params, with the trailing ":message" portion separated out.
  const trailingIdx = rest.indexOf(' :')
  let head = rest
  if (trailingIdx !== -1) {
    head = rest.slice(0, trailingIdx)
    out.text = rest.slice(trailingIdx + 2)
  }
  const headParts = head.split(' ')
  out.command = headParts[0]
  out.params = headParts.slice(1)
  return out
}

// IRCv3 tag value unescaping (\s -> space, \: -> ;, etc.)
function unescapeTag(v) {
  return v
    .replace(/\\s/g, ' ')
    .replace(/\\:/g, ';')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\')
}
