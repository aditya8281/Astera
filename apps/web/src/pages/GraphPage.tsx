import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { GraphCanvas } from '../components/Graph/GraphCanvas'
import { ParticleField } from '../components/Graph/ParticleField'
import { OverlayPanel } from '../components/Overlay/OverlayPanel'
import { SymbolsPanel } from './panels/SymbolsPanel'
import { FilesPanel } from './panels/FilesPanel'
import { MetricsPanel } from './panels/MetricsPanel'
import { ImpactPanel } from './panels/ImpactPanel'
import { BrokenRefsPanel } from './panels/BrokenRefsPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { useUIStore } from '../store'
import { COLORS, NODE_COLORS } from '../constants'
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
  const queryClient = useQueryClient()

  // Progressive loading state
  const [visibleNodes, setVisibleNodes] = useState<GraphNode[]>([])
  const [visibleEdges, setVisibleEdges] = useState<GraphEdge[]>([])
  const [drillStack, setDrillStack] = useState<Array<{ id: number; name: string; kind: string; nodes: GraphNode[]; edges: GraphEdge[] }>>([])
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] })
    },
  })

  // Dependency subtree mutation: BFS through all edges for a leaf node
  const subtreeMutation = useMutation({
    mutationFn: (nodeId: number) => api.subtree(nodeId, 5),
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

  // Process subtree mutation result
  const lastProcessedSubtreeRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const mutationKey = subtreeMutation.data
      ? `${subtreeMutation.variables}-${subtreeMutation.data.nodes.length}`
      : undefined
    if (subtreeMutation.data && mutationKey !== lastProcessedSubtreeRef.current) {
      lastProcessedSubtreeRef.current = mutationKey
      const data = subtreeMutation.data
      const nodeId = subtreeMutation.variables as number
      const clickedNode = nodesRef.current.find(n => n.id === nodeId)
      if (!clickedNode) return

      // Merge subtree into visible set (deduplicate by id)
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
      setGraphState({ phase: 'moduleFocused', moduleId: nodeId, moduleName: clickedNode.name })
      pushBreadcrumb(clickedNode.name + ' (subtree)', {
        phase: 'moduleFocused',
        moduleId: nodeId,
        moduleName: clickedNode.name,
      })
    }
  }, [subtreeMutation.data, subtreeMutation.variables, setGraphState, pushBreadcrumb])

  const handleNodeDoubleClick = useCallback((id: number) => {
    const node = visibleNodes.find(n => n.id === id)
    if (!node) return
    if (CONTAINER_KINDS.has(node.kind)) {
      // Drill down into container
      childrenMutation.mutate(id)
      setDrillStack(prev => [...prev, { id, name: node.name, kind: node.kind, nodes: [...visibleNodes], edges: [...visibleEdges] }])
    } else {
      // For leaf nodes: fetch full dependency subtree (callers + callees recursively)
      subtreeMutation.mutate(id)
      setDrillStack(prev => [...prev, { id, name: node.name, kind: node.kind, nodes: [...visibleNodes], edges: [...visibleEdges] }])
    }
  }, [visibleNodes, childrenMutation, subtreeMutation])

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

      {/* Particle constellation background */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <ParticleField />
      </div>

      {/* Graph */}
      <GraphCanvas
        nodes={filteredNodes}
        edges={filteredEdges}
        isLoading={isLoading}
        error={null}
        onNodeDoubleClick={handleNodeDoubleClick}
      />

      {/* Stats badges — staggered entrance */}
      {visibleNodes.length > 0 && (
        <div className="absolute top-3 right-3 flex gap-2" style={{ zIndex: 'var(--z-minimap)' }} role="status" aria-live="polite">
          <StatBadge label="Nodes" value={filteredNodes.length} delay={0} />
          <StatBadge label="Edges" value={filteredEdges.length} delay={1} />
          {drillStack.length > 0 && (
            <StatBadge label="Level" value={drillStack.length} delay={2} />
          )}
        </div>
      )}

      {/* Drill-down breadcrumb — clickable to navigate back */}
      {drillStack.length > 0 && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full font-mono text-[11px] animate-slide-up-panel"
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            zIndex: 'var(--z-minimap)',
          }}
          role="navigation"
          aria-label="Drill-down breadcrumb"
        >
          <button
            onClick={() => {
              // Reset to overview: reload modules, clear drill state
              loadedModulesRef.current = false
              setDrillStack([])
              setVisibleNodes([])
              setVisibleEdges([])
              setGraphState({ phase: 'overview' })
            }}
            className="transition-colors cursor-pointer"
            style={{ color: COLORS.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.selection)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
          >
            Overview
          </button>
          {drillStack.map((d, i) => (
            <span key={d.id} className="flex items-center gap-1">
              <span style={{ color: COLORS.textDim }}>→</span>
              <button
                onClick={() => {
                  // Restore snapshot from this drill level
                  const snapshot = drillStack[i]
                  setVisibleNodes(snapshot.nodes)
                  setVisibleEdges(snapshot.edges)
                  setDrillStack(drillStack.slice(0, i + 1))
                }}
                className="transition-colors cursor-pointer"
                style={{ color: i === drillStack.length - 1 ? COLORS.selection : COLORS.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.selection)}
                onMouseLeave={(e) => (e.currentTarget.style.color = i === drillStack.length - 1 ? COLORS.selection : COLORS.textMuted)}
              >
                {d.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Selected node detail panel — scale-in from origin */}
      {selectedNode && (
        <div
          className="absolute bottom-16 left-3 rounded-lg p-3 w-64 animate-scale-in"
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            zIndex: 'var(--z-minimap)',
            transformOrigin: 'bottom left',
          }}
          role="region"
          aria-label={`Details for ${selectedNode.name}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: NODE_COLORS[selectedNode.kind] || COLORS.nodeDefault }}
            />
            <span className="text-sm font-heading font-bold" style={{ color: COLORS.text }}>
              {selectedNode.name}
            </span>
          </div>
          <div className="text-[11px] space-y-0.5" style={{ color: COLORS.textMuted }}>
            <div className="flex items-center gap-1">
              <span style={{ color: COLORS.textDim }}>Kind</span>
              <span
                className="px-1 rounded text-[10px]"
                style={{
                  background: `${NODE_COLORS[selectedNode.kind] || COLORS.nodeDefault}20`,
                  color: NODE_COLORS[selectedNode.kind] || COLORS.text,
                }}
              >
                {selectedNode.kind}
              </span>
            </div>
            <div>
              <span style={{ color: COLORS.textDim }}>Lines </span>
              <span className="font-mono" style={{ color: COLORS.text }}>
                {selectedNode.start_line}–{selectedNode.end_line}
              </span>
            </div>
            {selectedNode.importance !== undefined && (
              <div>
                <span style={{ color: COLORS.textDim }}>Impact </span>
                <span className="font-mono" style={{ color: COLORS.text }}>
                  {(selectedNode.importance * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {CONTAINER_KINDS.has(selectedNode.kind) && (
              <div className="pt-1">
                <button
                  onClick={() => handleNodeDoubleClick(selectedNode.id)}
                  className="text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer"
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
            background: COLORS.surface,
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
      <OverlayPanel id="broken-refs" title="Broken References"><BrokenRefsPanel /></OverlayPanel>
      <OverlayPanel id="settings" title="Settings"><SettingsPanel /></OverlayPanel>
    </div>
  )
}

function StatBadge({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    const duration = 400
    const start = performance.now()
    const from = display
    let raf: number
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <div
      className="px-2.5 py-1 rounded font-mono text-xs animate-fade-in"
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.textMuted,
        animationDelay: `${delay * 50}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <span style={{ color: COLORS.text }}>{display.toLocaleString()}</span>
      {' '}
      <span className="text-[10px]">{label}</span>
    </div>
  )
}
