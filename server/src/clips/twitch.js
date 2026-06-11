import { config } from '../config.js'

// Twitch clips via the Helix API using an app access token (client_credentials)
// — read-only public data, no user OAuth. Requires TWITCH_CLIENT_ID/SECRET; if
// they're not set, clips are simply empty. Tokens + lookups are cached.

let appToken = null // { token, exp }
const idCache = new Map() // login -> { id, at }
const clipsCache = new Map() // login -> { at, clips }
const ID_TTL = 24 * 60 * 60 * 1000
const CLIPS_TTL = 3 * 60 * 1000

async function getAppToken() {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null
  if (appToken && Date.now() < appToken.exp - 60000) return appToken.token
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        grant_type: 'client_credentials',
      }),
    })
    if (!res.ok) return null
    const d = await res.json()
    appToken = { token: d.access_token, exp: Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000) }
    return appToken.token
  } catch {
    return null
  }
}

async function helix(path, params) {
  const token = await getAppToken()
  if (!token) return null
  try {
    const res = await fetch(`https://api.twitch.tv/helix/${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': config.twitch.clientId },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function resolveUserId(login) {
  const key = login.toLowerCase()
  const c = idCache.get(key)
  if (c && Date.now() - c.at < ID_TTL) return c.id
  const d = await helix('users', { login: key })
  const id = d?.data?.[0]?.id || null
  if (id) idCache.set(key, { id, at: Date.now() })
  return id
}

export async function getTwitchClips(login, count = 24) {
  const key = login.toLowerCase()
  const cached = clipsCache.get(key)
  if (cached && Date.now() - cached.at < CLIPS_TTL) return cached.clips
  const id = await resolveUserId(key)
  if (!id) return cached?.clips || []
  const d = await helix('clips', { broadcaster_id: id, first: String(Math.min(50, count)) })
  if (!d) return cached?.clips || []
  const clips = (d.data || []).map((c) => ({
    id: c.id,
    platform: 'twitch',
    channel: key,
    title: c.title || 'Clip',
    url: c.url,
    video: null, // Twitch plays via iframe embed (built client-side from id)
    thumbnail: c.thumbnail_url || '',
    views: c.view_count || 0,
    creator: c.creator_name || '',
    createdAt: c.created_at || null,
    duration: Math.round(c.duration || 0),
  }))
  clipsCache.set(key, { at: Date.now(), clips })
  return clips
}
