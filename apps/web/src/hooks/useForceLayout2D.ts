import { useState, useEffect, useRef } from 'react'
import type { GraphNode, GraphEdge } from '../types'

/**
 * 2D force-directed layout simulation.
 * Returns x/y positions — no z-axis.
 *
 * Tuned for calm, spacious layout:
 * - Stronger repulsion (charge) for breathing room
 * - Wider link distance to prevent clustering
 * - Slower alpha decay for smoother convergence
 * - Gentle center gravity to keep graph in view
 */

export interface Vec2 { x: number; y: number }

export function useForceLayout2D(nodes: GraphNode[], edges: GraphEdge[]): Map<number, Vec2> {
  const [positions, setPositions] = useState<Map<number, Vec2>>(new Map())
  const prevNodesRef = useRef<string>('')
  const simRef = useRef<ForceSimulation2D | null>(null)

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(new Map())
      return
    }

    const key = nodes.map(n => n.id).sort().join(',')
    if (key === prevNodesRef.current) return
    prevNodesRef.current = key

    if (simRef.current) simRef.current.cancelled = true

    const sim = new ForceSimulation2D(nodes, edges)
    simRef.current = sim

    let frame = 0
    const tick = () => {
      if (sim.cancelled) return
      sim.step()
      frame++
      if (frame % 2 === 0) {
        const map = new Map<number, Vec2>()
        for (const p of sim.positions) map.set(p.id, { x: p.x, y: p.y })
        setPositions(map)
      }
      if (sim.alpha > 0.001) {
        requestAnimationFrame(tick)
      } else {
        const map = new Map<number, Vec2>()
        for (const p of sim.positions) map.set(p.id, { x: p.x, y: p.y })
        setPositions(map)
      }
    }
    requestAnimationFrame(tick)

    return () => { sim.cancelled = true }
  }, [nodes, edges])

  return positions
}

interface Particle2D {
  id: number; x: number; y: number; vx: number; vy: number
}
interface Link { source: number; target: number }

class ForceSimulation2D {
  positions: Particle2D[]
  links: Link[]
  alpha = 1.0
  alphaDecay = 0.012 // Slower decay = more settling time = calmer convergence
  cancelled = false
  private nodeMap: Map<number, Particle2D>
  private connectedMap: Map<number, Set<number>>

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    // Wider initial spread for spacious feel
    const spread = Math.max(12, Math.sqrt(nodes.length) * 4)
    this.positions = nodes.map(n => ({
      id: n.id,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      vx: 0, vy: 0,
    }))
    this.nodeMap = new Map(this.positions.map(p => [p.id, p]))
    this.links = edges
      .filter(e => this.nodeMap.has(e.source) && this.nodeMap.has(e.target))
      .map(e => ({ source: e.source, target: e.target }))

    this.connectedMap = new Map()
    for (const p of this.positions) this.connectedMap.set(p.id, new Set())
    for (const link of this.links) {
      this.connectedMap.get(link.source)?.add(link.target)
      this.connectedMap.get(link.target)?.add(link.source)
    }
  }

  step() {
    this.alpha *= (1 - this.alphaDecay)
    if (this.alpha < 0.001) return
    const n = this.positions.length
    if (n === 0) return

    // Tuning: wide spread, no center gravity (auto-fit handles centering)
    const chargeStrength = -400 / Math.sqrt(n || 1) // Strong repulsion for breathing room
    const linkDistance = Math.max(100, 250 / Math.sqrt(n || 1)) // Wide spacing between linked nodes

    for (const p of this.positions) { p.vx = 0; p.vy = 0 }

    // Charge repulsion
    if (n <= 300) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = this.positions[i], b = this.positions[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 0.5) dist = 0.5
          const force = (chargeStrength * this.alpha) / (dist * dist)
          const fx = (dx / dist) * force, fy = (dy / dist) * force
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy
        }
      }
    } else {
      const step = Math.max(1, Math.floor(n / 150))
      for (let i = 0; i < n; i += step) {
        const a = this.positions[i]
        for (let j = 0; j < n; j++) {
          if (i === j) continue
          const b = this.positions[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 0.5) dist = 0.5
          const force = (chargeStrength * this.alpha * 0.3) / (dist * dist)
          a.vx -= (dx / dist) * force; a.vy -= (dy / dist) * force
        }
      }
    }

    // Link attraction — gentler spring
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source), b = this.nodeMap.get(link.target)
      if (!a || !b) continue
      let dx = b.x - a.x, dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) dist = 0.5
      const force = (dist - linkDistance) * 0.025 * this.alpha // Softer spring
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }

    // Cluster gravity — very gentle grouping
    for (const p of this.positions) {
      const neighbors = this.connectedMap.get(p.id)
      if (!neighbors || neighbors.size === 0) continue
      let cx = 0, cy = 0, count = 0
      for (const nid of neighbors) {
        const nd = this.nodeMap.get(nid)
        if (nd) { cx += nd.x; cy += nd.y; count++ }
      }
      if (count > 0) {
        cx /= count; cy /= count
        p.vx += (cx - p.x) * 0.002 * this.alpha // Half the original gravity
        p.vy += (cy - p.y) * 0.002 * this.alpha
      }
    }

    // Integrate with damping
    const decay = 0.55 // Slightly more damping for smoother motion
    for (const p of this.positions) {
      p.vx *= decay; p.vy *= decay
      p.x += p.vx; p.y += p.vy
    }
  }
}
