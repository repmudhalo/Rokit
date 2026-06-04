import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Tv, MonitorPlay, UserRound, Link2, SlidersHorizontal, KeyRound, Eye, Copy, RefreshCw, ExternalLink, Plus, Trash2, Activity, MessageSquare, Pin, X, Search, Gauge, Pause, Image,
  ALargeSmall, List, Contrast, Tag, EyeOff, SquareDashed, RectangleHorizontal, Frame, Type, BadgeCheck, Hash,
} from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { useChatSocket } from '../useChatSocket.js'
import ChatList from '../ChatList.jsx'
import { appearanceFrom } from '../appearance.js'

const TABS = {
  live: { title: 'Live', sub: 'Realtime stream activity and merged chat.' },
  channels: { title: 'Channels', sub: 'Connect the platforms you stream on.' },
  overlay: { title: 'Overlay', sub: 'Your OBS browser-source URL and appearance.' },
  account: { title: 'Account', sub: 'Profile, email and password.' },
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'live'

  const [sources, setSources] = useState([])
  const [overlay, setOverlay] = useState({ token: '', url: '' })
  const [settings, setSettings] = useState(null)

  const loadAll = async () => {
    const [s, o, st] = await Promise.all([
      api.get('/api/sources'),
      api.get('/api/overlay'),
      api.get('/api/settings'),
    ])
    setSources(s.sources)
    setOverlay(o)
    setSettings(st.settings)
  }
  useEffect(() => { loadAll().catch((e) => console.error(e)) }, [])

  const name = user?.displayName || user?.email || user?.twitchLogin || '?'

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-title">
          <h1>{TABS[tab].title}</h1>
          <p>{TABS[tab].sub}</p>
        </div>
        <div className="dash-user">
          <span className="user-chip">
            <span className="avatar">{name[0]?.toUpperCase()}</span>
            {name}
          </span>
          <button className="btn ghost sm" onClick={logout}>Log out</button>
        </div>
      </header>

      <VerifyBanner />

      <div className={`dash-body ${tab === 'live' ? 'live' : ''}`}>
        {tab === 'live' && <LiveTab token={overlay.token} sources={sources} />}

        {tab === 'channels' && (
          <div className="grid two">
            <div><SourcesPanel sources={sources} onChange={loadAll} /></div>
            <PreviewPanel token={overlay.token} />
          </div>
        )}

        {tab === 'overlay' && (
          <div className="grid two">
            <div>
              <OverlayPanel overlay={overlay} setOverlay={setOverlay} />
              {settings && <SettingsPanel settings={settings} setSettings={setSettings} />}
            </div>
            <PreviewPanel token={overlay.token} settings={settings} />
          </div>
        )}

        {tab === 'account' && (
          <div className="grid narrow"><AccountPanel /></div>
        )}
      </div>
    </div>
  )
}

