import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Zap, MessagesSquare, MonitorPlay, Flame, Smile, SlidersHorizontal, Check,
} from 'lucide-react'
import { useAuth } from '../auth.jsx'
import ChatMessage from '../ChatMessage.jsx'
import HypeMeter from '../HypeMeter.jsx'
import { normalizeHype } from '../hype.js'
import landerBg from '../lander_bg.jpg'

// ── live mock chat (hero + tools showcase visual) ────────────────────────────
const NAMES = [
  'ninjafrog', 'big_mike', 'lola_vt', 'streamsniper', 'pixelpete', 'gg_gabe', 'vexx',
  'noobmaster', 'clutchqueen', 'toasty', 'm0nopoly', 'sunny', 'rektifier', 'frostbyte',
  'aceofspades', 'mossy', 'kira', 'dripgod', 'wraith', 'echo',
]
const TEXTS = [
  'no way that clutch 😭', 'GG that was insane', 'one chat for everything LFG',
  'how is this so smooth 🔥', 'W stream', 'he is cooking again 👨‍🍳', 'that play 👀',
  'POGGERS', 'let him cook', 'chat is actually unified now??', 'this overlay goes hard',
  '🔥🔥🔥', 'sheeesh', 'first', 'real', 'based', 'hold the line', 'sub hype 🎉',
  'no shot', 'cleanest setup ive seen', 'gg go next', 'caught in 4k', '+1', 'lets gooo',
]
const PLATFORMS = ['twitch', 'kick', 'x', 'twitch', 'kick'] // weight twitch/kick a bit
const COLORS = {
  twitch: ['#b794ff', '#a970ff', '#ff7f50', '#1e90ff', '#00ff7f'],
  kick: ['#53fc18', '#6ee85a'],
  x: ['#e7e9ea', '#8cd1ff'],
}
const BADGES = { twitch: ['moderator', 'subscriber', 'vip'], kick: ['og', 'vip'], x: [] }
const pick = (a) => a[Math.floor(Math.random() * a.length)]

function makeMsg(id) {
  const platform = pick(PLATFORMS)
  const name = pick(NAMES)
  const pool = BADGES[platform]
  const badges = pool.length && Math.random() < 0.3 ? [pick(pool)] : []
  return {
    id: `m${id}`,
    platform,
    channel: 'demo',
    user: { name, displayName: name, color: pick(COLORS[platform]), badges },
    text: pick(TEXTS),
  }
}

function LiveMockChat({ max = 18, interval = 1100 }) {
  const [messages, setMessages] = useState(() => Array.from({ length: 12 }, (_, i) => makeMsg(i)))
  const ref = useRef(null)

  useEffect(() => {
    let id = 1000
    const timer = setInterval(() => {
      setMessages((prev) => {
        const next = prev.concat(makeMsg(id++))
        return next.length > max ? next.slice(-max) : next
      })
    }, interval)
    return () => clearInterval(timer)
  }, [max, interval])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [messages])

  return (
    <div className="hero-chat" ref={ref} aria-hidden="true">
      {messages.map((m) => (
        <div key={m.id} className="hero-chat-row">
          <ChatMessage msg={m} showPlatform showBadges />
        </div>
      ))}
    </div>
  )
}

// Animated hype meter for the showcase — oscillates with the occasional spike.
function DemoHypeMeter({ style = 'bar', label = 'CHAT HYPE' }) {
  const [level, setLevel] = useState(45)
  const cfg = normalizeHype({ style, label })
  useEffect(() => {
    let t = Math.random() * 6
    const id = setInterval(() => {
      t += 0.09
      const base = 56 + Math.sin(t) * 34 + Math.sin(t * 2.3) * 10
      const spike = Math.random() < 0.05 ? 22 : 0
      setLevel(Math.max(5, Math.min(99, base + spike + (Math.random() * 8 - 4))))
    }, 110)
    return () => clearInterval(id)
  }, [])
  return <HypeMeter level={level} cfg={cfg} />
}

// ── page content ─────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: MessagesSquare, title: 'One unified chat', desc: 'Twitch, Kick and X merged into a single real-time feed — every message, every platform, in one place.' },
  { icon: MonitorPlay, title: 'Drop-in OBS overlay', desc: 'A transparent browser source. Paste one URL into OBS or Streamlabs and your merged chat is on stream.' },
  { icon: Flame, title: 'Chat Hype Meter', desc: 'A live bar that reacts to chat speed and your keywords — it glows, flashes and catches fire when chat pops off.' },
  { icon: Smile, title: 'Real emotes', desc: '7TV, BetterTTV and FrankerFaceZ — global and per-channel. The emotes your chat actually uses, rendered inline.' },
  { icon: Zap, title: 'Sub-second latency', desc: 'Messages stream live over WebSockets. No refreshes, no lag, no missed moments in chat.' },
  { icon: SlidersHorizontal, title: 'Make it yours', desc: 'Fonts, sizes, platform tags, backgrounds and presets — tune the look to match your scene in seconds.' },
]

const STEPS = [
  { n: '01', title: 'Add your channels', desc: 'Connect your Twitch, Kick and X handles in the dashboard.' },
  { n: '02', title: 'Style your overlay', desc: 'Pick a preset or fine-tune the look with a live preview.' },
  { n: '03', title: 'Paste into OBS', desc: 'Drop the overlay URL in as a browser source. You’re live.' },
]

