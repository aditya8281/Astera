import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { GraphNode } from '../../types'

const LABEL_MIN_IMPORTANCE = 0.15

export function NodeLabels({
  nodes,
  positions,
  selectedNodeId,
  hoveredNodeId,
  visible,
}: {
  nodes: GraphNode[]
  positions: Map<number, [number, number, number]>
  selectedNodeId: number | null
  hoveredNodeId: number | null
  visible: boolean
}) {
  const visibleLabels = useMemo(() => {
    if (!visible) return []
    return nodes.filter((n) => {
      if (n.id === selectedNodeId || n.id === hoveredNodeId) return true
      return (n.importance ?? 0.3) > LABEL_MIN_IMPORTANCE
    })
  }, [nodes, visible, selectedNodeId, hoveredNodeId])

  if (!visible) return null

  return (
    <>
      {visibleLabels.map((node) => {
        const pos = positions.get(node.id)
        if (!pos) return null

        const isSelected = node.id === selectedNodeId
        const isHovered = node.id === hoveredNodeId

        return (
          <Html
            key={node.id}
            position={pos}
            center
            distanceFactor={12}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="font-mono whitespace-nowrap select-none"
              style={{
                fontSize: isSelected ? '11px' : '9px',
                color: isSelected ? '#E65100' : isHovered ? '#F0F0F0' : '#888888',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
                opacity: isSelected || isHovered ? 1 : 0.8,
                fontWeight: isSelected ? 600 : 400,
                background: isSelected ? 'rgba(230,81,0,0.12)' : 'transparent',
                padding: isSelected ? '0 3px' : '0',
                borderRadius: '2px',
              }}
            >
              {node.name}
            </span>
          </Html>
        )
      })}
    </>
  )
}
