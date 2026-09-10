import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Navigation, MapPin, Search, AlertTriangle, ShieldCheck,
  Clock, Ruler, Droplets, RefreshCw, LocateFixed,
} from 'lucide-react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const startIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.4)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8], className: '',
})
const endIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 0 3px rgba(239,68,68,0.4)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8], className: '',
})

import { API } from '../config'
const NOMINATIM = 'https://nominatim.openstreetmap.org'
const HEADERS = { 'User-Agent': 'UFNS/1.0' }

const RISK_COLOR: Record<string, string> = {
  High: '#ef4444', Medium: '#f97316', Low: '#eab308', Safe: '#22c55e',
}

interface GeocodedPlace {
  display_name: string
  lat: number
  lon: number
}

interface RouteResult {
  distance_km: number
  eta_min: number
  max_depth_cm: number
  risk: string
  avoided_roads: string[]
  flooded_roads_avoided: number
  safe: boolean
  geometry: GeoJSON.Feature
  route: GeoJSON.Feature
}

// Sub-component that flies map to bounds when route changes
function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) {
      const bounds = L.latLngBounds(coords)
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [coords, map])
  return null
}

// Geocode search field with autocomplete dropdown
function GeoSearchInput({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  iconColor,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onSelect: (place: GeocodedPlace) => void
  placeholder: string
  iconColor: string
}) {
  const [results, setResults] = useState<GeocodedPlace[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      // Try backend first
      const res = await fetch(`${API}/location/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.slice(0, 6))
      } else throw new Error()
    } catch {
      // Fallback to Nominatim directly
      try {
        const res = await fetch(
          `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: HEADERS }
        )
        const data = await res.json()
        setResults(data.map((d: any) => ({
          display_name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        })))
      } catch { setResults([]) }
    } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(value), 350)
    return () => clearTimeout(timerRef.current)
  }, [value, search])

  return (
    <div style={{ position: 'relative' }}>
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <MapPin size={14} color={iconColor} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          className="form-input"
          style={{ paddingLeft: 34 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {searching && (
          <RefreshCw size={12} color="#00d4aa" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />
        )}
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000,
          background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {results.map((r, i) => (
            <button key={i}
              onClick={() => { onSelect(r); onChange(r.display_name.split(',')[0]); setResults([]) }}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'none', border: 'none', cursor: 'pointer', color: '#e8f0ff',
                fontSize: 13, borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div style={{ fontWeight: 500 }}>{r.display_name.split(',')[0]}</div>
              <div style={{ fontSize: 11, color: '#7d9bc0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.display_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RoutePlanner() {
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [fromPlace, setFromPlace] = useState<GeocodedPlace | null>(null)
  const [toPlace, setToPlace] = useState<GeocodedPlace | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Extract route coords for map fitting
  const routeCoords: [number, number][] = result?.geometry
    ? (result.geometry.geometry as any).coordinates.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number])
    : []

  const handleRoute = async () => {
    if (!fromPlace || !toPlace) {
      setError('Please select a starting point and destination from the search results.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API}/routes/safe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_lat: fromPlace.lat,
          from_lon: fromPlace.lon,
          to_lat: toPlace.lat,
          to_lon: toPlace.lon,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data: RouteResult = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Failed to find route. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported by your browser.'); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const res = await fetch(`${API}/location/reverse?lat=${lat}&lon=${lon}`)
          const data = await res.json()
          const name = data.city || data.ward || `${lat.toFixed(4)}°N`
          const place = { display_name: name, lat, lon }
          setFromPlace(place)
          setFromText(name)
        } catch {
          setFromPlace({ display_name: 'My Location', lat, lon })
          setFromText('My Location')
        }
      },
      () => setError('Location permission denied. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const riskColor = result ? (RISK_COLOR[result.risk] ?? '#22c55e') : '#22c55e'

  // Default map center: India
  const mapCenter: [number, number] = fromPlace
    ? [fromPlace.lat, fromPlace.lon]
    : [20.5937, 78.9629]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 0, flex: 1, overflow: 'hidden' }}>

        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto',
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-glass)',
          padding: 20,
        }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#e8f0ff', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Navigation size={20} color="#00d4aa" /> Flood-Safe Route
            </h2>
            <p style={{ fontSize: 12, color: '#7d9bc0', margin: 0 }}>
              Dijkstra routing — avoids roads with water depth &gt; 15 cm
            </p>
          </div>

          {/* From */}
          <GeoSearchInput
            label="Starting Point"
            value={fromText}
            onChange={setFromText}
            onSelect={setFromPlace}
            placeholder="Search origin..."
            iconColor="#3b82f6"
          />

          {/* Use My Location */}
          <button
            onClick={useMyLocation}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(59,130,246,0.4)',
              background: 'rgba(59,130,246,0.08)', color: '#3b82f6',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', margin: '8px 0',
            }}
          >
            <LocateFixed size={14} /> Use My Location
          </button>

          {/* Connector */}
          <div style={{ paddingLeft: 14, height: 12, borderLeft: '2px dashed rgba(255,255,255,0.1)', margin: '4px 0' }} />

          {/* To */}
          <GeoSearchInput
            label="Destination"
            value={toText}
            onChange={setToText}
            onSelect={setToPlace}
            placeholder="Search destination..."
            iconColor="#ef4444"
          />

          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center', marginTop: 16, padding: '14px' }}
            onClick={handleRoute}
            disabled={loading || !fromPlace || !toPlace}
          >
            {loading
              ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Finding safe route...</>
              : <><Search size={16} /> Find Safe Route</>
            }
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: 13, display: 'flex', gap: 8,
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* Result summary */}
          {result && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Safety banner */}
              {result.safe
                ? <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <ShieldCheck size={16} /> Safe route — all flooded roads avoided
                  </div>
                : <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <AlertTriangle size={16} /> Partial flood exposure — proceed with caution
                  </div>
              }

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { icon: <Clock size={16} color="#00d4aa" />, label: 'ETA', value: `${result.eta_min} min` },
                  { icon: <Ruler size={16} color="#3b82f6" />, label: 'Distance', value: `${result.distance_km} km` },
                  { icon: <Droplets size={16} color={riskColor} />, label: 'Max Depth', value: `${result.max_depth_cm} cm` },
                  { icon: <AlertTriangle size={16} color={riskColor} />, label: 'Risk', value: result.risk },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}<span style={{ color: '#7d9bc0', fontSize: 11 }}>{label}</span></div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#e8f0ff' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Avoided roads */}
              {result.avoided_roads.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7d9bc0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Flooded Roads Avoided ({result.flooded_roads_avoided})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {result.avoided_roads.map((r, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
                        borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <AlertTriangle size={11} /> {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Map panel ─────────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <MapContainer
            center={mapCenter}
            zoom={fromPlace ? 12 : 5}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />

            {/* Start marker */}
            {fromPlace && (
              <Marker position={[fromPlace.lat, fromPlace.lon]} icon={startIcon}>
                <Popup>
                  <div style={{ fontFamily: 'Inter,sans-serif', color: '#1e293b' }}>
                    <strong>🔵 Start</strong><br />
                    <span style={{ fontSize: 12 }}>{fromPlace.display_name.split(',')[0]}</span>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* End marker */}
            {toPlace && (
              <Marker position={[toPlace.lat, toPlace.lon]} icon={endIcon}>
                <Popup>
                  <div style={{ fontFamily: 'Inter,sans-serif', color: '#1e293b' }}>
                    <strong>🔴 Destination</strong><br />
                    <span style={{ fontSize: 12 }}>{toPlace.display_name.split(',')[0]}</span>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Route line */}
            {result?.geometry && (
              <GeoJSON
                key={JSON.stringify(result.geometry.geometry)}
                data={result.geometry}
                style={{ color: '#00d4aa', weight: 5, opacity: 0.9 }}
              />
            )}

            {/* Fit map to route */}
            {routeCoords.length >= 2 && <FitRoute coords={routeCoords} />}
          </MapContainer>

          {/* Placeholder when no route yet */}
          {!result && !loading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10,22,40,0.55)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, pointerEvents: 'none',
            }}>
              <div style={{ textAlign: 'center', color: '#7d9bc0' }}>
                <Navigation size={52} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: '#e8f0ff' }}>
                  Set origin &amp; destination
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Dijkstra algorithm avoids roads with &gt; 15 cm water depth
                </div>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10,22,40,0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000,
            }}>
              <div style={{ textAlign: 'center', color: '#00d4aa' }}>
                <RefreshCw size={36} style={{ margin: '0 auto 14px', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>Finding safest route...</div>
                <div style={{ fontSize: 12, color: '#7d9bc0', marginTop: 4 }}>Applying flood penalties to road graph</div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 36, right: 16, zIndex: 1000,
            background: 'rgba(10,22,40,0.9)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(20px)',
          }}>
            {[
              { color: '#3b82f6', label: 'Start', dot: true },
              { color: '#ef4444', label: 'Destination', dot: true },
              { color: '#00d4aa', label: 'Safe Route', dot: false },
            ].map(({ color, label, dot }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                {dot
                  ? <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid #fff' }} />
                  : <div style={{ width: 22, height: 4, borderRadius: 2, background: color }} />
                }
                <span style={{ fontSize: 12, color: '#7d9bc0' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

