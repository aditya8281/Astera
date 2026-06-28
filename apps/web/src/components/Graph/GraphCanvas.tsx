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
 * OLED-black background, calm navigation, auto-centered on load.
 *
 * Key architecture:
 * - Animation loop runs once, never restarts
 * - All data (positions, nodes, edges, selection) read from refs
 * - Camera lerp for smooth pan/zoom transitions
 * - Auto-fit on first layout completion
 */

// Node radius by kind (slightly larger for OLED readability)
function nodeRadius(kind: string): number {
  if (kind === 'File' || kind === 'Module') return 10
  if (kind === 'Class' || kind === 'Interface' || kind === 'Enum') return 8
  if (kind === 'Function' || kind === 'Method') return 6
  return 5
}

// Smooth interpolation target for camera
interface CameraTarget {
  x: number
  y: number
  scale: number
}

export function GraphCanvas({ nodes, edges, isLoading, error, onNodeDoubleClick }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const positions = useForceLayout2D(nodes, edges)

  // --- All mutable state stored in refs to avoid animation loop restarts ---
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

  // Selection pulse: brief expanding ring on node select
  const selectionPulseRef = useRef<{ id: number; startTime: number } | null>(null)
  const prevSelectedRef = useRef<number | null>(null)

  // Hover tracking for glow ring
  const hoverNodeIdRef = useRef<number | null>(null)

  // --- Sync React state into refs (reads are free, no render cycle) ---
  useEffect(() => { positionsRef.current = positions }, [positions])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { selectedRef.current = selectedNodeId }, [selectedNodeId])

  // Auto-fit: center all nodes in view when positions first arrive
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

    transformRef.current = { x: tx, y: ty, scale: fitScale }
    cameraTargetRef.current = { x: tx, y: ty, scale: fitScale }
    autoFitAppliedRef.current = true
  }, [positions])

  // Reset auto-fit when nodes change (drill-down)
  useEffect(() => {
    autoFitAppliedRef.current = false
  }, [nodes])

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

  // Trigger reticle pulse on selection change
  useEffect(() => {
    if (selectedNodeId !== null && selectedNodeId !== prevSelectedRef.current) {
      selectionPulseRef.current = { id: selectedNodeId, startTime: performance.now() }
    }
    prevSelectedRef.current = selectedNodeId
  }, [selectedNodeId])

  // --- Single stable animation loop — never restarts ---
  useEffect(() => {
    let running = true

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

      // Smooth camera interpolation (lerp)
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

      // Draw edges
      ctx.lineWidth = 1
      for (const edge of currentEdges) {
        const from = currentPositions.get(edge.source)
        const to = currentPositions.get(edge.target)
        if (!from || !to) continue

        const fx = from.x * scale + tx
        const fy = from.y * scale + ty
        const tox = to.x * scale + tx
        const toy = to.y * scale + ty

        // Skip edges entirely off-screen
        if ((fx < -50 && tox < -50) || (fy < -50 && toy < -50)) continue
        if ((fx > w + 50 && tox > w + 50) || (fy > h + 50 && toy > h + 50)) continue

        const isHighlighted = edge.source === selectedId || edge.target === selectedId

        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(tox, toy)
        ctx.strokeStyle = isHighlighted ? COLORS.selection : COLORS.edgeDefault
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8
        ctx.stroke()
      }

      // Draw nodes
      for (const node of currentNodes) {
        const pos = currentPositions.get(node.id)
        if (!pos) continue

        const nx = pos.x * scale + tx
        const ny = pos.y * scale + ty

        if (nx < -30 || nx > w + 30 || ny < -30 || ny > h + 30) continue

        const r = nodeRadius(node.kind)
        const isSelected = node.id === selectedId
        const isHovered = hoverNodeIdRef.current === node.id

        // Node dot
        ctx.beginPath()
        ctx.arc(nx, ny, isSelected ? r + 2 : r, 0, Math.PI * 2)
        const color = NODE_COLORS[node.kind] || COLORS.nodeDefault
        ctx.fillStyle = isSelected ? COLORS.selection : color
        ctx.fill()

        // Selection ring
        if (isSelected) {
          ctx.beginPath()
          ctx.arc(nx, ny, r + 6, 0, Math.PI * 2)
          ctx.strokeStyle = `${COLORS.selection}40`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Hover glow
        if (isHovered && !isSelected) {
          ctx.beginPath()
          ctx.arc(nx, ny, r + 4, 0, Math.PI * 2)
          ctx.strokeStyle = `${COLORS.selection}20`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Reticle pulse
        const pulse = selectionPulseRef.current
        if (pulse && pulse.id === node.id) {
          const elapsed = (performance.now() - pulse.startTime) / 600
          if (elapsed < 1) {
            const pulseR = r + 6 + elapsed * 25
            const alpha = Math.round((1 - elapsed) * 50).toString(16).padStart(2, '0')
            ctx.beginPath()
            ctx.arc(nx, ny, pulseR, 0, Math.PI * 2)
            ctx.strokeStyle = `${COLORS.selection}${alpha}`
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }

        // Labels — visible at moderate zoom
        if (scale >= 0.8) {
          ctx.font = `10px 'IBM Plex Mono', monospace`
          ctx.textAlign = 'center'
          ctx.fillStyle = isSelected ? COLORS.text : COLORS.textMuted
          ctx.fillText(node.name, nx, ny + r + 14)
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
      // Hover tracking for glow ring
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
