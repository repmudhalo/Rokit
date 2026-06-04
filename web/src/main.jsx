import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth.jsx'
import AppShell from './components/AppShell.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Overlay from './pages/Overlay.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import './styles.css'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Root() {
  return (
    <Routes>
      {/* Standalone (no shell): transparent overlay + focused auth screens. */}
      <Route path="/overlay" element={<Overlay />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Shell (left icon rail): public landing + the app. */}
      <Route path="/" element={<AppShell><Landing /></AppShell>} />
      <Route
        path="/dashboard"
        element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
