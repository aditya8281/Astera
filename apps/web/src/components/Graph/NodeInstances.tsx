import { useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphNode } from '../../types'
import { useUIStore } from '../../store'
import { NODE_COLORS } from '../../constants'

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()
const _scale = new THREE.Vector3()

export function NodeInstances({
  nodes,
  positions,
  selectedNodeId,
  hoveredNodeId,
  onNodeDoubleClick,
}: {
  nodes: GraphNode[]
  positions: Map<number, [number, number, number]>
  selectedNodeId: number | null
  hoveredNodeId: number | null
  onNodeDoubleClick: (id: number) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const glowMeshRef = useRef<THREE.InstancedMesh>(null!)
  const { raycaster, camera, pointer } = useThree()
  const lastClickTime = useRef<Map<number, number>>(new Map())
  const selectNode = useUIStore((s) => s.selectNode)
  const setHoveredNode = useUIStore((s) => s.setHoveredNode)

  // Set up initial transforms and colors
  useFrame(() => {
    if (!meshRef.current || nodes.length === 0) return

    const mesh = meshRef.current
    const glowMesh = glowMeshRef.current
    const anySelected = selectedNodeId !== null

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const pos = positions.get(node.id)
      if (!pos) {
        _dummy.position.set(0, 0, -1000) // hide off-screen
        _dummy.scale.set(0, 0, 0)
      } else {
        const isSelected = node.id === selectedNodeId
        const isHovered = node.id === hoveredNodeId

        _dummy.position.set(pos[0], pos[1], pos[2])

        // Size by importance (base 0.3, max 0.6)
        const importance = node.importance ?? 0.3
        const baseScale = 0.2 + importance * 0.4
        const targetScale = isSelected ? baseScale * 1.5 : isHovered ? baseScale * 1.2 : baseScale
        _scale.setScalar(targetScale)
        _dummy.scale.copy(_scale)
      }

      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      // Color
      const nodeColor = NODE_COLORS[nodes[i].kind] || '#555555'
      _color.set(nodeColor)

      const isSelected = nodes[i].id === selectedNodeId
      const isHovered = nodes[i].id === hoveredNodeId
      const isConnected = anySelected && !isSelected && !isHovered

      if (isConnected) {
        _color.multiplyScalar(0.4)
      } else if (isSelected) {
        _color.offsetHSL(0, 0.1, 0.1)
      }

      mesh.setColorAt(i, _color)

      // Glow mesh
      if (glowMesh) {
        _dummy.scale.multiplyScalar(1.4)
        _dummy.updateMatrix()
        glowMesh.setMatrixAt(i, _dummy.matrix)

        _color.set(nodes[i].id === selectedNodeId ? '#E65100' : '#00E5FF')
        const glowOpacity = isSelected ? 0.3 : isHovered ? 0.15 : 0.05
        _color.multiplyScalar(glowOpacity)
        glowMesh.setColorAt(i, _color)
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (glowMesh) {
      glowMesh.instanceMatrix.needsUpdate = true
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true
    }
  })

  // Raycast on click
  const handleClick = useCallback(() => {
    if (!meshRef.current || nodes.length === 0) return

    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      if (instanceId === undefined || instanceId >= nodes.length) return

      const nodeId = nodes[instanceId].id
      const now = Date.now()
      const lastClick = lastClickTime.current.get(nodeId) ?? 0

      if (now - lastClick < 300) {
        // Double click
        onNodeDoubleClick(nodeId)
        lastClickTime.current.delete(nodeId)
      } else {
        // Single click
        lastClickTime.current.set(nodeId, now)

        const e = window.event as MouseEvent | undefined
        if (e?.ctrlKey || e?.metaKey) {
          useUIStore.getState().toggleMultiSelect(nodeId)
        } else {
          selectNode(useUIStore.getState().selectedNodeId === nodeId ? null : nodeId)
        }
      }
    }
  }, [nodes, raycaster, camera, pointer, selectNode, onNodeDoubleClick])

  // Hover detection
  const handlePointerMove = useCallback(() => {
    if (!meshRef.current || nodes.length === 0) return

    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      if (instanceId !== undefined && instanceId < nodes.length) {
        setHoveredNode(nodes[instanceId].id)
        document.body.style.cursor = 'pointer'
        return
      }
    }

    setHoveredNode(null)
    document.body.style.cursor = 'default'
  }, [nodes, raycaster, camera, pointer, setHoveredNode])

  return (
    <group onClick={handleClick} onPointerMove={handlePointerMove}>
      {/* Glow spheres behind nodes */}
      <instancedMesh
        ref={glowMeshRef}
        args={[undefined, undefined, Math.max(nodes.length, 1)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0.1} depthWrite={false} />
      </instancedMesh>

      {/* Main node spheres */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(nodes.length, 1)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          roughness={0.4}
          metalness={0.2}
          transparent
          opacity={0.95}
        />
      </instancedMesh>
    </group>
  )
}
