import rateLimit from 'express-rate-limit'

// Strict limiter for credential / email endpoints — brute-force & abuse guard.
// ~20 attempts per IP per 15 minutes.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too many attempts — please try again in a few minutes' },
})

// Generous catch-all limiter for the rest of the API (lets the dashboard poll
// freely while still capping runaway/abusive traffic). ~600 req/IP/min.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate limit exceeded' },
})
