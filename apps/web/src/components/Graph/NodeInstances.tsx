import { useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphNode } from '../../types'
import { useUIStore } from '../../store'
import { COLORS } from '../../constants'

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

export function NodeInstances({
  nodes,
  positions,
  selectedNodeId,
  hoveredNodeId,
  onNodeDoubleClick,
  onContextMenu,
}: {
  nodes: GraphNode[]
  positions: Map<number, [number, number, number]>
  selectedNodeId: number | null
  hoveredNodeId: number | null
  onNodeDoubleClick: (id: number) => void
  onContextMenu?: (id: number, screenX: number, screenY: number) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const glowMeshRef = useRef<THREE.InstancedMesh>(null!)
  const { raycaster, camera, pointer } = useThree()
  const lastClickTime = useRef<Map<number, number>>(new Map())
  const selectNode = useUIStore((s) => s.selectNode)
  const setHoveredNode = useUIStore((s) => s.setHoveredNode)

  // Smooth scale interpolation
  const currentScales = useRef<Map<number, number>>(new Map())

  useFrame(() => {
    if (!meshRef.current || nodes.length === 0) return

    const mesh = meshRef.current
    const glowMesh = glowMeshRef.current
    const anySelected = selectedNodeId !== null
    const anyHovered = hoveredNodeId !== null

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const pos = positions.get(node.id)
      const isSelected = node.id === selectedNodeId
      const isHovered = node.id === hoveredNodeId
      const importance = node.importance ?? 0.3

      if (!pos) {
        _dummy.position.set(0, 0, -1000)
        _dummy.scale.set(0, 0, 0)
      } else {
        _dummy.position.set(pos[0], pos[1], pos[2])

        // Node radius: 4-6px based on importance (mapped to world units)
        const baseScale = 0.25 + importance * 0.35
        const targetScale = isSelected ? baseScale * 1.4 : isHovered ? baseScale * 1.3 : baseScale

        // Smooth interpolation
        const currentScale = currentScales.current.get(node.id) ?? baseScale
        const newScale = currentScale + (targetScale - currentScale) * 0.12
        currentScales.current.set(node.id, newScale)

        _dummy.scale.setScalar(newScale)
      }

      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      // ─── Node color ───
      // Default: #A7B5C9 at 92% opacity
      // Hovered: #DCE8FF
      // Selected: #59F6FF
      // Connected (when something selected): brighten slightly
      // Unrelated (when something selected): fade to 30%

      let nodeColor: string
      let nodeOpacity: number

      if (isSelected) {
        nodeColor = COLORS.nodeSelected // #59F6FF
        nodeOpacity = 1.0
      } else if (isHovered) {
        nodeColor = COLORS.nodeHover // #DCE8FF
        nodeOpacity = 0.95
      } else if (anySelected || anyHovered) {
        // When something is focused, dim unrelated nodes
        nodeColor = COLORS.nodeDefault
        nodeOpacity = 0.3
      } else {
        nodeColor = COLORS.nodeDefault // #A7B5C9
        nodeOpacity = 0.92
      }

      _color.set(nodeColor)
      _color.multiplyScalar(nodeOpacity)
      mesh.setColorAt(i, _color)

      // ─── Glow mesh ───
      if (glowMesh) {
        _dummy.scale.setScalar((currentScales.current.get(node.id) ?? 0.3) * 1.6)
        _dummy.updateMatrix()
        glowMesh.setMatrixAt(i, _dummy.matrix)

        // Glow color
        let glowColor: THREE.Color
        let glowOpacity: number

        if (isSelected) {
          // #59F6FF glow — 0 0 22px rgba(89,246,255,.45)
          glowColor = new THREE.Color('#59F6FF')
          glowOpacity = 0.35
        } else if (isHovered) {
          // #DCE8FF glow — 0 0 18px rgba(180,210,255,.25)
          glowColor = new THREE.Color('#B4D2FF')
          glowOpacity = 0.2
        } else {
          // Subtle default glow — rgba(180,200,255,.08)
          glowColor = new THREE.Color('#B4C8FF')
          glowOpacity = 0.04
        }

        if (anySelected && !isSelected && !isHovered) {
          glowOpacity *= 0.2
        }

        glowColor.multiplyScalar(glowOpacity)
        glowMesh.setColorAt(i, glowColor)
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
        onNodeDoubleClick(nodeId)
        lastClickTime.current.delete(nodeId)
      } else {
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

  // Right-click context menu
  const handleContextMenu = useCallback((e: any) => {
    if (!meshRef.current || nodes.length === 0 || !onContextMenu) return

    const screenX = e?.nativeEvent?.clientX ?? 0
    const screenY = e?.nativeEvent?.clientY ?? 0

    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      if (instanceId !== undefined && instanceId < nodes.length) {
        onContextMenu(nodes[instanceId].id, screenX, screenY)
      }
    }
  }, [nodes, raycaster, camera, pointer, onContextMenu])

  return (
    <group onClick={handleClick} onPointerMove={handlePointerMove} onContextMenu={handleContextMenu}>
      {/* Glow layer — soft diffuse behind nodes */}
      <instancedMesh
        ref={glowMeshRef}
        args={[undefined, undefined, Math.max(nodes.length, 1)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/* Main node circles */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(nodes.length, 1)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          roughness={0.6}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </instancedMesh>
    </group>
  )
}
