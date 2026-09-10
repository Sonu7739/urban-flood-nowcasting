import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, GeoJSON, Circle, Popup, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, Layers, Droplets, RefreshCw, MapPin, Navigation,
  X, ChevronDown, Loader,
} from 'lucide-react'
import { useLocation } from '../contexts/LocationContext'

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

import { API } from '../config'

const RISK_COLOR: Record<string, string> = {
  Red: '#ef4444', Orange: '#f97316', Yellow: '#eab308', Green: '#22c55e',
}

function mockFloodGeoJSON(rainfall = 70): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let i = 0; i < 80; i++) {
    const lat = 19.076 + (Math.random() - 0.5) * 0.4
    const lon = 72.877 + (Math.random() - 0.5) * 0.3
    const depth = Math.max(0, rainfall * 0.3 + Math.random() * 20 - 5)
    const risk = depth > 30 ? 'Red' : depth > 15 ? 'Orange' : depth > 5 ? 'Yellow' : 'Green'
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[lon, lat], [lon + 0.004, lat + 0.002]] },
      properties: {
        name: `Road Segment ${i + 1}`, water_depth: Math.round(depth * 10) / 10,
        risk, risk_label: risk === 'Red' ? 'Critical' : risk === 'Orange' ? 'Warning' : risk === 'Yellow' ? 'Caution' : 'Safe',
        rainfall_intensity: rainfall, drain_capacity: Math.round(60 + Math.random() * 40),
        latitude: lat, longitude: lon,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

// Custom location marker icon
const locationIcon = L.divIcon({
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>',
  iconSize: [18, 18], iconAnchor: [9, 9], className: '',
})

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo(coords, 14, { duration: 1.5 })
  }, [coords, map])
  return null
}

const LAYERS = ['Roads', 'Flood Heatmap', 'Rainfall', 'Drainage Network', 'Rivers', 'Risk Zones']

