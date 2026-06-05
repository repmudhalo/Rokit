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

// The Rokit logotype (inlined). Per-letter paths let us keep the brand
// treatment: "RO" in the text color, "KIT" in the accent.
// Source: web/src/rokit_text.svg.
function RokitWordmark({ height }) {
  return (
    <svg
      className="logo-word"
      viewBox="0 0 456.85 82.03"
      style={{ height, width: 'auto' }}
      aria-label="Rokit"
      role="img"
      focusable="false"
    >
      <path fill="currentColor" d="M35.19,76.6H4.49L15.5,7.18h68.95c15.96,0,24.82,5.23,24.82,16.42s-9.42,16.8-17.73,18.29c8.49,2.52,13.9,8.3,12.5,17.35l-1.68,9.98c-.65,4.01-.19,5.69.19,6.81l-.09.56h-31.54c-.28-.56-.37-1.68-.09-3.27l1.31-7.84c1.21-7.46-1.77-11.85-11.85-11.85h-21.46l-3.64,22.95ZM69.15,35.36c5.88,0,7.65-2.99,7.65-5.69s-1.59-4.48-6.34-4.48h-27.15l-1.68,10.17h27.53Z" />
      <path fill="currentColor" d="M157.88,77.91c-40.22,0-48.33-17.45-48.33-31.35,0-1.87.09-4.48.47-7.18,1.87-14,10.17-33.5,54.03-33.5h4.39c41.06,0,48.52,17.36,48.52,30.79,0,2.52-.28,5.23-.65,7.56-2.24,13.81-9.7,33.68-53.93,33.68h-4.48ZM164.6,26.4c-17.17,0-22.21,7.65-22.95,14.28-.09.75-.19,1.68-.19,3.08,0,6.34,4.57,13.44,20.25,13.44,16.89,0,22.02-7.56,23.05-14.46.19-1.31.28-2.43.28-3.45,0-6.34-4.67-12.88-20.43-12.88Z" />
      <path fill="var(--accent)" d="M216.1,76.6l11.01-69.42h30.7l-4.11,25.75,35.27-25.75h37.88l-44.13,32.28,34.15,37.14h-39.28l-26.13-29.21-4.67,29.21h-30.7Z" />
      <path fill="var(--accent)" d="M349.16,76.6h-30.7l11.01-69.42h30.7l-11.01,69.42Z" />
      <path fill="var(--accent)" d="M391.24,28.92h-29.02l3.36-21.74h88.92l-3.45,21.74h-29.02l-7.56,47.68h-30.79l7.56-47.68Z" />
    </svg>
  )
}

// Rokit mark + logotype.
export default function Logo({ to = '/', word = true, size = 38 }) {
  const inner = (
    <span className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <RokitMark size={size * 0.58} />
      </span>
      {word && <RokitWordmark height={size * 0.5} />}
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
