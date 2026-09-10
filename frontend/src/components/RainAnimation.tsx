import { useEffect, useRef } from 'react'

interface RainDrop {
  x: number
  height: number
  delay: number
  duration: number
  opacity: number
}

export default function RainAnimation({ intensity = 60 }: { intensity?: number }) {
  const drops = useRef<RainDrop[]>([])

  if (drops.current.length === 0) {
    const count = Math.floor(40 + intensity * 0.5)
    for (let i = 0; i < count; i++) {
      drops.current.push({
        x:        Math.random() * 100,
        height:   20 + Math.random() * 60,
        delay:    Math.random() * 4,
        duration: 0.8 + Math.random() * 1.2,
        opacity:  0.1 + Math.random() * 0.25,
      })
    }
  }

  return (
    <div className="rain-container">
      {drops.current.map((d, i) => (
        <div
          key={i}
          className="raindrop"
          style={{
            left:              `${d.x}%`,
            height:            `${d.height}px`,
            animationDuration: `${d.duration}s`,
            animationDelay:    `${d.delay}s`,
            opacity:           d.opacity,
          }}
        />
      ))}
    </div>
  )
}
