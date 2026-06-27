// Force layout Web Worker
// Runs O(N²) force simulation off main thread

interface LayoutMessage {
  type: 'compute'
  nodes: Array<{ id: number; x?: number; y?: number; z?: number }>
  edges: Array<{ source: number; target: number }>
  config?: {
    iterations?: number
    repulsion?: number
    attraction?: number
    centerGravity?: number
  }
}

interface LayoutResult {
  type: 'result'
  positions: Record<number, [number, number, number]>
}

self.onmessage = (e: MessageEvent<LayoutMessage>) => {
  if (e.data.type !== 'compute') return

  const { nodes, edges, config } = e.data
  const N = nodes.length

  if (N === 0) {
    self.postMessage({ type: 'result', positions: {} } satisfies LayoutResult)
    return
  }

  const repulsion = config?.repulsion ?? (N < 500 ? 1.0 : N < 2000 ? 0.5 : 0.3)
  const attraction = config?.attraction ?? (N < 500 ? 0.03 : 0.02)
  const centerGravity = config?.centerGravity ?? 0.99
  const iterations = config?.iterations ?? (N < 200 ? 100 : N < 1000 ? 60 : N < 5000 ? 40 : 20)

  // Initialize positions (sphere distribution)
  const posMap = new Map<number, [number, number, number]>()
  const idxMap = new Map<number, number>()

  for (let i = 0; i < N; i++) {
    const node = nodes[i]
    idxMap.set(node.id, i)

    if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      posMap.set(node.id, [node.x, node.y, node.z])
    } else {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = 2 * Math.PI * Math.random()
      const r = 3 + Math.cbrt(N) * 0.5
      posMap.set(node.id, [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ])
    }
  }

  // Pre-compute adjacency for attraction
  const neighbors = new Map<number, number[]>()
  for (const e of edges) {
    if (!neighbors.has(e.source)) neighbors.set(e.source, [])
    if (!neighbors.has(e.target)) neighbors.set(e.target, [])
    neighbors.get(e.source)!.push(e.target)
    neighbors.get(e.target)!.push(e.source)
  }

  // Force simulation
  const nodeArray = Array.from(posMap.values())

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1.0 - iter / iterations

    // Repulsion (all pairs for N < 2000, skip for larger)
    if (N < 2000) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodeArray[i]
          const b = nodeArray[j]
          const dx = a[0] - b[0]
          const dy = a[1] - b[1]
          const dz = a[2] - b[2]
          const distSq = dx * dx + dy * dy + dz * dz
          const dist = Math.max(Math.sqrt(distSq), 0.01)
          const force = (repulsion / distSq) * temp
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          const fz = (dz / dist) * force
          a[0] += fx; a[1] += fy; a[2] += fz
          b[0] -= fx; b[1] -= fy; b[2] -= fz
        }
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const ai = idxMap.get(edge.source)
      const bi = idxMap.get(edge.target)
      if (ai === undefined || bi === undefined) continue
      const a = nodeArray[ai]
      const b = nodeArray[bi]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const dz = b[2] - a[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist < 0.01) continue
      const force = (dist - 2.0) * attraction * temp
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      a[0] += fx; a[1] += fy; a[2] += fz
      b[0] -= fx; b[1] -= fy; b[2] -= fz
    }

    // Center gravity
    for (const pos of nodeArray) {
      pos[0] *= centerGravity
      pos[1] *= centerGravity
      pos[2] *= centerGravity
    }
  }

  // Build result
  const positions: Record<number, [number, number, number]> = {}
  for (const node of nodes) {
    const pos = posMap.get(node.id)
    if (pos) positions[node.id] = pos
  }

  self.postMessage({ type: 'result', positions } satisfies LayoutResult)
}
