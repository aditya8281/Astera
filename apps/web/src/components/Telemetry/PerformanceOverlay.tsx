import { useRef, useState, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../../constants'

// Hook to track FPS — used inside R3F canvas
export function usePerformanceTracker() {
  const frameTimes = useRef<number[]>([])
  const lastTime = useRef(performance.now())

  useFrame(() => {
    const now = performance.now()
    const delta = now - lastTime.current
    lastTime.current = now
    frameTimes.current.push(delta)
    if (frameTimes.current.length > 60) frameTimes.current.shift()
  })

  const getFps = useCallback(() => {
    if (frameTimes.current.length < 2) return 0
    const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length
    return Math.round(1000 / avg)
  }, [])

  const getFrameTime = useCallback(() => {
    if (frameTimes.current.length === 0) return 0
    return frameTimes.current[frameTimes.current.length - 1].toFixed(1)
  }, [])

  return { getFps, getFrameTime }
}

// The overlay component — rendered OUTSIDE Canvas
export function PerformanceOverlay() {
  const [fps, setFps] = useState(0)
  const [frameTime, setFrameTime] = useState('0')
  const [memory, setMemory] = useState(0)
  const [drawCalls, setDrawCalls] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      // Memory (Chrome only)
      const perf = performance as any
      if (perf.memory) {
        setMemory(Math.round(perf.memory.usedJSHeapSize / 1024 / 1024))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Update from R3F — we'll use a global ref
  useEffect(() => {
    const interval = setInterval(() => {
      const tracker = (window as any).__astera_perf
      if (tracker) {
        setFps(tracker.getFps())
        setFrameTime(tracker.getFrameTime())
        setDrawCalls(tracker.drawCalls ?? 0)
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
        backdropFilter: 'blur(8px)',
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
      {drawCalls > 0 && <div>Draw: {drawCalls}</div>}
    </div>
  )
}

// Export a global tracker setter (called from inside Canvas)
export function PerfTracker() {
  const frameTimes = useRef<number[]>([])
  const lastTime = useRef(performance.now())

  useFrame((state) => {
    const now = performance.now()
    const delta = now - lastTime.current
    lastTime.current = now
    frameTimes.current.push(delta)
    if (frameTimes.current.length > 60) frameTimes.current.shift()

    // Set global tracker
    if (!(window as any).__astera_perf) {
      ;(window as any).__astera_perf = {
        getFps: () => {
          const ft = (window as any).__astera_perf._frameTimes || []
          if (ft.length < 2) return 0
          const avg = ft.reduce((a: number, b: number) => a + b, 0) / ft.length
          return Math.round(1000 / avg)
        },
        getFrameTime: () => {
          const ft = (window as any).__astera_perf._frameTimes || []
          if (ft.length === 0) return '0'
          return ft[ft.length - 1].toFixed(1)
        },
        drawCalls: 0,
        _frameTimes: frameTimes.current,
      }
    }
    ;(window as any).__astera_perf._frameTimes = frameTimes.current
    ;(window as any).__astera_perf.drawCalls = state.gl.info.render.calls
  })

  return null
}
