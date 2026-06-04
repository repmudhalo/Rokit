import { Router } from 'express'
import * as users from '../repos/users.js'
import * as tokens from '../repos/tokens.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { sendVerificationEmail } from '../mail/templates.js'

export const profileRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VERIFY_TTL = 24 * 60 * 60 * 1000

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  twitchLogin: u.twitch_login,
  emailVerified: u.email_verified,
})

// Update display name and/or email. Changing email forces re-verification.
profileRouter.put('/', async (req, res) => {
  const { displayName, email } = req.body || {}
  let user = req.user

  if (typeof displayName === 'string' && displayName.trim()) {
    user = await users.updateDisplayName(user.id, displayName.trim().slice(0, 80))
  }

  if (typeof email === 'string' && email !== user.email) {
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })
    const existing = await users.findByEmail(email)
    if (existing && String(existing.id) !== String(user.id))
      return res.status(409).json({ error: 'that email is already in use' })
    user = await users.updateEmail(user.id, email)
    const token = await tokens.issue(user.id, 'verify_email', VERIFY_TTL)
    await sendVerificationEmail(user, token)
  }

  res.json({ user: publicUser(user) })
})

// Change password. Accounts that already have a password must supply the
// current one; OAuth-only accounts can set an initial password without it.
profileRouter.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'new password must be at least 8 characters' })

  const currentHash = await users.getPasswordHash(req.user.id)
  if (currentHash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, currentHash)))
      return res.status(401).json({ error: 'current password is incorrect' })
  }

  await users.setPassword(req.user.id, await hashPassword(newPassword))
  res.json({ ok: true, hadPassword: Boolean(currentHash) })
})
