import { useMemo } from 'react'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '../types'

/**
 * Simple force-directed layout.
 * For <1000 nodes: runs synchronously.
 * For larger: still sync but faster iteration count.
 */
export function useForceLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<number, THREE.Vector3> {
  return useMemo(() => {
    const positions = new Map<number, THREE.Vector3>()
    const N = nodes.length

    if (N === 0) return positions

    // Initialize on sphere
    nodes.forEach((n) => {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = 2 * Math.PI * Math.random()
      const r = 3 + Math.cbrt(N) * 0.5
      positions.set(n.id, new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ))
    })

    // Build adjacency for fast lookup
    const adjacency = new Map<number, number[]>()
    for (const e of edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, [])
      if (!adjacency.has(e.target)) adjacency.set(e.target, [])
      adjacency.get(e.source)!.push(e.target)
      adjacency.get(e.target)!.push(e.source)
    }

    // Adaptive iteration count
    const iterations = N < 200 ? 100 : N < 1000 ? 60 : N < 5000 ? 40 : 20
    const repulsionStrength = N < 500 ? 1.0 : N < 2000 ? 0.5 : 0.3
    const attractionStrength = N < 500 ? 0.03 : 0.02

    // Force simulation
    for (let iter = 0; iter < iterations; iter++) {
      const temp = 1.0 - iter / iterations

      // Repulsion (N² for small graphs, skip for very large)
      if (N < 2000) {
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const a = positions.get(nodes[i].id)!
            const b = positions.get(nodes[j].id)!
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dz = a.z - b.z
            const distSq = dx * dx + dy * dy + dz * dz
            const dist = Math.max(Math.sqrt(distSq), 0.01)
            const force = repulsionStrength / (distSq) * temp
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            const fz = (dz / dist) * force
            a.x += fx; a.y += fy; a.z += fz
            b.x -= fx; b.y -= fy; b.z -= fz
          }
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = positions.get(edge.source)
        const b = positions.get(edge.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const force = (dist - 2.0) * attractionStrength * temp
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fz = (dz / dist) * force
        a.x += fx; a.y += fy; a.z += fz
        b.x -= fx; b.y -= fy; b.z -= fz
      }

      // Center gravity
      for (const pos of positions.values()) {
        pos.x *= 0.99
        pos.y *= 0.99
        pos.z *= 0.99
      }
    }

    return positions
  }, [nodes, edges])
}
