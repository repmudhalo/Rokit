import { verifySession } from './session.js'
import { config } from '../config.js'
import * as users from '../repos/users.js'

// Resolves the session cookie to req.user (or null). Never blocks.
export async function attachUser(req, _res, next) {
  req.user = null
  const token = req.cookies?.[config.cookieName]
  if (token) {
    const uid = verifySession(token)
    if (uid) req.user = await users.findById(uid).catch(() => null)
  }
  next()
}

// Blocks unauthenticated requests with 401.
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' })
  next()
}