export default function GISMap() {
  const { setLocation, floodData, loading: floodLoading } = useLocation()
  const [floodGJ, setFloodGJ] = useState<GeoJSON.FeatureCollection>(mockFloodGeoJSON(70))
  const [rainfall, setRainfall] = useState(70)
  const [timeline, setTimeline] = useState(3)
  const [loading, setLoading] = useState(false)
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    'Flood Heatmap': true, 'Drainage Network': true, Roads: true,
    Rainfall: false, Rivers: false, 'Risk Zones': true,
  })
  const [showLayerPanel, setShowLayerPanel] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Location
  const [gpsPos, setGpsPos] = useState<[number, number] | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsCity, setGpsCity] = useState<string>('')
  const [gpsWard, setGpsWard] = useState<string>('')
  const [gpsDenied, setGpsDenied] = useState(false)
  const watchRef = useRef<number | null>(null)

  // Selected marker
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)

  // Emergency services
  const [emergency, setEmergency] = useState<{ shelters: any[], hospitals: any[], police: any[], fire: any[] } | null>(null)
  const [showEmergency, setShowEmergency] = useState(false)

  const TIMELINE_LABELS = ['-3h', '-2h', '-1h', 'Now', '+1h', '+2h', '+3h']

  const refreshMap = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/map`)
      const data = await res.json()
      if (data?.features?.length) setFloodGJ(data)
      else setFloodGJ(mockFloodGeoJSON(rainfall))
    } catch {
      setFloodGJ(mockFloodGeoJSON(rainfall))
    } finally { setLoading(false) }
  }, [rainfall])

  // Whenever context provides new floodData, use it on the map
  useEffect(() => {
    if (floodData?.geojson?.features?.length) {
      setFloodGJ(floodData.geojson as GeoJSON.FeatureCollection)
    }
  }, [floodData])

  useEffect(() => { refreshMap() }, [])
  useEffect(() => { setFloodGJ(mockFloodGeoJSON(rainfall)) }, [rainfall, timeline])

  // Nominatim search
  const searchLocation = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`${API}/location/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults(data)
    } catch {
      // Fallback to direct nominatim
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6`, {
          headers: { 'User-Agent': 'UFNS/1.0' }
        })
        const data = await res.json()
        setSearchResults(data.map((d: any) => ({ display_name: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) })))
      } catch { setSearchResults([]) }
    } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchLocation(query), 400)
    return () => clearTimeout(t)
  }, [query, searchLocation])

  const selectResult = (r: any) => {
    const pos: [number, number] = [r.lat, r.lon]
    setMarkerPos(pos)
    setFlyTarget(pos)
    setQuery(r.display_name?.split(',')[0] ?? '')
    setSearchResults([])
    // Trigger global location context → auto fetch flood prediction
    setLocation({
      lat: r.lat,
      lon: r.lon,
      name: r.display_name?.split(',')[0] ?? 'Selected Location',
      radiusKm: 5,
    })
  }

  // GPS
  const useMyLocation = () => {
    if (!navigator.geolocation) { setGpsDenied(true); return }
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current) }
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords
        setGpsPos([lat, lon])
        setGpsAccuracy(Math.round(accuracy))
        setFlyTarget([lat, lon])
        // Reverse geocode
        try {
          const res = await fetch(`${API}/location/reverse?lat=${lat}&lon=${lon}`)
          const data = await res.json()
          setGpsCity(data.city || data.state || '')
          setGpsWard(data.ward || '')
        } catch {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
            const data = await res.json()
            const a = data.address || {}
            setGpsCity(a.city || a.town || a.village || '')
            setGpsWard(a.suburb || a.neighbourhood || '')
          } catch { }
        }
        // Load nearest emergency services
        try {
          const [s, h, p, f] = await Promise.all([
            fetch(`${API}/shelters/nearest?lat=${lat}&lon=${lon}&limit=3`).then(r => r.json()),
            fetch(`${API}/hospitals/nearest?lat=${lat}&lon=${lon}&limit=3`).then(r => r.json()),
            fetch(`${API}/police/nearest?lat=${lat}&lon=${lon}&limit=2`).then(r => r.json()),
            fetch(`${API}/fire/nearest?lat=${lat}&lon=${lon}&limit=2`).then(r => r.json()),
          ])
          setEmergency({ shelters: s, hospitals: h, police: p, fire: f })
          setShowEmergency(true)
        } catch { }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsDenied(true)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
  }

  const onMapClick = async (lat: number, lon: number) => {
    setMarkerPos([lat, lon])
    setFlyTarget([lat, lon])
    // Trigger global location context → auto fetch flood prediction
    setLocation({ lat, lon, name: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`, radiusKm: 5 })
  }

  const styleFeature = (f: GeoJSON.Feature | undefined) => {
    const risk = f?.properties?.risk ?? 'Green'
    return { color: RISK_COLOR[risk] ?? '#22c55e', weight: 2.5, opacity: 0.85 }
  }

  const onEachFeature = (feature: GeoJSON.Feature, layer: any) => {
    const p = feature.properties ?? {}
    const color = RISK_COLOR[p.risk] ?? '#22c55e'
    layer.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:200px;color:#e8f0ff;background:#0d1a2e;border-radius:10px;padding:4px 0">
        <div style="font-weight:800;font-size:14px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1)">${p.name ?? p.road_id}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
          <span style="color:#7d9bc0">Latitude</span><span>${(p.latitude ?? 0).toFixed(5)}</span>
          <span style="color:#7d9bc0">Longitude</span><span>${(p.longitude ?? 0).toFixed(5)}</span>
          <span style="color:#7d9bc0">Flood Depth</span><strong style="color:${color}">${p.water_depth} cm</strong>
          <span style="color:#7d9bc0">Rainfall</span><span>${p.rainfall_intensity} mm/hr</span>
          <span style="color:#7d9bc0">Risk Level</span><span style="background:${color}22;color:${color};padding:2px 8px;border-radius:99px;font-weight:600">${p.risk_label}</span>
          <span style="color:#7d9bc0">Drain Cap.</span><span>${p.drain_capacity}%</span>
        </div>
      </div>
    `, { className: 'dark-popup' })
  }

  const stats = {
    red: floodGJ.features.filter(f => f.properties?.risk === 'Red').length,
    orange: floodGJ.features.filter(f => f.properties?.risk === 'Orange').length,
    yellow: floodGJ.features.filter(f => f.properties?.risk === 'Yellow').length,
    green: floodGJ.features.filter(f => f.properties?.risk === 'Green').length,
  }

  const EMERGENCY_ICONS: Record<string, string> = {
    shelters: '🏠', hospitals: '🏥', police: '👮', fire: '🚒',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* Top Control Bar */}
      <div style={{
        padding: '10px 20px', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', zIndex: 500,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
          <Search size={15} color="#7d9bc0" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search city, street, landmark..."
            style={{
              width: '100%', padding: '9px 14px 9px 36px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e8f0ff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searching && <RefreshCw size={13} color="#00d4aa" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
              background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectResult(r)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#e8f0ff',
                    fontSize: 13, borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{r.display_name?.split(',')[0]}</div>
                  <div style={{ fontSize: 11, color: '#7d9bc0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Use My Location */}
        <button
          onClick={useMyLocation}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, border: '1px solid rgba(59,130,246,0.4)',
            background: gpsPos ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
            color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Navigation size={14} /> {gpsPos ? 'Tracking' : 'Use My Location'}
        </button>

        {/* Layer Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLayerPanel(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: '#e8f0ff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Layers size={14} /> Layers <ChevronDown size={12} />
          </button>
          {showLayerPanel && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '12px 16px', zIndex: 1000, width: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              {LAYERS.map(layer => (
                <label key={layer} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={activeLayers[layer] ?? false}
                    onChange={e => setActiveLayers(p => ({ ...p, [layer]: e.target.checked }))}
                    style={{ accentColor: '#00d4aa', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 13, color: '#e8f0ff' }}>{layer}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Rainfall slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Droplets size={14} color="#00d4aa" />
          <input type="range" min="0" max="200" value={rainfall} onChange={e => setRainfall(+e.target.value)}
            style={{ width: 80, cursor: 'pointer', accentColor: '#00d4aa' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: rainfall > 100 ? '#ef4444' : rainfall > 50 ? '#f97316' : '#00d4aa', minWidth: 60 }}>
            {rainfall} mm/hr
          </span>
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMELINE_LABELS.map((l, i) => (
            <button key={l} onClick={() => setTimeline(i)}
              style={{
                padding: '4px 9px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: timeline === i ? '#00d4aa' : 'rgba(255,255,255,0.06)',
                color: timeline === i ? '#000' : '#7d9bc0',
              }}
            >{l}</button>
          ))}
        </div>

        {/* Risk pills */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[['Red', stats.red], ['Orange', stats.orange], ['Yellow', stats.yellow], ['Green', stats.green]].map(([risk, count]) => (
            <div key={risk as string} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99,
              background: `${RISK_COLOR[risk as string]}22`, border: `1px solid ${RISK_COLOR[risk as string]}44`,
            }}>
              <span style={{ fontSize: 11, color: RISK_COLOR[risk as string], fontWeight: 700 }}>{count}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={refreshMap}>
          <RefreshCw size={14} className={(loading || floodLoading) ? 'spin' : ''} />
        </button>
      </div>

      {/* Flood prediction banner */}
      {floodLoading && (
        <div style={{
          padding: '8px 20px', background: 'rgba(0,212,170,0.08)',
          borderBottom: '1px solid rgba(0,212,170,0.2)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          color: '#00d4aa',
        }}>
          <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Fetching real flood prediction for selected area...
        </div>
      )}
      {floodData && !floodLoading && (
        <div style={{
          padding: '7px 20px', background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 16, fontSize: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ color: '#00d4aa', fontWeight: 700 }}>📍 {floodData.location}</span>
          <span style={{ color: '#7d9bc0' }}>{floodData.summary.total_roads} roads analysed</span>
          <span style={{ color: '#ef4444' }}>🔴 {floodData.summary.critical} critical</span>
          <span style={{ color: '#f97316' }}>🟠 {floodData.summary.warning} warning</span>
          <span style={{ color: '#eab308' }}>🟡 {floodData.summary.caution} caution</span>
          <span style={{ color: '#22c55e' }}>🟢 {floodData.summary.safe} safe</span>
          <span style={{ color: '#7d9bc0', marginLeft: 'auto' }}>
            Max depth: <strong style={{ color: '#e8f0ff' }}>{floodData.summary.max_depth_cm} cm</strong>
          </span>
          <span style={{ color: '#7d9bc0', fontSize: 11 }}>
            Source: {floodData.source === 'osm' ? '🗺 OpenStreetMap' : '🤖 Simulation'}
          </span>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[20, 0]} zoom={3}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <ClickHandler onMapClick={onMapClick} />
          <FlyTo coords={flyTarget} />

          {/* Flood layer */}
          {activeLayers['Flood Heatmap'] && (
            <GeoJSON
              key={rainfall + timeline + floodGJ.features.length}
              data={floodGJ} style={styleFeature} onEachFeature={onEachFeature}
            />
          )}

          {/* GPS location marker */}
          {gpsPos && (
            <Marker position={gpsPos} icon={locationIcon}>
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', color: '#e8f0ff', background: '#0d1a2e', padding: '4px 0' }}>
                  <strong>📍 Your Location</strong><br />
                  <span style={{ color: '#7d9bc0', fontSize: 12 }}>{gpsPos[0].toFixed(5)}°N, {gpsPos[1].toFixed(5)}°E</span><br />
                  {gpsCity && <span style={{ fontSize: 12 }}>{gpsCity}</span>}
                  {gpsWard && <span style={{ fontSize: 11, color: '#7d9bc0' }}> · {gpsWard}</span>}
                  <br />
                  <span style={{ fontSize: 11, color: '#7d9bc0' }}>Accuracy: ±{gpsAccuracy}m</span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Clicked marker */}
          {markerPos && (
            <Marker position={markerPos}>
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', color: '#e8f0ff', background: '#0d1a2e', padding: '4px 0' }}>
                  <strong>📌 Selected</strong><br />
                  <span style={{ fontSize: 12 }}>{markerPos[0].toFixed(5)}°N, {markerPos[1].toFixed(5)}°E</span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Emergency service markers */}
          {showEmergency && emergency && (
            <>
              {emergency.shelters.map((s, i) => (
                <Circle key={`s${i}`} center={[s.latitude, s.longitude]} radius={100}
                  pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.4 }}>
                  <Popup><strong>🏠 {s.name}</strong><br />{s.distance_km} km</Popup>
                </Circle>
              ))}
              {emergency.hospitals.map((h, i) => (
                <Circle key={`h${i}`} center={[h.latitude, h.longitude]} radius={100}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.4 }}>
                  <Popup><strong>🏥 {h.name}</strong><br />{h.distance_km} km</Popup>
                </Circle>
              ))}
            </>
          )}
        </MapContainer>

        {/* GPS info panel */}
        {gpsPos && (
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            style={{
              position: 'absolute', top: 16, left: 16, zIndex: 1000,
              background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 12, padding: '14px 18px', backdropFilter: 'blur(20px)',
              minWidth: 200,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Navigation size={14} color="#3b82f6" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>LIVE LOCATION</span>
            </div>
            {[
              ['Latitude', `${gpsPos[0].toFixed(5)}°N`],
              ['Longitude', `${gpsPos[1].toFixed(5)}°E`],
              ['Accuracy', `±${gpsAccuracy}m`],
              ['City', gpsCity || '—'],
              ['Ward', gpsWard || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: '#7d9bc0' }}>{k}</span>
                <span style={{ color: '#e8f0ff', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Selected coordinates */}
        {markerPos && !gpsPos && (
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 1000,
            background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MapPin size={14} color="#00d4aa" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00d4aa' }}>SELECTED LOCATION</span>
            </div>
            <div style={{ fontSize: 12, color: '#e8f0ff' }}>{markerPos[0].toFixed(5)}°N</div>
            <div style={{ fontSize: 12, color: '#e8f0ff' }}>{markerPos[1].toFixed(5)}°E</div>
          </div>
        )}

        {/* GPS denied warning */}
        {gpsDenied && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(20px)',
            fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠️ Location permission denied. Use the search box to find your location.
            <button onClick={() => setGpsDenied(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 4 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Emergency Services Panel */}
        {showEmergency && emergency && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1000,
              background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: '16px', backdropFilter: 'blur(20px)',
              width: 280, maxHeight: '70vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ff' }}>🚨 Nearest Emergency Services</span>
              <button onClick={() => setShowEmergency(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d9bc0' }}>
                <X size={14} />
              </button>
            </div>

            {Object.entries(emergency).map(([type, items]) => (
              <div key={type} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7d9bc0', marginBottom: 8, letterSpacing: '0.5px' }}>
                  {EMERGENCY_ICONS[type]} {type.toUpperCase()}
                </div>
                {(items as any[]).map((item, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f0ff', marginBottom: 4 }}>{item.name}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                      <span style={{ color: '#00d4aa' }}>📍 {item.distance_km} km</span>
                      {item.capacity && <span style={{ color: '#7d9bc0' }}>👥 {item.capacity}</span>}
                      {item.phone && <span style={{ color: '#7d9bc0' }}>📞 {item.phone}</span>}
                    </div>
                    <button
                      onClick={() => { setFlyTarget([item.latitude, item.longitude]) }}
                      style={{
                        marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, border: 'none',
                        background: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Navigate →
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 40, right: 16, zIndex: 1000,
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: '#7d9bc0', letterSpacing: '0.5px' }}>FLOOD DEPTH</div>
          {[
            { label: 'Critical  30+ cm', color: '#ef4444' },
            { label: 'Warning  15–30 cm', color: '#f97316' },
            { label: 'Caution  5–15 cm', color: '#eab308' },
            { label: 'Safe  0–5 cm', color: '#22c55e' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 12 }}>
              <div style={{ width: 22, height: 4, background: color, borderRadius: 2 }} />
              <span style={{ color: '#7d9bc0' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
