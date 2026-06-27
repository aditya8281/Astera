import { useMemo } from 'react'
import type { GraphNode } from '../types'
import { BUDGETS } from '../constants'

/**
 * Level of Detail — filters nodes based on importance score.
 * Used to cull low-importance nodes at far zoom levels.
 */
export function useLOD(
  nodes: GraphNode[],
  threshold: 'low' | 'medium' | 'high',
  cameraDistance: number
): GraphNode[] {
  const lodConfig = BUDGETS.lodThresholds[threshold]

  return useMemo(() => {
    if (cameraDistance < lodConfig.distance * 0.5) {
      // Very close — show everything
      return nodes
    }

    const importanceCutoff = lodConfig.importance * (cameraDistance / (lodConfig.distance * 2))

    return nodes.filter((n) => {
      const importance = n.importance ?? 0.3
      return importance >= Math.min(importanceCutoff, 0.7)
    })
  }, [nodes, cameraDistance, lodConfig])
}
