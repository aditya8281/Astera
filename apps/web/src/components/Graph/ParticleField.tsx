import { useRef, useEffect, useCallback } from 'react'

/**
 * Particle constellation background for the graph page.
 * ~150 tiny dots drift slowly on OLED black, connected by faint lines when close.
 * Subtle mouse parallax. Canvas 2D, 60fps.
 * Respects prefers-reduced-motion: static dots, no drift.
 *
 * Tuned for OLED: lower opacity, fewer dots, cyan-tinted lines.
 */

const DOT_COUNT = 150
const LINE_THRESHOLD = 100
const DRIFT_SPEED = 0.04
const PARALLAX_STRENGTH = 10
const DOT_SIZE = 1
const DOT_OPACITY = 0.08
const LINE_MAX_OPACITY = 0.03

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<Dot[]>([])
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const animRef = useRef<number>(0)
  const prefersReducedMotion = useRef(false)

  // Initialize dots
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

    // Check reduced motion preference
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
      mouseRef.current.x = (e.clientX - rect.left) / rect.width - 0.5
      mouseRef.current.y = (e.clientY - rect.top) / rect.height - 0.5
      mouseRef.current.active = true
    }
    const handleMouseLeave = () => { mouseRef.current.active = false }

    canvas.parentElement?.addEventListener('mousemove', handleMouse)
    canvas.parentElement?.addEventListener('mouseleave', handleMouseLeave)

    // Draw loop
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const dots = dotsRef.current
      if (dots.length === 0) { animRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, w, h)

      // Parallax offset
      const px = mouseRef.current.active ? mouseRef.current.x * PARALLAX_STRENGTH : 0
      const py = mouseRef.current.active ? mouseRef.current.y * PARALLAX_STRENGTH : 0

      // Update positions (skip if reduced motion)
      if (!prefersReducedMotion.current) {
        for (const d of dots) {
          d.x += d.vx
          d.y += d.vy
          // Wrap around edges
          if (d.x < -10) d.x = w + 10
          if (d.x > w + 10) d.x = -10
          if (d.y < -10) d.y = h + 10
          if (d.y > h + 10) d.y = -10
        }
      }

      // Draw connections — cyan-tinted for OLED
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
            const alpha = (1 - dist / LINE_THRESHOLD) * LINE_MAX_OPACITY
            // Subtle cyan tint instead of pure white
            ctx.strokeStyle = `rgba(89,246,255,${alpha})`
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(bx, by)
            ctx.stroke()
          }
        }
      }

      // Draw dots — slightly brighter for OLED visibility
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
