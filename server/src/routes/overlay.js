import { Router } from 'express'
import { config } from '../config.js'
import * as users from '../repos/users.js'

export const overlayRouter = Router()

// The overlay token lives on the user row; expose it + the ready-to-use URLs.
// Overlays are frontend routes, so point at APP_URL (the public frontend);
// fall back to the request host for a plain integrated/same-origin deploy.
const overlayBase = (req) => config.appUrl || `${req.protocol}://${req.get('host')}`
const urlsFor = (req, token) => {
  const base = overlayBase(req)
  return {
    token,
    url: `${base}/overlay?token=${token}`, // chat overlay
    hypeUrl: `${base}/hype?token=${token}`, // chat hype meter
  }
}

overlayRouter.get('/', async (req, res) => {
  const u = await users.findById(req.user.id)
  res.json(urlsFor(req, u.overlay_token))
})

// Rotate the token (old OBS URLs stop working — useful if a token leaks).
overlayRouter.post('/rotate', async (req, res) => {
  const token = await users.rotateOverlayToken(req.user.id)
  res.json(urlsFor(req, token))
})
