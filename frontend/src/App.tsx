import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
          <Route path="/route"     element={<RoutePlanner />} />
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
      <AppContent />
    </AuthProvider>
  )
}
