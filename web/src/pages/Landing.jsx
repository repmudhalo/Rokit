import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import ChatMessage from '../ChatMessage.jsx'
import landerBg from '../lander_bg.jpg'

// ── live mock chat (background hero visual) ──────────────────────────────────
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

function LiveMockChat({ max = 18 }) {
  const [messages, setMessages] = useState(() => Array.from({ length: 12 }, (_, i) => makeMsg(i)))
  const ref = useRef(null)

  useEffect(() => {
    let id = 1000
    const tick = () => {
      setMessages((prev) => {
        const next = prev.concat(makeMsg(id++))
        return next.length > max ? next.slice(-max) : next
      })
    }
    const timer = setInterval(tick, 1100)
    return () => clearInterval(timer)
  }, [max])

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

export default function Landing() {
  const { user } = useAuth()

  return (
    <main className="hero">
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
          {user ? (
            <Link className="btn primary lg" to="/dashboard">Open dashboard <ArrowRight size={17} /></Link>
          ) : (
            <>
              <Link className="btn primary lg" to="/register">Get started free <ArrowRight size={17} /></Link>
              <Link className="btn lg ghost" to="/login">Sign in</Link>
            </>
          )}
        </div>
        {!user && <p className="hero-note">Free while in beta. <Link to="/register">Create your overlay →</Link></p>}

        <div className="hero-stats">
          <div className="hero-stat"><div className="n"><span className="grad">3</span></div><div className="l">PLATFORMS UNIFIED</div></div>
          <div className="hero-stat"><div className="n">&lt;1s</div><div className="l">MESSAGE LATENCY</div></div>
          <div className="hero-stat"><div className="n">1</div><div className="l">URL INTO OBS</div></div>
        </div>
      </div>
    </main>
  )
}
