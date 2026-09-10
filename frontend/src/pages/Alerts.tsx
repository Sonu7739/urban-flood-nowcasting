import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, AlertTriangle } from 'lucide-react'

interface Alert {
  id: number
  title: string
  message: string
  risk_level: 'Green' | 'Yellow' | 'Orange' | 'Red'
  is_read: number
  created_at: string
}

const RISK_COLORS: Record<string, string> = {
  Green: '#22c55e', Yellow: '#eab308', Orange: '#f97316', Red: '#ef4444',
}
const RISK_ICONS: Record<string, string> = {
  Green: '✅', Yellow: '⚠️', Orange: '🔶', Red: '🚨',
}

const API = '/api'

// Mock data for when backend isn't running
const MOCK_ALERTS: Alert[] = [
  { id: 1, title: 'Flash Flood Warning', message: 'Flooding predicted near MG Road in approximately 40 minutes. Water depth: 28cm expected.', risk_level: 'Red', is_read: 0, created_at: new Date().toISOString() },
  { id: 2, title: 'Drainage Overload Alert', message: 'Drainage system capacity at 85% in Sion Junction. Risk of overflow in 60 minutes.', risk_level: 'Orange', is_read: 0, created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 3, title: 'Heavy Rainfall Advisory', message: 'Heavy rainfall expected: 72 mm/hr. Avoid low-lying areas and underpasses.', risk_level: 'Yellow', is_read: 1, created_at: new Date(Date.now() - 900000).toISOString() },
  { id: 4, title: 'All Clear - Dharavi Sector', message: 'Water levels returning to normal in Dharavi. Roads reopening.', risk_level: 'Green', is_read: 1, created_at: new Date(Date.now() - 1800000).toISOString() },
]

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [toasts, setToasts] = useState<Alert[]>([])
  const [showBell, setShowBell] = useState(false)
  const [filter, setFilter] = useState<string>('All')

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API}/alerts/notifications`)
        const data = await res.json()
        setAlerts(data)
      } catch {
        setAlerts(MOCK_ALERTS)
      }
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  // Show toasts for new unread alerts
  useEffect(() => {
    const unread = alerts.filter(a => !a.is_read).slice(0, 3)
    setToasts(unread)
  }, [alerts])

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: 1 } : a))
  }

  const filtered = filter === 'All' ? alerts : alerts.filter(a => a.risk_level === filter)
  const unreadCount = alerts.filter(a => !a.is_read).length

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: 80, right: 20, zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              style={{
                background: 'rgba(10,22,40,0.97)', backdropFilter: 'blur(20px)',
                border: `1px solid ${RISK_COLORS[toast.risk_level]}44`,
                borderLeft: `4px solid ${RISK_COLORS[toast.risk_level]}`,
                borderRadius: 12, padding: '14px 16px', width: 320,
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${RISK_COLORS[toast.risk_level]}11`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 18 }}>{RISK_ICONS[toast.risk_level]}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ff', marginBottom: 4 }}>{toast.title}</div>
                    <div style={{ fontSize: 12, color: '#7d9bc0', lineHeight: 1.5 }}>{toast.message}</div>
                  </div>
                </div>
                <button onClick={() => dismiss(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d9bc0', padding: 2, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e8f0ff', margin: 0 }}>Alert Center</h1>
          <p style={{ fontSize: 13, color: '#7d9bc0', marginTop: 4 }}>Real-time flood warnings and notifications</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowBell(v => !v)}
              style={{
                width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)', color: '#e8f0ff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={18} />
            </button>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, background: '#ef4444',
                color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%',
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #0a0f1e',
              }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Risk level summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {(['Red', 'Orange', 'Yellow', 'Green'] as const).map(risk => {
          const count = alerts.filter(a => a.risk_level === risk).length
          return (
            <motion.div
              key={risk} whileHover={{ scale: 1.02 }}
              onClick={() => setFilter(filter === risk ? 'All' : risk)}
              style={{
                background: filter === risk ? `${RISK_COLORS[risk]}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === risk ? RISK_COLORS[risk] : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{RISK_ICONS[risk]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: RISK_COLORS[risk] }}>{count}</div>
              <div style={{ fontSize: 12, color: '#7d9bc0', marginTop: 2 }}>
                {risk === 'Red' ? 'Critical' : risk === 'Orange' ? 'Warning' : risk === 'Yellow' ? 'Caution' : 'Info'} Alerts
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['All', 'Red', 'Orange', 'Yellow', 'Green'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: filter === f ? (f === 'All' ? '#00d4aa' : RISK_COLORS[f]) : 'rgba(255,255,255,0.06)',
              color: filter === f ? '#000' : '#7d9bc0', transition: 'all 0.2s',
            }}
          >
            {f}
          </button>
        ))}
        <button
          onClick={() => setAlerts(prev => prev.map(a => ({ ...a, is_read: 1 })))}
          style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 99,
            border: '1px solid rgba(255,255,255,0.1)', background: 'none',
            color: '#7d9bc0', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <CheckCheck size={13} /> Mark all read
        </button>
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence>
          {filtered.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.04 }}
              style={{
                background: alert.is_read ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${alert.is_read ? 'rgba(255,255,255,0.06)' : RISK_COLORS[alert.risk_level] + '33'}`,
                borderLeft: `4px solid ${RISK_COLORS[alert.risk_level]}`,
                borderRadius: 14, padding: '16px 20px',
                opacity: alert.is_read ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{RISK_ICONS[alert.risk_level]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>{alert.title}</span>
                    {!alert.is_read && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: `${RISK_COLORS[alert.risk_level]}22`, color: RISK_COLORS[alert.risk_level],
                      }}>NEW</span>
                    )}
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 99,
                      background: `${RISK_COLORS[alert.risk_level]}15`, color: RISK_COLORS[alert.risk_level],
                      fontWeight: 600, marginLeft: 'auto',
                    }}>
                      {alert.risk_level}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#7d9bc0', margin: 0, lineHeight: 1.6 }}>{alert.message}</p>
                  <div style={{ fontSize: 11, color: '#4d6280', marginTop: 8 }}>
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => dismiss(alert.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d9bc0', padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7d9bc0' }}>
            <AlertTriangle size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <p>No alerts for this filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
