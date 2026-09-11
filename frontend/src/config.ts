/**
 * Central configuration — reads VITE_API_URL at build time.
 *
 * Local dev  : Vite proxy forwards /api → http://localhost:8000  (no env var needed)
 * Vercel prod: Set VITE_API_URL to your backend URL, e.g. https://your-backend.railway.app
 */
const rawUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export const API = rawUrl
  ? (rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`)
  : '/api'

