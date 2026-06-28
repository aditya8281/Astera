import { useRef, useEffect, useCallback } from 'react'

/**
 * Particle constellation background for the graph page.
 *
 * Emil Kowalski principles applied:
 * - Mouse parallax uses spring interpolation (not linear follow)
 * - Reduced motion: static dots, no drift, no parallax
 * - Drift speed is calm (0.04) — decorative motion, never dominant
 * - Connection lines use exponential fade (not linear alpha)
 * - Dot opacity stays below 0.1 — background must never compete with graph
 */

const DOT_COUNT = 150
const LINE_THRESHOLD = 100
const DRIFT_SPEED = 0.04
const PARALLAX_STRENGTH = 10
const DOT_SIZE = 1
const DOT_OPACITY = 0.08
const LINE_MAX_OPACITY = 0.03

// Spring constants for mouse tracking (decorative — interruptible)
const SPRING_STIFFNESS = 0.06
const SPRING_DAMPING = 0.85

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<Dot[]>([])
  // Spring state for mouse parallax (not raw mouse position)
  const springRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const targetMouseRef = useRef({ x: 0, y: 0 })
  const mouseActiveRef = useRef(false)
  const animRef = useRef<number>(0)
  const prefersReducedMotion = useRef(false)

  const initDots = useCallback((w: number, h: number) => {
    const dots: Dot[] = []
    for (let i = 0; i < DOT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = DRIFT_SPEED * (0.5 + Math.random() * 0.5)
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      })
    }
    dotsRef.current = dots
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.current = mq.matches
    const onMqChange = (e: MediaQueryListEvent) => { prefersReducedMotion.current = e.matches }
    mq.addEventListener('change', onMqChange)

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      if (dotsRef.current.length === 0) initDots(rect.width, rect.height)
    }
    resize()

    const resizeObs = new ResizeObserver(resize)
    resizeObs.observe(canvas.parentElement || canvas)

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      // Raw target (not final position — spring will interpolate)
      targetMouseRef.current.x = (e.clientX - rect.left) / rect.width - 0.5
      targetMouseRef.current.y = (e.clientY - rect.top) / rect.height - 0.5
      mouseActiveRef.current = true
    }
    const handleMouseLeave = () => { mouseActiveRef.current = false }

    canvas.parentElement?.addEventListener('mousemove', handleMouse)
    canvas.parentElement?.addEventListener('mouseleave', handleMouseLeave)

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const dots = dotsRef.current
      if (dots.length === 0) { animRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, w, h)

      // Spring-based mouse interpolation (not linear — has momentum)
      const spring = springRef.current
      const target = mouseActiveRef.current ? targetMouseRef.current : { x: 0, y: 0 }
      const forceX = (target.x - spring.x) * SPRING_STIFFNESS
      const forceY = (target.y - spring.y) * SPRING_STIFFNESS
      spring.vx = (spring.vx + forceX) * SPRING_DAMPING
      spring.vy = (spring.vy + forceY) * SPRING_DAMPING
      spring.x += spring.vx
      spring.y += spring.vy

      const px = spring.x * PARALLAX_STRENGTH
      const py = spring.y * PARALLAX_STRENGTH

      // Update dot positions (skip if reduced motion)
      if (!prefersReducedMotion.current) {
        for (const d of dots) {
          d.x += d.vx
          d.y += d.vy
          if (d.x < -10) d.x = w + 10
          if (d.x > w + 10) d.x = -10
          if (d.y < -10) d.y = h + 10
          if (d.y > h + 10) d.y = -10
        }
      }

      // Draw connections — cyan-tinted, exponential alpha falloff
      ctx.lineWidth = 0.5
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i]
        const ax = a.x + px
        const ay = a.y + py
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j]
          const bx = b.x + px
          const by = b.y + py
          const dx = ax - bx
          const dy = ay - by
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINE_THRESHOLD) {
            const t = dist / LINE_THRESHOLD
            const alpha = (1 - t * t) * LINE_MAX_OPACITY // Quadratic falloff (stronger near dots)
            ctx.strokeStyle = `rgba(89,246,255,${alpha})`
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(bx, by)
            ctx.stroke()
          }
        }
      }

      // Draw dots
      for (const d of dots) {
        const dx = d.x + px
        const dy = d.y + py
        ctx.fillStyle = `rgba(180,200,220,${DOT_OPACITY})`
        ctx.fillRect(dx, dy, DOT_SIZE, DOT_SIZE)
      }

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      resizeObs.disconnect()
      mq.removeEventListener('change', onMqChange)
      canvas.parentElement?.removeEventListener('mousemove', handleMouse)
      canvas.parentElement?.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [initDots])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
