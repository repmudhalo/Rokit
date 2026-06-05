import { Router } from 'express'
import * as users from '../repos/users.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import {
  setSessionCookie,
  clearSessionCookie,
  signOAuthState,
  verifyOAuthState,
} from '../auth/session.js'
import { config, oauthEnabled } from '../config.js'
import { buildAuthorizeUrl, exchangeCode, fetchTwitchUser } from '../auth/twitch-oauth.js'
import { requireAuth } from '../auth/middleware.js'
import { authLimiter } from '../middleware/ratelimit.js'
import * as tokens from '../repos/tokens.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../mail/templates.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VERIFY_TTL = 24 * 60 * 60 * 1000 // 24h
const RESET_TTL = 60 * 60 * 1000 // 1h

// Shape a user row for the client (drop internal fields).
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  twitchLogin: u.twitch_login,
  emailVerified: u.email_verified,
})

// Issue a verification token and email it.
async function sendVerify(user) {
  const token = await tokens.issue(user.id, 'verify_email', VERIFY_TTL)
  await sendVerificationEmail(user, token)
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const { email, password, displayName } = req.body || {}
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'invalid email' })
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'password must be at least 8 characters' })

  if (await users.findByEmail(email))
    return res.status(409).json({ error: 'an account with that email already exists' })

  const passwordHash = await hashPassword(password)
  const user = await users.createWithPassword({ email, passwordHash, displayName })
  setSessionCookie(res, user.id)
  await sendVerify(user)
  res.status(201).json({ user: publicUser(user) })
})

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {}
  const user = await users.findByEmail(email || '')
  if (!user || !user.password_hash || !(await verifyPassword(password || '', user.password_hash)))
    return res.status(401).json({ error: 'invalid email or password' })

  setSessionCookie(res, user.id)
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null, oauth: { twitch: oauthEnabled() } })
})

// ── email verification ───────────────────────────────────────────────────────
authRouter.post('/verify-email', authLimiter, async (req, res) => {
  const userId = await tokens.consume('verify_email', req.body?.token)
  if (!userId) return res.status(400).json({ error: 'invalid or expired link' })
  await users.setEmailVerified(userId, true)
  res.json({ ok: true })
})

authRouter.post('/verify-email/resend', authLimiter, requireAuth, async (req, res) => {
  if (!req.user.email) return res.status(400).json({ error: 'account has no email' })
  if (req.user.email_verified) return res.json({ ok: true, alreadyVerified: true })
  await sendVerify(req.user)
  res.json({ ok: true })
})

// ── password reset ───────────────────────────────────────────────────────────
authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const email = req.body?.email
  if (EMAIL_RE.test(email || '')) {
    const user = await users.findByEmail(email)
    // Only for accounts that actually have a password (not OAuth-only).
    if (user && user.password_hash) {
      const token = await tokens.issue(user.id, 'reset_password', RESET_TTL)
      await sendPasswordResetEmail({ ...user, display_name: user.display_name }, token)
    }
  }
  // Always 200 — never reveal whether an email is registered.
  res.json({ ok: true })
})

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body || {}
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  const userId = await tokens.consume('reset_password', token)
  if (!userId) return res.status(400).json({ error: 'invalid or expired link' })

  await users.setPassword(userId, await hashPassword(password))
  // Completing a reset proves control of the inbox, so confirm the email too.
  await users.setEmailVerified(userId, true)
  res.json({ ok: true })
})

// ── Twitch OAuth ────────────────────────────────────────────────────────────
authRouter.get('/twitch', (req, res) => {
  if (!oauthEnabled()) return res.status(501).send('Twitch OAuth is not configured')
  // CSRF state stored in a short-lived signed cookie and echoed in the URL.
  const state = signOAuthState(String(Date.now()))
  res.cookie('chataggr_oauth_state', state, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  })
  res.redirect(buildAuthorizeUrl(state))
})

authRouter.get('/twitch/callback', async (req, res) => {
  if (!oauthEnabled()) return res.status(501).send('Twitch OAuth is not configured')
  const { code, state } = req.query
  const cookieState = req.cookies?.chataggr_oauth_state
  res.clearCookie('chataggr_oauth_state', { path: '/' })

  if (!code || !state || state !== cookieState || !verifyOAuthState(state)) {
    return res.redirect(`${config.appUrl}/login?error=oauth_state`)
  }

  try {
    const token = await exchangeCode(code)
    const tw = await fetchTwitchUser(token.access_token)

    // Existing Twitch account → log in. Else link to a matching email account,
    // else create a fresh Twitch-only account.
    let user = await users.findByTwitchId(tw.id)
    if (!user && tw.email) {
      const byEmail = await users.findByEmail(tw.email)
      if (byEmail) user = await users.linkTwitch(byEmail.id, { twitchId: tw.id, twitchLogin: tw.login })
    }
    if (!user) {
      user = await users.createWithTwitch({
        twitchId: tw.id,
        twitchLogin: tw.login,
        displayName: tw.displayName,
        email: tw.email,
      })
    }

    setSessionCookie(res, user.id)
    res.redirect(`${config.appUrl}/dashboard`)
  } catch (err) {
    console.error('[oauth] twitch callback failed:', err.message)
    res.redirect(`${config.appUrl}/login?error=oauth_failed`)
  }
})
