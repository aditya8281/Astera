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

// Node radius by kind
function nodeRadius(kind: string): number {
  if (kind === 'File' || kind === 'Module') return 10
  if (kind === 'Class' || kind === 'Interface' || kind === 'Enum') return 8
  if (kind === 'Function' || kind === 'Method') return 6
  return 5
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
      const revealScale = Math.max(fitScale * 3, 3.5)
      transformRef.current = { x: w / 2, y: h / 2, scale: revealScale }
      cameraTargetRef.current = { x: tx, y: ty, scale: fitScale }
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
      for (const edge of currentEdges) {
        const from = currentPositions.get(edge.source)
        const to = currentPositions.get(edge.target)
        if (!from || !to) continue

        const fx = from.x * scale + tx
        const fy = from.y * scale + ty
        const tox = to.x * scale + tx
        const toy = to.y * scale + ty

        // Skip off-screen
        if ((fx < -50 && tox < -50) || (fy < -50 && toy < -50)) continue
        if ((fx > w + 50 && tox > w + 50) || (fy > h + 50 && toy > h + 50)) continue

        const isDirectHighlight = edge.source === selectedId || edge.target === selectedId

        // Delight: connected-edge cascade — hop-distance glow
        let cascadeStrength = 0
        if (selectedId !== null) {
          const distSource = hopDistances.get(edge.source)
          const distTarget = hopDistances.get(edge.target)
          if (distSource !== undefined && distTarget !== undefined) {
            // Edge connecting two BFS nodes gets glow based on further hop
            const maxDist = Math.max(distSource, distTarget)
            if (maxDist <= 2) cascadeStrength = 1 - maxDist * 0.35 // hop 0=1.0, hop 1=0.65, hop 2=0.3
          }
        }

        // Edge entrance: fade in
        let edgeAlpha = 1
        const edgeKey = `${edge.source}-${edge.target}-${edge.kind}`
        const edgeBirth = edgeBirthRef.current.get(edgeKey)
        if (edgeBirth !== undefined) {
          const age = time - edgeBirth
          if (age < EDGE_ENTRANCE_DURATION) {
            edgeAlpha = easeOutCubic(Math.max(0, age / EDGE_ENTRANCE_DURATION))
          }
        }

        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(tox, toy)

        if (isDirectHighlight) {
          ctx.strokeStyle = COLORS.selection
          ctx.globalAlpha = edgeAlpha
          ctx.lineWidth = 1.5
        } else if (cascadeStrength > 0.05) {
          // Delight: cascade glow — cyan at decreasing intensity
          ctx.strokeStyle = COLORS.selection
          ctx.globalAlpha = cascadeStrength * 0.6 * edgeAlpha
          ctx.lineWidth = 1.0
        } else {
          ctx.strokeStyle = COLORS.edgeDefault
          ctx.globalAlpha = edgeAlpha
          ctx.lineWidth = 0.8
        }

        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // --- Draw nodes ---
      for (const node of currentNodes) {
        const pos = currentPositions.get(node.id)
        if (!pos) continue

        const nx = pos.x * scale + tx
        const ny = pos.y * scale + ty

        if (nx < -30 || nx > w + 30 || ny < -30 || ny > h + 30) continue

        const baseR = nodeRadius(node.kind)
        const isSelected = node.id === selectedId
        const hoverStrength = hoverStrengthRef.current.get(node.id) || 0

        // Node entrance: staggered scale + fade
        let entranceScale = 1
        let entranceAlpha = 1
        const birth = nodeBirthRef.current.get(node.id)
        if (birth !== undefined) {
          const age = time - birth
          if (age < NODE_ENTRANCE_DURATION) {
            const progress = easeOutCubic(Math.max(0, age / NODE_ENTRANCE_DURATION))
            entranceScale = 0.6 + 0.4 * progress  // 0.6 → 1.0
            entranceAlpha = progress               // 0 → 1
          }
        }

        const r = baseR * entranceScale * (isSelected ? 1.2 : 1)
        const color = NODE_COLORS[node.kind] || COLORS.nodeDefault

        // Delight: same-kind highlight — hovering a node brightens all same-kind nodes
        let sameKindStrength = 0
        if (currentHover !== null && hoverStrength > 0.3 && node.kind !== 'File') {
          const hoveredNode = currentNodes.find(n => n.id === currentHover)
          if (hoveredNode && hoveredNode.kind === node.kind && node.id !== currentHover) {
            sameKindStrength = hoverStrength * 0.4
          }
        }

        ctx.globalAlpha = entranceAlpha

        // Node dot
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        if (isSelected) {
          ctx.fillStyle = COLORS.selection
        } else if (sameKindStrength > 0.01) {
          // Brighten same-kind nodes by blending toward nodeHover
          ctx.fillStyle = color
          ctx.globalAlpha = entranceAlpha * (1 + sameKindStrength)
        } else {
          ctx.fillStyle = color
        }
        ctx.fill()
        ctx.globalAlpha = entranceAlpha // reset after fill

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
          const ringR = (baseR + 6) * ringScale
          ctx.beginPath()
          ctx.arc(nx, ny, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `${COLORS.selection}40`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Hover glow — smooth lerp, not binary
        if (hoverStrength > 0.01 && !isSelected) {
          const glowR = baseR + 4
          const glowAlpha = Math.round(hoverStrength * 35).toString(16).padStart(2, '0')
          ctx.beginPath()
          ctx.arc(nx, ny, glowR, 0, Math.PI * 2)
          ctx.strokeStyle = `${COLORS.selection}${glowAlpha}`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Reticle pulse — ease-out cubic expansion
        const pulse = selectionPulseRef.current
        if (pulse && pulse.id === node.id) {
          const age = time - pulse.startTime
          if (age < RETICLE_DURATION) {
            const progress = age / RETICLE_DURATION
            const eased = easeOutCubic(progress)
            const pulseR = (baseR + 6) + eased * 25
            const alpha = Math.round((1 - eased) * 50).toString(16).padStart(2, '0')
            ctx.beginPath()
            ctx.arc(nx, ny, pulseR, 0, Math.PI * 2)
            ctx.strokeStyle = `${COLORS.selection}${alpha}`
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }

        // Labels — smooth crossfade at zoom threshold (0.7x–1.0x)
        const labelFadeIn = Math.max(0, Math.min(1, (scale - 0.7) / 0.3))
        if (labelFadeIn > 0.01) {
          ctx.font = `10px 'IBM Plex Mono', monospace`
          ctx.textAlign = 'center'
          ctx.fillStyle = isSelected ? COLORS.text : COLORS.textMuted
          ctx.globalAlpha = labelFadeIn * entranceAlpha
          ctx.fillText(node.name, nx, ny + baseR + 14)
          ctx.globalAlpha = entranceAlpha
        }

        ctx.globalAlpha = 1
      }

      // --- Delight: Constellation beams — radial lines to 1-hop neighbors ---
      const beam = beamsRef.current
      if (beam) {
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

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {})
    observer.observe(container)
    return () => observer.disconnect()
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
    const newScale = Math.max(0.15, Math.min(4, currentScale * factor))

    const t = transformRef.current
    const newTx = mouseX - (mouseX - t.x) * (newScale / currentScale)
    const newTy = mouseY - (mouseY - t.y) * (newScale / currentScale)

    t.x = newTx
    t.y = newTy
    t.scale = newScale
    cameraTargetRef.current = { x: newTx, y: newTy, scale: newScale }
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

    selectNode(closest ? closest.id : null)
  }, [selectNode])

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
      <div className="h-full flex items-center justify-center" style={{ color: COLORS.textMuted }}>
        <div className="text-center space-y-3">
          <div className="skeleton w-48 h-4" />
          <div className="skeleton w-32 h-3" />
          <p className="text-xs">Loading graph...</p>
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
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
