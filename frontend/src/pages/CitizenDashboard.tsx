import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Droplets, AlertTriangle, TrendingUp, Navigation, MapPin,
  CloudRain, Thermometer, ArrowRight, RefreshCw,
} from 'lucide-react'
import ufnsApi, { SimulationSummary, PredictResponse } from '../services/api'

const MOCK_SUMMARY: SimulationSummary = {
  timestamp: new Date().toISOString(),
  rainfall_mm_hr: 72,
  total_roads: 500,
  critical_roads: 42,
  warning_roads: 87,
  caution_roads: 134,
  safe_roads: 237,
  avg_depth_cm: 18.4,
  max_depth_cm: 52.1,
}

const NEARBY_ALERTS = [
  { road: 'LBS Marg near Kurla', depth: 47.2, risk: 'Red', ward: 'Ward K-E' },
  { road: 'Sion-Panvel Hwy', depth: 31.5, risk: 'Red', ward: 'Ward M-W' },
  { road: 'Dharavi Main Rd', depth: 22.8, risk: 'Orange', ward: 'Ward G-N' },
  { road: 'Bandra Reclamation', depth: 14.1, risk: 'Yellow', ward: 'Ward H-W' },
]

const riskStyle = {
  Green:  { bg: 'var(--risk-green-bg)',  color: 'var(--risk-green)'  },
  Yellow: { bg: 'var(--risk-yellow-bg)', color: 'var(--risk-yellow)' },
  Orange: { bg: 'var(--risk-orange-bg)', color: 'var(--risk-orange)' },
  Red:    { bg: 'var(--risk-red-bg)',    color: 'var(--risk-red)'    },
}

