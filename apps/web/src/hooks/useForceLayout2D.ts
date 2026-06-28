import { useState, useEffect, useRef } from 'react'
import type { GraphNode, GraphEdge } from '../types'

/**
 * 2D force-directed layout simulation.
 *
 * Physics:
 * - Repulsion: inverse-square with floor (prevents singularity)
 * - Link springs: threshold-based — pull if > target, push if < target/2
 * - Connection attraction: connected nodes attract gently (draws clusters together)
 * - Radial containment: prevents unbounded outward drift
 * - Moderate damping with velocity floor
 *
 * Adaptive: spread and forces scale with node count so small and large repos both look good.
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
  private adjacency: Map<number, Set<number>>

  // --- Adaptive tuning (scaled by node count) ---
  private readonly REPULSION_BASE = 600
  private readonly REPULSION_FLOOR = 150
  private readonly LINK_DISTANCE_BASE = 60
  private readonly LINK_SPRING = 0.05
  private readonly CONNECTION_ATTRACTION = 0.008
  private readonly RADIAL_CONTAINMENT = 0.003
  private readonly DAMPING = 0.65
  private readonly MIN_VELOCITY = 0.015
  private readonly MAX_TICKS = 600
  private tickCount = 0

  // Adaptive values
  private readonly repulsion: number
  private readonly linkDistance: number
  private readonly spread: number

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    const n = nodes.length

    // Adaptive spread: more nodes → wider initial spread to reduce early chaos
    this.spread = Math.max(20, Math.sqrt(n) * 6)
    this.repulsion = this.REPULSION_BASE * Math.max(0.5, Math.min(2, Math.sqrt(n) / 10))
    this.linkDistance = this.LINK_DISTANCE_BASE * Math.max(0.6, Math.min(1.5, Math.sqrt(n) / 8))

    this.positions = nodes.map(p => ({
      id: p.id,
      x: (Math.random() - 0.5) * this.spread,
      y: (Math.random() - 0.5) * this.spread,
      vx: 0, vy: 0,
    }))
    this.nodeMap = new Map(this.positions.map(p => [p.id, p]))

    // Build adjacency for connection attraction
    this.adjacency = new Map()
    for (const id of this.nodeMap.keys()) this.adjacency.set(id, new Set())

    this.links = edges
      .filter(e => this.nodeMap.has(e.source) && this.nodeMap.has(e.target))
      .map(e => {
        this.adjacency.get(e.source)!.add(e.target)
        this.adjacency.get(e.target)!.add(e.source)
        return { source: e.source, target: e.target }
      })
  }

  step() {
    if (this.settled || this.cancelled) return

    const n = this.positions.length
    if (n === 0) { this.settled = true; return }

    // 1. REPULSION — every pair pushes apart
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.positions[i], b = this.positions[j]
        let dx = b.x - a.x, dy = b.y - a.y
        const distSq = dx * dx + dy * dy
        if (distSq < 0.01) {
          const angle = Math.random() * Math.PI * 2
          a.vx -= Math.cos(angle) * 0.5
          a.vy -= Math.sin(angle) * 0.5
          b.vx += Math.cos(angle) * 0.5
          b.vy += Math.sin(angle) * 0.5
          continue
        }
        const dist = Math.sqrt(distSq)
        const force = this.repulsion / (distSq + this.REPULSION_FLOOR)
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
      const displacement = dist - this.linkDistance
      const force = displacement * this.LINK_SPRING
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // 3. CONNECTION ATTRACTION — connected nodes pull gently toward each other
    // This is the key addition: makes clusters of connected nodes visually coherent
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source), b = this.nodeMap.get(link.target)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue
      // Attract toward average position of connected neighbors
      const force = this.CONNECTION_ATTRACTION * Math.min(dist, this.linkDistance * 2)
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // 4. RADIAL CONTAINMENT — gentle inward pull to prevent unbounded expansion
    if (n > 3) {
      const maxRadius = this.spread * 1.5
      for (const p of this.positions) {
        const distFromCenter = Math.sqrt(p.x * p.x + p.y * p.y)
        if (distFromCenter > maxRadius) {
          const pull = (distFromCenter - maxRadius) * this.RADIAL_CONTAINMENT
          p.vx -= (p.x / distFromCenter) * pull
          p.vy -= (p.y / distFromCenter) * pull
        }
        // Prevent exact collapse to center
        if (distFromCenter < 5 && n > 5) {
          const angle = Math.atan2(p.y, p.x) || Math.random() * Math.PI * 2
          p.vx += Math.cos(angle) * 1.5
          p.vy += Math.sin(angle) * 1.5
        }
      }
    }

    // 5. Integrate with damping
    for (const p of this.positions) {
      p.vx *= this.DAMPING
      p.vy *= this.DAMPING
      p.x += p.vx
      p.y += p.vy
    }

    // 6. Check settlement
    this.tickCount++
    if (this.tickCount > 40) {
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
