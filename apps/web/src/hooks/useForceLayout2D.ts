import { useState, useEffect, useRef } from 'react'
import type { GraphNode, GraphEdge } from '../types'

/**
 * 2D force-directed layout with Barnes-Hut quadtree for O(n log n) performance.
 *
 * Physics:
 * - Repulsion: Barnes-Hut approximate (O(n log n) vs O(n²))
 * - Link springs: threshold-based attraction/repulsion
 * - Connection attraction: connected nodes pull together
 * - Radial containment: prevents unbounded drift
 * - Adaptive tuning: forces scale with node count
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

// ─── Barnes-Hut Quadtree ───

interface QuadNode {
  x: number; y: number; mass: number; totalX: number; totalY: number
  childNW: QuadNode | null; childNE: QuadNode | null
  childSW: QuadNode | null; childSE: QuadNode | null
}

const THETA = 0.8 // Accuracy threshold for Barnes-Hut

function buildQuadtree(particles: Particle2D[]): QuadNode {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of particles) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  // Expand bounds slightly to avoid edge cases
  const dx = (maxX - minX) || 1
  const dy = (maxY - minY) || 1
  const pad = Math.max(dx, dy) * 0.1
  minX -= pad; minY -= pad; maxX += pad; maxY += pad

  const root: QuadNode = { x: 0, y: 0, mass: 0, totalX: 0, totalY: 0, childNW: null, childNE: null, childSW: null, childSE: null }

  for (const p of particles) {
    insertParticle(root, p, minX, minY, maxX, maxY)
  }

  return root
}

function insertParticle(node: QuadNode, p: Particle2D, minX: number, minY: number, maxX: number, maxY: number) {
  // Update center of mass
  const newMass = node.mass + 1
  node.totalX += p.x
  node.totalY += p.y
  node.x = node.totalX / newMass
  node.y = node.totalY / newMass
  node.mass = newMass

  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  // Leaf node with existing particle — split
  if (node.mass === 2 && !node.childNW) {
    // Re-insert the existing particle into a quadrant
    const existingX = node.x
    const existingY = node.y
    const exId = -1 // Virtual — just for position
    const exP: Particle2D = { id: exId, x: existingX, y: existingY, vx: 0, vy: 0 }
    insertIntoChild(node, exP, minX, minY, maxX, maxY, midX, midY)
  }

  // Insert new particle
  if (node.mass > 1 || node.childNW) {
    insertIntoChild(node, p, minX, minY, maxX, maxY, midX, midY)
  }
}

function insertIntoChild(node: QuadNode, p: Particle2D, minX: number, minY: number, maxX: number, maxY: number, midX: number, midY: number) {
  const childMinX = p.x < midX ? minX : midX
  const childMaxX = p.x < midX ? midX : maxX
  const childMinY = p.y < midY ? minY : midY
  const childMaxY = p.y < midY ? midY : maxY

  if (p.x < midX) {
    if (p.y < midY) {
      if (!node.childNW) node.childNW = { x: 0, y: 0, mass: 0, totalX: 0, totalY: 0, childNW: null, childNE: null, childSW: null, childSE: null }
      insertParticle(node.childNW, p, childMinX, childMinY, childMaxX, childMaxY)
    } else {
      if (!node.childSW) node.childSW = { x: 0, y: 0, mass: 0, totalX: 0, totalY: 0, childNW: null, childNE: null, childSW: null, childSE: null }
      insertParticle(node.childSW, p, childMinX, childMinY, childMaxX, childMaxY)
    }
  } else {
    if (p.y < midY) {
      if (!node.childNE) node.childNE = { x: 0, y: 0, mass: 0, totalX: 0, totalY: 0, childNW: null, childNE: null, childSW: null, childSE: null }
      insertParticle(node.childNE, p, childMinX, childMinY, childMaxX, childMaxY)
    } else {
      if (!node.childSE) node.childSE = { x: 0, y: 0, mass: 0, totalX: 0, totalY: 0, childNW: null, childNE: null, childSW: null, childSE: null }
      insertParticle(node.childSE, p, childMinX, childMinY, childMaxX, childMaxY)
    }
  }
}

function applyBarnesHut(node: QuadNode, p: Particle2D, repulsion: number, floor: number) {
  if (node.mass === 0) return

  const dx = p.x - node.x
  const dy = p.y - node.y
  const distSq = dx * dx + dy * dy

  // Leaf node or far enough — treat as point mass
  if (node.mass === 1 || !node.childNW) {
    if (distSq < 0.01) return // Skip self
    const dist = Math.sqrt(distSq)
    const force = repulsion / (distSq + floor)
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    p.vx += fx
    p.vy += fy
    return
  }

  // Internal node — check if far enough to approximate
  const nodeSize = Math.sqrt((node.totalX / node.mass - node.x) ** 2 + (node.totalY / node.mass - node.y) ** 2) || 1
  const width = Math.max(1, nodeSize * 2)

  if (width * width / (distSq + 0.01) < THETA * THETA) {
    // Approximate as point mass
    if (distSq < 0.01) return
    const dist = Math.sqrt(distSq)
    const force = repulsion / (distSq + floor)
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    p.vx += fx
    p.vy += fy
  } else {
    // Recurse into children
    if (node.childNW) applyBarnesHut(node.childNW, p, repulsion, floor)
    if (node.childNE) applyBarnesHut(node.childNE, p, repulsion, floor)
    if (node.childSW) applyBarnesHut(node.childSW, p, repulsion, floor)
    if (node.childSE) applyBarnesHut(node.childSE, p, repulsion, floor)
  }
}

class ForceSimulation2D {
  positions: Particle2D[]
  links: Link[]
  settled = false
  cancelled = false
  private nodeMap: Map<number, Particle2D>
  private adjacency: Map<number, Set<number>>

  // --- Adaptive tuning (scaled by node count) ---
  // Calm, spacious layout: high repulsion, wide link distance, gentle attraction
  private readonly REPULSION_BASE = 900
  private readonly REPULSION_FLOOR = 200
  private readonly LINK_DISTANCE_BASE = 140
  private readonly LINK_SPRING = 0.03
  private readonly CONNECTION_ATTRACTION = 0.004
  private readonly RADIAL_CONTAINMENT = 0.0015
  private readonly DAMPING = 0.7
  private readonly MIN_VELOCITY = 0.012
  private readonly MAX_TICKS = 800
  private tickCount = 0

  // Adaptive values
  private readonly repulsion: number
  private readonly linkDistance: number
  private readonly spread: number

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    const n = nodes.length

    // Adaptive spread: more nodes → wider initial spread to reduce early chaos
    this.spread = Math.max(30, Math.sqrt(n) * 8)
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

    // 1. REPULSION — Barnes-Hut quadtree for O(n log n)
    const tree = buildQuadtree(this.positions)
    for (const p of this.positions) {
      applyBarnesHut(tree, p, this.repulsion, this.REPULSION_FLOOR)
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
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source), b = this.nodeMap.get(link.target)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue
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
