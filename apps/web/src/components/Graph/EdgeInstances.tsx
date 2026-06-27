import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphEdge } from '../../types'
import { COLORS } from '../../constants'

const MAX_EDGES = 20_000

// Pre-allocated geometry for all edges
function createEdgeGeometry() {
  const positions = new Float32Array(MAX_EDGES * 6) // 2 vertices * 3 components * MAX_EDGES
  const colors = new Float32Array(MAX_EDGES * 6) // 2 vertices * 3 components * MAX_EDGES
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

export function EdgeInstances({
  edges,
  positions,
  selectedNodeId,
  animation,
}: {
  edges: GraphEdge[]
  positions: Map<number, [number, number, number]>
  selectedNodeId: number | null
  animation: 'dots' | 'glow' | 'both' | 'none'
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)
  const glowLineRef = useRef<THREE.LineSegments>(null!)
  const edgeGeometry = useMemo(() => createEdgeGeometry(), [])
  const glowGeometry = useMemo(() => createEdgeGeometry(), [])
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (!lineRef.current) return

    timeRef.current += delta

    const posAttr = edgeGeometry.attributes.position as THREE.BufferAttribute
    const colAttr = edgeGeometry.attributes.color as THREE.BufferAttribute
    const glowPosAttr = glowGeometry.attributes.position as THREE.BufferAttribute
    const glowColAttr = glowGeometry.attributes.color as THREE.BufferAttribute

    const anySelected = selectedNodeId !== null
    const cyanColor = new THREE.Color(COLORS.relationship)
    const dimColor = new THREE.Color(COLORS.border)
    const selectedColor = new THREE.Color(COLORS.relationshipGlow)
    const glowCyan = new THREE.Color(COLORS.relationship).multiplyScalar(0.15)

    for (let i = 0; i < edges.length && i < MAX_EDGES; i++) {
      const edge = edges[i]
      const from = positions.get(edge.source)
      const to = positions.get(edge.target)

      if (!from || !to) {
        // Hide off-screen
        posAttr.setXYZ(i * 2, 0, 0, -1000)
        posAttr.setXYZ(i * 2 + 1, 0, 0, -1000)
        glowPosAttr.setXYZ(i * 2, 0, 0, -1000)
        glowPosAttr.setXYZ(i * 2 + 1, 0, 0, -1000)
        continue
      }

      const isConnected = anySelected && (edge.source === selectedNodeId || edge.target === selectedNodeId)

      // Position
      posAttr.setXYZ(i * 2, from[0], from[1], from[2])
      posAttr.setXYZ(i * 2 + 1, to[0], to[1], to[2])

      // Glow (slightly wider)
      glowPosAttr.setXYZ(i * 2, from[0], from[1], from[2])
      glowPosAttr.setXYZ(i * 2 + 1, to[0], to[1], to[2])

      // Color with optional animation
      let color: THREE.Color
      let opacity: number

      if (isConnected) {
        color = selectedColor.clone()
        opacity = 0.9

        // Glow pulse for connected edges
        if (animation === 'glow' || animation === 'both') {
          const pulse = 0.7 + 0.3 * Math.sin(timeRef.current * 3 + i * 0.5)
          opacity *= pulse
        }
      } else {
        color = dimColor.clone()
        opacity = 0.12
      }

      // Apply traveling dots effect via color modulation
      if ((animation === 'dots' || animation === 'both') && isConnected) {
        const t = (timeRef.current * 0.5 + i * 0.3) % 1.0
        if (t < 0.1) {
          color = cyanColor.clone().lerp(selectedColor, t / 0.1)
        }
      }

      colAttr.setXYZ(i * 2, color.r * opacity, color.g * opacity, color.b * opacity)
      colAttr.setXYZ(i * 2 + 1, color.r * opacity, color.g * opacity, color.b * opacity)

      // Glow line
      glowColAttr.setXYZ(i * 2, glowCyan.r, glowCyan.g, glowCyan.b)
      glowColAttr.setXYZ(i * 2 + 1, glowCyan.r, glowCyan.g, glowCyan.b)
    }

    // Clear remaining slots
    for (let i = edges.length; i < MAX_EDGES; i++) {
      posAttr.setXYZ(i * 2, 0, 0, -1000)
      posAttr.setXYZ(i * 2 + 1, 0, 0, -1000)
      glowPosAttr.setXYZ(i * 2, 0, 0, -1000)
      glowPosAttr.setXYZ(i * 2 + 1, 0, 0, -1000)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    glowPosAttr.needsUpdate = true
    glowColAttr.needsUpdate = true
    edgeGeometry.setDrawRange(0, edges.length * 2)
    glowGeometry.setDrawRange(0, edges.length * 2)
  })

  return (
    <group>
      {/* Glow layer */}
      <lineSegments ref={glowLineRef} geometry={glowGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Main edges */}
      <lineSegments ref={lineRef} geometry={edgeGeometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} />
      </lineSegments>
    </group>
  )
}
