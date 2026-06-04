import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage.jsx'

// Renders the merged message list and keeps it pinned to the bottom as new
// messages arrive — unless the user has scrolled up to read history.
export default function ChatList({ messages, className = '', options = {}, onPin }) {
  const ref = useRef(null)
  const pinnedRef = useRef(true)

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    // Stay pinned unless the user has scrolled meaningfully up to read history.
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // Pin to the bottom after the new rows have laid out (rAF), so live messages
  // stream into view instead of accumulating below the fold.
  useEffect(() => {
    if (!pinnedRef.current || !ref.current) return
    const el = ref.current
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [messages])

  return (
    <div className={`chat-list ${className}`} ref={ref} onScroll={onScroll}>
      {messages.map((m) => (
        <ChatMessage
          key={m.id}
          msg={m}
          showBadges={options.showBadges !== false}
          showPlatform={options.showPlatform !== false}
          platformStyle={options.platformStyle}
          platformPlain={options.platformPlain}
          showChannel={options.showChannel}
          onPin={onPin}
        />
      ))}
    </div>
  )
}
