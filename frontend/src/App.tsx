import { Routes, Route, Navigate } from 'react-router-dom'
import { Component, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LocationProvider } from './contexts/LocationContext'
import Layout from './components/Layout'
import Chatbot from './components/Chatbot'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import CitizenDashboard from './pages/CitizenDashboard'
import AuthorityDashboard from './pages/AuthorityDashboard'
import GISMap from './pages/GISMap'
import RoutePlanner from './pages/RoutePlanner'
import Analytics from './pages/Analytics'
import Alerts from './pages/Alerts'

// ── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{
          padding: 40, textAlign: 'center', color: '#ef4444',
          background: 'rgba(239,68,68,0.08)', borderRadius: 16, margin: 24,
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#7d9bc0', marginBottom: 20 }}>
            {(this.state.error as Error).message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Protected Route ────────────────────────────────────────────────────────────
function RequireAuth({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/dashboard" replace />
  return children
}

// ── App content (needs AuthContext) ───────────────────────────────────────────
function AppContent() {
  const { user } = useAuth()

  return (
    <>
      <Routes>
        {/* Public pages */}
        <Route path="/"       element={<Landing />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected pages inside Layout */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {/* Citizen routes */}
          <Route path="/dashboard" element={<CitizenDashboard />} />
          <Route path="/map"       element={<GISMap />} />
          <Route path="/route"     element={
            <ErrorBoundary>
              <RoutePlanner />
            </ErrorBoundary>
          } />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/profile"   element={<Profile />} />

          {/* Admin route */}
          <Route path="/authority" element={
            <RequireAuth adminOnly>
              <AuthorityDashboard />
            </RequireAuth>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Floating Chatbot — shown on all authenticated pages */}
      {user && <Chatbot />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <AppContent />
      </LocationProvider>
    </AuthProvider>
  )
}