export default function CitizenDashboard() {
  const nav = useNavigate()
  const [summary, setSummary]     = useState<SimulationSummary>(MOCK_SUMMARY)
  const [prediction, setPrediction] = useState<PredictResponse | null>(null)
  const [lat, setLat]             = useState('19.076')
  const [lon, setLon]             = useState('72.877')
  const [rainfall, setRainfall]   = useState('72')
  const [loading, setLoading]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchSummary = async () => {
    try {
      const data = await ufnsApi.getSummary()
      if (data && data.total_roads) setSummary(data)
    } catch { /* use mock */ }
    setLastUpdated(new Date())
  }

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, 30000)
    return () => clearInterval(interval)
  }, [])

  const handlePredict = async () => {
    setLoading(true)
    try {
      const res = await ufnsApi.predict({
        lat: parseFloat(lat), lon: parseFloat(lon), rainfall: parseFloat(rainfall),
      })
      setPrediction(res)
    } catch {
      // Mock fallback
      const depth = parseFloat(rainfall) * 0.38 + Math.random() * 5
      setPrediction({
        water_depth_cm: Math.round(depth * 10) / 10,
        risk:           depth > 30 ? 'Critical' : depth > 15 ? 'Warning' : depth > 5 ? 'Caution' : 'Safe',
        risk_color:     depth > 30 ? 'Red' : depth > 15 ? 'Orange' : depth > 5 ? 'Yellow' : 'Green',
        confidence:     0.91,
        lat:            parseFloat(lat),
        lon:            parseFloat(lon),
        rainfall_mm_hr: parseFloat(rainfall),
        timestamp:      new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const { critical_roads, warning_roads, caution_roads, safe_roads, avg_depth_cm, max_depth_cm, rainfall_mm_hr } = summary

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-20">
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800 }}>
            Citizen Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchSummary}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Critical Banner */}
      {critical_roads > 20 && (
        <div className="alert-banner critical" style={{ marginBottom: 24 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>⚠️ Active Flood Warning:</strong>{' '}
            {critical_roads} road segments in Mumbai are critically flooded (30+ cm). Avoid non-essential travel.
            Max depth recorded: <strong>{max_depth_cm} cm</strong>.
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Rainfall',    value: `${rainfall_mm_hr} mm/hr`, icon: CloudRain,     color: '#6c63ff' },
          { label: 'Critical Roads', value: critical_roads,         icon: AlertTriangle,  color: 'var(--risk-red)' },
          { label: 'Avg Depth',   value: `${avg_depth_cm} cm`,      icon: Droplets,       color: 'var(--risk-orange)' },
          { label: 'Safe Roads',  value: safe_roads,                 icon: TrendingUp,     color: 'var(--risk-green)' },
        ].map((s) => (
          <div key={s.label} className="glass-card stat-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="stat-label">{s.label}</span>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Risk Distribution */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>Road Risk Distribution</h3>
          {[
            { label: 'Critical (30+ cm)', value: critical_roads, color: 'var(--risk-red)',    pct: (critical_roads / 500) * 100 },
            { label: 'Warning (15–30 cm)', value: warning_roads,  color: 'var(--risk-orange)', pct: (warning_roads / 500) * 100 },
            { label: 'Caution (5–15 cm)', value: caution_roads,  color: 'var(--risk-yellow)', pct: (caution_roads / 500) * 100 },
            { label: 'Safe (0–5 cm)',      value: safe_roads,     color: 'var(--risk-green)',  pct: (safe_roads / 500) * 100 },
          ].map((r) => (
            <div key={r.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ color: r.color, fontWeight: 600 }}>{r.value}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${r.pct}%`,
                  background: r.color,
                  borderRadius: 3,
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Quick Predict */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>Quick Flood Prediction</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div>
                <label className="form-label">Latitude</label>
                <input className="form-input" value={lat} onChange={e => setLat(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input className="form-input" value={lon} onChange={e => setLon(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Rainfall (mm/hr)</label>
              <input
                className="form-input" type="range" min="0" max="200"
                value={rainfall} onChange={e => setRainfall(e.target.value)}
                style={{ padding: '8px 0', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>0 mm/hr</span>
                <strong style={{ color: 'var(--accent)' }}>{rainfall} mm/hr</strong>
                <span>200 mm/hr</span>
              </div>
            </div>
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }} onClick={handlePredict} disabled={loading}>
              {loading ? 'Predicting...' : <><Thermometer size={16} /> Predict Flood Depth</>}
            </button>

            {prediction && (
              <div style={{
                padding: '16px', borderRadius: 'var(--radius)',
                background: (riskStyle[prediction.risk_color as keyof typeof riskStyle] ?? riskStyle.Green).bg,
                border: `1px solid ${(riskStyle[prediction.risk_color as keyof typeof riskStyle] ?? riskStyle.Green).color}44`,
                marginTop: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--font-head)', color: (riskStyle[prediction.risk_color as keyof typeof riskStyle] ?? riskStyle.Green).color }}>
                      {prediction.water_depth_cm} cm
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Water depth</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`badge badge-${prediction.risk_color.toLowerCase()}`} style={{ marginBottom: 4 }}>
                      {prediction.risk}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Confidence: {Math.round(prediction.confidence * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nearby Alerts */}
      <div className="glass-card p-24">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="section-header" style={{ fontSize: 16, margin: 0 }}>Nearby Flood Alerts</h3>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => nav('/alerts')}>
            View All <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NEARBY_ALERTS.map((a) => (
            <div key={a.road} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px', borderRadius: 'var(--radius)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: a.risk === 'Red' ? 'var(--risk-red)' : a.risk === 'Orange' ? 'var(--risk-orange)' : 'var(--risk-yellow)',
                boxShadow: a.risk === 'Red' ? '0 0 8px var(--risk-red)' : 'none',
                animation: a.risk === 'Red' ? 'blink 1s infinite' : 'none',
              }} />
              <MapPin size={14} color="var(--text-muted)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.road}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.ward}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: (riskStyle[a.risk as keyof typeof riskStyle] ?? riskStyle.Green).color }}>
                  {a.depth} cm
                </div>
                <div className={`badge badge-${a.risk.toLowerCase()}`} style={{ fontSize: 11 }}>{a.risk}</div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => nav('/route')}
              >
                <Navigation size={12} /> Route
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
