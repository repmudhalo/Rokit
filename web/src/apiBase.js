// Where the backend lives. For a split deploy (frontend on Vercel, API on
// another host) set VITE_API_BASE at build time, e.g.
//   VITE_API_BASE=https://api.rokit.app
// Leave it unset for an integrated/same-origin deploy (the Node server serves
// this frontend), in which case all calls stay relative.
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

// Absolute URL for a REST path (relative when same-origin).
export function apiUrl(path) {
  return API_BASE + path
}

// ws:// or wss:// URL for the chat socket.
export function wsUrl(path) {
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + path
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}${path}`
}
