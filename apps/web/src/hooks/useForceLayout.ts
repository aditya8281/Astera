import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '../types'

/**
 * Force-directed layout simulation.
 * Runs synchronously with velocity verlet integration.
 * Returns positions reactively — starts empty, fills when simulation stabilizes.
 */
export function useForceLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<number, THREE.Vector3> {
  const [positions, setPositions] = useState<Map<number, THREE.Vector3>>(new Map())
  const prevNodesRef = useRef<string>('')
  const simRef = useRef<ForceSimulation | null>(null)

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(new Map())
      return
    }

    // Skip if same node set
    const key = nodes.map(n => n.id).sort().join(',')
    if (key === prevNodesRef.current) return
    prevNodesRef.current = key

    // Cancel previous simulation
    if (simRef.current) {
      simRef.current.cancelled = true
    }

    const sim = new ForceSimulation(nodes, edges)
    simRef.current = sim

    let frame = 0
    const tick = () => {
      if (sim.cancelled) return

      sim.step()

      // Update positions every 3 frames for perf
      frame++
      if (frame % 3 === 0) {
        const map = new Map<number, THREE.Vector3>()
        for (const p of sim.positions) {
          map.set(p.id, new THREE.Vector3(p.x, p.y, p.z))
        }
        setPositions(map)
      }

      if (sim.alpha > 0.001) {
        requestAnimationFrame(tick)
      } else {
        // Final positions
        const map = new Map<number, THREE.Vector3>()
        for (const p of sim.positions) {
          map.set(p.id, new THREE.Vector3(p.x, p.y, p.z))
        }
        setPositions(map)
      }
    }

    requestAnimationFrame(tick)

    return () => {
      sim.cancelled = true
    }
  }, [nodes, edges])

  return positions
}

interface Particle {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

interface Link {
  source: number
  target: number
}

class ForceSimulation {
  positions: Particle[]
  links: Link[]
  alpha = 1.0
  alphaDecay = 0.02
  cancelled = false
  private nodeMap: Map<number, Particle>
  private connectedMap: Map<number, Set<number>>

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    // Initialize positions with some spread
    const spread = Math.max(5, Math.sqrt(nodes.length) * 2)
    this.positions = nodes.map((n) => ({
      id: n.id,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread * 0.5,
      z: (Math.random() - 0.5) * spread,
      vx: 0,
      vy: 0,
      vz: 0,
    }))

    this.nodeMap = new Map(this.positions.map(p => [p.id, p]))

    this.links = edges
      .filter(e => this.nodeMap.has(e.source) && this.nodeMap.has(e.target))
      .map(e => ({ source: e.source, target: e.target }))

    // Build adjacency for clustering
    this.connectedMap = new Map()
    for (const p of this.positions) {
      this.connectedMap.set(p.id, new Set())
    }
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

    const chargeStrength = -120 / Math.sqrt(n || 1)
    const linkDistance = Math.max(30, 120 / Math.sqrt(n || 1))
    const centerStrength = 0.01

    // Reset forces
    for (const p of this.positions) {
      p.vx = 0
      p.vy = 0
      p.vz = 0
    }

    // Charge repulsion (Barnes-Hut approximation for large n)
    if (n <= 200) {
      // O(n²) for small graphs
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = this.positions[i]
          const b = this.positions[j]
          let dx = b.x - a.x
          let dy = b.y - a.y
          let dz = b.z - a.z
          let dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < 0.1) dist = 0.1

          const force = (chargeStrength * this.alpha) / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          const fz = (dz / dist) * force

          a.vx -= fx
          a.vy -= fy
          a.vz -= fz
          b.vx += fx
          b.vy += fy
          b.vz += fz
        }
      }
    } else {
      // Approximate: only repel from neighbors + random subset
      const step = Math.max(1, Math.floor(n / 100))
      for (let i = 0; i < n; i += step) {
        const a = this.positions[i]
        for (let j = 0; j < n; j++) {
          if (i === j) continue
          const b = this.positions[j]
          let dx = b.x - a.x
          let dy = b.y - a.y
          let dz = b.z - a.z
          let dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < 0.1) dist = 0.1

          const force = (chargeStrength * this.alpha * 0.3) / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          const fz = (dz / dist) * force

          a.vx -= fx
          a.vy -= fy
          a.vz -= fz
        }
      }
    }

    // Link attraction (springs)
    for (const link of this.links) {
      const a = this.nodeMap.get(link.source)
      const b = this.nodeMap.get(link.target)
      if (!a || !b) continue

      let dx = b.x - a.x
      let dy = b.y - a.y
      let dz = b.z - a.z
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist < 0.1) dist = 0.1

      const force = (dist - linkDistance) * 0.05 * this.alpha
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force

      a.vx += fx
      a.vy += fy
      a.vz += fz
      b.vx -= fx
      b.vy -= fy
      b.vz -= fz
    }

    // Cluster gravity — connected nodes attract toward each other's centroid
    for (const p of this.positions) {
      const neighbors = this.connectedMap.get(p.id)
      if (!neighbors || neighbors.size === 0) continue

      let cx = 0, cy = 0, cz = 0, count = 0
      for (const nid of neighbors) {
        const n = this.nodeMap.get(nid)
        if (n) { cx += n.x; cy += n.y; cz += n.z; count++ }
      }
      if (count > 0) {
        cx /= count; cy /= count; cz /= count
        p.vx += (cx - p.x) * 0.003 * this.alpha
        p.vy += (cy - p.y) * 0.003 * this.alpha
        p.vz += (cz - p.z) * 0.003 * this.alpha
      }
    }

    // Center gravity
    for (const p of this.positions) {
      p.vx -= p.x * centerStrength * this.alpha
      p.vy -= p.y * centerStrength * this.alpha
      p.vz -= p.z * centerStrength * this.alpha
    }

    // Integrate
    const velocityDecay = 0.6
    for (const p of this.positions) {
      p.vx *= velocityDecay
      p.vy *= velocityDecay
      p.vz *= velocityDecay
      p.x += p.vx
      p.y += p.vy
      p.z += p.vz
    }
  }
}
