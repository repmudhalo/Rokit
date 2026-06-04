import { TwitchSource } from './twitch.js'
import { KickSource } from './kick.js'
import { XSource } from './x.js'

// Build a live ChatSource from a stored `sources` row.
// X is experimental/unofficial (Periscope chatman) — see x.js.
export function buildSource(row) {
  switch (row.platform) {
    case 'twitch':
      return new TwitchSource({ channel: row.channel })
    case 'kick':
      return new KickSource({ channel: row.channel, chatroomId: row.chatroom_id || null })
    case 'x':
      return new XSource({ channel: row.channel })
    default:
      return null
  }
}

export const SUPPORTED_PLATFORMS = ['twitch', 'kick', 'x']
