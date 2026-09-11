import axios from 'axios'
import { API } from '../config'

const api = axios.create({
  baseURL: API,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictRequest {
  lat: number
  lon: number
  rainfall: number
}

export interface PredictResponse {
  water_depth_cm: number
  risk: string
  risk_color: string
  confidence: number
  lat: number
  lon: number
  rainfall_mm_hr: number
  timestamp: string
}

export interface SimulationSummary {
  timestamp: string
  rainfall_mm_hr: number
  total_roads: number
  critical_roads: number
  warning_roads: number
  caution_roads: number
  safe_roads: number
  avg_depth_cm: number
  max_depth_cm: number
}

export interface Alert {
  alert_id: string
  severity: string
  message: string
  ward?: string
  lat: number
  lon: number
  water_depth_cm: number
  risk: string
  timestamp: string
  whatsapp_payload?: object
}

export interface RouteResult {
  route: GeoJSON.Feature
  eta_minutes: number
  distance_m: number
  avoided_roads: string[]
  safe: boolean
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const ufnsApi = {
  /** Health check */
  async health() {
    const { data } = await api.get('/health')
    return data
  },

  /** Get rainfall grid */
  async getRainfall() {
    const { data } = await api.get('/rainfall')
    return data
  },

  /** Predict flood at a point */
  async predict(req: PredictRequest): Promise<PredictResponse> {
    const { data } = await api.post('/predict', req)
    return data
  },

  /** Get flood GeoJSON map */
  async getFloodMap(): Promise<GeoJSON.FeatureCollection> {
    const { data } = await api.get('/map')
    return data
  },

  /** Get simulation summary */
  async getSummary(): Promise<SimulationSummary> {
    const { data } = await api.get('/summary')
    return data
  },

  /** Get active alerts */
  async getAlerts(): Promise<{ total_alerts: number; alerts: Alert[] }> {
    const { data } = await api.get('/alerts')
    return data
  },

  /** Get model metrics */
  async getMetrics() {
    const { data } = await api.get('/metrics')
    return data
  },

  /** Find safe route */
  async getRoute(startLat: number, startLon: number, endLat: number, endLon: number): Promise<RouteResult> {
    const { data } = await api.get('/route', {
      params: { start_lat: startLat, start_lon: startLon, end_lat: endLat, end_lon: endLon }
    })
    return data
  },

  /** Admin: inject rainfall */
  async injectRainfall(rainfall_mm_hr: number, duration_minutes = 60) {
    const { data } = await api.post('/admin/simulate', { rainfall_mm_hr, duration_minutes })
    return data
  },

  /** Admin: reset */
  async resetSimulation() {
    const { data } = await api.post('/admin/reset')
    return data
  },
}

export default ufnsApi
