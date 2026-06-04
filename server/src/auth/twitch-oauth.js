import { config } from '../config.js'

// Minimal Twitch OAuth (authorization code flow) via fetch — no extra deps.
// Docs: https://dev.twitch.tv/docs/authentication/

const REDIRECT_URI = () => `${config.twitch.redirectBase}/api/auth/twitch/callback`

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: REDIRECT_URI(),
    response_type: 'code',
    scope: 'user:read:email',
    state,
  })
  return `https://id.twitch.tv/oauth2/authorize?${params}`
}

export async function exchangeCode(code) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI(),
    }),
  })
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`)
  return res.json()
}

export async function fetchTwitchUser(accessToken) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': config.twitch.clientId,
    },
  })
  if (!res.ok) throw new Error(`user fetch failed: HTTP ${res.status}`)
  const data = await res.json()
  const u = data.data?.[0]
  if (!u) throw new Error('no user returned')
  return { id: u.id, login: u.login, displayName: u.display_name, email: u.email || null }
}
