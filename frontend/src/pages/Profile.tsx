import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Lock, Shield, MapPin, Bell, Eye, EyeOff, Activity, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user, logout } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [savedLocations] = useState([
    { id: 1, name: 'Home', lat: 19.0760, lon: 72.8777 },
    { id: 2, name: 'Office', lat: 19.0400, lon: 72.8490 },
  ])
  const [notifications, setNotifications] = useState({ flood: true, rainfall: true, evacuation: true, system: false })

  const activityLog = [
    { action: 'Logged in', time: '2026-09-09 21:30', icon: '🔑' },
    { action: 'Viewed flood map', time: '2026-09-09 21:32', icon: '🗺️' },
    { action: 'Searched safe route', time: '2026-09-09 21:45', icon: '🛣️' },
    { action: 'Chatted with FloodAssist AI', time: '2026-09-09 21:50', icon: '🤖' },
  ]

  const isAdmin = user?.role === 'Admin'

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e8f0ff', margin: 0 }}>
          {isAdmin ? 'Admin Profile' : 'My Profile'}
        </h1>
        <p style={{ fontSize: 13, color: '#7d9bc0', marginTop: 4 }}>Manage your account settings and preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        {/* Left — Avatar & Quick Info */}
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '28px 24px', textAlign: 'center', marginBottom: 16,
            }}
          >
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${isAdmin ? '#3b82f6' : '#00d4aa'}, ${isAdmin ? '#8b5cf6' : '#3b82f6'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>
              {isAdmin ? '⚙️' : '👤'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e8f0ff', marginBottom: 4 }}>
              {user?.full_name || 'UFNS User'}
            </div>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: isAdmin ? 'rgba(59,130,246,0.15)' : 'rgba(0,212,170,0.15)',
              color: isAdmin ? '#3b82f6' : '#00d4aa',
              border: `1px solid ${isAdmin ? 'rgba(59,130,246,0.3)' : 'rgba(0,212,170,0.3)'}`,
            }}>
              {user?.role || 'Citizen'}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#7d9bc0' }}>{user?.email}</div>
            <div style={{ fontSize: 13, color: '#7d9bc0' }}>{user?.phone}</div>

            <button
              onClick={logout}
              style={{
                marginTop: 20, width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </motion.div>

          {/* Admin-specific info */}
          {isAdmin && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 16, padding: '18px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7d9bc0', marginBottom: 12, letterSpacing: '0.5px' }}>ADMIN DETAILS</div>
              {[
                { label: 'Department', value: 'Disaster Management' },
                { label: 'Employee ID', value: 'DM-2026-001' },
                { label: 'Access Level', value: 'Full' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#7d9bc0' }}>{label}</span>
                  <span style={{ color: '#e8f0ff', fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Personal Info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <User size={16} color="#00d4aa" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>Personal Information</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'FULL NAME', value: user?.full_name || '', icon: User },
                { label: 'EMAIL', value: user?.email || '', icon: Mail },
                { label: 'PHONE', value: user?.phone || '', icon: Phone },
                { label: 'ROLE', value: user?.role || 'Citizen', icon: Shield },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#7d9bc0', display: 'block', marginBottom: 6 }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <Icon size={14} color="#7d9bc0" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      defaultValue={value} readOnly
                      style={{
                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e8f0ff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Change Password */}
          {!isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Lock size={16} color="#00d4aa" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>Change Password</span>
              </div>
              <div style={{ position: 'relative', maxWidth: 400 }}>
                <Lock size={14} color="#7d9bc0" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: '100%', padding: '10px 40px 10px 36px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#e8f0ff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPassword ? <EyeOff size={14} color="#7d9bc0" /> : <Eye size={14} color="#7d9bc0" />}
                </button>
              </div>
              <button style={{
                marginTop: 12, padding: '9px 20px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                Update Password
              </button>
            </motion.div>
          )}

          {/* Saved Locations (Citizen) */}
          {!isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <MapPin size={16} color="#00d4aa" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>Saved Locations</span>
              </div>
              {savedLocations.map(loc => (
                <div key={loc.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MapPin size={14} color="#00d4aa" />
                    <span style={{ fontSize: 13, color: '#e8f0ff', fontWeight: 600 }}>{loc.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#7d9bc0' }}>{loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Notification Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Bell size={16} color="#00d4aa" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>Notification Preferences</span>
            </div>
            {Object.entries(notifications).map(([key, val]) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 13, color: '#e8f0ff', textTransform: 'capitalize' }}>
                  {key === 'flood' ? '🌊 Flood Alerts' : key === 'rainfall' ? '🌧️ Rainfall Warnings' : key === 'evacuation' ? '🚶 Evacuation Orders' : '⚙️ System Updates'}
                </span>
                <button
                  onClick={() => setNotifications(p => ({ ...p, [key]: !val }))}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: val ? '#00d4aa' : 'rgba(255,255,255,0.12)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: val ? 23 : 3, transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </motion.div>

          {/* Activity Log (Admin) */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={16} color="#3b82f6" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>Activity Log</span>
              </div>
              {activityLog.map((log, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: i < activityLog.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{ fontSize: 18 }}>{log.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e8f0ff' }}>{log.action}</div>
                    <div style={{ fontSize: 11, color: '#7d9bc0' }}>{log.time}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
