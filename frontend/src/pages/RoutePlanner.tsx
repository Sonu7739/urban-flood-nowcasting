import { useState } from 'react'
import { Navigation, MapPin, Search, AlertTriangle, ArrowRight, ShieldCheck, Clock } from 'lucide-react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import ufnsApi, { RouteResult } from '../services/api'
import 'leaflet/dist/leaflet.css'

export default function RoutePlanner() {
  const [start, setStart] = useState('Dadar Station')
  const [end, setEnd] = useState('BKC Complex')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResult | null>(null)

  // Mock coordinates for demo
  const MOCK_COORDS: Record<string, [number, number]> = {
    'Dadar Station': [19.0178, 72.8438],
    'BKC Complex': [19.0632, 72.8653],
    'Andheri West': [19.1172, 72.8335],
    'Colaba': [18.9067, 72.8147],
  }

  const handleRoute = async () => {
    setLoading(true)
    try {
      const sCoords = MOCK_COORDS[start] || [19.076, 72.877]
      const eCoords = MOCK_COORDS[end] || [19.120, 72.900]
      const res = await ufnsApi.getRoute(sCoords[0], sCoords[1], eCoords[0], eCoords[1])
      setResult(res)
    } catch {
      // Mock fallback
      setResult({
        route: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[72.8438, 19.0178], [72.855, 19.040], [72.8653, 19.0632]]
          },
          properties: {}
        },
        eta_minutes: 24,
        distance_m: 6500,
        avoided_roads: ['R0123 (Flooded: 35cm)', 'R0451 (Flooded: 22cm)'],
        safe: true
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div className="grid-3" style={{ gap: 24, flex: 1 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass-card p-24">
            <h2 className="section-header" style={{ fontSize: 18, marginBottom: 16 }}>
              <Navigation size={20} color="var(--accent)" /> Flood-Safe Routing
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 32, left: 12 }} />
                <label className="form-label">Starting Point</label>
                <input
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  list="locations"
                />
              </div>
              <div style={{ paddingLeft: 16, height: 16, borderLeft: '2px dashed var(--border-glass)', marginLeft: 3 }} />
              <div style={{ position: 'relative' }}>
                <MapPin size={16} color="var(--accent2)" style={{ position: 'absolute', top: 32, left: 12 }} />
                <label className="form-label">Destination</label>
                <input
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  list="locations"
                />
              </div>

              <datalist id="locations">
                {Object.keys(MOCK_COORDS).map(l => <option key={l} value={l} />)}
              </datalist>

              <button
                className="btn btn-primary"
                style={{ justifyContent: 'center', marginTop: 12, padding: '14px' }}
                onClick={handleRoute}
                disabled={loading}
              >
                {loading ? 'Finding Safe Route...' : <><Search size={18} /> Find Route</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="glass-card p-24" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 className="section-header" style={{ fontSize: 16, marginBottom: 16 }}>Route Summary</h3>

              <div className="grid-2" style={{ marginBottom: 20, gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>ETA</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={18} /> {result.eta_minutes} min
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Distance</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {(result.distance_m / 1000).toFixed(1)} km
                  </div>
                </div>
              </div>

              {result.safe ? (
                <div className="alert-banner safe" style={{ marginBottom: 16 }}>
                  <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                  <div>Safe route found! Avoiding all roads with &gt;15 cm water depth.</div>
                </div>
              ) : (
                <div className="alert-banner warning" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>Could not avoid all flooding. Proceed with extreme caution.</div>
                </div>
              )}

              {result.avoided_roads.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Roads Avoided (Flooded)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.avoided_roads.map((r, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', background: 'var(--risk-red-bg)', color: 'var(--risk-red)',
                        borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        <AlertTriangle size={12} /> {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="glass-card" style={{ gridColumn: 'span 2', overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={[19.040, 72.855]} zoom={12} style={{ height: '100%', width: '100%', minHeight: 400 }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; CartoDB'
            />
            {result?.route && (
              <GeoJSON
                key={JSON.stringify(result.route)}
                data={result.route}
                style={{ color: '#00d4aa', weight: 6, opacity: 0.8 }}
              />
            )}
          </MapContainer>
          {!result && !loading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Navigation size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <div style={{ fontSize: 18, fontWeight: 500 }}>Enter points to find a safe route</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Dijkstra algorithm avoids roads &gt; 15cm deep</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
