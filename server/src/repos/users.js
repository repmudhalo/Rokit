import { query } from '../db/pool.js'
import { randomToken } from '../utils/token.js'

// Columns safe to expose to the client (never password_hash).
const PUBLIC =
  'id, email, display_name, twitch_id, twitch_login, overlay_token, email_verified, created_at'

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [id])
  return rows[0] || null
}

export async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, email, password_hash, display_name, twitch_id, twitch_login, overlay_token
     FROM users WHERE lower(email) = lower($1)`,
    [email],
  )
  return rows[0] || null
}

export async function findByTwitchId(twitchId) {
  const { rows } = await query(`SELECT ${PUBLIC} FROM users WHERE twitch_id = $1`, [twitchId])
  return rows[0] || null
}

export async function findByOverlayToken(token) {
  const { rows } = await query(`SELECT id FROM users WHERE overlay_token = $1`, [token])
  return rows[0] || null
}

export async function createWithPassword({ email, passwordHash, displayName }) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, display_name, overlay_token)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC}`,
    [email, passwordHash, displayName || email.split('@')[0], randomToken()],
  )
  return rows[0]
}

export async function createWithTwitch({ twitchId, twitchLogin, displayName, email }) {
  // Twitch has already verified the user's email, so trust it.
  const { rows } = await query(
    `INSERT INTO users (twitch_id, twitch_login, display_name, email, overlay_token, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC}`,
    [twitchId, twitchLogin, displayName || twitchLogin, email || null, randomToken(), Boolean(email)],
  )
  return rows[0]
}

// Link a Twitch identity onto an existing (email) account.
export async function linkTwitch(userId, { twitchId, twitchLogin }) {
  const { rows } = await query(
    `UPDATE users SET twitch_id = $2, twitch_login = $3 WHERE id = $1 RETURNING ${PUBLIC}`,
    [userId, twitchId, twitchLogin],
  )
  return rows[0]
}

export async function rotateOverlayToken(userId) {
  const token = randomToken()
  await query(`UPDATE users SET overlay_token = $2 WHERE id = $1`, [userId, token])
  return token
}

export async function getPasswordHash(userId) {
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId])
  return rows[0]?.password_hash || null
}

export async function setPassword(userId, passwordHash) {
  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash])
}

export async function setEmailVerified(userId, verified = true) {
  const { rows } = await query(
    `UPDATE users SET email_verified = $2 WHERE id = $1 RETURNING ${PUBLIC}`,
    [userId, verified],
  )
  return rows[0] || null
}

export async function updateDisplayName(userId, displayName) {
  const { rows } = await query(
    `UPDATE users SET display_name = $2 WHERE id = $1 RETURNING ${PUBLIC}`,
    [userId, displayName],
  )
  return rows[0]
}

// Change email and force re-verification. Caller should issue a new verify token.
export async function updateEmail(userId, email) {
  const { rows } = await query(
    `UPDATE users SET email = $2, email_verified = false WHERE id = $1 RETURNING ${PUBLIC}`,
    [userId, email],
  )
  return rows[0]
}
