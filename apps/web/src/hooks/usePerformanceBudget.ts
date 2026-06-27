import { useRef, useCallback } from 'react'

interface FrameBudget {
  start: number
  cpuMs: number
  drawCalls: number
}

/**
 * Tracks per-frame performance metrics.
 * Call `begin()` at frame start, `end()` at frame end.
 */
export function usePerformanceBudget() {
  const frameStart = useRef(0)
  const lastFrameCpu = useRef(0)
  const lastDrawCalls = useRef(0)

  const begin = useCallback(() => {
    frameStart.current = performance.now()
  }, [])

  const end = useCallback((drawCalls?: number) => {
    lastFrameCpu.current = performance.now() - frameStart.current
    lastDrawCalls.current = drawCalls ?? 0
  }, [])

  const getMetrics = useCallback((): FrameBudget => ({
    start: frameStart.current,
    cpuMs: lastFrameCpu.current,
    drawCalls: lastDrawCalls.current,
  }), [])

  return { begin, end, getMetrics }
}
