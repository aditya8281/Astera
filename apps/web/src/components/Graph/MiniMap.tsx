import { useMemo, useCallback } from 'react'
import type { GraphNode } from '../../types'
import { useUIStore } from '../../store'
import { COLORS } from '../../constants'

interface MiniMapProps {
  nodes: GraphNode[]
  positions: Map<number, [number, number, number]>
}

export function MiniMap({ nodes, positions }: MiniMapProps) {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const setCameraTarget = useUIStore((s) => s.setCameraTarget)

  const { dots, bounds } = useMemo(() => {
    const dots: Array<{ x: number; y: number; color: string; isSelected: boolean }> = []
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity

    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!pos) continue
      const [x, , z] = pos
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }

    const rangeX = maxX - minX || 1
    const rangeZ = maxZ - minZ || 1
    const pad = 0.05

    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!pos) continue
      const [x, , z] = pos
      dots.push({
        x: pad + ((x - minX) / rangeX) * (1 - 2 * pad),
        y: pad + ((z - minZ) / rangeZ) * (1 - 2 * pad),
        color: node.id === selectedNodeId ? COLORS.selection : COLORS.relationship,
        isSelected: node.id === selectedNodeId,
      })
    }

    return { dots, bounds: { minX, maxX, minZ, maxZ } }
  }, [nodes, positions, selectedNodeId])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rx = (e.clientX - rect.left) / rect.width
    const ry = (e.clientY - rect.top) / rect.height
    const x = bounds.minX + rx * (bounds.maxX - bounds.minX)
    const z = bounds.minZ + ry * (bounds.maxZ - bounds.minZ)
    setCameraTarget([x, 3, z])
  }, [bounds, setCameraTarget])

  if (nodes.length === 0) return null

  return (
    <div
      className="absolute bottom-3 right-3 rounded-lg overflow-hidden cursor-crosshair"
      style={{
        width: 200,
        height: 150,
        background: `${COLORS.surface}D0`,
        border: `1px solid ${COLORS.border}`,
        zIndex: 'var(--z-minimap)',
      }}
      onClick={handleClick}
      role="img"
      aria-label="Mini map"
    >
      <svg viewBox="0 0 200 150" className="w-full h-full">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x * 200}
            cy={d.y * 150}
            r={d.isSelected ? 3 : 1}
            fill={d.color}
            opacity={d.isSelected ? 1 : 0.6}
          />
        ))}
      </svg>
      <div
        className="absolute top-1 left-1 text-[8px] font-mono uppercase tracking-wider"
        style={{ color: COLORS.textDim }}
      >
        minimap
      </div>
    </div>
  )
}
