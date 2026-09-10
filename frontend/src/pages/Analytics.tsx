import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import { BarChart3, Activity, Droplets } from 'lucide-react'

// Mock Historical Data
const RAINFALL_TREND = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  rainfall: Math.max(0, 80 * Math.exp(-0.5 * ((i - 12) / 4) ** 2) + (Math.random() * 10 - 5)),
  depth: Math.max(0, 30 * Math.exp(-0.5 * ((i - 14) / 4) ** 2) + (Math.random() * 5)),
}))

const WARD_STATS = [
  { name: 'Kurla',   avgDepth: 28, maxDepth: 45, incidents: 12 },
  { name: 'Sion',    avgDepth: 22, maxDepth: 38, incidents: 8 },
  { name: 'Dharavi', avgDepth: 18, maxDepth: 32, incidents: 6 },
  { name: 'Bandra',  avgDepth: 12, maxDepth: 24, incidents: 3 },
  { name: 'Andheri', avgDepth: 8,  maxDepth: 18, incidents: 1 },
]

const MODEL_ACCURACY = [
  { time: '-3h', predicted: 24, actual: 22 },
  { time: '-2h', predicted: 32, actual: 35 },
  { time: '-1h', predicted: 45, actual: 42 },
  { time: 'Now', predicted: 40, actual: 41 },
]

export default function Analytics() {
  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <BarChart3 size={28} color="var(--accent)" />
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800, margin: 0 }}>
          Analytics & Performance
        </h1>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Rainfall vs Depth Trend */}
        <div className="glass-card p-24" style={{ gridColumn: 'span 2' }}>
          <h3 className="section-header" style={{ fontSize: 16 }}>
            <Droplets size={18} color="var(--accent)" /> 24-Hour Rainfall vs Avg Depth Trend
          </h3>
          <div style={{ height: 300, width: '100%', marginTop: 20 }}>
            <ResponsiveContainer>
              <AreaChart data={RAINFALL_TREND} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6c63ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDepth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 8, color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="rainfall" name="Rainfall (mm/hr)" stroke="#6c63ff" strokeWidth={3} fillOpacity={1} fill="url(#colorRain)" />
                <Area yAxisId="right" type="monotone" dataKey="depth" name="Avg Depth (cm)" stroke="#00d4aa" strokeWidth={3} fillOpacity={1} fill="url(#colorDepth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ward Comparison */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>Ward-wise Flood Severity</h3>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={WARD_STATS} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} width={60} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="avgDepth" name="Avg Depth (cm)" fill="#00d4aa" radius={[0, 4, 4, 0]} />
                <Bar dataKey="maxDepth" name="Max Depth (cm)" fill="#ff6b6b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Accuracy */}
        <div className="glass-card p-24">
          <h3 className="section-header" style={{ fontSize: 16 }}>
            <Activity size={18} color="var(--accent3)" /> AI Model Accuracy (Last 3 Hours)
          </h3>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={MODEL_ACCURACY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} domain={[0, 50]} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 8 }}
                />
                <Legend />
                <Line type="monotone" dataKey="predicted" name="Predicted (cm)" stroke="#00d4aa" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name="Actual Sensor (cm)" stroke="#ff6b6b" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            RMSE: <strong style={{ color: 'var(--text-primary)' }}>3.4 cm</strong> | R²: <strong style={{ color: 'var(--text-primary)' }}>0.94</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
