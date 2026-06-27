import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphEdge } from '../../types'
import { COLORS } from '../../constants'

const MAX_EDGES = 20_000
const CURVE_SEGMENTS = 8 // segments per curved edge
const TOTAL_VERTS = MAX_EDGES * (CURVE_SEGMENTS + 1)

// Pre-allocated geometry for curved edges
function createCurvedEdgeGeometry() {
  const positions = new Float32Array(TOTAL_VERTS * 3)
  const colors = new Float32Array(TOTAL_VERTS * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Quadratic bezier point
function bezierPoint(
  t: number,
  x0: number, y0: number, z0: number,
  cx: number, cy: number, cz: number,
  x1: number, y1: number, z1: number,
): [number, number, number] {
  const mt = 1 - t
  return [
    mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    mt * mt * z0 + 2 * mt * t * cz + t * t * z1,
  ]
}

export function EdgeInstances({
  edges,
  positions,
  selectedNodeId,
  hoveredNodeId,
  animation,
}: {
  edges: GraphEdge[]
  positions: Map<number, [number, number, number]>
  selectedNodeId: number | null
  hoveredNodeId: number | null
  animation: 'pulse' | 'dots' | 'glow' | 'both' | 'none'
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)
  const edgeGeometry = useMemo(() => createCurvedEdgeGeometry(), [])
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (!lineRef.current) return
    timeRef.current += delta

    const posAttr = edgeGeometry.attributes.position as THREE.BufferAttribute
    const colAttr = edgeGeometry.attributes.color as THREE.BufferAttribute

    const anyFocused = selectedNodeId !== null || hoveredNodeId !== null

    const defaultColor = new THREE.Color(COLORS.edgeDefault)
    const hoverColor = new THREE.Color(COLORS.edgeHover)
    const dimColor = new THREE.Color(COLORS.edgeDefault).multiplyScalar(0.3)

    let vertIndex = 0

    for (let i = 0; i < edges.length && i < MAX_EDGES; i++) {
      const edge = edges[i]
      const from = positions.get(edge.source)
      const to = positions.get(edge.target)

      if (!from || !to) {
        // Skip: write degenerate segment
        for (let s = 0; s <= CURVE_SEGMENTS; s++) {
          posAttr.setXYZ(vertIndex, 0, 0, -1000)
          colAttr.setXYZ(vertIndex, 0, 0, 0)
          vertIndex++
        }
        continue
      }

      const isSource = edge.source === selectedNodeId || edge.source === hoveredNodeId
      const isTarget = edge.target === selectedNodeId || edge.target === hoveredNodeId
      const isConnected = isSource || isTarget

      // Compute bezier control point (arc perpendicular to midpoint)
      const midX = (from[0] + to[0]) / 2
      const midY = (from[1] + to[1]) / 2
      const midZ = (from[2] + to[2]) / 2
      const dx = to[0] - from[0]
      const dy = to[1] - from[1]
      const dz = to[2] - from[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Curve amount proportional to distance (subtle arc)
      const curveAmount = Math.min(dist * 0.1, 2.0)
      // Perpendicular direction (cross with up vector)
      const nx = -dy * curveAmount / (dist || 1)
      const ny = dx * curveAmount / (dist || 1)
      const nz = 0

      const cx = midX + nx
      const cy = midY + ny
      const cz = midZ + nz

      // Write curved edge vertices
      for (let s = 0; s <= CURVE_SEGMENTS; s++) {
        const t = s / CURVE_SEGMENTS
        const [px, py, pz] = bezierPoint(
          t,
          from[0], from[1], from[2],
          cx, cy, cz,
          to[0], to[1], to[2],
        )
        posAttr.setXYZ(vertIndex, px, py, pz)

        // Color
        let color: THREE.Color
        let opacity: number

        if (isConnected) {
          color = hoverColor.clone()
          opacity = 0.5

          // Animated pulse along the edge
          if (animation === 'pulse' || animation === 'both' || animation === 'glow') {
            // Pulse travels from source to target in 1.5s
            const pulseT = (timeRef.current * 0.67) % 1.0 // 1/1.5 = 0.67
            const distFromPulse = Math.abs(t - pulseT)
            const pulseBrightness = Math.max(0, 1 - distFromPulse * 4)
            opacity += pulseBrightness * 0.5
          }
        } else if (anyFocused) {
          color = dimColor.clone()
          opacity = 0.08
        } else {
          color = defaultColor.clone()
          opacity = 0.22
        }

        colAttr.setXYZ(vertIndex, color.r * opacity, color.g * opacity, color.b * opacity)
        vertIndex++
      }
    }

    // Clear remaining slots
    for (let i = vertIndex; i < TOTAL_VERTS; i++) {
      posAttr.setXYZ(i, 0, 0, -1000)
      colAttr.setXYZ(i, 0, 0, 0)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    edgeGeometry.setDrawRange(0, Math.min(edges.length, MAX_EDGES) * (CURVE_SEGMENTS + 1))
  })

  return (
    <lineSegments ref={lineRef} geometry={edgeGeometry} frustumCulled={false}>
      <lineBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        linewidth={1}
      />
    </lineSegments>
  )
}
