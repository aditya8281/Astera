import { useRef, useEffect, useCallback } from 'react'
import type { GraphNode, GraphEdge } from '../../types'
import { useUIStore } from '../../store'
import { COLORS, NODE_COLORS } from '../../constants'
import { useForceLayout2D } from '../../hooks/useForceLayout2D'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  isLoading: boolean
  error: string | null
  onNodeDoubleClick: (id: number) => void
}

/**
 * 2D Canvas-based graph visualization.
 * Obsidian-style: nodes as colored circles, edges as lines,
 * pan/zoom via mouse, click to select, double-click to drill.
 */

// Node radius by kind (larger = more important)
function nodeRadius(kind: string): number {
  if (kind === 'File' || kind === 'Module') return 8
  if (kind === 'Class' || kind === 'Interface' || kind === 'Enum') return 6
  if (kind === 'Function' || kind === 'Method') return 5
  return 4
}

export function GraphCanvas({ nodes, edges, isLoading, error, onNodeDoubleClick }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const positions = useForceLayout2D(nodes, edges)

  // View transform (pan + zoom)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 })
  const animFrameRef = useRef<number>(0)

  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectNode = useUIStore((s) => s.selectNode)
  const cameraTarget = useUIStore((s) => s.cameraTarget)

  // Camera target follow (when selecting a node)
  useEffect(() => {
    if (!cameraTarget || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const targetX = cameraTarget[0]
    const targetY = cameraTarget[1]
    const scale = transformRef.current.scale
    transformRef.current.x = rect.width / 2 - targetX * scale
    transformRef.current.y = rect.height / 2 - targetY * scale
    /* trigger draw via animation loop */
  }, [cameraTarget])

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    const w = rect.width
    const h = rect.height
    const { x: tx, y: ty, scale } = transformRef.current

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Draw edges
    ctx.lineWidth = 1
    for (const edge of edges) {
      const from = positions.get(edge.source)
      const to = positions.get(edge.target)
      if (!from || !to) continue

      const fx = from.x * scale + tx
      const fy = from.y * scale + ty
      const tox = to.x * scale + tx
      const toy = to.y * scale + ty

      const isHighlighted =
        edge.source === selectedNodeId || edge.target === selectedNodeId

      ctx.beginPath()
      ctx.moveTo(fx, fy)
      ctx.lineTo(tox, toy)
      ctx.strokeStyle = isHighlighted
        ? COLORS.selection
        : `${COLORS.textDim}40`
      ctx.lineWidth = isHighlighted ? 1.5 : 0.5
      ctx.stroke()
    }

    // Draw nodes
    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!pos) continue

      const nx = pos.x * scale + tx
      const ny = pos.y * scale + ty
      const r = nodeRadius(node.kind) * (scale > 2 ? 1 : 1)
      const isSelected = node.id === selectedNodeId

      // Node dot
      ctx.beginPath()
      ctx.arc(nx, ny, isSelected ? r + 2 : r, 0, Math.PI * 2)
      const color = NODE_COLORS[node.kind] || COLORS.nodeDefault
      ctx.fillStyle = isSelected ? COLORS.selection : color
      ctx.fill()

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(nx, ny, r + 5, 0, Math.PI * 2)
        ctx.strokeStyle = `${COLORS.selection}50`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Labels at higher zoom
      if (scale >= 1.2) {
        ctx.font = `10px 'IBM Plex Mono', monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = isSelected ? COLORS.text : COLORS.textMuted
        ctx.fillText(node.name, nx, ny + r + 12)
      }
    }
  }, [nodes, edges, positions, selectedNodeId])

  // Animation loop
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [draw])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => { draw() })
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
    transformRef.current.x += dx
    transformRef.current.y += dy
    /* trigger draw via animation loop */
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

    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, transformRef.current.scale * factor))

    // Zoom toward cursor
    const t = transformRef.current
    t.x = mouseX - (mouseX - t.x) * (newScale / t.scale)
    t.y = mouseY - (mouseY - t.y) * (newScale / t.scale)
    t.scale = newScale
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale
    const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale

    // Hit test: find closest node
    let closest: GraphNode | null = null
    let closestDist = Infinity
    for (const node of nodes) {
      const pos = positions.get(node.id)
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
  }, [nodes, positions, selectNode])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale
    const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale

    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!pos) continue
      const dx = pos.x - mx, dy = pos.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nodeRadius(node.kind) + 4) {
        onNodeDoubleClick(node.id)
        return
      }
    }
  }, [nodes, positions, onNodeDoubleClick])

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
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor: 'grab' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
