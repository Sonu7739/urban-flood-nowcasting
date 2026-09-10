import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login, isLoading, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    try {
      await login(email, password)
      // Redirect based on role is handled in App.tsx via AuthContext
      navigate('/dashboard')
    } catch (err: any) {
      setLocalError(err.message || 'Login failed')
    }
  }

  // Demo login shortcut
  const demoLogin = async (role: 'citizen' | 'admin') => {
    setEmail(role === 'admin' ? 'admin@ufns.in' : 'citizen@ufns.in')
    setPassword('Demo@1234')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 50%, #0a1628 100%)',
      padding: '20px',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(0,212,170,0.04) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59,130,246,0.04) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 440, position: 'relative', zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.2), rgba(59,130,246,0.2))',
            border: '1px solid rgba(0,212,170,0.3)', marginBottom: 16,
          }}>
            <Shield size={32} color="#00d4aa" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e8f0ff', margin: 0 }}>UFNS</h1>
          <p style={{ fontSize: 13, color: '#7d9bc0', marginTop: 4 }}>Urban Flood Nowcasting System</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '36px 40px', backdropFilter: 'blur(20px)',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8f0ff', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#7d9bc0', marginBottom: 28 }}>Sign in to access your dashboard</p>

          {(localError || error) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#ef4444' }}>{localError || error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#7d9bc0" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e8f0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#7d9bc0" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Your password"
                  style={{
                    width: '100%', padding: '12px 42px 12px 42px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e8f0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPassword ? <EyeOff size={16} color="#7d9bc0" /> : <Eye size={16} color="#7d9bc0" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={isLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', color: '#fff',
                fontWeight: 700, fontSize: 15, transition: 'opacity 0.2s',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo buttons */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button onClick={() => demoLogin('citizen')}
              style={{
                flex: 1, padding: '9px', borderRadius: 8, border: '1px solid rgba(0,212,170,0.3)',
                background: 'rgba(0,212,170,0.08)', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              Demo: Citizen
            </button>
            <button onClick={() => demoLogin('admin')}
              style={{
                flex: 1, padding: '9px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)',
                background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              Demo: Admin
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#7d9bc0' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#00d4aa', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
