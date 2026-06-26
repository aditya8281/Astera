import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Graph3D } from '../components/Graph3D'
import { useUIStore } from '../store'
import { NODE_COLORS } from '../types'

export function GraphPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['graph'],
    queryFn: () => api.dependencyGraph(),
  })

  const { selectedNodeId, searchQuery, setSearchQuery } = useUIStore()

  // Filter by search
  const filteredNodes = data?.nodes.filter(n =>
    !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || data?.nodes || []
  const nodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = data?.edges.filter(e =>
    nodeIds.has(e.source) && nodeIds.has(e.target)
  ) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm animate-pulse">Loading graph…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-accent-rose text-sm">Failed to load graph</div>
        <div className="text-text-muted text-xs max-w-md text-center">
          Make sure the Astera API server is running:<br />
          <code className="bg-bg-card px-2 py-1 rounded text-accent-cyan mt-1 inline-block">
            astera serve --port 8080
          </code>
        </div>
      </div>
    )
  }

  const selectedNode = data?.nodes.find(n => n.id === selectedNodeId)

  return (
    <div className="h-full relative">
      {/* Search overlay */}
      <div className="absolute top-4 left-4 z-10">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter nodes…"
          className="bg-bg-surface/90 backdrop-blur border border-border-subtle rounded px-3 py-2 text-xs text-text-primary placeholder-text-muted w-60 focus:outline-none focus:border-accent-cyan"
        />
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-3">
        {data && (
          <>
            <StatBadge label="Nodes" value={filteredNodes.length} color="text-accent-cyan" />
            <StatBadge label="Edges" value={filteredEdges.length} color="text-accent-violet" />
          </>
        )}
      </div>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-bg-surface/95 backdrop-blur border border-border-subtle rounded-lg p-4 w-72">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: NODE_COLORS[selectedNode.kind] || '#64748b' }}
            />
            <span className="text-sm font-semibold text-text-primary">{selectedNode.name}</span>
          </div>
          <div className="text-[11px] text-text-muted space-y-1">
            <div>Kind: <span className="text-text-primary">{selectedNode.kind}</span></div>
            <div>File ID: <span className="text-text-primary">{selectedNode.file_id}</span></div>
            <div>Lines: <span className="text-text-primary">{selectedNode.start_line}–{selectedNode.end_line}</span></div>
          </div>
        </div>
      )}

      <Graph3D nodes={filteredNodes} edges={filteredEdges} />
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-surface/90 backdrop-blur border border-border-subtle rounded px-3 py-1.5">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-text-muted ml-1">{label}</span>
    </div>
  )
}
