import { Router } from 'express'
import * as users from '../repos/users.js'

export const overlayRouter = Router()

// The overlay token lives on the user row; expose it + the ready-to-use URL.
const overlayUrl = (req, token) => {
  const base = `${req.protocol}://${req.get('host')}`
  return `${base}/overlay?token=${token}`
}

overlayRouter.get('/', async (req, res) => {
  const u = await users.findById(req.user.id)
  res.json({ token: u.overlay_token, url: overlayUrl(req, u.overlay_token) })
})

// Rotate the token (old OBS URLs stop working — useful if a token leaks).
overlayRouter.post('/rotate', async (req, res) => {
  const token = await users.rotateOverlayToken(req.user.id)
  res.json({ token, url: overlayUrl(req, token) })
})
