import jwt from 'jsonwebtoken'
import { config } from '../config.js'

// Stateless sessions: a signed JWT carrying the user id, stored in an
// httpOnly cookie. No server-side session table needed.

const MAX_AGE_DAYS = 30

export function signSession(userId) {
  return jwt.sign({ uid: String(userId) }, config.sessionSecret, {
    expiresIn: `${MAX_AGE_DAYS}d`,
  })
}

export function verifySession(token) {
  try {
    const payload = jwt.verify(token, config.sessionSecret)
    return payload.uid || null
  } catch {
    return null
  }
}

// SameSite=None (cross-site cookies) is only honoured by browsers when Secure,
// so force Secure whenever the cookie is cross-site.
const sameSite = config.cookieSameSite
const secure = config.cookieSecure || sameSite === 'none'

export function setSessionCookie(res, userId) {
  res.cookie(config.cookieName, signSession(userId), {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, { path: '/', sameSite, secure })
}

// Short-lived signed state for the OAuth round-trip (CSRF protection).
export function signOAuthState(value) {
  return jwt.sign({ s: value }, config.sessionSecret, { expiresIn: '10m' })
}
export function verifyOAuthState(token) {
  try {
    return jwt.verify(token, config.sessionSecret).s || null
  } catch {
    return null
  }
}
