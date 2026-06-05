import React, { useEffect } from 'react'
import { useChatSocket } from '../useChatSocket.js'
import { useHype, normalizeHype } from '../hype.js'
import HypeMeter from '../HypeMeter.jsx'

// Transparent OBS/Streamlabs overlay for the Chat Hype Meter. Unauthenticated —
// identified only by ?token=. Config comes from the user's saved hype settings
// (pushed over the socket), with optional URL overrides: ?style=, ?label=.
export default function Hype() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') || ''
  const styleOverride = params.get('style')
  const labelOverride = params.get('label')

  const { messages, config } = useChatSocket({ token, max: 120 })

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  const cfg = normalizeHype({
    ...(config?.hype || {}),
    ...(styleOverride ? { style: styleOverride } : {}),
    ...(labelOverride != null ? { label: labelOverride } : {}),
  })
  const level = useHype(messages, cfg)

  if (!token) {
    return <div className="overlay-error">Missing overlay token. Copy the Hype Meter URL from your dashboard.</div>
  }

  return (
    <div className="overlay hype-overlay">
      <HypeMeter level={level} cfg={cfg} />
    </div>
  )
}
