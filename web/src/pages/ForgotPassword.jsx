import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Logo from '../components/Logo.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true) // server always returns ok; don't reveal account existence
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="bg-aura" />
      <form className="auth-card" onSubmit={submit}>
        <Logo to="/" />
        <h1>Reset password</h1>
        {sent ? (
          <>
            <p className="muted">
              If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox.
            </p>
            <Link className="btn" to="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <p className="muted small">Enter your email and we’ll send a reset link.</p>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="auth-alt"><Link to="/login">Back to sign in</Link></p>
          </>
        )}
      </form>
    </div>
  )
}
