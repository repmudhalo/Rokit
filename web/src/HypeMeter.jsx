import React from 'react'
import { hypeTier, heatColor } from './hype.js'

const SEGMENTS = 12
const R = 52
const C = 2 * Math.PI * R

// Presentational hype meter. `level` is 0..100; `cfg` is a normalized hype
// config. Pure — drive `level` with useHype. The whole thing gets livelier as
// the level rises: color shifts cold→hot, glow grows (--lvl), and the top tier
// flashes / catches fire (see tier-* classes in styles.css).
export default function HypeMeter({ level = 0, cfg }) {
  const pct = Math.round(level)
  const tier = hypeTier(level)
  const color = cfg.dynamic_color ? heatColor(level) : cfg.color
  const rootClass = `hype hype-${cfg.style} tier-${tier.replace(/\s+/g, '-')}`
  const rootStyle = { '--hype': color, '--lvl': (level / 100).toFixed(3) }
  const flame = <span className="hype-flame" aria-hidden="true">🔥</span>
  const label = <span className="hype-label">{cfg.label}</span>
  const value = cfg.show_value && <span className="hype-pct">{pct}%</span>

  if (cfg.style === 'vertical') {
    return (
      <div className={rootClass} style={rootStyle}>
        {label}
        <div className="hype-track">
          <div className="hype-fill" style={{ height: `${level}%` }}><span className="hype-sheen" />{flame}</div>
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
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const on = i < lit
            const segColor = cfg.dynamic_color ? heatColor(((i + 1) / SEGMENTS) * 100) : cfg.color
            return <span key={i} className={`hype-seg ${on ? 'on' : ''}`} style={on ? { background: segColor, borderColor: segColor } : undefined} />
          })}
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
        <div className="hype-fill" style={{ width: `${level}%` }}>
          <span className="hype-sheen" />
          {flame}
        </div>
      </div>
    </div>
  )
}
