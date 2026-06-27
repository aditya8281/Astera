import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { GraphScene } from '../components/Graph/GraphScene'
import { OverlayPanel } from '../components/Overlay/OverlayPanel'
import { SymbolsPanel } from './panels/SymbolsPanel'
import { FilesPanel } from './panels/FilesPanel'
import { MetricsPanel } from './panels/MetricsPanel'
import { ImpactPanel } from './panels/ImpactPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { useUIStore } from '../store'
import { COLORS } from '../constants'

export function GraphPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['graph'],
    queryFn: () => api.dependencyGraph(),
  })

  const selectedNodeId = useUIStore((s) => s.selectedNodeId)

  // Filter by search
  const searchQuery = useUIStore((s) => s.searchQuery)
  const kindFilter = useUIStore((s) => s.kindFilter)

  const filteredNodes = data?.nodes.filter(n =>
    kindFilter.has(n.kind) &&
    (!searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || data?.nodes || []

  const nodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = data?.edges.filter(e =>
    nodeIds.has(e.source) && nodeIds.has(e.target)
  ) || []

  const selectedNode = data?.nodes.find(n => n.id === selectedNodeId)

  return (
    <div className="h-full relative">
      {/* Graph */}
      <GraphScene
        nodes={filteredNodes}
        edges={filteredEdges}
        isLoading={isLoading}
        error={error ? 'Failed to load graph. Make sure the API server is running.' : null}
      />

      {/* Stats badges */}
      {data && (
        <div className="absolute top-3 right-3 flex gap-2" style={{ zIndex: 'var(--z-minimap)' }}>
          <StatBadge label="Nodes" value={filteredNodes.length} />
          <StatBadge label="Edges" value={filteredEdges.length} />
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
            backdropFilter: 'blur(8px)',
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
          </div>
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
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ color: COLORS.text }}>{value.toLocaleString()}</span>
      {' '}
      <span className="text-[10px]">{label}</span>
    </div>
  )
}
