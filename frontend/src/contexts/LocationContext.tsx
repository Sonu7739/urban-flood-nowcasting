/**
 * LocationContext — Global location + flood prediction state.
 *
 * Any component can:
 *   const { selectedLocation, setLocation, floodData, loading } = useLocation()
 *
 * Whenever lat/lon changes it automatically calls POST /api/flood/predict
 * and stores the resulting GeoJSON + summary.
 */
import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react'

export interface SelectedLocation {
  lat: number
  lon: number
  name: string
  radiusKm: number
}

export interface FloodSummary {
  total_roads: number
  critical: number
  warning: number
  caution: number
  safe: number
  avg_depth_cm: number
  max_depth_cm: number
}

export interface FloodPredictResult {
  location: string
  latitude: number
  longitude: number
  rainfall_mm_hr: number
  geojson: GeoJSON.FeatureCollection
  summary: FloodSummary
  roads: { name: string; depth_cm: number; risk: string }[]
  timestamp: string
  source: 'osm' | 'simulation'
}

interface LocationContextType {
  selectedLocation: SelectedLocation | null
  setLocation: (loc: SelectedLocation) => void
  floodData: FloodPredictResult | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const LocationContext = createContext<LocationContextType | null>(null)

import { API } from '../config'

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [floodData, setFloodData] = useState<FloodPredictResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchFlood = useCallback(async (loc: SelectedLocation) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/flood/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: loc.lat,
          longitude: loc.lon,
          radius_km: loc.radiusKm,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`Backend error: ${res.status}`)
      const data: FloodPredictResult = await res.json()
      setFloodData(data)
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Failed to fetch flood prediction')
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [])

  const setLocation = useCallback((loc: SelectedLocation) => {
    setSelectedLocation(loc)
    fetchFlood(loc)
  }, [fetchFlood])

  const refresh = useCallback(() => {
    if (selectedLocation) fetchFlood(selectedLocation)
  }, [selectedLocation, fetchFlood])

  return (
    <LocationContext.Provider value={{ selectedLocation, setLocation, floodData, loading, error, refresh }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used within LocationProvider')
  return ctx
}
