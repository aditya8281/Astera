import { useRef, useEffect, useCallback } from 'react'
import type { GraphNode, GraphEdge } from '../../types'
import { useUIStore } from '../../store'
import { COLORS, NODE_COLORS } from '../../constants'
import { useForceLayout2D, type Vec2 } from '../../hooks/useForceLayout2D'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  isLoading: boolean
  error: string | null
  onNodeDoubleClick: (id: number) => void
}

/**
 * 2D Canvas-based graph visualization.
 *
 * Animation system (Emil Kowalski principles):
 * - Node entrance: staggered scale 0.6→1.0 + opacity 0→1, 200ms ease-out
 * - Edge entrance: fade opacity 0→1, 250ms ease-out
 * - Hover: exponential lerp on glow strength (no binary on/off)
 * - Selection: reticle pulse with cubic ease-out, ring scale 0.6→1.0
 * - Camera: linear lerp = exponential ease-out (already correct)
 * - All entrances respect prefers-reduced-motion
 *
 * Delight moments:
 * - Connected edge cascade: selection lights connected edges with hop-distance stagger
 * - Same-kind highlight: hovering brightens siblings of the same kind
 * - Label crossfade: smooth opacity at zoom threshold (not binary gate)
 */

// Node radius by kind — generous sizes for visibility
function nodeRadius(kind: string): number {
  if (kind === 'File' || kind === 'Module') return 14
  if (kind === 'Class' || kind === 'Interface' || kind === 'Enum') return 11
  if (kind === 'Function' || kind === 'Method') return 9
  return 7
}

// Easing: cubic ease-out — starts fast, decelerates
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Smooth camera target
interface CameraTarget {
  x: number
  y: number
  scale: number
}

// Entrance timing constants
const NODE_ENTRANCE_DURATION = 200   // ms
const EDGE_ENTRANCE_DURATION = 250   // ms
const STAGGER_SPREAD = 120           // ms total stagger across all nodes
const RETICLE_DURATION = 400         // ms (was 600 — Emil: keep UI under 300ms, decorative under 500ms)
const SELECTION_RING_DURATION = 180  // ms
const HOVER_LERP = 0.12              // exponential decay per frame for hover glow

