import React from 'react'
import { Pin } from 'lucide-react'

// Inline brand marks (lucide dropped brand icons, so we ship our own).
const Marks = {
  twitch: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  ),
  kick: (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M4 4h7.2v5.6h2.4V7.2H16V4.8h7.2v6.4h-2.4v2.4h-2.4v2.4h2.4v2.4h2.4v6.4H16v-2.4h-2.4v-2.4h-2.4V28H4z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" />
    </svg>
  ),
}

const PLATFORM = {
  twitch: { label: 'Twitch', color: '#b794ff' },
  kick: { label: 'Kick', color: '#53fc18' },
  x: { label: 'X', color: '#e7e9ea' },
}

// Deterministic fallback color when the platform didn't send a name color.
const FALLBACK = ['#ff7f50', '#1e90ff', '#00ff7f', '#ff69b4', '#ffd700', '#7fffd4', '#ff4500', '#9acd32', '#da70d6', '#40e0d0']
function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

// Render the message body: custom emotes as <img>, everything else as text.
// (Unicode emoji live in the text and render natively.)
function Body({ msg }) {
  if (Array.isArray(msg.fragments) && msg.fragments.length) {
    return (
      <span className="msg-body">
        {msg.fragments.map((f, i) =>
          f.type === 'emote' ? (
            <img
              key={i}
              className="emote"
              src={f.url}
              alt={f.name}
              title={f.name}
              loading="lazy"
              onError={(e) => { e.currentTarget.replaceWith(document.createTextNode(f.name)) }}
            />
          ) : (
            <span key={i}>{f.text}</span>
          ),
        )}
      </span>
    )
  }
  return <span className="msg-body">{msg.text}</span>
}

function ChatMessageRow({
  msg,
  showBadges = true,
  showPlatform = true,
  platformStyle = 'label',
  platformPlain = false,
  showChannel = false,
  onPin,
}) {
  const p = PLATFORM[msg.platform] || { label: msg.platform, color: '#888' }
  const nameColor = msg.user.color || p.color || colorFor(msg.user.displayName || msg.user.name || '?')
  const iconOnly = platformStyle === 'logo' || platformStyle === 'icon'

  return (
    <div className="msg" data-platform={msg.platform}>
      {showPlatform && platformStyle !== 'hidden' && (
        <span className={`msg-platform ${iconOnly ? 'icon-only' : ''} ${platformPlain ? 'plain' : ''}`} title={p.label}>
          <span className="msg-platform-mark">{Marks[msg.platform] || null}</span>
          {!iconOnly && p.label}
        </span>
      )}
      <span className="msg-meta">
        {showBadges &&
          msg.user.badges?.map((b) => (
            <span key={b} className="user-badge" title={b}>
              {b[0]?.toUpperCase()}
            </span>
          ))}
        <span className="msg-name" style={{ color: nameColor }}>
          {msg.user.displayName || msg.user.name}
        </span>
        {showChannel && msg.channel && <span className="msg-channel">#{msg.channel}</span>}
      </span>
      <Body msg={msg} />
      {onPin && (
        <button className="msg-pin" title="Pin message" aria-label="Pin message" onClick={() => onPin(msg)}>
          <Pin size={14} />
        </button>
      )}
    </div>
  )
}

export default React.memo(ChatMessageRow)
