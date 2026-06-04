import { query } from '../db/pool.js'

export async function list(userId) {
  const { rows } = await query(
    `SELECT id, platform, channel, chatroom_id, enabled, created_at
     FROM sources WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  )
  return rows
}

export async function listEnabled(userId) {
  const { rows } = await query(
    `SELECT id, platform, channel, chatroom_id
     FROM sources WHERE user_id = $1 AND enabled = true`,
    [userId],
  )
  return rows
}

export async function countForUser(userId) {
  const { rows } = await query(`SELECT count(*)::int AS n FROM sources WHERE user_id = $1`, [userId])
  return rows[0].n
}

export async function create(userId, { platform, channel, chatroomId }) {
  const { rows } = await query(
    `INSERT INTO sources (user_id, platform, channel, chatroom_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, platform, channel, chatroom_id, enabled, created_at`,
    [userId, platform, channel, chatroomId || null],
  )
  return rows[0]
}

export async function setEnabled(userId, id, enabled) {
  const { rows } = await query(
    `UPDATE sources SET enabled = $3 WHERE id = $2 AND user_id = $1
     RETURNING id, platform, channel, chatroom_id, enabled, created_at`,
    [userId, id, enabled],
  )
  return rows[0] || null
}

export async function remove(userId, id) {
  const { rowCount } = await query(`DELETE FROM sources WHERE id = $2 AND user_id = $1`, [userId, id])
  return rowCount > 0
}
