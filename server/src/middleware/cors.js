import { config } from '../config.js'

// Minimal credentialed CORS for the split deploy (e.g. a Vercel frontend talking
// to this API on another origin). Only origins listed in CORS_ORIGIN are allowed,
// and credentials are permitted so the cross-site session cookie is sent.
//
// When CORS_ORIGIN is empty (integrated/same-origin deploy) this is a no-op:
// same-origin requests don't need the headers and never preflight.
export function cors(req, res, next) {
  const origin = req.headers.origin

  if (origin && config.corsOrigins.includes(origin.replace(/\/$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type',
      )
      res.setHeader('Access-Control-Max-Age', '600')
      return res.sendStatus(204)
    }
  } else if (req.method === 'OPTIONS') {
    // Preflight from an origin we don't allow — end it without CORS headers.
    return res.sendStatus(204)
  }

  next()
}