export function GraphCanvas({ nodes, edges, isLoading, error, onNodeDoubleClick }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const positions = useForceLayout2D(nodes, edges)

  // --- All mutable state in refs ---
  const positionsRef = useRef<Map<number, Vec2>>(new Map())
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const selectedRef = useRef<number | null>(null)

  // View transform
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const cameraTargetRef = useRef<CameraTarget>({ x: 0, y: 0, scale: 1 })
  const autoFitAppliedRef = useRef(false)

  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 })
  const animFrameRef = useRef<number>(0)

  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectNode = useUIStore((s) => s.selectNode)
  const cameraTarget = useUIStore((s) => s.cameraTarget)

  // --- Delight state ---
  // Adjacency map for connected-edge cascade
  const adjacencyRef = useRef<Map<number, Set<number>>>(new Map())
  // Orbital reveal: camera starts zoomed in, spirals out to fitted view
  const orbitalRevealRef = useRef(false)
  // Constellation beams: radial lines to 1-hop neighbors on selection
  const beamsRef = useRef<{ id: number; startTime: number; neighbors: number[] } | null>(null)
  const prevBeamsIdRef = useRef<number | null>(null)

  // --- Ambient breathing (perpetual subtle drift, graph never feels dead) ---
  const breathPhaseRef = useRef<Map<number, { phaseX: number; phaseY: number; speed: number; amp: number }>>(new Map())

  // --- Animation state ---
  // Node entrance: birth timestamp per node (staggered by distance from center)
  const nodeBirthRef = useRef<Map<number, number>>(new Map())
  // Node entrance: completion time (when simulation settled)
  const nodeEntranceStartRef = useRef<number>(0)

  // Edge entrance: birth timestamp per edge key
  const edgeBirthRef = useRef<Map<string, number>>(new Map())
  const edgeEntranceStartRef = useRef<number>(0)

  // Hover glow: per-node strength (0-1), lerps smoothly
  const hoverStrengthRef = useRef<Map<number, number>>(new Map())
  const hoverNodeIdRef = useRef<number | null>(null)

  // Selection pulse
  const selectionPulseRef = useRef<{ id: number; startTime: number } | null>(null)
  const prevSelectedRef = useRef<number | null>(null)

  // Selection ring scale animation
  const selectionRingRef = useRef<{ id: number; startTime: number } | null>(null)

  // Reduced motion preference
  const reducedMotionRef = useRef(false)

  // --- Sync React state into refs ---
  useEffect(() => { positionsRef.current = positions }, [positions])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { selectedRef.current = selectedNodeId }, [selectedNodeId])

  // Build adjacency map for delight features (connected-edge cascade, same-kind highlight)
  useEffect(() => {
    const adj = new Map<number, Set<number>>()
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set())
      if (!adj.has(e.target)) adj.set(e.target, new Set())
      adj.get(e.source)!.add(e.target)
      adj.get(e.target)!.add(e.source)
    }
    adjacencyRef.current = adj
  }, [edges])

  // Check reduced motion on mount
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Auto-fit + stagger entrance when positions first arrive
  useEffect(() => {
    if (positions.size === 0 || autoFitAppliedRef.current) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    if (w === 0 || h === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pos of positions.values()) {
      if (pos.x < minX) minX = pos.x
      if (pos.y < minY) minY = pos.y
      if (pos.x > maxX) maxX = pos.x
      if (pos.y > maxY) maxY = pos.y
    }

    const graphW = maxX - minX
    const graphH = maxY - minY
    if (graphW === 0 && graphH === 0) return

    const padX = w * 0.15
    const padY = h * 0.15
    const availW = w - padX * 2
    const availH = h - padY * 2

    const scaleX = graphW > 0 ? availW / graphW : 1
    const scaleY = graphH > 0 ? availH / graphH : 1
    const fitScale = Math.min(scaleX, scaleY, 2.0)

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const tx = w / 2 - cx * fitScale
    const ty = h / 2 - cy * fitScale

    // Orbital reveal: start camera zoomed in tight, let lerp spiral it out
    if (!orbitalRevealRef.current) {
      if (reducedMotionRef.current) {
        // Skip reveal animation — snap directly to fit
        transformRef.current = { x: tx, y: ty, scale: fitScale }
        cameraTargetRef.current = { x: tx, y: ty, scale: fitScale }
      } else {
        const revealScale = Math.max(fitScale * 3, 3.5)
        transformRef.current = { x: w / 2, y: h / 2, scale: revealScale }
        cameraTargetRef.current = { x: tx, y: ty, scale: fitScale }
      }
      orbitalRevealRef.current = true
    } else {
      // Drill-down: snap directly
      transformRef.current = { x: tx, y: ty, scale: fitScale }
      cameraTargetRef.current = { x: tx, y: ty, scale: fitScale }
    }
    autoFitAppliedRef.current = true

    // Stagger node entrance by distance from graph center
    const now = performance.now()
    nodeEntranceStartRef.current = now

    if (!reducedMotionRef.current) {
      const maxDist = Math.sqrt(graphW * graphW + graphH * graphH) / 2
      const birthMap = new Map<number, number>()
      for (const [id, pos] of positions) {
        const dx = pos.x - cx
        const dy = pos.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Normalize 0-1, center nodes appear first
        const normalizedDist = maxDist > 0 ? dist / maxDist : 0
        const delay = normalizedDist * STAGGER_SPREAD
        birthMap.set(id, now + delay)
      }
      nodeBirthRef.current = birthMap
    } else {
      // Reduced motion: all nodes appear instantly
      const birthMap = new Map<number, number>()
      for (const id of positions.keys()) birthMap.set(id, now)
      nodeBirthRef.current = birthMap
    }

    // Initialize ambient breathing: each node gets unique phase + amplitude
    const breathMap = new Map<number, { phaseX: number; phaseY: number; speed: number; amp: number }>()
    for (const [id] of positions) {
      breathMap.set(id, {
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4,  // radians per second
        amp: 0.8 + Math.random() * 1.2,     // pixels of drift
      })
    }
    breathPhaseRef.current = breathMap
  }, [positions])

  // Reset auto-fit + entrance when nodes change (drill-down)
  useEffect(() => {
    autoFitAppliedRef.current = false
    // Clear old entrance data
    nodeBirthRef.current.clear()
    edgeBirthRef.current.clear()
    hoverStrengthRef.current.clear()
    beamsRef.current = null
    prevBeamsIdRef.current = null
  }, [nodes])

  // Track edge births
  useEffect(() => {
    const now = performance.now()
    edgeEntranceStartRef.current = now
    if (reducedMotionRef.current) return

    const newEdgeKeys = new Set(
      edges.map(e => `${e.source}-${e.target}-${e.kind}`)
    )
    // Record birth for edges not yet tracked
    const map = edgeBirthRef.current
    for (const key of newEdgeKeys) {
      if (!map.has(key)) {
        map.set(key, now + EDGE_ENTRANCE_DURATION * 0.3) // Small initial delay
      }
    }
    // Remove dead edges
    for (const key of map.keys()) {
      if (!newEdgeKeys.has(key)) map.delete(key)
    }
  }, [edges])

  // Camera target follow (when selecting a node)
  useEffect(() => {
    if (!cameraTarget || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const [targetX, targetY] = cameraTarget
    const scale = transformRef.current.scale
    cameraTargetRef.current = {
      x: rect.width / 2 - targetX * scale,
      y: rect.height / 2 - targetY * scale,
      scale,
    }
  }, [cameraTarget])

  // Trigger reticle pulse + selection ring + constellation beams on selection change
  useEffect(() => {
    if (selectedNodeId !== null && selectedNodeId !== prevSelectedRef.current) {
      const now = performance.now()
      selectionPulseRef.current = { id: selectedNodeId, startTime: now }
      selectionRingRef.current = { id: selectedNodeId, startTime: now }
      // Delight: constellation beams — find 1-hop neighbors
      const neighbors = adjacencyRef.current.get(selectedNodeId)
      if (neighbors && neighbors.size > 0) {
        beamsRef.current = { id: selectedNodeId, startTime: now, neighbors: Array.from(neighbors) }
      } else {
        beamsRef.current = null
      }
    }
    prevSelectedRef.current = selectedNodeId
  }, [selectedNodeId])

  // --- Single stable animation loop ---
  useEffect(() => {
    let running = true
    const now = () => performance.now()

    const loop = () => {
      if (!running) return

      const canvas = canvasRef.current
      if (!canvas) { animFrameRef.current = requestAnimationFrame(loop); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { animFrameRef.current = requestAnimationFrame(loop); return }

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)
      }

      const w = rect.width
      const h = rect.height

      // Smooth camera interpolation (exponential ease-out by nature)
      const LERP_SPEED = 0.1
      const t = transformRef.current
      const target = cameraTargetRef.current
      t.x += (target.x - t.x) * LERP_SPEED
      t.y += (target.y - t.y) * LERP_SPEED
      t.scale += (target.scale - t.scale) * LERP_SPEED

      const { x: tx, y: ty, scale } = t

      // Clear — OLED black
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)

      // Read current data from refs
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current
      const currentPositions = positionsRef.current
      const selectedId = selectedRef.current
      const time = now()

      // --- Update hover strengths (exponential lerp) ---
      const hoverMap = hoverStrengthRef.current
      const currentHover = hoverNodeIdRef.current
      // All nodes that were ever hovered get updated
      for (const node of currentNodes) {
        const isHovered = currentHover === node.id
        const current = hoverMap.get(node.id) || 0
        const target = isHovered ? 1 : 0
        const newVal = current + (target - current) * HOVER_LERP
        // Snap to 0/1 when very close to avoid running forever
        if (Math.abs(newVal - target) < 0.01) {
          hoverMap.set(node.id, target)
        } else {
          hoverMap.set(node.id, newVal)
        }
      }

      // --- Compute connected-edge cascade (delight: hop-distance stagger) ---
      // BFS from selected node to find hop distances
      const hopDistances = new Map<number, number>()
      if (selectedId !== null) {
        hopDistances.set(selectedId, 0)
        const queue = [selectedId]
        let qi = 0
        const adj = adjacencyRef.current
        while (qi < queue.length && queue.length < 500) { // cap BFS for perf
          const current = queue[qi++]
          const neighbors = adj.get(current)
          if (!neighbors) continue
          const nextDist = (hopDistances.get(current) || 0) + 1
          if (nextDist > 2) continue // only cascade 2 hops
          for (const nid of neighbors) {
            if (!hopDistances.has(nid)) {
              hopDistances.set(nid, nextDist)
              queue.push(nid)
            }
          }
        }
      }

      // --- Draw edges ---
      const timeSec = time / 1000

      // First pass: hover cascade glow on connected edges
      const hoveredId = hoverNodeIdRef.current
      const hoverConnectedEdges = new Set<string>()
      if (hoveredId !== null) {
        const adj = adjacencyRef.current.get(hoveredId)
        if (adj) {
          for (const nid of adj) {
            hoverConnectedEdges.add(`${hoveredId}-${nid}`)
            hoverConnectedEdges.add(`${nid}-${hoveredId}`)
          }
        }
      }

      for (const edge of currentEdges) {
        const from = currentPositions.get(edge.source)
        const to = currentPositions.get(edge.target)
        if (!from || !to) continue

        // Apply breathing offset to edge endpoints too
        const bFrom = breathPhaseRef.current.get(edge.source)
        const bTo = breathPhaseRef.current.get(edge.target)
        const bfx = bFrom && !reducedMotionRef.current ? Math.sin(timeSec * bFrom.speed + bFrom.phaseX) * bFrom.amp : 0
        const bfy = bFrom && !reducedMotionRef.current ? Math.cos(timeSec * bFrom.speed * 0.7 + bFrom.phaseY) * bFrom.amp : 0
        const btx = bTo && !reducedMotionRef.current ? Math.sin(timeSec * bTo.speed + bTo.phaseX) * bTo.amp : 0
        const bty = bTo && !reducedMotionRef.current ? Math.cos(timeSec * bTo.speed * 0.7 + bTo.phaseY) * bTo.amp : 0

        const fx = from.x * scale + tx + bfx
        const fy = from.y * scale + ty + bfy
        const tox = to.x * scale + tx + btx
        const toy = to.y * scale + ty + bty

        // Skip off-screen
        if ((fx < -50 && tox < -50) || (fy < -50 && toy < -50)) continue
        if ((fx > w + 50 && tox > w + 50) || (fy > h + 50 && toy > h + 50)) continue

        const isDirectHighlight = edge.source === selectedId || edge.target === selectedId
        const edgeKey = `${edge.source}-${edge.target}`
        const isHoverConnected = hoverConnectedEdges.has(edgeKey)

        // Delight: connected-edge cascade — hop-distance glow
        let cascadeStrength = 0
        if (selectedId !== null) {
          const distSource = hopDistances.get(edge.source)
          const distTarget = hopDistances.get(edge.target)
          if (distSource !== undefined && distTarget !== undefined) {
            const maxDist = Math.max(distSource, distTarget)
            if (maxDist <= 2) cascadeStrength = 1 - maxDist * 0.35
          }
        }

        // Edge entrance: fade in
        let edgeAlpha = 1
        const edgeKindKey = `${edge.source}-${edge.target}-${edge.kind}`
        const edgeBirth = edgeBirthRef.current.get(edgeKindKey)
        if (edgeBirth !== undefined) {
          const age = time - edgeBirth
          if (age < EDGE_ENTRANCE_DURATION) {
            edgeAlpha = easeOutCubic(Math.max(0, age / EDGE_ENTRANCE_DURATION))
          }
        }

        // Determine edge color and width
        let edgeColor: string
        let edgeWidth: number
        let edgeAlphaFinal: number

        if (isDirectHighlight) {
          edgeColor = COLORS.selection
          edgeWidth = 2.5
          edgeAlphaFinal = edgeAlpha
        } else if (cascadeStrength > 0.05) {
          edgeColor = COLORS.selection
          edgeWidth = 1.8 + cascadeStrength
          edgeAlphaFinal = (0.4 + cascadeStrength * 0.5) * edgeAlpha
        } else if (isHoverConnected) {
          // Hover glow cascade: electric cyan with energy
          const pulse = Math.sin(timeSec * 3 + edge.source * 0.1) * 0.15 + 0.85
          edgeColor = COLORS.selection
          edgeWidth = 2.0
          edgeAlphaFinal = 0.7 * pulse * edgeAlpha
        } else {
          edgeColor = COLORS.edgeDefault
          edgeWidth = 1.4
          edgeAlphaFinal = 0.75 * edgeAlpha
        }

        // Draw edge glow layer (thicker, more transparent)
        if (isDirectHighlight || cascadeStrength > 0.05 || isHoverConnected) {
          ctx.beginPath()
          ctx.moveTo(fx, fy)
          ctx.lineTo(tox, toy)
          ctx.strokeStyle = edgeColor
          ctx.globalAlpha = edgeAlphaFinal * 0.3
          ctx.lineWidth = edgeWidth + 4
          ctx.stroke()
        }

        // Draw edge core
        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(tox, toy)
        ctx.strokeStyle = edgeColor
        ctx.globalAlpha = edgeAlphaFinal
        ctx.lineWidth = edgeWidth
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // --- Draw nodes ---
      for (const node of currentNodes) {
        const pos = currentPositions.get(node.id)
        if (!pos) continue

        // Ambient breathing: perpetual subtle sine drift
        const breath = breathPhaseRef.current.get(node.id)
        let bx = 0, by = 0
        if (breath && !reducedMotionRef.current) {
          bx = Math.sin(timeSec * breath.speed + breath.phaseX) * breath.amp
          by = Math.cos(timeSec * breath.speed * 0.7 + breath.phaseY) * breath.amp
        }

        const nx = pos.x * scale + tx + bx
        const ny = pos.y * scale + ty + by

        if (nx < -40 || nx > w + 40 || ny < -40 || ny > h + 40) continue

        const baseR = nodeRadius(node.kind)
        const isSelected = node.id === selectedId
        const hoverStrength = hoverStrengthRef.current.get(node.id) || 0

        // Is this node connected to the hovered node?
        let isConnectedToHover = false
        if (hoveredId !== null && hoveredId !== node.id) {
          const hoverAdj = adjacencyRef.current.get(hoveredId)
          if (hoverAdj?.has(node.id)) isConnectedToHover = true
        }

        // Node entrance: staggered scale + fade
        let entranceScale = 1
        let entranceAlpha = 1
        const birth = nodeBirthRef.current.get(node.id)
        if (birth !== undefined) {
          const age = time - birth
          if (age < NODE_ENTRANCE_DURATION) {
            const progress = easeOutCubic(Math.max(0, age / NODE_ENTRANCE_DURATION))
            entranceScale = 0.6 + 0.4 * progress
            entranceAlpha = progress
          }
        }

        const scaleBoost = isSelected ? 1.3 : (isConnectedToHover ? 1.15 : 1)
        const r = baseR * entranceScale * scaleBoost
        const color = NODE_COLORS[node.kind] || COLORS.nodeDefault

        // Delight: same-kind highlight
        let sameKindStrength = 0
        if (currentHover !== null && hoverStrength > 0.3 && node.kind !== 'File') {
          const hoveredNode = currentNodes.find(n => n.id === currentHover)
          if (hoveredNode && hoveredNode.kind === node.kind && node.id !== currentHover) {
            sameKindStrength = hoverStrength * 0.5
          }
        }

        ctx.globalAlpha = entranceAlpha

        // Outer glow halo — neural feel, pulsing for selected/hovered
        const isHighlighted = isSelected || isConnectedToHover || sameKindStrength > 0.01
        if (isHighlighted) {
          const haloR = r + (isSelected ? 16 : 10)
          const haloAlpha = isSelected ? 0.25 : (isConnectedToHover ? 0.18 : 0.1)
          const pulse = isSelected
            ? Math.sin(timeSec * 2) * 0.08 + 0.92
            : isConnectedToHover
              ? Math.sin(timeSec * 3 + node.id * 0.3) * 0.1 + 0.9
              : 1
          ctx.beginPath()
          ctx.arc(nx, ny, haloR * pulse, 0, Math.PI * 2)
          ctx.fillStyle = isSelected ? COLORS.selection : color
          ctx.globalAlpha = entranceAlpha * haloAlpha
          ctx.fill()
          ctx.globalAlpha = entranceAlpha
        }

        // Node dot — filled with color
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        if (isSelected) {
          ctx.fillStyle = COLORS.selection
        } else if (sameKindStrength > 0.01) {
          ctx.fillStyle = color
          ctx.globalAlpha = entranceAlpha * (1 + sameKindStrength)
        } else {
          ctx.fillStyle = color
        }
        ctx.fill()
        ctx.globalAlpha = entranceAlpha

        // Selection ring — scale animation from 0.6 to 1.0
        if (isSelected) {
          let ringScale = 1
          const ringAnim = selectionRingRef.current
          if (ringAnim && ringAnim.id === node.id) {
            const age = time - ringAnim.startTime
            if (age < SELECTION_RING_DURATION) {
              ringScale = 0.6 + 0.4 * easeOutCubic(age / SELECTION_RING_DURATION)
            }
          }
          const ringR = (baseR + 8) * ringScale
          ctx.beginPath()
          ctx.arc(nx, ny, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `${COLORS.selection}50`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Hover glow — smooth lerp
        if (hoverStrength > 0.01 && !isSelected) {
          const glowR = r + 6
          ctx.beginPath()
          ctx.arc(nx, ny, glowR, 0, Math.PI * 2)
          ctx.strokeStyle = COLORS.selection
          ctx.globalAlpha = hoverStrength * 0.4
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.globalAlpha = entranceAlpha
        }

        // Reticle pulse — ease-out cubic expansion
        const pulse = selectionPulseRef.current
        if (pulse && pulse.id === node.id) {
          const age = time - pulse.startTime
          if (age < RETICLE_DURATION) {
            const progress = age / RETICLE_DURATION
            const eased = easeOutCubic(progress)
            const pulseR = (baseR + 8) + eased * 30
            ctx.beginPath()
            ctx.arc(nx, ny, pulseR, 0, Math.PI * 2)
            ctx.strokeStyle = COLORS.selection
            ctx.globalAlpha = (1 - eased) * 0.5
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.globalAlpha = entranceAlpha
          }
        }

        // Labels — smooth crossfade at zoom threshold (0.5x–1.0x)
        const labelFadeIn = Math.max(0, Math.min(1, (scale - 0.5) / 0.5))
        if (labelFadeIn > 0.01) {
          const fontSize = Math.max(10, Math.min(14, 10 / Math.max(0.5, scale)))
          ctx.font = `${fontSize}px 'IBM Plex Mono', monospace`
          ctx.textAlign = 'center'
          ctx.fillStyle = isSelected ? COLORS.text : COLORS.textMuted
          ctx.globalAlpha = labelFadeIn * entranceAlpha * (isSelected || isConnectedToHover ? 1 : 0.7)
          ctx.fillText(node.name, nx, ny + baseR + 16)
          ctx.globalAlpha = entranceAlpha
        }

        ctx.globalAlpha = 1
      }

      // --- Delight: Constellation beams — radial lines to 1-hop neighbors ---
      const beam = beamsRef.current
      if (beam && !reducedMotionRef.current) {
        const beamAge = time - beam.startTime
        const BEAM_IN = 300      // ms: fade in
        const BEAM_LINGER = 600  // ms: stay visible
        const BEAM_OUT = 400     // ms: fade out
        const BEAM_TOTAL = BEAM_IN + BEAM_LINGER + BEAM_OUT

        if (beamAge < BEAM_TOTAL) {
          let beamAlpha = 1
          if (beamAge < BEAM_IN) {
            beamAlpha = easeOutCubic(beamAge / BEAM_IN)
          } else if (beamAge > BEAM_IN + BEAM_LINGER) {
            const outProgress = (beamAge - BEAM_IN - BEAM_LINGER) / BEAM_OUT
            beamAlpha = 1 - easeOutCubic(outProgress)
          }

          const centerPos = currentPositions.get(beam.id)
          if (centerPos) {
            const cx = centerPos.x * scale + tx
            const cy = centerPos.y * scale + ty

            for (const neighborId of beam.neighbors) {
              const nPos = currentPositions.get(neighborId)
              if (!nPos) continue
              const nx = nPos.x * scale + tx
              const ny = nPos.y * scale + ty

              // Skip off-screen beams
              if ((cx < -50 && nx < -50) || (cy < -50 && ny < -50)) continue
              if ((cx > w + 50 && nx > w + 50) || (cy > h + 50 && ny > h + 50)) continue

              // Beam: radial line with gradient fade
              ctx.beginPath()
              ctx.moveTo(cx, cy)
              ctx.lineTo(nx, ny)
              ctx.strokeStyle = COLORS.selection
              ctx.globalAlpha = beamAlpha * 0.5
              ctx.lineWidth = 1.5
              ctx.stroke()
              ctx.globalAlpha = 1
            }

            // Center glow during beams
            ctx.beginPath()
            ctx.arc(cx, cy, 16, 0, Math.PI * 2)
            ctx.fillStyle = COLORS.selection
            ctx.globalAlpha = beamAlpha * 0.15
            ctx.fill()
            ctx.globalAlpha = 1
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, []) // Empty deps — never restarts

  // Resize observer — trigger canvas redraw by setting a dirty flag
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let rafId: number
    const observer = new ResizeObserver(() => {
      // Force a canvas resize on next frame (canvas element will auto-resize via CSS,
      // but we need to update the internal resolution to match)
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width * dpr
          canvas.height = rect.height * dpr
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.scale(dpr, dpr)
        }
      })
    })
    observer.observe(container)
    return () => { observer.disconnect(); cancelAnimationFrame(rafId) }
  }, [])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale
        const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale
        const currentNodes = nodesRef.current
        const currentPositions = positionsRef.current
        let closest: number | null = null
        let closestDist = Infinity
        for (const node of currentNodes) {
          const pos = currentPositions.get(node.id)
          if (!pos) continue
          const dx = pos.x - mx, dy = pos.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          const threshold = nodeRadius(node.kind) + 8
          if (dist < threshold && dist < closestDist) { closest = node.id; closestDist = dist }
        }
        hoverNodeIdRef.current = closest
      }
      return
    }
    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
    transformRef.current.x += dx
    transformRef.current.y += dy
    cameraTargetRef.current.x += dx
    cameraTargetRef.current.y += dy
  }, [])

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const currentScale = transformRef.current.scale
    const newScale = Math.max(0.03, Math.min(12, currentScale * factor))

    const t = transformRef.current
    const newTx = mouseX - (mouseX - t.x) * (newScale / currentScale)
    const newTy = mouseY - (mouseY - t.y) * (newScale / currentScale)

    t.x = newTx
    t.y = newTy
    t.scale = newScale
    cameraTargetRef.current = { x: newTx, y: newTy, scale: newScale }
  }, [])

  // Pan camera to center on a node position
  const panToNode = useCallback((nodeId: number) => {
    const pos = positionsRef.current.get(nodeId)
    if (!pos || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scale = transformRef.current.scale
    cameraTargetRef.current = {
      x: rect.width / 2 - pos.x * scale,
      y: rect.height / 2 - pos.y * scale,
      scale,
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale
    const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale

    const currentNodes = nodesRef.current
    const currentPositions = positionsRef.current
    let closest: GraphNode | null = null
    let closestDist = Infinity
    for (const node of currentNodes) {
      const pos = currentPositions.get(node.id)
      if (!pos) continue
      const dx = pos.x - mx, dy = pos.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      const threshold = nodeRadius(node.kind) + 4
      if (dist < threshold && dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }

    const newId = closest ? closest.id : null
    selectNode(newId)
    if (newId !== null) panToNode(newId)
  }, [selectNode, panToNode])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale
    const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale

    const currentNodes = nodesRef.current
    const currentPositions = positionsRef.current
    for (const node of currentNodes) {
      const pos = currentPositions.get(node.id)
      if (!pos) continue
      const dx = pos.x - mx, dy = pos.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nodeRadius(node.kind) + 4) {
        onNodeDoubleClick(node.id)
        return
      }
    }
  }, [onNodeDoubleClick])

  // Keyboard navigation: arrow keys traverse nodes, Escape deselects, +/- zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if inside input/textarea
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return

      const currentNodes = nodesRef.current
      const currentPositions = positionsRef.current
      const currentSelected = selectedRef.current

      if (e.key === 'Escape') {
        selectNode(null)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        if (currentNodes.length === 0) return
        // Find next/previous node by index
        const idx = currentNodes.findIndex(n => n.id === currentSelected)
        const next = e.shiftKey
          ? (idx <= 0 ? currentNodes.length - 1 : idx - 1)
          : (idx < 0 || idx >= currentNodes.length - 1 ? 0 : idx + 1)
        const nextNode = currentNodes[next]
        selectNode(nextNode.id)
        panToNode(nextNode.id)
        return
      }

      if (e.key === 'ArrowDown' && currentSelected !== null) {
        e.preventDefault()
        // Find nearest node below current
        const pos = currentPositions.get(currentSelected)
        if (!pos) return
        let best: number | null = null
        let bestDist = Infinity
        for (const n of currentNodes) {
          if (n.id === currentSelected) continue
          const np = currentPositions.get(n.id)
          if (!np) continue
          const dy = np.y - pos.y
          if (dy > 2 && dy < bestDist) { bestDist = dy; best = n.id }
        }
        if (best !== null) { selectNode(best); panToNode(best) }
        return
      }

      if (e.key === 'ArrowUp' && currentSelected !== null) {
        e.preventDefault()
        const pos = currentPositions.get(currentSelected)
        if (!pos) return
        let best: number | null = null
        let bestDist = Infinity
        for (const n of currentNodes) {
          if (n.id === currentSelected) continue
          const np = currentPositions.get(n.id)
          if (!np) continue
          const dy = pos.y - np.y
          if (dy > 2 && dy < bestDist) { bestDist = dy; best = n.id }
        }
        if (best !== null) { selectNode(best); panToNode(best) }
        return
      }

      if (e.key === 'ArrowLeft' && currentSelected !== null) {
        e.preventDefault()
        const pos = currentPositions.get(currentSelected)
        if (!pos) return
        let best: number | null = null
        let bestDist = Infinity
        for (const n of currentNodes) {
          if (n.id === currentSelected) continue
          const np = currentPositions.get(n.id)
          if (!np) continue
          const dx = pos.x - np.x
          if (dx > 2 && dx < bestDist) { bestDist = dx; best = n.id }
        }
        if (best !== null) { selectNode(best); panToNode(best) }
        return
      }

      if (e.key === 'ArrowRight' && currentSelected !== null) {
        e.preventDefault()
        const pos = currentPositions.get(currentSelected)
        if (!pos) return
        let best: number | null = null
        let bestDist = Infinity
        for (const n of currentNodes) {
          if (n.id === currentSelected) continue
          const np = currentPositions.get(n.id)
          if (!np) continue
          const dx = np.x - pos.x
          if (dx > 2 && dx < bestDist) { bestDist = dx; best = n.id }
        }
        if (best !== null) { selectNode(best); panToNode(best) }
        return
      }

      // Zoom with +/-
      if (e.key === '=' || e.key === '+') {
        const t = transformRef.current
        const newScale = Math.min(12, t.scale * 1.15)
        cameraTargetRef.current = { x: t.x, y: t.y, scale: newScale }
        return
      }
      if (e.key === '-' || e.key === '_') {
        const t = transformRef.current
        const newScale = Math.max(0.03, t.scale * 0.85)
        cameraTargetRef.current = { x: t.x, y: t.y, scale: newScale }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectNode, panToNode])

  // Touch support: pan + pinch zoom + tap to select
  const touchRef = useRef({ startX: 0, startY: 0, startDist: 0, startScale: 1, touching: false, moved: false })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touchRef.current = { startX: t.clientX, startY: t.clientY, startDist: 0, startScale: 1, touching: true, moved: false }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchRef.current = {
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        startDist: Math.sqrt(dx * dx + dy * dy),
        startScale: transformRef.current.scale,
        touching: true,
        moved: false,
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1 && touchRef.current.touching) {
      const t = e.touches[0]
      const dx = t.clientX - touchRef.current.startX
      const dy = t.clientY - touchRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) touchRef.current.moved = true
      transformRef.current.x += dx
      transformRef.current.y += dy
      cameraTargetRef.current.x += dx
      cameraTargetRef.current.y += dy
      touchRef.current.startX = t.clientX
      touchRef.current.startY = t.clientY
    } else if (e.touches.length === 2 && touchRef.current.startDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newScale = Math.max(0.03, Math.min(12, touchRef.current.startScale * (dist / touchRef.current.startDist)))
      const t = transformRef.current
      cameraTargetRef.current = { x: t.x, y: t.y, scale: newScale }
      touchRef.current.moved = true
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0 && !touchRef.current.moved) {
      // Tap — treat as click for node selection
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect && touchRef.current.touching) {
        const mx = (touchRef.current.startX - rect.left - transformRef.current.x) / transformRef.current.scale
        const my = (touchRef.current.startY - rect.top - transformRef.current.y) / transformRef.current.scale
        let closest: number | null = null
        let closestDist = Infinity
        for (const node of nodesRef.current) {
          const pos = positionsRef.current.get(node.id)
          if (!pos) continue
          const dx = pos.x - mx, dy = pos.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          const threshold = nodeRadius(node.kind) + 8
          if (dist < threshold && dist < closestDist) { closest = node.id; closestDist = dist }
        }
        selectNode(closest)
        if (closest !== null) panToNode(closest)
      }
    }
    touchRef.current.touching = false
  }, [selectNode, panToNode])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: COLORS.error }}>
        <div className="text-center">
          <p className="text-sm font-heading font-bold">Failed to load graph</p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Make sure astera serve is running and your codebase is indexed.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: COLORS.textMuted }} role="status" aria-live="polite">
        <div className="text-center space-y-4">
          {/* Animated dot cluster */}
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: COLORS.selection,
                  opacity: 0.3,
                  animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded" style={{ width: 180, background: COLORS.surface, opacity: 0.6 }} />
            <div className="h-2.5 rounded" style={{ width: 120, background: COLORS.surfaceDim, opacity: 0.4 }} />
          </div>
          <p className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>Building force layout…</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor: 'grab', background: '#000000' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); hoverNodeIdRef.current = null }}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={`Force-directed graph with ${nodes.length} nodes and ${edges.length} edges`}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
