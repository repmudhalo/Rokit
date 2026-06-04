import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Logo from '../components/Logo.jsx'

// Lands here from the email link: /verify-email?token=…
export default function VerifyEmail() {
  const [state, setState] = useState('verifying') // verifying | ok | error
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode double-invoke guard (token is single-use)
    ran.current = true
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) return setState('error')
    api
      .post('/api/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch(() => setState('error'))
  }, [])

  return (
    <div className="auth-page">
      <div className="bg-aura" />
      <div className="auth-card">
        <Logo to="/" />
        {state === 'verifying' && <p>Verifying your email…</p>}
        {state === 'ok' && (
          <>
            <h1>Email verified ✓</h1>
            <p className="muted">Your email is confirmed.</p>
            <Link className="btn primary" to="/dashboard">Go to dashboard</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1>Link invalid</h1>
            <p className="muted">This verification link is invalid or has expired. You can request a new one from your dashboard.</p>
            <Link className="btn" to="/dashboard">Go to dashboard</Link>
          </>
        )}
      </div>
    </div>
  )
}
