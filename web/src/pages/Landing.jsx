import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import { useAuth } from '../auth.jsx'

// Sample messages for the hero's faux unified-overlay visual.
const DEMO = [
  { pf: 'twitch', who: 'ninjafrog', txt: 'no way that clutch 😭' },
  { pf: 'kick', who: 'big_mike', txt: 'GG that was insane' },
  { pf: 'twitch', who: 'lola_vt', txt: 'one chat for everything LFG' },
  { pf: 'kick', who: 'streamsniper', txt: 'how is this so smooth' },
  { pf: 'twitch', who: 'modbot', txt: 'welcome raiders 👋' },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <main className="hero">
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
          <span className="pill"><Zap size={13} /> Twitch + Kick · one feed</span>
        </div>
        <h1>
          All your chats.<br />
          <span className="grad">One overlay.</span>
        </h1>
        <p className="hero-sub">
          Rokit merges your Twitch and Kick live chat into a single, beautiful stream
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
          <div className="hero-stat"><div className="n"><span className="grad">2</span></div><div className="l">PLATFORMS UNIFIED</div></div>
          <div className="hero-stat"><div className="n">&lt;1s</div><div className="l">MESSAGE LATENCY</div></div>
          <div className="hero-stat"><div className="n">1</div><div className="l">URL INTO OBS</div></div>
        </div>
      </div>

      <div className="hero-visual">
        <div className="glass-overlay">
          <div className="ov-head">
            <span className="ov-title">UNIFIED CHAT</span>
            <span className="pill"><span className="dot" /> live</span>
          </div>
          {DEMO.map((m, i) => (
            <div className="ov-msg" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
              <span className={`pf ${m.pf}`}>{m.pf}</span>
              <span className="who">{m.who}</span>
              <span className="txt">{m.txt}</span>
            </div>
          ))}
          <div className="merge-badge"><Zap size={13} /> Twitch + Kick merged</div>
        </div>
      </div>
    </main>
  )
}
