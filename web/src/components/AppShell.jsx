import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, MessagesSquare, MessageSquare, Tv, Wrench, Flame, Film, BarChart3, UserRound, LogIn, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Logo from './Logo.jsx'
import { useAuth } from '../auth.jsx'

// Collapsible left sidebar + main content. Expanded shows icon + label;
// collapsed is an icon rail with hover tooltips. Nav is context-aware:
// signed-out users see Home + Sign in; signed-in users get the dashboard tabs.
function RailItem({ icon: Icon, label, to, active, onClick, className = '' }) {
  const cls = `rail-item ${className}${active ? ' active' : ''}`
  const body = (
    <>
      <Icon size={20} strokeWidth={2.1} />
      <span className="rail-label">{label}</span>
      <span className="tip">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className={cls} aria-label={label}>{body}</Link>
  ) : (
    <button type="button" className={cls} aria-label={label} onClick={onClick}>{body}</button>
  )
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const params = new URLSearchParams(loc.search)
  const onDash = loc.pathname.startsWith('/dashboard')
  const tab = params.get('tab') || 'live'

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('rokit:rail') === 'collapsed' } catch { return false }
  })
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('rokit:rail', next ? 'collapsed' : 'expanded') } catch { /* ignore */ }
      return next
    })

  const doLogout = async () => { await logout(); nav('/') }

  return (
    <>
      <div className="bg-aura" />
      <div className="shell">
        <aside className={`rail ${collapsed ? '' : 'expanded'}`}>
          <div className="rail-top">
            <Logo to="/" word size={36} />
          </div>

          <nav className="rail-nav">
            <RailItem icon={Home} label="Home" to="/" active={loc.pathname === '/'} />
            {user && (
              <>
                <RailItem icon={MessagesSquare} label="Live chat" to="/dashboard?tab=live" active={onDash && tab === 'live'} />
                <RailItem icon={Tv} label="Channels" to="/dashboard?tab=channels" active={onDash && tab === 'channels'} />
                <RailItem icon={Wrench} label="Stream tools" to="/dashboard?tab=overlay" active={onDash && (tab === 'overlay' || tab === 'hype')} />
                {onDash && (tab === 'overlay' || tab === 'hype') && (
                  <div className="rail-sub">
                    <RailItem icon={MessageSquare} label="Chat overlay" to="/dashboard?tab=overlay" active={tab === 'overlay'} className="rail-subitem" />
                    <RailItem icon={Flame} label="Hype meter" to="/dashboard?tab=hype" active={tab === 'hype'} className="rail-subitem" />
                  </div>
                )}
                <RailItem icon={Film} label="Clips" to="/dashboard?tab=clips" active={onDash && tab === 'clips'} />
                <RailItem icon={BarChart3} label="Analytics" to="/dashboard?tab=analytics" active={onDash && tab === 'analytics'} />
                <RailItem icon={UserRound} label="Account" to="/dashboard?tab=account" active={onDash && tab === 'account'} />
              </>
            )}
          </nav>

          <div className="rail-spacer" />

          {user ? (
            <RailItem icon={LogOut} label="Log out" onClick={doLogout} className="rail-logout" />
          ) : (
            <RailItem icon={LogIn} label="Sign in" to="/login" active={loc.pathname === '/login'} className="rail-signin" />
          )}

          <RailItem
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? 'Expand' : 'Collapse'}
            onClick={toggle}
            className="rail-toggle"
          />
        </aside>

        <div className="shell-main">{children}</div>
      </div>
    </>
  )
}