const MARKS = {
  twitch: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" /></svg>,
  kick: <svg viewBox="0 0 32 32" fill="currentColor"><path d="M4 4h7.2v5.6h2.4V7.2H16V4.8h7.2v6.4h-2.4v2.4h-2.4v2.4h2.4v2.4h2.4v6.4H16v-2.4h-2.4v-2.4h-2.4V28H4z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" /></svg>,
}

function SectionHead({ eyebrow, title, sub }) {
  return (
    <div className="lp-head">
      <span className="lp-eyebrow">{eyebrow}</span>
      <h2 className="lp-title">{title}</h2>
      {sub && <p className="lp-sub">{sub}</p>}
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const primaryTo = user ? '/dashboard' : '/register'
  const primaryLabel = user ? 'Open dashboard' : 'Get started free'

  return (
    <main className="landing">
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${landerBg})` }} />
        <div className="hero-chat-bg"><LiveMockChat /></div>
        <div className="hero-scrim" />

        <div className="hero-topbar">
          <span className="pill"><span className="dot" /> realtime</span>
          {user ? (
            <Link className="btn sm" to="/dashboard">Dashboard</Link>
          ) : (
            <Link className="btn sm ghost" to="/login">Sign in</Link>
          )}
        </div>

        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="pill"><Zap size={13} /> Twitch · Kick · X — one feed</span>
          </div>
          <h1>
            All your chats.<br />
            <span className="grad">One overlay.</span>
          </h1>
          <p className="hero-sub">
            Rokit merges your Twitch, Kick and X live chat into a single, beautiful stream
            overlay — drop one URL into OBS and you’re live. No config, no clutter.
          </p>

          <div className="hero-cta">
            <Link className="btn primary lg" to={primaryTo}>{primaryLabel} <ArrowRight size={17} /></Link>
            {!user && <Link className="btn lg ghost" to="/login">Sign in</Link>}
          </div>
          {!user && <p className="hero-note">Free while in beta. No card required.</p>}

          <div className="hero-stats">
            <div className="hero-stat"><div className="n"><span className="grad">3</span></div><div className="l">Platforms unified</div></div>
            <div className="hero-stat"><div className="n">&lt;1s</div><div className="l">Message latency</div></div>
            <div className="hero-stat"><div className="n">1</div><div className="l">URL into OBS</div></div>
          </div>
        </div>
      </section>

      {/* ── platforms strip ──────────────────────────────────────────────── */}
      <section className="lp-strip">
        <span className="lp-strip-label">One overlay for</span>
        <div className="lp-logos">
          <span className="lp-logo" data-platform="twitch">{MARKS.twitch} Twitch</span>
          <span className="lp-logo" data-platform="kick">{MARKS.kick} Kick</span>
          <span className="lp-logo" data-platform="x">{MARKS.x} X</span>
        </div>
      </section>

      {/* ── features ─────────────────────────────────────────────────────── */}
      <section className="lp-section">
        <SectionHead eyebrow="Features" title="Everything your chat needs" sub="A complete toolkit for multi-platform streamers — built to look great on stream from the first click." />
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <article className="lp-card" key={f.title}>
              <span className="lp-card-icon"><f.icon size={20} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── stream tools showcase ────────────────────────────────────────── */}
      <section className="lp-section lp-tools">
        <SectionHead eyebrow="Stream tools" title="More than a chat box" sub="Overlays that make your stream feel alive — and react to your chat in real time." />
        <div className="lp-tools-grid">
          <div className="lp-tool">
            <div className="lp-frame lp-frame-chat">
              <div className="lp-frame-bar"><span /><span /><span /><em>Merged chat · OBS browser source</em></div>
              <div className="lp-frame-body"><LiveMockChat max={9} interval={1300} /></div>
            </div>
            <div className="lp-tool-copy">
              <h3><MessagesSquare size={17} /> Merged chat overlay</h3>
              <p>Every platform’s chat, interleaved live with platform tags, badges and real emotes. Clean, readable, transparent.</p>
            </div>
          </div>

          <div className="lp-tool">
            <div className="lp-frame lp-frame-hype">
              <div className="lp-frame-bar"><span /><span /><span /><em>Chat Hype Meter · OBS browser source</em></div>
              <div className="lp-frame-body lp-hype-demos">
                <DemoHypeMeter style="bar" label="CHAT HYPE" />
                <div className="lp-hype-row">
                  <DemoHypeMeter style="gauge" label="HYPE" />
                  <DemoHypeMeter style="segments" label="ENERGY" />
                </div>
              </div>
            </div>
            <div className="lp-tool-copy">
              <h3><Flame size={17} /> Chat Hype Meter</h3>
              <p>A meter that fills as chat speeds up — with boost/drain keywords, heat colors and four styles. Glows and catches fire at peak hype.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────────────── */}
      <section className="lp-section">
        <SectionHead eyebrow="How it works" title="Live in three steps" />
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div className="lp-step" key={s.n}>
              <span className="lp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <h2>Unify your chat.<br /><span className="grad">Go live in minutes.</span></h2>
          <ul className="lp-cta-points">
            <li><Check size={15} /> Free while in beta</li>
            <li><Check size={15} /> No card required</li>
            <li><Check size={15} /> Set up in under 5 minutes</li>
          </ul>
          <Link className="btn primary lg" to={primaryTo}>{primaryLabel} <ArrowRight size={17} /></Link>
        </div>
      </section>

      {/* ── footer ───────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <span className="lp-footer-brand">RO<b>KIT</b></span>
        <span className="lp-footer-meta">Twitch · Kick · X — one overlay</span>
        <span className="lp-footer-copy">© 2026 Rokit</span>
      </footer>
    </main>
  )
}
