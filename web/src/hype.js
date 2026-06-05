import { useEffect, useRef, useState } from 'react'

// ── Chat Hype Meter engine ───────────────────────────────────────────────────
// A 0–100 "hype" value driven by chat velocity (energy accumulates per message,
// then decays over time) plus weighted keywords/emotes (e.g. W/GG/POG push it
// up, F/L/sadge pull it down). Shared by the OBS overlay and the dashboard
// preview so they behave identically.

const STYLES = ['bar', 'vertical', 'gauge', 'segments']

export const HYPE_DEFAULTS = {
  style: 'bar',
  label: 'CHAT HYPE',
  color: '#8cd1ff',
  sensitivity: 5, // 1..10 — how strongly each message fills the bar
  decay: 5, // 1..10 — how fast it falls when chat slows (higher = faster)
  show_value: true,
  boost: [
    { word: 'W', weight: 2 }, { word: 'GG', weight: 2 }, { word: 'POG', weight: 2 },
    { word: 'POGGERS', weight: 2 }, { word: 'LETSGO', weight: 2 }, { word: 'LFG', weight: 2 },
    { word: 'HYPE', weight: 2 }, { word: 'CLUTCH', weight: 2 }, { word: '+2', weight: 1.5 },
    { word: '🔥', weight: 1.5 }, { word: 'KEKW', weight: 1 }, { word: 'LOL', weight: 1 },
  ],
  drain: [
    { word: 'F', weight: 2 }, { word: 'L', weight: 2 }, { word: 'sadge', weight: 1.5 },
    { word: 'yikes', weight: 1.5 }, { word: '-2', weight: 1.5 }, { word: 'cringe', weight: 1.5 },
    { word: 'rip', weight: 1 }, { word: 'boo', weight: 1.5 },
  ],
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const HEX = /^#[0-9a-fA-F]{6}$/

function sanitizeWords(arr, fallback) {
  if (!Array.isArray(arr)) return fallback
  const out = []
  for (const it of arr) {
    if (!it) continue
    const word = String(it.word ?? '').trim().slice(0, 24)
    if (!word) continue
    out.push({ word, weight: clamp(Number(it.weight) || 1, 0.1, 5) })
    if (out.length >= 40) break
  }
  return out
}

export function normalizeHype(h = {}) {
  const n = { ...HYPE_DEFAULTS, ...(h || {}) }
  return {
    style: STYLES.includes(n.style) ? n.style : 'bar',
    label: String(n.label ?? 'CHAT HYPE').slice(0, 24),
    color: HEX.test(n.color) ? n.color : '#8cd1ff',
    sensitivity: clamp(Math.round(Number(n.sensitivity) || 5), 1, 10),
    decay: clamp(Math.round(Number(n.decay) || 5), 1, 10),
    show_value: n.show_value !== false,
    boost: sanitizeWords(n.boost, HYPE_DEFAULTS.boost),
    drain: sanitizeWords(n.drain, HYPE_DEFAULTS.drain),
  }
}

// Tier label + when the "on fire" flourish kicks in.
export function hypeTier(level) {
  if (level >= 85) return 'on fire'
  if (level >= 60) return 'hot'
  if (level >= 30) return 'warm'
  return 'cold'
}

// Build a fast scorer: exact-token match (case-insensitive) for word-like
// entries, substring match for emoji/symbol entries.
function buildScorer(cfg) {
  const exact = new Map() // UPPER word -> signed weight
  const sub = [] // { needle, weight } for emoji/symbol entries
  const add = (list, sign) => {
    for (const { word, weight } of list) {
      if (/^[\w+\-]+$/.test(word)) exact.set(word.toUpperCase(), sign * weight)
      else sub.push({ needle: word, weight: sign * weight })
    }
  }
  add(cfg.boost, 1)
  add(cfg.drain, -1)
  return (text) => {
    if (!text) return 0
    let score = 0
    for (const tok of text.split(/\s+/)) {
      const w = exact.get(tok.toUpperCase())
      if (w) score += w
    }
    for (const { needle, weight } of sub) {
      if (text.includes(needle)) score += weight
    }
    return score
  }
}

const FULL = 9 // energy that maps to 100%

// Returns a smoothed 0..100 hype level derived from the live message list.
export function useHype(messages, hype) {
  const [level, setLevel] = useState(0)
  const cfgRef = useRef(null)
  const scoreRef = useRef(() => 0)
  const energyRef = useRef(0)
  const dispRef = useRef(0)
  const seenRef = useRef(new Set())
  const lastRef = useRef(0)

  // Rebuild config/scorer when settings change.
  const key = JSON.stringify(hype || {})
  useEffect(() => {
    const cfg = normalizeHype(hype)
    cfgRef.current = cfg
    scoreRef.current = buildScorer(cfg)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Add energy for newly-arrived messages.
  useEffect(() => {
    const cfg = cfgRef.current || normalizeHype(hype)
    const base = cfg.sensitivity / 5 // 0.2 .. 2.0 per message
    for (const m of messages) {
      if (!m || seenRef.current.has(m.id)) continue
      seenRef.current.add(m.id)
      const impulse = clamp(base + scoreRef.current(m.text) * 0.5, -3, 6)
      energyRef.current = clamp(energyRef.current + impulse, 0, FULL * 1.25)
    }
    if (seenRef.current.size > 4000) seenRef.current = new Set()
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  // Decay + smoothing loop.
  useEffect(() => {
    let raf
    const tick = (now) => {
      if (!lastRef.current) lastRef.current = now
      const dt = clamp((now - lastRef.current) / 1000, 0, 0.1)
      lastRef.current = now
      const cfg = cfgRef.current || normalizeHype(hype)
      // decay slider 1(slow)..10(fast) → per-second retention 0.72..0.06
      const retention = 0.72 - (cfg.decay - 1) * (0.66 / 9)
      energyRef.current *= Math.pow(retention, dt)
      const target = clamp((energyRef.current / FULL) * 100, 0, 100)
      dispRef.current += (target - dispRef.current) * clamp(dt * 8, 0, 1)
      setLevel(dispRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return level
}
