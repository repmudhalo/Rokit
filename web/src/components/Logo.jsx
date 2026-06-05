import React from 'react'
import { Link } from 'react-router-dom'

// The Rokit mark (inlined so it inherits currentColor → accent, and stays
// crisp at any size). Source: web/src/rokit_logo.svg.
function RokitMark({ size }) {
  return (
    <svg
      viewBox="0 0 351 318.33"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.35,8.85l11.67.15c92,0,172.25-17.36,248.97,16.8,102.75,45.74,92.81,171.55-8.49,209.73l90.2,77.48-143.72,1.14-74.88-61.23c-9.87-19.83,32.46-31.64,45.82-39.81,45.85-28.04,59.44-58.11,55.6-121.89h0c-32.31,4.81-66.71,8.17-93.12,28.85-25.02,19.6-33.83,48.98-49.93,74.98H4.35V8.85Z" />
      <path d="M79.86,230.56c2.91,2.71,15.1,15.94,17.07,18.79.01.02.03.04.04.06,1.88,2.67,1.27,6.33-1.48,8.07l-62.73,39.7c-5.11,3.23-11.04-2.72-7.79-7.82l39.96-62.65c1.63-2.56,4.98-3.36,7.61-1.85,2.92,1.67,5.9,4.38,7.32,5.7Z" />
    </svg>
  )
}

// Rokit wordmark + mark.
export default function Logo({ to = '/', word = true, size = 38 }) {
  const inner = (
    <span className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <RokitMark size={size * 0.58} />
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
