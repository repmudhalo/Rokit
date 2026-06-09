// Third-party emotes (7TV · BetterTTV · FrankerFaceZ) for Twitch channels.
// Fetches global + per-channel emote sets and returns a Map of
//   code -> { url, provider }
// keyed by the exact word a chatter types. Results are cached in-memory with a
// TTL so we don't hammer the providers. All network failures degrade silently —
// emotes are a nicety, never allowed to break chat.

const TTL_MS = 60 * 60 * 1000 // refresh a channel's set at most hourly
const FETCH_TIMEOUT = 6000

const channelCache = new Map() // roomId -> { at, map }
let globalCache = null // { at, map }

async function fetchJson(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const bttvImg = (id) => `https://cdn.betterttv.net/emote/${id}/2x`
const seventvImg = (id) => `https://cdn.7tv.app/emote/${id}/2x.webp`

// Each parser returns [{ code, url, provider }].
const parseBttvGlobal = (j) =>
  Array.isArray(j) ? j.map((e) => ({ code: e.code, url: bttvImg(e.id), provider: 'bttv' })) : []

const parseBttvUser = (j) =>
  j ? [...(j.channelEmotes || []), ...(j.sharedEmotes || [])].map((e) => ({ code: e.code, url: bttvImg(e.id), provider: 'bttv' })) : []

function parseFfz(j) {
  if (!j || !j.sets) return []
  const out = []
  for (const set of Object.values(j.sets)) {
    for (const e of set.emoticons || []) {
      const urls = e.urls || {}
      const u = urls['2'] || urls['4'] || urls['1']
      if (u) out.push({ code: e.name, url: u.startsWith('http') ? u : `https:${u}`, provider: 'ffz' })
    }
  }
  return out
}

const parseSeventv = (emoteSet) =>
  Array.isArray(emoteSet?.emotes)
    ? emoteSet.emotes.map((e) => ({ code: e.name, url: seventvImg(e.id), provider: '7tv' }))
    : []

// First writer wins, so push higher-priority lists first.
function addAll(map, list) {
  for (const e of list) {
    if (e?.code && e.url && !map.has(e.code)) map.set(e.code, { url: e.url, provider: e.provider })
  }
}

async function loadGlobal() {
  if (globalCache && Date.now() - globalCache.at < TTL_MS) return globalCache.map
  const [bttv, ffz, stv] = await Promise.all([
    fetchJson('https://api.betterttv.net/3/cached/emotes/global'),
    fetchJson('https://api.frankerfacez.com/v1/set/global'),
    fetchJson('https://7tv.io/v3/emote-sets/global'),
  ])
  const map = new Map()
  addAll(map, parseSeventv(stv))
  addAll(map, parseBttvGlobal(bttv))
  addAll(map, parseFfz(ffz))
  globalCache = { at: Date.now(), map }
  return map
}

// Resolve the full emote map for a Twitch channel (by its numeric room/user id).
// Channel emotes take priority over globals on a code clash.
export async function getTwitchEmotes(roomId) {
  const global = await loadGlobal()
  if (!roomId) return global

  const cached = channelCache.get(roomId)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map

  const [bttv, ffz, stv] = await Promise.all([
    fetchJson(`https://api.betterttv.net/3/cached/users/twitch/${roomId}`),
    fetchJson(`https://api.frankerfacez.com/v1/room/id/${roomId}`),
    fetchJson(`https://7tv.io/v3/users/twitch/${roomId}`),
  ])
  const map = new Map()
  addAll(map, parseSeventv(stv?.emote_set))
  addAll(map, parseBttvUser(bttv))
  addAll(map, parseFfz(ffz))
  for (const [code, val] of global) if (!map.has(code)) map.set(code, val) // fill globals
  channelCache.set(roomId, { at: Date.now(), map })
  return map
}

// Replace whole-word emote codes in the text fragments with emote fragments.
// Native (Twitch/Kick) emote fragments pass through untouched.
export function expandThirdPartyEmotes(fragments, emoteMap) {
  if (!emoteMap || emoteMap.size === 0 || !fragments) return fragments
  const out = []
  for (const f of fragments) {
    if (f.type !== 'text' || !f.text) { out.push(f); continue }
    let buf = ''
    for (const part of f.text.split(/(\s+)/)) {
      const hit = part && !/^\s/.test(part) ? emoteMap.get(part) : null
      if (hit) {
        if (buf) { out.push({ type: 'text', text: buf }); buf = '' }
        out.push({ type: 'emote', name: part, url: hit.url })
      } else {
        buf += part
      }
    }
    if (buf) out.push({ type: 'text', text: buf })
  }
  return out
}
