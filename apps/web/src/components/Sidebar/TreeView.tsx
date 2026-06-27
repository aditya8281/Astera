import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { NODE_COLORS, COLORS } from '../../constants'
import { useUIStore } from '../../store'
import type { SymbolNode } from '../../types'
import { ChevronRightIcon, ChevronDownIcon } from '../Common/Icons'

interface TreeNode {
  symbol: SymbolNode
  children: TreeNode[]
}

function buildTree(symbols: SymbolNode[]): TreeNode[] {
  // Group by kind: Module → Class → Function/Method
  const roots: TreeNode[] = []
  const moduleMap = new Map<string, TreeNode>()
  const classMap = new Map<string, TreeNode>()

  for (const sym of symbols) {
    const node: TreeNode = { symbol: sym, children: [] }

    switch (sym.kind) {
      case 'Module': {
        moduleMap.set(sym.name, node)
        roots.push(node)
        break
      }
      case 'Class':
      case 'Interface':
      case 'Enum': {
        // Try to find parent module
        const parentName = sym.properties?.parent_module as string | undefined
        if (parentName && moduleMap.has(parentName)) {
          moduleMap.get(parentName)!.children.push(node)
        } else {
          roots.push(node)
        }
        classMap.set(sym.name, node)
        break
      }
      case 'Function':
      case 'Method': {
        const parentName = sym.properties?.parent_class as string | undefined
          || sym.properties?.parent_module as string | undefined
        if (parentName && classMap.has(parentName)) {
          classMap.get(parentName)!.children.push(node)
        } else if (parentName && moduleMap.has(parentName)) {
          moduleMap.get(parentName)!.children.push(node)
        } else {
          roots.push(node)
        }
        break
      }
      default: {
        roots.push(node)
        break
      }
    }
  }

  return roots
}

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const selectNode = useUIStore((s) => s.selectNode)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const hasChildren = node.children.length > 0
  const isSelected = node.symbol.id === selectedNodeId

  const handleClick = useCallback(() => {
    if (node.symbol.id !== null) {
      selectNode(node.symbol.id)
      setActivePanel(null)
    }
  }, [node.symbol.id, selectNode, setActivePanel])

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          handleClick()
        }}
        className="w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors group"
        style={{
          paddingLeft: `${depth * 12 + 8}px`,
          background: isSelected ? `${COLORS.selection}15` : 'transparent',
          color: isSelected ? COLORS.selection : COLORS.text,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = COLORS.surfaceHover
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <span className="text-[8px] w-3 text-center flex-shrink-0" style={{ color: COLORS.textDim }}>
            {expanded ? <ChevronDownIcon size={8} /> : <ChevronRightIcon size={8} />}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Kind color dot */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: NODE_COLORS[node.symbol.kind] || COLORS.inactive }}
        />

        {/* Name */}
        <span className="text-[11px] font-mono truncate flex-1">{node.symbol.name}</span>

        {/* Child count badge */}
        {hasChildren && (
          <span
            className="text-[9px] font-mono px-1 rounded"
            style={{ background: COLORS.surfaceDim, color: COLORS.textDim }}
          >
            {node.children.length}
          </span>
        )}
      </button>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.symbol.id ?? child.symbol.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TreeView() {
  const { data, isLoading } = useQuery({
    queryKey: ['tree-view'],
    queryFn: () => api.symbols(),
  })

  const symbols = data?.data || []
  const tree = useMemo(() => buildTree(symbols), [symbols])

  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-6 w-full" style={{ marginLeft: `${i * 12}px` }} />
        ))}
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="p-4 text-center">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>No symbols indexed</span>
      </div>
    )
  }

  return (
    <div className="py-1">
      {tree.map((node) => (
        <TreeItem key={node.symbol.id ?? node.symbol.name} node={node} />
      ))}
    </div>
  )
}
