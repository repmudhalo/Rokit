import { query } from '../db/pool.js'

// Hype clip markers — timestamped chat-activity spikes for VOD clipping.

export async function insert(userId, { at, intoMs, rate }) {
  await query(
    `INSERT INTO hype_markers (user_id, at, into_ms, rate) VALUES ($1, $2, $3, $4)`,
    [userId, new Date(at), Math.round(intoMs) || 0, Math.round(rate) || 0],
  )
}

export async function recent(userId, limit = 50) {
  const { rows } = await query(
    `SELECT id, at, into_ms, rate FROM hype_markers WHERE user_id = $1 ORDER BY at DESC LIMIT $2`,
    [userId, Math.min(200, Math.max(1, limit))],
  )
  return rows
}

export async function remove(userId, id) {
  await query(`DELETE FROM hype_markers WHERE user_id = $1 AND id = $2`, [userId, id])
}

export async function clear(userId) {
  await query(`DELETE FROM hype_markers WHERE user_id = $1`, [userId])
}
