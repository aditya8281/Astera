import { useState, useEffect, useRef } from 'react'
import type { GraphNode, GraphEdge } from '../types'

/**
 * 2D force-directed layout simulation.
 * Returns x/y positions — no z-axis.
 *
 * Layout philosophy: NO center gravity. NO cluster gravity.
 * Just repulsion (constant) + link springs (threshold-based).
 * auto-fit camera handles centering the view.
 * Nodes spread naturally from repulsion; links pull connected
 * nodes to a threshold distance. That's it.
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
  cancelled = false
  settled = false
  private nodeMap: Map<number, Particle2D>
  private connectedMap: Map<number, Set<number>>
  private n: number

  // Tuning — these are constants, not multiplied by alpha
  private readonly REPULSION = 600       // constant repulsion strength
  private readonly LINK_DISTANCE = 150   // target distance between linked nodes
  private readonly LINK_SPRING = 0.03    // spring constant
  private readonly DAMPING = 0.5         // velocity damping per tick
  private readonly MAX_TICKS = 300       // hard stop
  private readonly MIN_VELOCITY = 0.05   // velocity threshold for settling
  private tickCount = 0

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    this.n = nodes.length
    // Wide initial spread — spread out, not clustered
    const spread = Math.max(15, Math.sqrt(this.n) * 5)
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
    if (this.settled || this.cancelled) return
    this.tickCount++
    if (this.tickCount > this.MAX_TICKS) { this.settled = true; return }

    const n = this.n
    if (n === 0) { this.settled = true; return }

    // Reset velocities
    for (const p of this.positions) { p.vx = 0; p.vy = 0 }

    // 1. REPULSION — constant, NOT decaying with alpha
    //    Every pair of nodes pushes apart
    if (n <= 400) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = this.positions[i], b = this.positions[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 1) dist = 1
          // Inverse-square repulsion with floor
          const force = this.REPULSION / (dist * dist + 100)
          const fx = (dx / dist) * force, fy = (dy / dist) * force
          a.vx -= fx; a.vy -= fy
          b.vx += fx; b.vy += fy
        }
      }
    } else {
      // Large graph: sample-based repulsion for perf
      const step = Math.max(1, Math.floor(n / 200))
      for (let i = 0; i < n; i += step) {
        const a = this.positions[i]
        for (let j = 0; j < n; j++) {
          if (i === j) continue
          const b = this.positions[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 1) dist = 1
          const force = this.REPULSION * 0.4 / (dist * dist + 100)
          a.vx -= (dx / dist) * force
          a.vy -= (dy / dist) * force
        }
      }
    }

    // 2. LINK SPRINGS — threshold-based, constant
    //    If distance > LINK_DISTANCE: pull together
    //    If distance < LINK_DISTANCE: push apart
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source), b = this.nodeMap.get(link.target)
      if (!a || !b) continue
      let dx = b.x - a.x, dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) dist = 0.5
      // Spring: rest at LINK_DISTANCE, push if too close, pull if too far
      const displacement = dist - this.LINK_DISTANCE
      const force = displacement * this.LINK_SPRING
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // 3. Integrate with strong damping
    for (const p of this.positions) {
      p.vx *= this.DAMPING; p.vy *= this.DAMPING
      p.x += p.vx; p.y += p.vy
    }

    // Check if settled: all velocities below threshold
    let totalVelocity = 0
    for (const p of this.positions) {
      totalVelocity += Math.abs(p.vx) + Math.abs(p.vy)
    }
    if (totalVelocity / n < this.MIN_VELOCITY && this.tickCount > 30) {
      this.settled = true
    }
  }
}
