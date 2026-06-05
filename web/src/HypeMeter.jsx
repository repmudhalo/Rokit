import React from 'react'
import { hypeTier } from './hype.js'

const SEGMENTS = 12
const R = 52
const C = 2 * Math.PI * R

// Presentational hype meter. `level` is 0..100; `cfg` is a normalized hype
// config (style, label, color, show_value). Pure — drive `level` with useHype.
export default function HypeMeter({ level = 0, cfg }) {
  const pct = Math.round(level)
  const tier = hypeTier(level)
  const rootClass = `hype hype-${cfg.style} tier-${tier.replace(/\s+/g, '-')}`
  const rootStyle = { '--hype': cfg.color }
  const flame = <span className="hype-flame" aria-hidden="true">🔥</span>
  const label = <span className="hype-label">{cfg.label}</span>
  const value = cfg.show_value && <span className="hype-pct">{pct}%</span>

  if (cfg.style === 'vertical') {
    return (
      <div className={rootClass} style={rootStyle}>
        {label}
        <div className="hype-track">
          <div className="hype-fill" style={{ height: `${level}%` }}>{flame}</div>
        </div>
        {value}
      </div>
    )
  }

  if (cfg.style === 'gauge') {
    return (
      <div className={rootClass} style={rootStyle}>
        <svg className="hype-ring" viewBox="0 0 120 120">
          <circle className="ring-bg" cx="60" cy="60" r={R} />
          <circle
            className="ring-fill"
            cx="60"
            cy="60"
            r={R}
            style={{ strokeDasharray: C, strokeDashoffset: C * (1 - level / 100) }}
          />
        </svg>
        <div className="hype-ring-center">
          {flame}
          {value}
          {label}
        </div>
      </div>
    )
  }

  if (cfg.style === 'segments') {
    const lit = (level / 100) * SEGMENTS
    return (
      <div className={rootClass} style={rootStyle}>
        <div className="hype-top">{label}{value}</div>
        <div className="hype-segs">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={`hype-seg ${i < lit ? 'on' : ''}`} style={{ '--i': i / (SEGMENTS - 1) }} />
          ))}
        </div>
        <div className="hype-tier">{tier} {flame}</div>
      </div>
    )
  }

  // default: horizontal bar
  return (
    <div className={rootClass} style={rootStyle}>
      <div className="hype-top">{label}{value}</div>
      <div className="hype-track">
        <div className="hype-fill" style={{ width: `${level}%` }}>{flame}</div>
      </div>
    </div>
  )
}
