import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import Logo from '../components/Logo.jsx'

export default function Login() {
  const { login, oauth } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(sp.get('error') ? oauthErr(sp.get('error')) : '')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
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
        <h1>Sign in</h1>
        {error && <div className="auth-error">{error}</div>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {oauth?.twitch && (
          <a className="btn twitch" href="/api/auth/twitch">Continue with Twitch</a>
        )}
        <p className="auth-alt">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-alt">No account? <Link to="/register">Create one</Link></p>
      </form>
    </div>
  )
}

function oauthErr(code) {
  if (code === 'oauth_state') return 'Login session expired, please try again.'
  if (code === 'oauth_failed') return 'Twitch sign-in failed, please try again.'
  return ''
}
