import crypto from 'node:crypto'
import { query } from '../db/pool.js'
import { randomToken } from '../utils/token.js'

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex')

// Issue a new token of `kind`, invalidating any prior unused ones for that
// user+kind. Returns the PLAINTEXT token to email; only its hash is stored.
export async function issue(userId, kind, ttlMs) {
  await query(`DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2 AND used_at IS NULL`, [
    userId,
    kind,
  ])
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + ttlMs)
  await query(
    `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, kind, sha256(token), expiresAt],
  )
  return token
}

// Validate + single-use consume. Returns the user_id on success, else null.
export async function consume(kind, token) {
  if (!token) return null
  const { rows } = await query(
    `SELECT id, user_id, expires_at, used_at FROM auth_tokens
     WHERE kind = $1 AND token_hash = $2`,
    [kind, sha256(token)],
  )
  const row = rows[0]
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return null
  await query(`UPDATE auth_tokens SET used_at = now() WHERE id = $1`, [row.id])
  return row.user_id
}
