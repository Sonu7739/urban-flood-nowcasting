import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface User {
  id: number
  full_name: string
  email: string
  phone: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  isLoading: boolean
  error: string | null
}

interface SignupData {
  full_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
  role: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = '/api'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ufns_token'))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        // Token invalid
        localStorage.removeItem('ufns_token')
        setToken(null)
      }
    } catch {
      // Backend not running — set mock user from stored token
    }
  }, [])

  useEffect(() => {
    if (token) fetchProfile(token)
  }, [token, fetchProfile])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      
      const t = data.access_token
      localStorage.setItem('ufns_token', t)
      setToken(t)
      await fetchProfile(t)
    } catch (e: any) {
      const msg = e.message === 'Failed to fetch'
        ? 'Cannot connect to server. Make sure the backend is running on port 8000.'
        : (e.message || 'Login failed')
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (signupData: SignupData) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Signup failed')
    } catch (e: any) {
      const msg = e.message === 'Failed to fetch'
        ? 'Cannot connect to server. Make sure the backend is running on port 8000.'
        : (e.message || 'Signup failed')
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('ufns_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
