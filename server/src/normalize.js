// The single canonical chat-message shape every source must emit.
// Keeping one shape is what lets the overlay treat Twitch/Kick/X identically
// and lets new platforms be added without touching the frontend.
//
// {
//   id:        string   // unique per message (platform-prefixed)
//   platform:  'twitch' | 'kick' | 'x'
//   channel:   string   // which channel/room it came from
//   user: {
//     name:        string   // login / handle
//     displayName: string   // shown name (may differ in case/locale)
//     color:       string   // hex color for the name, or '' to auto-pick
//     badges:      string[] // e.g. ['moderator', 'subscriber']
//   }
//   text:      string
//   timestamp: number   // ms epoch
// }

let counter = 0

// `fragments` (optional) is an ordered array describing the message body with
// inline custom emotes:
//   { type: 'text',  text: '...' }
//   { type: 'emote', name: 'Kappa', url: 'https://.../emote.png' }
// When present the client renders fragments (emotes as <img>); otherwise it
// falls back to `text`. Unicode emoji (😂🔥) live in the text and need no help.
export function makeMessage({
  platform,
  channel,
  name,
  displayName,
  color = '',
  badges = [],
  text,
  fragments,
  id,
  timestamp,
}) {
  return {
    id: id || `${platform}-${Date.now()}-${counter++}`,
    platform,
    channel: channel || '',
    user: {
      name: name || '',
      displayName: displayName || name || '',
      color: color || '',
      badges: Array.isArray(badges) ? badges : [],
    },
    text: text || '',
    ...(Array.isArray(fragments) && fragments.length ? { fragments } : {}),
    timestamp: timestamp || Date.now(),
  }
}
