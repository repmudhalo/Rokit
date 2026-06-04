import { query } from '../db/pool.js'

const DEFAULTS = {
  font_size: 18,
  max_messages: 60,
  theme: 'shadow',
  show_badges: true,
  show_platform: true,
  platform_style: 'label',
  platform_plain: false,
  show_channel: false,
  message_bg: 'none',
  text_shadow: true,
  bg_opacity: 0,
}

// Always returns a settings row, creating defaults on first access.
export async function get(userId) {
  const { rows } = await query(`SELECT * FROM overlay_settings WHERE user_id = $1`, [userId])
  if (rows[0]) return rows[0]
  const { rows: created } = await query(
    `INSERT INTO overlay_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId],
  )
  return created[0]
}

const FIELDS = [
  'font_size', 'max_messages', 'theme', 'show_badges', 'show_platform',
  'platform_style', 'platform_plain', 'show_channel', 'message_bg', 'text_shadow', 'bg_opacity',
]

export async function update(userId, patch) {
  await get(userId) // ensure row exists
  const sets = []
  const vals = [userId]
  for (const f of FIELDS) {
    if (patch[f] !== undefined) {
      vals.push(patch[f])
      sets.push(`${f} = $${vals.length}`)
    }
  }
  if (!sets.length) return get(userId)
  sets.push('updated_at = now()')
  const { rows } = await query(
    `UPDATE overlay_settings SET ${sets.join(', ')} WHERE user_id = $1 RETURNING *`,
    vals,
  )
  return rows[0]
}

export { DEFAULTS }
