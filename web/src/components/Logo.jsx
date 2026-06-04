import React from 'react'
import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'

// Rokit wordmark + gradient rocket mark.
export default function Logo({ to = '/', word = true, size = 38 }) {
  const inner = (
    <span className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <Rocket size={size * 0.5} strokeWidth={2.4} />
      </span>
      {word && (
        <span className="logo-word">
          Ro<b>kit</b>
        </span>
      )}
    </span>
  )
  return to ? (
    <Link to={to} aria-label="Rokit home" style={{ textDecoration: 'none' }}>
      {inner}
    </Link>
  ) : (
    inner
  )
}
