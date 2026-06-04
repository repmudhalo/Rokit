import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import Logo from '../components/Logo.jsx'

export default function Register() {
  const { register, oauth } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(email, password, displayName)
      nav('/dashboard')
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
        <h1>Create account</h1>
        {error && <div className="auth-error">{error}</div>}
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="optional" /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="at least 8 characters" /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        {oauth?.twitch && (
          <a className="btn twitch" href="/api/auth/twitch">Continue with Twitch</a>
        )}
        <p className="auth-alt">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  )
}
