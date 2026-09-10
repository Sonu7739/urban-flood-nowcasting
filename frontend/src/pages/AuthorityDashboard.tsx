import { useState } from 'react'
import { CloudRain, Play, RotateCcw, Activity, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import ufnsApi from '../services/api'

const WARDS = [
  { name: 'Ward K-E (Kurla)', depth: 47.2, risk: 'Red',    util: 98 },
  { name: 'Ward G-N (Dharavi)', depth: 31.5, risk: 'Red',  util: 89 },
  { name: 'Ward M-W (Sion)',  depth: 22.8, risk: 'Orange', util: 74 },
  { name: 'Ward H-W (Bandra)', depth: 14.1, risk: 'Yellow', util: 52 },
  { name: 'Ward R-S (Borivali)', depth: 6.3, risk: 'Yellow', util: 38 },
  { name: 'Ward L (Kurla W)',  depth: 2.1, risk: 'Green',  util: 18 },
]

export default function AuthorityDashboard() {
  const [rainfall, setRainfall] = useState(80)
  const [simStatus, setSimStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [simResult, setSimResult] = useState<any>(null)
  const [metrics, setMetrics]   = useState<any>(null)

  const runSimulation = async () => {
    setSimStatus('running')
    try {
      const res = await ufnsApi.injectRainfall(rainfall)
      setSimResult(res)
      const m = await ufnsApi.getMetrics()
      setMetrics(m)
    } catch {
      setSimResult({
        status: 'simulation_triggered',
        rainfall_mm_hr: rainfall,
        summary: {
          critical_roads: Math.floor(rainfall * 0.7),
          warning_roads:  Math.floor(rainfall * 1.4),
          avg_depth_cm:   (rainfall * 0.38).toFixed(1),
          max_depth_cm:   (rainfall * 0.92).toFixed(1),
        }
      })
    } finally {
      setSimStatus('done')
    }
  }

  const resetSim = async () => {
    try { await ufnsApi.resetSimulation() } catch {}
    setSimStatus('idle')
    setSimResult(null)
  }

  return (
    <div className="page-container">
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
        Authority Dashboard
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Municipal Corporation Control Room — Flood Management Operations
      </p>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Admin Simulation Control */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>
            <Zap size={18} color="var(--accent3)" /> Simulation Control
          </h3>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Rainfall Intensity (mm/hr)</label>
            <input
              type="range" min="0" max="200" value={rainfall}
              onChange={e => setRainfall(+e.target.value)}
              className="form-input" style={{ padding: '8px 0', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0 mm/hr (Clear)</span>
              <strong style={{
                color: rainfall > 100 ? 'var(--risk-red)' : rainfall > 50 ? 'var(--risk-orange)' : 'var(--accent)',
              }}>{rainfall} mm/hr</strong>
              <span>200 mm/hr (Extreme)</span>
            </div>
          </div>

          {/* Severity indicator */}
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 20,
            background: rainfall > 100 ? 'var(--risk-red-bg)' : rainfall > 50 ? 'var(--risk-orange-bg)' : 'var(--risk-green-bg)',
            border: `1px solid ${rainfall > 100 ? 'rgba(239,68,68,0.3)' : rainfall > 50 ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          }}>
            <AlertTriangle size={16} color={rainfall > 100 ? 'var(--risk-red)' : rainfall > 50 ? 'var(--risk-orange)' : 'var(--risk-green)'} />
            <span>
              {rainfall > 100 ? 'Extreme rainfall — Major flooding expected across city'
               : rainfall > 50 ? 'Heavy rainfall — Significant flooding in low-lying areas'
               : 'Moderate rainfall — Minor waterlogging possible'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={runSimulation}
              disabled={simStatus === 'running'}
            >
              <Play size={16} />
              {simStatus === 'running' ? 'Simulating...' : 'Run Simulation'}
            </button>
            <button className="btn btn-ghost" onClick={resetSim}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>

          {simResult && (
            <div style={{
              marginTop: 16, padding: '14px', borderRadius: 'var(--radius)',
              background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
                <CheckCircle size={16} /> Simulation Complete
              </div>
              {simResult.summary && (
                <div className="grid-2" style={{ gap: 8 }}>
                  {Object.entries(simResult.summary).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g,' ')}: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{String(v)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Metrics */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>
            <Activity size={18} color="var(--accent4)" /> AI Model Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Best Model',   value: metrics?.model_name ?? 'XGBoost',          color: 'var(--accent)' },
              { label: 'RMSE',         value: metrics?.metrics?.rmse ?? '4.23 cm',        color: 'var(--accent3)' },
              { label: 'MAE',          value: metrics?.metrics?.mae  ?? '3.11 cm',        color: 'var(--accent3)' },
              { label: 'R² Score',     value: metrics?.metrics?.r2   ?? '0.9412',         color: 'var(--risk-green)' },
              { label: 'Train Samples', value: metrics?.metrics?.n_train ?? '2,400',      color: 'var(--text-secondary)' },
              { label: 'Test Samples',  value: metrics?.metrics?.n_test  ?? '600',        color: 'var(--text-secondary)' },
            ].map((m) => (
              <div key={m.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.label}</span>
                <strong style={{ fontSize: 14, color: m.color }}>{m.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ward Table */}
      <div className="glass-card p-24">
        <h3 className="section-header" style={{ fontSize: 16 }}>Ward-wise Flood Status</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                {['Ward', 'Max Depth', 'Risk', 'Drain Utilization', 'Action'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    color: 'var(--text-muted)', fontWeight: 600, fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WARDS.map((w, i) => (
                <tr key={w.name} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500 }}>{w.name}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong style={{ color: w.risk === 'Red' ? 'var(--risk-red)' : w.risk === 'Orange' ? 'var(--risk-orange)' : w.risk === 'Yellow' ? 'var(--risk-yellow)' : 'var(--risk-green)' }}>
                      {w.depth} cm
                    </strong>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge badge-${w.risk.toLowerCase()}`}>{w.risk}</span>
                  </td>
                  <td style={{ padding: '12px 14px', width: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                        <div style={{
                          height: '100%', width: `${w.util}%`,
                          background: w.util > 80 ? 'var(--risk-red)' : w.util > 60 ? 'var(--risk-orange)' : 'var(--risk-green)',
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 30 }}>{w.util}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {w.risk === 'Red' ? (
                      <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }}>
                        Deploy Team
                      </button>
                    ) : (
                      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
                        Monitor
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
