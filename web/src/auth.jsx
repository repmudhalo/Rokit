import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [oauth, setOauth] = useState({ twitch: false })
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const { user, oauth } = await api.get('/api/auth/me')
      setUser(user)
      setOauth(oauth || { twitch: false })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const login = async (email, password) => {
    const { user } = await api.post('/api/auth/login', { email, password })
    setUser(user)
  }
  const register = async (email, password, displayName) => {
    const { user } = await api.post('/api/auth/register', { email, password, displayName })
    setUser(user)
  }
  const logout = async () => {
    await api.post('/api/auth/logout')
    setUser(null)
  }

  const updateProfile = async (patch) => {
    const { user } = await api.put('/api/profile', patch)
    setUser(user)
  }
  const changePassword = (currentPassword, newPassword) =>
    api.post('/api/profile/password', { currentPassword, newPassword })
  const resendVerification = () => api.post('/api/auth/verify-email/resend')

  return (
    <AuthCtx.Provider
      value={{
        user,
        oauth,
        loading,
        login,
        register,
        logout,
        refresh,
        updateProfile,
        changePassword,
        resendVerification,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
