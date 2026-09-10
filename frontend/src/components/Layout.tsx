import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, Navigation, BarChart3, Bell,
  ShieldAlert, Droplets, LogOut, User
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const CITIZEN_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/map',       icon: Map,             label: 'GIS Map' },
  { to: '/route',     icon: Navigation,      label: 'Route Planner' },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/alerts',    icon: Bell,            label: 'Alerts' },
]

const ADMIN_NAV = [
  { to: '/authority', icon: ShieldAlert,     label: 'Admin Dashboard' },
  { to: '/map',       icon: Map,             label: 'GIS Map' },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/alerts',    icon: Bell,            label: 'Alert Center' },
]

const ALL_LABELS = [...CITIZEN_NAV, ...ADMIN_NAV]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const navItems = isAdmin ? ADMIN_NAV : CITIZEN_NAV

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div style={{ display: 'flex' }}>
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #00d4aa, #6c63ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Droplets size={20} color="#000" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                UFNS
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                FLOOD NOWCASTING
              </div>
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: isAdmin ? 'rgba(59,130,246,0.15)' : 'rgba(0,212,170,0.12)',
            color: isAdmin ? '#3b82f6' : '#00d4aa',
            border: `1px solid ${isAdmin ? 'rgba(59,130,246,0.3)' : 'rgba(0,212,170,0.25)'}`,
          }}>
            {isAdmin ? '⚙️' : '👤'} {user?.role || 'Citizen'}
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom items */}
        <div style={{ padding: '0 12px', borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 8 }}>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <User size={18} />
            <span>Profile</span>
          </NavLink>
          <button onClick={logout}
            className="nav-item"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="main-content" style={{ flex: 1 }}>
        {/* Top bar */}
        <div className="topbar">
          <div style={{ flex: 1, fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 18 }}>
            {ALL_LABELS.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard'}
          </div>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--risk-green)',
              boxShadow: '0 0 8px var(--risk-green)',
              display: 'inline-block',
              animation: 'blink 2s ease-in-out infinite',
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>LIVE</span>
          </div>
          {/* User avatar */}
          <NavLink to="/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: isAdmin ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #00d4aa, #6c63ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              {initials}
            </div>
          </NavLink>
        </div>

        <Outlet />
      </main>
    </div>
  )
}