// ── channels ─────────────────────────────────────────────────────────────────
function SourcesPanel({ sources, onChange }) {
  const [platform, setPlatform] = useState('twitch')
  const [channel, setChannel] = useState('')
  const [chatroomId, setChatroomId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api.post('/api/sources', { platform, channel, chatroomId: chatroomId || undefined })
      setChannel(''); setChatroomId('')
      await onChange()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const toggle = async (s) => { await api.patch(`/api/sources/${s.id}`, { enabled: !s.enabled }); await onChange() }
  const remove = async (s) => { await api.del(`/api/sources/${s.id}`); await onChange() }

  return (
    <section className="panel">
      <h2><Tv size={17} /> Your channels</h2>
      <p className="sub">Add the Twitch / Kick channels whose chat you want merged.</p>

      {sources.length === 0 ? (
        <div className="source-empty">No channels yet — add your first one below.</div>
      ) : (
        <ul className="source-list">
          {sources.map((s) => (
            <li key={s.id} className="source-row">
              <span className="tag" data-platform={s.platform}>{s.platform}</span>
              <span className="source-name">{s.channel}</span>
              <label className="switch" title={s.enabled ? 'Enabled' : 'Disabled'}>
                <input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} />
                <span />
              </label>
              <button className="btn ghost sm" onClick={() => remove(s)} aria-label="Remove"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      <form className="add-source" onSubmit={add}>
        {error && <div className="auth-error">{error}</div>}
        <div className="add-row">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="twitch">Twitch</option>
            <option value="kick">Kick</option>
            <option value="x">X (live)</option>
          </select>
          <input
            placeholder={
              platform === 'twitch' ? 'twitch channel name'
                : platform === 'kick' ? 'kick channel slug'
                : 'x.com/i/broadcasts/…'
            }
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            required
          />
          <button className="btn primary" disabled={busy}><Plus size={16} /> {busy ? 'Adding…' : 'Add'}</button>
        </div>
        {platform === 'kick' && (
          <input className="chatroom-input" placeholder="optional: chatroom id (if auto-resolve fails)" value={chatroomId} onChange={(e) => setChatroomId(e.target.value)} />
        )}
      </form>
      <p className="muted small" style={{ marginTop: 12 }}>
        {platform === 'x'
          ? 'X is experimental — paste a live broadcast URL while it’s on air. Unofficial; may break.'
          : 'Tip: for X, switch the dropdown to “X (live)” and paste a broadcast URL.'}
      </p>
    </section>
  )
}

// ── overlay url ────────────────────────────────────────────────────────────
function OverlayPanel({ overlay, setOverlay }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(overlay.url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const rotate = async () => {
    if (!confirm('Rotate the token? Your current OBS overlay URL will stop working.')) return
    setOverlay(await api.post('/api/overlay/rotate'))
  }
  return (
    <section className="panel">
      <h2><Link2 size={17} /> OBS overlay URL</h2>
      <p className="sub">Add this as a Browser source in OBS. Keep it secret.</p>
      <div className="overlay-url">
        <input readOnly value={overlay.url} onFocus={(e) => e.target.select()} />
        <button className="btn" onClick={copy}><Copy size={15} /> {copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <div className="row-actions">
        <a className="btn ghost sm" href={overlay.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
        <button className="btn ghost sm danger" onClick={rotate}><RefreshCw size={14} /> Rotate token</button>
      </div>
    </section>
  )
}

// ── appearance ───────────────────────────────────────────────────────────────
const TwitchGlyph = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
  </svg>
)

// Picker where each choice shows a mini live example of the result (WYSIWYG).
function OptionCards({ value, onChange, options }) {
  return (
    <div className="opt-cards" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`opt-card ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          <div className="opt-demo">{o.demo}</div>
          <div className="opt-label">{o.label}</div>
        </button>
      ))}
    </div>
  )
}

// Labelled switch row with a one-line description.
function SwitchRow({ on, onChange, title, desc, disabled }) {
  return (
    <label className={`switch-row ${disabled ? 'disabled' : ''}`}>
      <span className="switch-info">
        <span className="switch-title">{title}</span>
        {desc && <span className="switch-desc">{desc}</span>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  )
}

function SettingsPanel({ settings, setSettings }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const update = (patch) => { setSettings((s) => ({ ...s, ...patch })); setSaved(false) }
  const save = async () => {
    setSaving(true)
    try {
      const { settings: srv } = await api.put('/api/settings', settings)
      setSettings(srv)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const pstyle = settings.platform_style || 'label'
  return (
    <section className="panel">
      <h2><SlidersHorizontal size={17} /> Appearance</h2>
      <p className="sub">Everything previews live on the right. Save to apply to your OBS overlay.</p>

      <div className="ctrl">
        <div className="ctrl-label"><ALargeSmall size={15} /> Font size <span className="val">{settings.font_size}px</span></div>
        <input type="range" min="10" max="64" value={settings.font_size} onChange={(e) => update({ font_size: Number(e.target.value) })} />
      </div>
      <div className="ctrl">
        <div className="ctrl-label"><List size={15} /> Messages on screen <span className="val">{settings.max_messages}</span></div>
        <input type="range" min="5" max="200" value={settings.max_messages} onChange={(e) => update({ max_messages: Number(e.target.value) })} />
      </div>

      <div className="set-group">
        <div className="set-grouphead">Platform tag</div>
        <OptionCards
          value={pstyle}
          onChange={(v) => update({ platform_style: v })}
          options={[
            { value: 'label', label: 'Label', demo: (<><span className="demo-chip tw"><TwitchGlyph /> Twitch</span><span className="demo-user">user</span></>) },
            { value: 'logo', label: 'Logo only', demo: (<><span className="demo-chip tw icon"><TwitchGlyph /></span><span className="demo-user">user</span></>) },
            { value: 'hidden', label: 'Hidden', demo: (<span className="demo-user">user <span className="demo-msg">gg</span></span>) },
          ]}
        />
        {pstyle !== 'hidden' && (
          <OptionCards
            value={settings.platform_plain ? 'plain' : 'chip'}
            onChange={(v) => update({ platform_plain: v === 'plain' })}
            options={[
              { value: 'chip', label: 'Boxed', demo: (<span className="demo-chip tw"><TwitchGlyph /> Twitch</span>) },
              { value: 'plain', label: 'Plain', demo: (<span className="demo-chip tw plain"><TwitchGlyph /> Twitch</span>) },
            ]}
          />
        )}
      </div>

      <div className="set-group">
        <div className="set-grouphead">Message style</div>
        <OptionCards
          value={settings.message_bg || 'none'}
          onChange={(v) => update({ message_bg: v })}
          options={[
            { value: 'none', label: 'Clean', demo: (<span className="demo-line"><span className="demo-user">user</span> nice clip</span>) },
            { value: 'plate', label: 'Card', demo: (<span className="demo-line plate"><span className="demo-user">user</span> nice clip</span>) },
          ]}
        />
      </div>

      <div className="ctrl">
        <div className="ctrl-label"><Contrast size={15} /> Background <span className="val">{settings.bg_opacity ? `${settings.bg_opacity}% dark` : 'transparent'}</span></div>
        <input type="range" min="0" max="100" value={settings.bg_opacity || 0} onChange={(e) => update({ bg_opacity: Number(e.target.value) })} />
      </div>

      <div className="set-switches">
        <SwitchRow on={settings.text_shadow !== false} onChange={(v) => update({ text_shadow: v })} title="Text outline" desc="Adds a shadow so text reads over any video" />
        <SwitchRow on={!!settings.show_badges} onChange={(v) => update({ show_badges: v })} title="User badges" desc="Show mod / sub badges next to names" />
        <SwitchRow on={!!settings.show_channel} onChange={(v) => update({ show_channel: v })} title="Channel name" desc="Tag which channel each message came from" />
      </div>

      <button className="btn primary block" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save to overlay'}</button>
    </section>
  )
}

// ── verify banner ────────────────────────────────────────────────────────────
function VerifyBanner() {
  const { user, resendVerification, refresh } = useAuth()
  const [state, setState] = useState('idle')
  if (!user || !user.email || user.emailVerified) return null
  const resend = async () => { setState('sending'); try { await resendVerification(); setState('sent') } catch { setState('idle') } }
  return (
    <div className="verify-banner">
      <span>Your email <b>{user.email}</b> isn’t verified — check your inbox for the link.</span>
      <div className="row-actions">
        {state === 'sent'
          ? <span className="muted small">Sent. Click the link, then “I’ve verified”.</span>
          : <button className="btn sm" onClick={resend} disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Resend email'}</button>}
        <button className="btn ghost sm" onClick={refresh}>I’ve verified</button>
      </div>
    </div>
  )
}

// ── account ──────────────────────────────────────────────────────────────────
function AccountPanel() {
  const { user, updateProfile, changePassword } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [pMsg, setPMsg] = useState(''); const [pErr, setPErr] = useState('')
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState(''); const [pwErr, setPwErr] = useState('')

  const saveProfile = async (e) => {
    e.preventDefault(); setPMsg(''); setPErr('')
    try {
      const emailChanged = email !== user.email
      await updateProfile({ displayName, email })
      setPMsg(emailChanged ? 'Saved — check your new email for a verification link.' : 'Saved.')
    } catch (err) { setPErr(err.message) }
  }
  const savePassword = async (e) => {
    e.preventDefault(); setPwMsg(''); setPwErr('')
    try {
      const { hadPassword } = await changePassword(curPw || undefined, newPw)
      setPwMsg(hadPassword ? 'Password changed.' : 'Password set.')
      setCurPw(''); setNewPw('')
    } catch (err) { setPwErr(err.message) }
  }

  return (
    <>
      <section className="panel">
        <h2><UserRound size={17} /> Profile</h2>
        <form onSubmit={saveProfile}>
          {pErr && <div className="auth-error">{pErr}</div>}
          {pMsg && <div className="auth-ok">{pMsg}</div>}
          <label className="field">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="field">
            Email {user?.emailVerified ? <span className="badge-ok">verified</span> : <span className="badge-warn">unverified</span>}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {user?.twitchLogin && <p className="muted small">Linked to Twitch: {user.twitchLogin}</p>}
          <button className="btn primary" type="submit">Save profile</button>
        </form>
      </section>

      <section className="panel">
        <h2><KeyRound size={17} /> {user?.email ? 'Password' : 'Set a password'}</h2>
        <form onSubmit={savePassword}>
          {pwErr && <div className="auth-error">{pwErr}</div>}
          {pwMsg && <div className="auth-ok">{pwMsg}</div>}
          <label className="field">Current password <span className="muted small">(blank if you signed up with Twitch)</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          </label>
          <label className="field">New password<input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required /></label>
          <button className="btn primary" type="submit">Update password</button>
        </form>
      </section>
    </>
  )
}

// ── LIVE page: stats + filters + slow-mode + pinnable full-height chat ─────────
function StatTile({ label, value, accent }) {
  return (
    <div className="live-stat">
      <div className="v">{accent ? <span className="accent">{value}</span> : value}</div>
      <div className="l">{label}</div>
    </div>
  )
}

const SLOW_RATES = [
  { label: '2s', ms: 2000 },
  { label: '4s', ms: 4000 },
  { label: '8s', ms: 8000 },
]

function LiveTab({ token, sources }) {
  // Reading/moderation feed keeps a big scrollback so messages persist (the OBS
  // overlay's small max-messages is for the overlay, not this tab).
  const { messages, config, status, stats } = useChatSocket({ token, max: 600 })
  const [live, setLive] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [slow, setSlow] = useState(false)
  const [slowMs, setSlowMs] = useState(4000)
  const [minimal, setMinimal] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [top, setTop] = useState({ name: '', n: 0 })

  // Pinned messages, persisted locally so they survive refreshes.
  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rokit:pinned') || '[]') } catch { return [] }
  })
  useEffect(() => {
    try { localStorage.setItem('rokit:pinned', JSON.stringify(pinned)) } catch { /* ignore */ }
  }, [pinned])

  const pin = useCallback((m) => {
    setPinned((prev) =>
      prev.some((p) => p.id === m.id)
        ? prev
        : [...prev, { id: m.id, platform: m.platform, text: m.text, name: m.user.displayName || m.user.name }].slice(-50),
    )
  }, [])
  const unpin = useCallback((id) => setPinned((prev) => prev.filter((p) => p.id !== id)), [])
  const clearPinned = useCallback(() => setPinned([]), [])

  // Poll server for per-source connection status.
  useEffect(() => {
    let stop = false
    const poll = async () => {
      try { const d = await api.get('/api/live'); if (!stop) setLive(d) } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { stop = true; clearInterval(id) }
  }, [])

  // Session-cumulative "top chatter" (counts new message ids as they arrive).
  const topRef = useRef({ counts: new Map(), seen: new Set(), name: '', n: 0 })
  useEffect(() => {
    const t = topRef.current
    for (const m of messages) {
      if (t.seen.has(m.id)) continue
      t.seen.add(m.id)
      const name = m.user.displayName || m.user.name || '?'
      const n = (t.counts.get(name) || 0) + 1
      t.counts.set(name, n)
      if (n > t.n) { t.n = n; t.name = name }
    }
    setTop({ name: t.name, n: t.n })
  }, [messages])

  const liveSources = live?.sources || []
  const isConnected = (s) => liveSources.some((x) => x.platform === s.platform && x.channel === s.channel && x.connected)
  const connectedCount = sources.filter(isConnected).length
  const platforms = [...new Set(sources.map((s) => s.platform))]
  const max = 300 // Live tab shows a long scrollback (not the overlay's compact limit)
  const options = {
    showBadges: config ? config.show_badges : true,
    showPlatform: config ? config.show_platform : true,
    platformStyle: minimal ? 'icon' : 'label',
  }

  // platform + keyword filtered feed (full, not yet sliced)
  const q = query.trim().toLowerCase()
  const feed = messages.filter(
    (m) => (filter === 'all' || m.platform === filter) && (!q || (m.text || '').toLowerCase().includes(q)),
  )

  // Slow mode: drip the feed into view one message per interval.
  const feedRef = useRef([])
  feedRef.current = feed
  const [slowShown, setSlowShown] = useState([])
  useEffect(() => {
    if (!slow) return
    setSlowShown(feedRef.current.slice(-max))
    const id = setInterval(() => {
      setSlowShown((prev) => {
        const ids = new Set(prev.map((m) => m.id))
        const next = feedRef.current.find((m) => !ids.has(m.id))
        return next ? [...prev, next].slice(-max) : prev
      })
    }, slowMs)
    return () => clearInterval(id)
  }, [slow, slowMs, max, filter, q])

  const liveDisplay = slow ? slowShown : feed.slice(-max)
  // Pause on hover: keep showing the snapshot captured just before hovering so
  // a fast feed holds still and the right comment can be pinned.
  const frozenRef = useRef([])
  if (!hovering) frozenRef.current = liveDisplay
  const display = hovering ? frozenRef.current : liveDisplay
  const queued = slow ? Math.max(0, feed.length - slowShown.filter((m) => feed.some((f) => f.id === m.id)).length) : 0

  return (
    <div className="live-layout">
      <div className="live-stats">
        <StatTile label="Channels Live" value={`${connectedCount}/${sources.length || 0}`} accent />
        <StatTile label="Messages" value={stats.total.toLocaleString()} />
        <StatTile label="Msgs / Min" value={stats.perMin} />
        <StatTile label="Top Chatter" value={top.name ? `${top.name}` : '—'} />
        <StatTile label="Pinned" value={pinned.length} />
      </div>

      <div className="live-main">
        <section className="panel live-chat-panel">
          <div className="live-chat-head">
            <div className="chat-filters">
              <button className={`chat-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
              {platforms.map((p) => (
                <button key={p} className={`chat-filter ${filter === p ? 'active' : ''}`} data-platform={p} onClick={() => setFilter(p)}>{p}</button>
              ))}
            </div>
            <div className="chat-search">
              <Search size={13} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search chat" />
            </div>
            <div className="slow-ctl">
              <button className={`chat-filter ${minimal ? 'active' : ''}`} onClick={() => setMinimal((v) => !v)} title="Show platform logos only">
                <Image size={13} /> Logos
              </button>
              <button className={`chat-filter ${slow ? 'active' : ''}`} onClick={() => setSlow((s) => !s)} title="Drip messages at a readable pace">
                <Gauge size={13} /> Slow
              </button>
              {slow && (
                <select value={slowMs} onChange={(e) => setSlowMs(Number(e.target.value))}>
                  {SLOW_RATES.map((r) => <option key={r.ms} value={r.ms}>{r.label}</option>)}
                </select>
              )}
            </div>
            <span className={`status status-${status}`}>{status}</span>
          </div>

          <div
            className="live-feed-full"
            style={{ fontSize: `${config?.font_size || 16}px` }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            <ChatList messages={display} className="preview-list" options={options} onPin={pin} />
            {hovering && <div className="paused-badge"><Pause size={12} /> Paused — release to resume</div>}
          </div>
          {slow && queued > 0 && <div className="slow-note">slow mode · {queued} queued</div>}
        </section>

        <aside className="live-side">
          <section className="panel">
            <h2><Pin size={16} /> Pinned {pinned.length > 0 && <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={clearPinned}>Clear</button>}</h2>
            {pinned.length === 0 ? (
              <div className="source-empty">Hover a message and hit the pin to save it here for later.</div>
            ) : (
              <ul className="pinned-list">
                {pinned.map((m) => (
                  <li key={m.id} className="pinned-row">
                    <span className="tag" data-platform={m.platform}>{m.platform}</span>
                    <div className="pinned-body"><b>{m.name}</b> {m.text}</div>
                    <button className="btn ghost sm" onClick={() => unpin(m.id)} aria-label="Unpin"><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2><Activity size={16} /> Channels</h2>
            {sources.length === 0 ? (
              <div className="source-empty">No channels yet — add some on the Channels tab.</div>
            ) : (
              <ul className="chan-status">
                {sources.map((s) => {
                  const on = isConnected(s)
                  return (
                    <li key={s.id} className="chan-row">
                      <span className={`chan-dot ${on ? 'on' : ''}`} />
                      <span className="tag" data-platform={s.platform}>{s.platform}</span>
                      <span className="chan-name">{s.channel}</span>
                      <span className={`chan-state ${on ? 'on' : ''}`}>{on ? 'connected' : '…'}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

// ── live preview ──────────────────────────────────────────────────────────
// When `settings` is passed (Overlay tab), appearance updates in REAL TIME as
// the user edits — otherwise it follows the saved config from the socket.
function PreviewPanel({ token, settings }) {
  const { messages, config, status } = useChatSocket({ token, max: 200 })
  const a = appearanceFrom(settings || config || {})
  const visible = messages.slice(-a.maxMessages)
  return (
    <section className="panel preview-panel">
      <div className="preview-head">
        <h2><Eye size={17} /> Live preview</h2>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      <div className="preview-window" style={a.containerStyle}>
        <ChatList messages={visible} className={`preview-list ${a.listClassName}`} options={a.options} />
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Messages appear once a channel is live and chat is active.</p>
    </section>
  )
}
