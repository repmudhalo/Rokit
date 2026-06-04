import React, { useEffect, useMemo } from 'react'
import { useChatSocket } from '../useChatSocket.js'
import ChatList from '../ChatList.jsx'
import { appearanceFrom } from '../appearance.js'

// Transparent OBS overlay. Unauthenticated — identified only by ?token=.
// Appearance comes from the user's saved settings (pushed over the socket),
// with optional URL overrides: ?size=, ?max=.
export default function Overlay() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') || ''
  const sizeOverride = Number(params.get('size')) || null
  const maxOverride = Number(params.get('max')) || null

  const { messages, config } = useChatSocket({ token, max: 200 })

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  const a = appearanceFrom(config || {})
  const maxMessages = maxOverride || a.maxMessages
  const style = { ...a.containerStyle }
  if (sizeOverride) style.fontSize = `${sizeOverride}px`

  const visible = useMemo(() => messages.slice(-maxMessages), [messages, maxMessages])

  if (!token) {
    return <div className="overlay-error">Missing overlay token. Copy the overlay URL from your dashboard.</div>
  }

  return (
    <div className="overlay" style={style}>
      <ChatList messages={visible} className={`overlay-list ${a.listClassName}`} options={a.options} />
    </div>
  )
}
