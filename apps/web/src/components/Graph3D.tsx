import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line, Html, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '../types'
import { NODE_COLORS } from '../types'
import { useUIStore } from '../store'

// ─── Force-directed layout (runs on mount) ───

function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<number, THREE.Vector3> {
  const positions = new Map<number, THREE.Vector3>()
  const N = nodes.length

  // Initialize positions on a sphere
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

  // Run force simulation
  for (let iter = 0; iter < 80; iter++) {
    const temp = 1.0 - iter / 80

    // Repulsion between all pairs (Barnes-Hut would be better for >1000 nodes)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = positions.get(nodes[i].id)!
        const b = positions.get(nodes[j].id)!
        const delta = a.clone().sub(b)
        const dist = Math.max(delta.length(), 0.01)
        const force = 0.5 / (dist * dist) * temp
        delta.normalize().multiplyScalar(force)
        a.add(delta)
        b.sub(delta)
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = positions.get(edge.source)
      const b = positions.get(edge.target)
      if (!a || !b) continue
      const delta = b.clone().sub(a)
      const dist = delta.length()
      const force = (dist - 2.0) * 0.02 * temp
      delta.normalize().multiplyScalar(force)
      a.add(delta)
      b.sub(delta)
    }

    // Center gravity
    for (const pos of positions.values()) {
      pos.multiplyScalar(0.99)
    }
  }

  return positions
}

// ─── Node sphere component ───

function NodeSphere({
  node,
  position,
  color,
  size,
}: {
  node: GraphNode
  position: THREE.Vector3
  color: string
  size: number
}) {
  const { selectedNodeId, hoveredNodeId, setSelectedNode, setHoveredNode } = useUIStore()
  const meshRef = useRef<THREE.Mesh>(null!)

  const isSelected = selectedNodeId === node.id
  const isHovered = hoveredNodeId === node.id

  useFrame(() => {
    if (!meshRef.current) return
    const scale = isSelected ? 1.4 : isHovered ? 1.2 : 1.0
    meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
  })

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setSelectedNode(isSelected ? null : node.id)
  }, [node.id, isSelected, setSelectedNode])

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHoveredNode(node.id) }}
      onPointerOut={() => setHoveredNode(null)}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 0.6 : isHovered ? 0.4 : 0.15}
        roughness={0.4}
        metalness={0.2}
        transparent
        opacity={selectedNodeId === null || isSelected || isHovered ? 0.95 : 0.3}
      />
    </mesh>
  )
}

// ─── Label component ───

function NodeLabel({ position, text, visible }: { position: THREE.Vector3; text: string; visible: boolean }) {
  if (!visible) return null
  return (
    <Html position={position} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
      <span className="text-[9px] text-white/80 font-mono whitespace-nowrap drop-shadow-lg bg-black/40 px-1 rounded">
        {text}
      </span>
    </Html>
  )
}

// ─── Edge line component ───

function EdgeLine({
  from,
  to,
  highlighted,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  highlighted: boolean
}) {
  const points = useMemo(() => [from, to], [from, to])
  return (
    <Line
      points={points}
      color={highlighted ? '#06b6d4' : '#2a2a3a'}
      lineWidth={highlighted ? 1.8 : 0.6}
      transparent
      opacity={highlighted ? 0.8 : 0.2}
    />
  )
}

// ─── Main scene ───

function Scene({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const { kindFilter, showLabels, selectedNodeId } = useUIStore()

  const positions = useMemo(() => forceLayout(nodes, edges), [nodes, edges])

  // Filter nodes by kind
  const visibleNodes = useMemo(
    () => nodes.filter(n => kindFilter.has(n.kind)),
    [nodes, kindFilter]
  )
  const visibleIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes])

  // Filter edges where both endpoints are visible
  const visibleEdges = useMemo(
    () => edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds]
  )

  // Highlight edges connected to selected node
  const highlightedEdges = useMemo(
    () => selectedNodeId !== null
      ? new Set(visibleEdges
          .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
          .map(e => `${e.source}-${e.target}`))
      : null,
    [visibleEdges, selectedNodeId]
  )

  // Node size by kind
  const sizeMap: Record<string, number> = {
    File: 0.6, Module: 0.5, Function: 0.35, Method: 0.3,
    Class: 0.45, Interface: 0.4, Enum: 0.35, Variable: 0.25,
    TypeAlias: 0.3, Import: 0.2, Macro: 0.3, Anonymous: 0.2,
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#8b5cf6" />
      <Stars radius={50} depth={30} count={2000} factor={2} fade speed={0.5} />

      {/* Edges */}
      {visibleEdges.map((e, i) => {
        const from = positions.get(e.source)
        const to = positions.get(e.target)
        if (!from || !to) return null
        const key = `${e.source}-${e.target}`
        return (
          <EdgeLine
            key={i}
            from={from}
            to={to}
            highlighted={highlightedEdges?.has(key) ?? false}
          />
        )
      })}

      {/* Nodes */}
      {visibleNodes.map(n => {
        const pos = positions.get(n.id)
        if (!pos) return null
        return (
          <group key={n.id}>
            <NodeSphere
              node={n}
              position={pos}
              color={NODE_COLORS[n.kind] || '#64748b'}
              size={sizeMap[n.kind] || 0.3}
            />
            <NodeLabel
              position={pos}
              text={n.name}
              visible={showLabels}
            />
          </group>
        )
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        minDistance={2}
        maxDistance={100}
      />
    </>
  )
}

// ─── Main export ───

export function Graph3D({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  return (
    <Canvas
      camera={{ position: [0, 5, 15], fov: 50 }}
      style={{ background: '#0a0a0f' }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => useUIStore.getState().setSelectedNode(null)}
    >
      <Scene nodes={nodes} edges={edges} />
    </Canvas>
  )
}
