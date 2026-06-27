import { useRef, useMemo, useCallback, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '../../types'
import { useUIStore } from '../../store'
import { COLORS } from '../../constants'
import { NodeInstances } from './NodeInstances'
import { EdgeInstances } from './EdgeInstances'
import { NodeLabels } from './NodeLabels'
import { ParticleField } from './ParticleField'
import { MiniMap } from './MiniMap'
import { ContextMenu } from '../Common/ContextMenu'
import { useForceLayout } from '../../hooks/useForceLayout'

// ─── Camera rig ───

function CameraRig() {
  const { camera } = useThree()
  const cameraTarget = useUIStore((s) => s.cameraTarget)
  const settings = useUIStore((s) => s.settings)
  const lastPos = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    if (!cameraTarget) return
    const target = new THREE.Vector3(...cameraTarget)
    const lerpFactor = settings.cameraSpeed === 'slow' ? 0.03 : settings.cameraSpeed === 'fast' ? 0.1 : 0.06
    const newPos = lastPos.current.clone().lerp(target, lerpFactor)
    camera.position.copy(newPos)
    camera.lookAt(target)
    lastPos.current.copy(newPos)
  })

  useFrame(() => {
    if (!cameraTarget) {
      lastPos.current.copy(camera.position)
    }
  })

  return null
}

// ─── Scene ───

function Scene({ nodePositions, visibleNodes, visibleEdges, rawPositions, onNodeDoubleClick, onContextMenu }: { nodePositions: Map<number, [number, number, number]>; visibleNodes: GraphNode[]; visibleEdges: GraphEdge[]; rawPositions: Map<number, THREE.Vector3>; onNodeDoubleClick?: (id: number) => void; onContextMenu?: (id: number, x: number, y: number) => void }) {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const hoveredNodeId = useUIStore((s) => s.hoveredNodeId)
  const settings = useUIStore((s) => s.settings)
  const setCameraTarget = useUIStore((s) => s.setCameraTarget)

  const handleNodeDoubleClick = useCallback((id: number) => {
    // Use external handler (progressive drill-down) if provided
    if (onNodeDoubleClick) {
      onNodeDoubleClick(id)
    }
    // Also focus camera on the node
    const pos = rawPositions.get(id)
    if (pos) {
      setCameraTarget([pos.x, pos.y, pos.z])
    }
  }, [rawPositions, setCameraTarget, onNodeDoubleClick])

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.4} />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#59F6FF" />

      {!settings.reducedMotion && <ParticleField />}

      <EdgeInstances
        edges={visibleEdges}
        positions={nodePositions}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        animation={settings.edgeAnimation}
      />

      <NodeInstances
        nodes={visibleNodes}
        positions={nodePositions}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        onNodeDoubleClick={handleNodeDoubleClick}
        onContextMenu={onContextMenu}
      />

      <NodeLabels
        nodes={visibleNodes}
        positions={nodePositions}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        visible={settings.showLabels}
      />

      <CameraRig />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        panSpeed={0.5}
        minDistance={2}
        maxDistance={100}
        enablePan
        enableRotate
        enableZoom
        onStart={() => useUIStore.getState().setCameraTarget(null)}
      />
    </>
  )
}

// ─── Loading state ───

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: `${COLORS.selection}40`, borderTopColor: COLORS.selection }}
        />
        <span className="text-sm font-body" style={{ color: COLORS.textMuted }}>
          Loading graph...
        </span>
      </div>
    </div>
  )
}

function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="text-sm" style={{ color: COLORS.error }}>{message}</div>
        <div className="text-xs font-mono px-3 py-2 rounded" style={{ background: COLORS.surface, color: COLORS.textMuted }}>
          astera serve --port 8080
        </div>
      </div>
    </div>
  )
}

// ─── Main export ───

interface GraphSceneProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  isLoading?: boolean
  error?: string | null
  onNodeDoubleClick?: (id: number) => void
}

interface ContextMenuState {
  nodeId: number
  nodeName: string
  nodeKind: string
  x: number
  y: number
}

export function GraphScene({ nodes, edges, isLoading, error, onNodeDoubleClick }: GraphSceneProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const kindFilter = useUIStore((s) => s.kindFilter)

  const positions = useForceLayout(nodes, edges)

  const visibleNodes = useMemo(
    () => nodes.filter((n) => kindFilter.has(n.kind)),
    [nodes, kindFilter]
  )

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])

  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds]
  )

  const nodePositions = useMemo(() => {
    const map = new Map<number, [number, number, number]>()
    for (const n of visibleNodes) {
      const pos = positions.get(n.id)
      if (pos) map.set(n.id, [pos.x, pos.y, pos.z])
    }
    return map
  }, [visibleNodes, positions])

  const handleContextMenu = useCallback((id: number, x: number, y: number) => {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    setContextMenu({ nodeId: id, nodeName: node.name, nodeKind: node.kind, x, y })
  }, [nodes])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  if (error) return <ErrorOverlay message={error} />

  return (
    <div className="relative w-full h-full">
      {isLoading && <LoadingOverlay />}

      <Canvas
        camera={{ position: [0, 5, 15], fov: 50 }}
        style={{
          background: `radial-gradient(ellipse at center, ${COLORS.bgGradientTop} 0%, ${COLORS.bg} 50%, ${COLORS.bgGradientBottom} 100%)`,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        onPointerMissed={() => useUIStore.getState().clearSelection()}
      >
        <Scene
          nodePositions={nodePositions}
          visibleNodes={visibleNodes}
          visibleEdges={visibleEdges}
          rawPositions={positions}
          onNodeDoubleClick={onNodeDoubleClick}
          onContextMenu={handleContextMenu}
        />
      </Canvas>

      {/* MiniMap — outside Canvas (DOM element) */}
      <MiniMap nodes={visibleNodes} positions={nodePositions} />

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Context menu (DOM overlay, outside Canvas) */}
      {contextMenu && (
        <ContextMenu
          nodeName={contextMenu.nodeName}
          nodeKind={contextMenu.nodeKind}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}

// ─── Breadcrumbs ───

function Breadcrumbs() {
  const breadcrumbs = useUIStore((s) => s.breadcrumbs)
  const popBreadcrumb = useUIStore((s) => s.popBreadcrumb)
  const setGraphState = useUIStore((s) => s.setGraphState)

  if (breadcrumbs.length <= 1) return null

  return (
    <div
      className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px]"
      style={{ background: `${COLORS.surface}E0`, border: `1px solid ${COLORS.border}` }}
    >
      {breadcrumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span style={{ color: COLORS.textDim }}>/</span>}
          <button
            onClick={() => {
              // Pop to this level
              while (useUIStore.getState().breadcrumbs.length > i + 1) {
                popBreadcrumb()
              }
              setGraphState(crumb.state)
            }}
            className="hover:underline transition-colors"
            style={{ color: i === breadcrumbs.length - 1 ? COLORS.selection : COLORS.textMuted }}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  )
}
