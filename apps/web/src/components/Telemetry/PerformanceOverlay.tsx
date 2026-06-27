import { useState, useEffect, useRef } from 'react'
import { COLORS } from '../../constants'

/**
 * Performance overlay — pure DOM, no R3F dependency.
 * Tracks FPS via requestAnimationFrame, memory via Chrome perf API.
 */
export function PerformanceOverlay() {
  const [fps, setFps] = useState(0)
  const [frameTime, setFrameTime] = useState('0')
  const [memory, setMemory] = useState(0)
  const frameTimesRef = useRef<number[]>([])
  const lastTimeRef = useRef(performance.now())

  // FPS tracking via rAF
  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      const now = performance.now()
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now
      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) frameTimesRef.current.shift()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => { running = false }
  }, [])

  // Update display every 200ms
  useEffect(() => {
    const interval = setInterval(() => {
      const ft = frameTimesRef.current
      if (ft.length >= 2) {
        const avg = ft.reduce((a, b) => a + b, 0) / ft.length
        setFps(Math.round(1000 / avg))
        setFrameTime(ft[ft.length - 1].toFixed(1))
      }
      const perf = performance as any
      if (perf.memory) {
        setMemory(Math.round(perf.memory.usedJSHeapSize / 1024 / 1024))
      }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="fixed top-3 right-3 rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed"
      style={{
        background: `${COLORS.surface}E0`,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.textMuted,
        zIndex: 'var(--z-telemetry)',
        minWidth: 160,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ color: fps >= 55 ? COLORS.success : fps >= 30 ? COLORS.warning : COLORS.error }}>
          FPS: {fps}
        </span>
        <span>{frameTime}ms</span>
      </div>
      {memory > 0 && <div>Memory: {memory}MB</div>}
    </div>
  )
}
