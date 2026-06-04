import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Logo from '../components/Logo.jsx'

// Lands here from the email link: /reset-password?token=…
export default function ResetPassword() {
  const nav = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('passwords do not match')
    setBusy(true)
    setError('')
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => nav('/login'), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="bg-aura" />
      <form className="auth-card" onSubmit={submit}>
        <Logo to="/" />
        <h1>Choose a new password</h1>
        {!token && <div className="auth-error">Missing reset token — use the link from your email.</div>}
        {done ? (
          <p className="muted">Password updated ✓ Redirecting to sign in…</p>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}
            <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
            <label>Confirm password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required /></label>
            <button className="btn primary" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'}</button>
            <p className="auth-alt"><Link to="/login">Back to sign in</Link></p>
          </>
        )}
      </form>
    </div>
  )
}
