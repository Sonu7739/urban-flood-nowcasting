/**
 * Central configuration — reads VITE_API_URL at build time.
 *
 * Local dev  : Vite proxy forwards /api → http://localhost:8000  (no env var needed)
 * Vercel prod: Set VITE_API_URL to your backend URL, e.g. https://your-backend.railway.app
 */
export const API = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'
