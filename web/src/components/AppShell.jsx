import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Activity, Tv, MonitorPlay, UserRound, LogIn, LogOut } from 'lucide-react'
import { Rocket } from 'lucide-react'
import { useAuth } from '../auth.jsx'

// Minimal left icon rail + main content area. Nav is context-aware: signed-out
// users see Home + Sign in; signed-in users get the dashboard sections, which
// deep-link into the dashboard's tabs via ?tab=.
function RailItem({ icon: Icon, label, to, active, onClick }) {
  const className = `rail-item${active ? ' active' : ''}`
  const body = (
    <>
      <Icon size={21} strokeWidth={2.1} />
      <span className="tip">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className={className} aria-label={label}>{body}</Link>
  ) : (
    <button type="button" className={className} aria-label={label} onClick={onClick}>{body}</button>
  )
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const params = new URLSearchParams(loc.search)
  const onDash = loc.pathname.startsWith('/dashboard')
  const tab = params.get('tab') || 'live'

  const doLogout = async () => {
    await logout()
    nav('/')
  }

  return (
    <>
      <div className="bg-aura" />
      <div className="shell">
        <aside className="rail">
          <Link to="/" className="rail-logo" aria-label="Rokit home">
            <span className="logo-mark" style={{ width: 40, height: 40 }}>
              <Rocket size={20} strokeWidth={2.4} />
            </span>
          </Link>

          <RailItem icon={Home} label="Home" to="/" active={loc.pathname === '/'} />

          {user && (
            <>
              <RailItem icon={Activity} label="Live" to="/dashboard?tab=live" active={onDash && tab === 'live'} />
              <RailItem icon={Tv} label="Channels" to="/dashboard?tab=channels" active={onDash && tab === 'channels'} />
              <RailItem icon={MonitorPlay} label="Overlay" to="/dashboard?tab=overlay" active={onDash && tab === 'overlay'} />
              <RailItem icon={UserRound} label="Account" to="/dashboard?tab=account" active={onDash && tab === 'account'} />
            </>
          )}

          <div className="rail-spacer" />

          {user ? (
            <RailItem icon={LogOut} label="Log out" onClick={doLogout} />
          ) : (
            <RailItem icon={LogIn} label="Sign in" to="/login" active={loc.pathname === '/login'} />
          )}
        </aside>

        <div className="shell-main">{children}</div>
      </div>
    </>
  )
}
