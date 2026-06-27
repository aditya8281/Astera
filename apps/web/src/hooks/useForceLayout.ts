import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '../types'

/**
 * Force-directed layout using a Web Worker.
 * Returns positions reactively — starts as empty, fills when worker completes.
 * Falls back to synchronous layout if worker fails.
 */
export function useForceLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<number, THREE.Vector3> {
  const [positions, setPositions] = useState<Map<number, THREE.Vector3>>(new Map())
  const prevNodesRef = useRef<string>('')

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(new Map())
      return
    }

    // Skip if same node set
    const key = `${nodes.length}:${edges.length}`
    if (key === prevNodesRef.current) return
    prevNodesRef.current = key

    // For very small graphs, skip worker overhead
    if (nodes.length < 50) {
      setPositions(computeSync(nodes, edges))
      return
    }

    let cancelled = false

    const worker = new Worker(
      new URL('../workers/forceLayout.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      if (cancelled) return
      if (e.data.type === 'result') {
        const raw = e.data.positions as Record<number, [number, number, number]>
        const map = new Map<number, THREE.Vector3>()
        for (const [id, [x, y, z]] of Object.entries(raw)) {
          map.set(Number(id), new THREE.Vector3(x, y, z))
        }
        setPositions(map)
      }
      worker.terminate()
    }

    worker.onerror = () => {
      // Fallback to sync
      if (!cancelled) {
        setPositions(computeSync(nodes, edges))
      }
      worker.terminate()
    }

    worker.postMessage({
      type: 'compute',
      nodes: nodes.map(n => ({ id: n.id })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
    })

    return () => {
      cancelled = true
      worker.terminate()
    }
  }, [nodes, edges])

  return positions
}

/** Synchronous fallback for small graphs or worker failure */
function computeSync(nodes: GraphNode[], edges: GraphEdge[]): Map<number, THREE.Vector3> {
  const positions = new Map<number, THREE.Vector3>()
  const N = nodes.length

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

  const iterations = N < 200 ? 100 : N < 1000 ? 60 : 20
  const rep = N < 500 ? 1.0 : 0.5

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1.0 - iter / iterations

    if (N < 2000) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = positions.get(nodes[i].id)!
          const b = positions.get(nodes[j].id)!
          const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
          const distSq = dx * dx + dy * dy + dz * dz
          const dist = Math.max(Math.sqrt(distSq), 0.01)
          const force = rep / distSq * temp
          const fx = (dx / dist) * force, fy = (dy / dist) * force, fz = (dz / dist) * force
          a.x += fx; a.y += fy; a.z += fz
          b.x -= fx; b.y -= fy; b.z -= fz
        }
      }
    }

    for (const edge of edges) {
      const a = positions.get(edge.source)
      const b = positions.get(edge.target)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist < 0.01) continue
      const force = (dist - 2.0) * 0.02 * temp
      const fx = (dx / dist) * force, fy = (dy / dist) * force, fz = (dz / dist) * force
      a.x += fx; a.y += fy; a.z += fz
      b.x -= fx; b.y -= fy; b.z -= fz
    }

    for (const pos of positions.values()) {
      pos.x *= 0.99; pos.y *= 0.99; pos.z *= 0.99
    }
  }

  return positions
}
