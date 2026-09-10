import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Lock, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
function validatePhone(phone: string) {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))
}
function validatePassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)
}

export default function Signup() {
  const { signup, isLoading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirm_password: '', role: 'Citizen',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (!form.full_name.trim()) return 'Full name is required'
    if (!validateEmail(form.email)) return 'Invalid email address'
    if (!validatePhone(form.phone)) return 'Invalid phone number (10 digits, starts with 6-9)'
    if (!validatePassword(form.password)) return 'Password must be 8+ chars with uppercase and number'
    if (form.password !== form.confirm_password) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    try {
      await signup(form)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 50%, #0a1628 100%)',
      padding: '20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 480 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.2), rgba(59,130,246,0.2))',
            border: '1px solid rgba(0,212,170,0.3)', marginBottom: 12,
          }}>
            <Shield size={28} color="#00d4aa" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e8f0ff', margin: 0 }}>Create Account</h1>
          <p style={{ fontSize: 13, color: '#7d9bc0', marginTop: 4 }}>Join Urban Flood Nowcasting System</p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '32px 36px', backdropFilter: 'blur(20px)',
        }}>
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ fontSize: 13, color: '#22c55e' }}>Account created! Redirecting to login...</span>
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            {[
              { key: 'full_name', label: 'FULL NAME', icon: User, type: 'text', placeholder: 'Rahul Sharma' },
              { key: 'email', label: 'EMAIL', icon: Mail, type: 'email', placeholder: 'you@example.com' },
              { key: 'phone', label: 'PHONE', icon: Phone, type: 'tel', placeholder: '9876543210' },
            ].map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>
                  {label}
                </label>
                <div style={{ position: 'relative' }}>
                  <Icon size={16} color="#7d9bc0" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={type} value={form[key as keyof typeof form]} onChange={e => update(key, e.target.value)}
                    placeholder={placeholder} required
                    style={{
                      width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e8f0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Role */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>
                ROLE
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Citizen', 'Admin'].map(role => (
                  <button
                    key={role} type="button" onClick={() => update('role', role)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                      border: form.role === role ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.1)',
                      background: form.role === role ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                      color: form.role === role ? '#00d4aa' : '#7d9bc0',
                      fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
                    }}
                  >
                    {role === 'Citizen' ? '👤' : '⚙️'} {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            {['password', 'confirm_password'].map(key => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>
                  {key === 'password' ? 'PASSWORD' : 'CONFIRM PASSWORD'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#7d9bc0" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form[key as keyof typeof form]} onChange={e => update(key, e.target.value)}
                    placeholder={key === 'password' ? 'Min 8 chars, uppercase & number' : 'Repeat password'}
                    required
                    style={{
                      width: '100%', padding: '12px 42px 12px 42px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e8f0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {key === 'password' && (
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showPassword ? <EyeOff size={16} color="#7d9bc0" /> : <Eye size={16} color="#7d9bc0" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="submit" disabled={isLoading || success}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', color: '#fff',
                fontWeight: 700, fontSize: 15, marginTop: 4, opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#7d9bc0' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#00d4aa', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
