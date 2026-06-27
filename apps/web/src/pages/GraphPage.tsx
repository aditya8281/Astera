import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api'
import { GraphCanvas } from '../components/Graph/GraphCanvas'
import { OverlayPanel } from '../components/Overlay/OverlayPanel'
import { SymbolsPanel } from './panels/SymbolsPanel'
import { FilesPanel } from './panels/FilesPanel'
import { MetricsPanel } from './panels/MetricsPanel'
import { ImpactPanel } from './panels/ImpactPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { useUIStore } from '../store'
import { COLORS } from '../constants'
import { EmptyState } from '../components/Common/EmptyState'
import type { GraphNode, GraphEdge } from '../types'

// Container kinds that support drill-down
const CONTAINER_KINDS = new Set(['Module', 'Class', 'Interface', 'Enum', 'File'])

export function GraphPage() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const kindFilter = useUIStore((s) => s.kindFilter)
  const setGraphState = useUIStore((s) => s.setGraphState)
  const pushBreadcrumb = useUIStore((s) => s.pushBreadcrumb)

  // Progressive loading state
  const [visibleNodes, setVisibleNodes] = useState<GraphNode[]>([])
  const [visibleEdges, setVisibleEdges] = useState<GraphEdge[]>([])
  const [drillStack, setDrillStack] = useState<Array<{ id: number; name: string; kind: string }>>([])
  const loadedModulesRef = useRef(false)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  nodesRef.current = visibleNodes
  edgesRef.current = visibleEdges

  // Fetch modules on mount (overview)
  const { data: modulesData, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: () => api.modules(),
    enabled: !loadedModulesRef.current,
  })

  // Process modules data after query completes
  useEffect(() => {
    if (modulesData && !loadedModulesRef.current) {
      loadedModulesRef.current = true
      const nodes: GraphNode[] = modulesData.data.map(m => ({
        id: m.id,
        kind: m.kind,
        name: m.name,
        file_id: m.file_id,
        start_line: m.start_line,
        end_line: m.end_line,
        importance: m.importance,
      }))
      setVisibleNodes(nodes)
      setGraphState({ phase: 'overview' })
    }
  }, [modulesData, setGraphState])

  // Drill-down mutation: fetch children of a container node
  const childrenMutation = useMutation({
    mutationFn: (nodeId: number) => api.children(nodeId),
  })

  // Track last processed mutation to avoid re-processing
  const lastProcessedMutationRef = useRef<string | undefined>(undefined)

  // Process mutation result
  useEffect(() => {
    const mutationKey = childrenMutation.data
      ? `${childrenMutation.variables}-${JSON.stringify(childrenMutation.data.nodes.length)}`
      : undefined
    if (childrenMutation.data && mutationKey !== lastProcessedMutationRef.current) {
      lastProcessedMutationRef.current = mutationKey
      const data = childrenMutation.data
      const nodeId = childrenMutation.variables as number
      const clickedNode = nodesRef.current.find(n => n.id === nodeId)
      if (!clickedNode) return

      // Merge children into visible set (deduplicate by id)
      const existingIds = new Set(nodesRef.current.map(n => n.id))
      const newNodes = data.nodes.filter(n => !existingIds.has(n.id))
      const existingEdgeKeys = new Set(
        edgesRef.current.map(e => `${e.source}-${e.target}-${e.kind}`)
      )
      const newEdges = data.edges.filter(
        e => !existingEdgeKeys.has(`${e.source}-${e.target}-${e.kind}`)
      )

      setVisibleNodes(prev => [...prev, ...newNodes])
      setVisibleEdges(prev => [...prev, ...newEdges])

      // Update state machine
      const phase =
        clickedNode.kind === 'Module' ? 'moduleFocused' :
        clickedNode.kind === 'Class' || clickedNode.kind === 'Interface' ? 'classFocused' :
        'functionFocused'
      setGraphState({ phase, moduleId: nodeId, moduleName: clickedNode.name } as never)

      // Push breadcrumb
      pushBreadcrumb(clickedNode.name, {
        phase: phase as never,
        moduleId: nodeId,
        moduleName: clickedNode.name,
      } as never)
    }
  }, [childrenMutation.data, childrenMutation.variables, setGraphState, pushBreadcrumb])

  const handleNodeDoubleClick = useCallback((id: number) => {
    const node = visibleNodes.find(n => n.id === id)
    if (!node) return
    if (CONTAINER_KINDS.has(node.kind)) {
      // Drill down into container
      childrenMutation.mutate(id)
      setDrillStack(prev => [...prev, { id, name: node.name, kind: node.kind }])
    }
  }, [visibleNodes, childrenMutation])

  // Filter by kind and search
  const filteredNodes = visibleNodes.filter(n =>
    kindFilter.has(n.kind) &&
    (!searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )
  const nodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = visibleEdges.filter(e =>
    nodeIds.has(e.source) && nodeIds.has(e.target)
  )

  const selectedNode = visibleNodes.find(n => n.id === selectedNodeId)
  const isLoading = modulesLoading && visibleNodes.length === 0
  const isEmpty = !isLoading && visibleNodes.length === 0

  return (
    <div className="h-full relative">
      {/* Empty state: no index yet */}
      {isEmpty && (
        <EmptyState
          iconKey="graph"
          title="No index found"
          description="Run astera index to parse your codebase into a queryable graph."
          action={{ label: 'View setup guide', onClick: () => window.open('https://github.com/astera/astera#usage', '_blank') }}
        />
      )}

      {/* Graph */}
      <GraphCanvas
        nodes={filteredNodes}
        edges={filteredEdges}
        isLoading={isLoading}
        error={null}
        onNodeDoubleClick={handleNodeDoubleClick}
      />

      {/* Stats badges */}
      {visibleNodes.length > 0 && (
        <div className="absolute top-3 right-3 flex gap-2" style={{ zIndex: 'var(--z-minimap)' }}>
          <StatBadge label="Nodes" value={filteredNodes.length} />
          <StatBadge label="Edges" value={filteredEdges.length} />
          {drillStack.length > 0 && (
            <StatBadge label="Level" value={drillStack.length} />
          )}
        </div>
      )}

      {/* Drill-down indicator */}
      {drillStack.length > 0 && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-mono text-[11px]"
          style={{
            background: `${COLORS.surface}E0`,
            border: `1px solid ${COLORS.selection}40`,
            color: COLORS.selection,
            zIndex: 'var(--z-minimap)',
          }}
        >
          {drillStack.map(d => d.name).join(' → ')}
        </div>
      )}

      {/* Selected node detail panel */}
      {selectedNode && (
        <div
          className="absolute bottom-16 left-3 rounded-lg p-3 w-64 animate-fade-in"
          style={{
            background: `${COLORS.surface}E8`,
            border: `1px solid ${COLORS.border}`,
            zIndex: 'var(--z-minimap)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.selection }} />
            <span className="text-sm font-heading font-bold" style={{ color: COLORS.text }}>
              {selectedNode.name}
            </span>
          </div>
          <div className="text-[11px] space-y-0.5" style={{ color: COLORS.textMuted }}>
            <div>Kind: <span style={{ color: COLORS.text }}>{selectedNode.kind}</span></div>
            <div>File: <span style={{ color: COLORS.text }}>{selectedNode.file_id}</span></div>
            <div>Lines: <span style={{ color: COLORS.text }}>{selectedNode.start_line}–{selectedNode.end_line}</span></div>
            {selectedNode.importance !== undefined && (
              <div>Importance: <span style={{ color: COLORS.text }}>{(selectedNode.importance * 100).toFixed(0)}%</span></div>
            )}
            {CONTAINER_KINDS.has(selectedNode.kind) && (
              <div className="pt-1">
                <button
                  onClick={() => handleNodeDoubleClick(selectedNode.id)}
                  className="text-[11px] px-2 py-0.5 rounded transition-colors"
                  style={{
                    background: `${COLORS.selection}20`,
                    color: COLORS.selection,
                    border: `1px solid ${COLORS.selection}40`,
                  }}
                >
                  Explore inside →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {visibleNodes.length > 0 && (
        <div
          className="absolute bottom-3 right-3 px-2 py-1 rounded text-[10px] font-mono"
          style={{
            background: `${COLORS.surface}C0`,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.textDim,
            zIndex: 'var(--z-minimap)',
          }}
        >
          Press <kbd className="mx-0.5 px-1 py-0.5 rounded" style={{ background: COLORS.surfaceDim, border: `1px solid ${COLORS.border}` }}>?</kbd> for shortcuts
        </div>
      )}

      {/* Overlay panels */}
      <OverlayPanel id="symbols" title="Symbols"><SymbolsPanel /></OverlayPanel>
      <OverlayPanel id="files" title="Files"><FilesPanel /></OverlayPanel>
      <OverlayPanel id="metrics" title="Metrics"><MetricsPanel /></OverlayPanel>
      <OverlayPanel id="impact" title="Impact Analysis"><ImpactPanel /></OverlayPanel>
      <OverlayPanel id="settings" title="Settings"><SettingsPanel /></OverlayPanel>
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="px-2.5 py-1 rounded font-mono text-xs"
      style={{
        background: `${COLORS.surface}D0`,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.textMuted,
      }}
    >
      <span style={{ color: COLORS.text }}>{value.toLocaleString()}</span>
      {' '}
      <span className="text-[10px]">{label}</span>
    </div>
  )
}
