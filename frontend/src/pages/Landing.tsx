import { useNavigate } from 'react-router-dom'
import { Droplets, Brain, Map, AlertTriangle, ArrowRight, Navigation, Zap, Shield } from 'lucide-react'
import RainAnimation from '../components/RainAnimation'

const FEATURES = [
  { icon: Brain,          title: 'AI-Powered',        desc: 'XGBoost + LightGBM ensemble predicts water depth with 94%+ confidence', color: '#00d4aa' },
  { icon: Map,            title: 'GIS Dashboard',     desc: 'Real-time flood heatmap on interactive Leaflet maps with layer controls', color: '#6c63ff' },
  { icon: Navigation,     title: 'Safe Routing',      desc: 'Dijkstra route planner avoids flooded roads — find the safest path', color: '#ffd93d' },
  { icon: AlertTriangle,  title: 'Early Alerts',      desc: '0–3 hour flood nowcasting with WhatsApp-ready alert payloads', color: '#ff6b6b' },
  { icon: Zap,            title: 'Real-time Updates', desc: 'Simulation refreshes every 5 minutes with live WebSocket push', color: '#22c55e' },
  { icon: Shield,         title: 'Authority Tools',   desc: 'Admin dashboard with rainfall injection for demo & training', color: '#f97316' },
]

const STATS = [
  { value: '94%',    label: 'Prediction Accuracy' },
  { value: '0–3hr', label: 'Lead Time' },
  { value: '500+',  label: 'Road Segments' },
  { value: '5min',  label: 'Update Interval' },
]

export default function Landing() {
  const nav = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      <RainAnimation intensity={50} />

      {/* Glow Orbs */}
      <div style={{
        position: 'absolute', top: -200, left: -200,
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -200, right: -100,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 60px',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #00d4aa, #6c63ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Droplets size={22} color="#000" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>UFNS</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>SIH 26085</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => nav('/login')}>Login</button>
          <button className="btn btn-primary" onClick={() => nav('/dashboard')}>
            Launch Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '100px 60px 80px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 99,
          background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)',
          fontSize: 12, color: 'var(--accent)', fontWeight: 600,
          marginBottom: 28, letterSpacing: '0.5px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          SMART INDIA HACKATHON 2026 — Problem Statement 26085
        </div>

        <h1 style={{
          fontFamily: 'var(--font-head)', fontSize: 'clamp(40px, 7vw, 80px)',
          fontWeight: 900, lineHeight: 1.05, marginBottom: 24,
        }}>
          <span className="gradient-text">Urban Flood</span>
          <br />Nowcasting System
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 22px)', color: 'var(--text-secondary)',
          maxWidth: 680, margin: '0 auto 48px', lineHeight: 1.7,
        }}>
          Predict street-level flooding <strong style={{ color: 'var(--accent)' }}>0–3 hours before it occurs</strong>.
          AI-powered water depth predictions for every road segment — protecting lives, enabling safer cities.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary pulse"
            style={{ fontSize: 16, padding: '14px 32px' }}
            onClick={() => nav('/dashboard')}
          >
            <Droplets size={20} /> Open Dashboard
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 16, padding: '14px 32px' }}
            onClick={() => nav('/map')}
          >
            <Map size={20} /> View Live Map
          </button>
        </div>
      </section>

      {/* Stats */}
      <section style={{
        position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center', gap: 0,
        padding: '0 60px 80px',
      }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{
            flex: 1, maxWidth: 200, textAlign: 'center',
            padding: '28px 20px',
            borderRight: i < STATS.length - 1 ? '1px solid var(--border-glass)' : 'none',
          }}>
            <div style={{
              fontFamily: 'var(--font-head)', fontSize: 48, fontWeight: 900,
              color: 'var(--accent)', lineHeight: 1,
            }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 60px 100px' }}>
        <h2 style={{
          fontFamily: 'var(--font-head)', fontSize: 36, fontWeight: 800,
          textAlign: 'center', marginBottom: 48,
        }}>
          Everything You Need
        </h2>
        <div className="grid-3" style={{ maxWidth: 1100, margin: '0 auto' }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card p-24" style={{ cursor: 'default' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `${f.color}22`, border: `1px solid ${f.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <f.icon size={24} color={f.color} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '60px',
        borderTop: '1px solid var(--border-glass)',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(108,99,255,0.05))',
          borderRadius: 24,
          border: '1px solid var(--border-glass)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
            Built for Smart India Hackathon
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 16 }}>
            Team wallBreakers · Problem Statement 26085 · Real-time Flood Forecasting
          </p>
          <button
            className="btn btn-primary"
            style={{ fontSize: 16, padding: '14px 36px' }}
            onClick={() => nav('/dashboard')}
          >
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  )
}
