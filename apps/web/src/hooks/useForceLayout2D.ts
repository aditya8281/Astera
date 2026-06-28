import { useState, useEffect, useRef } from 'react'
import type { GraphNode, GraphEdge } from '../types'

/**
 * 2D force-directed layout simulation.
 *
 * Zero gravity — pure repulsion + link springs.
 * Nodes orbit and settle organically, never collapsing to center.
 * Constant repulsion (no decay) keeps nodes spread.
 * Link springs: pull if too far, push if too close.
 * Moderate damping lets nodes oscillate visibly before settling.
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
      if (sim.settled) {
        const map = new Map<number, Vec2>()
        for (const p of sim.positions) map.set(p.id, { x: p.x, y: p.y })
        setPositions(map)
      } else {
        requestAnimationFrame(tick)
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
  settled = false
  cancelled = false
  private nodeMap: Map<number, Particle2D>

  // --- Tuning constants ---
  private readonly REPULSION = 800
  private readonly REPULSION_FLOOR = 200     // prevent singularity at d=0
  private readonly LINK_DISTANCE = 80
  private readonly LINK_SPRING = 0.04
  private readonly DAMPING = 0.7
  private readonly MIN_VELOCITY = 0.02
  private readonly MAX_TICKS = 500
  private tickCount = 0

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    const spread = Math.max(15, Math.sqrt(nodes.length) * 5)
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
  }

  step() {
    if (this.settled || this.cancelled) return

    const n = this.positions.length
    if (n === 0) { this.settled = true; return }

    // 1. REPULSION — every pair pushes apart (constant, no gravity)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.positions[i], b = this.positions[j]
        let dx = b.x - a.x, dy = b.y - a.y
        const distSq = dx * dx + dy * dy
        if (distSq < 0.01) {
          // Jitter overlapping nodes apart
          const angle = Math.random() * Math.PI * 2
          a.vx -= Math.cos(angle) * 0.5
          a.vy -= Math.sin(angle) * 0.5
          b.vx += Math.cos(angle) * 0.5
          b.vy += Math.sin(angle) * 0.5
          continue
        }
        const dist = Math.sqrt(distSq)
        const force = this.REPULSION / (distSq + this.REPULSION_FLOOR)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx -= fx; a.vy -= fy
        b.vx += fx; b.vy += fy
      }
    }

    // 2. LINK SPRINGS — threshold-based attraction/repulsion
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source), b = this.nodeMap.get(link.target)
      if (!a || !b) continue
      let dx = b.x - a.x, dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) dist = 0.5
      const displacement = dist - this.LINK_DISTANCE
      const force = displacement * this.LINK_SPRING
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // 3. Gentle radial energy: slight outward push to prevent collapse
    if (n > 5) {
      for (const p of this.positions) {
        const distFromCenter = Math.sqrt(p.x * p.x + p.y * p.y)
        if (distFromCenter < 10) {
          const angle = Math.atan2(p.y, p.x) || Math.random() * Math.PI * 2
          p.vx += Math.cos(angle) * 2
          p.vy += Math.sin(angle) * 2
        }
      }
    }

    // 4. Integrate with moderate damping
    for (const p of this.positions) {
      p.vx *= this.DAMPING
      p.vy *= this.DAMPING
      p.x += p.vx
      p.y += p.vy
    }

    // 5. Check settlement
    this.tickCount++
    if (this.tickCount > 50) {
      let totalVel = 0
      for (const p of this.positions) {
        totalVel += Math.abs(p.vx) + Math.abs(p.vy)
      }
      const avgVel = totalVel / n
      if (avgVel < this.MIN_VELOCITY) {
        this.settled = true
      }
    }
    if (this.tickCount >= this.MAX_TICKS) {
      this.settled = true
    }
  }
}
