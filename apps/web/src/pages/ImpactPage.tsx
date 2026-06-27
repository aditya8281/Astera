import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { NODE_COLORS } from '../types'
import type { ImpactResponse } from '../types'

export function ImpactPage() {
  const [rootId, setRootId] = useState<string>('')
  const [maxDepth, setMaxDepth] = useState<string>('5')
  const [direction, setDirection] = useState<string>('forward')
  const [searchName, setSearchName] = useState('')

  // Search for a symbol to pick as root
  const { data: searchData } = useQuery({
    queryKey: ['search', searchName],
    queryFn: () => api.search(searchName),
    enabled: searchName.length >= 2,
  })

  const searchResults = searchData?.data || []

  const { data, isLoading, error } = useQuery({
    queryKey: ['impact', rootId, maxDepth, direction],
    queryFn: () => api.impact(Number(rootId), Number(maxDepth) || 5, direction),
    enabled: rootId !== '',
  })

  const impact: ImpactResponse | undefined = data?.data

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Impact Analysis</h2>

      {/* Input controls */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Search symbol for root…"
          className="bg-bg-surface border border-border-subtle rounded px-3 py-2 text-xs text-text-primary placeholder-text-muted flex-1 focus:outline-none focus:border-accent-cyan"
        />
        <input
          type="number"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          min={1}
          max={20}
          className="bg-bg-surface border border-border-subtle rounded px-3 py-2 text-xs text-text-primary w-20 focus:outline-none focus:border-accent-cyan"
          title="Max depth"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-bg-surface border border-border-subtle rounded px-3 py-2 text-xs text-text-primary focus:outline-none"
        >
          <option value="forward">Forward (who affects)</option>
          <option value="reverse">Reverse (what affects me)</option>
        </select>
      </div>

      {/* Search results — click to set as root */}
      {searchResults.length > 0 && rootId === '' && (
        <div className="mb-4 bg-bg-surface border border-border-subtle rounded-lg p-3 max-h-40 overflow-auto">
          <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Click a symbol to set as root</p>
          {searchResults.map((s) => (
            <button
              key={s.id}
              onClick={() => { setRootId(String(s.id)); setSearchName('') }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-bg-card transition-colors text-left"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[s.kind] || '#64748b' }} />
              <span className="text-xs text-text-primary font-mono">{s.name}</span>
              <span className="text-[10px] text-text-muted ml-auto">{s.kind}</span>
            </button>
          ))}
        </div>
      )}

      {/* Root selected */}
      {rootId && (
        <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
          <span>Root:</span>
          <span className="text-accent-cyan font-mono">#{rootId}</span>
          {impact && <span className="text-text-primary font-mono">{impact.root_name}</span>}
          <button onClick={() => setRootId('')} className="text-accent-rose ml-2 hover:underline">clear</button>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading && rootId && (
        <div className="text-text-muted text-sm animate-pulse">Analyzing impact…</div>
      )}
      {error && rootId && (
        <div className="text-accent-rose text-sm">Failed to run impact analysis. Check that the API server is running.</div>
      )}

      {/* Results */}
      {impact && (
        <>
          {/* Summary */}
          <div className="flex gap-4 mb-4">
            <div className="bg-bg-surface border border-border-subtle rounded px-4 py-2">
              <p className="text-[10px] text-text-muted">Affected</p>
              <p className="text-xl font-bold text-accent-cyan">{impact.total_affected}</p>
            </div>
            <div className="bg-bg-surface border border-border-subtle rounded px-4 py-2">
              <p className="text-[10px] text-text-muted">Max Depth</p>
              <p className="text-xl font-bold text-text-primary">{impact.max_depth}</p>
            </div>
            {impact.cycle_detected && (
              <div className="bg-bg-surface border border-accent-rose/30 rounded px-4 py-2">
                <p className="text-[10px] text-accent-rose">Cycle Detected</p>
                <p className="text-xl font-bold text-accent-rose">⚠</p>
              </div>
            )}
          </div>

          {/* Affected list */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-1">
              {impact.affected.map((node) => (
                <div
                  key={node.node_id}
                  className="flex items-center gap-3 px-3 py-2 rounded bg-bg-surface hover:bg-bg-card transition-colors"
                >
                  {/* Depth indicator */}
                  <span className="text-[10px] text-text-muted w-6 text-right" title="Depth from root">
                    {'→'.repeat(Math.min(node.depth, 5))}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: NODE_COLORS[node.kind] || '#64748b' }}
                  />
                  <span className="text-xs text-text-primary font-mono flex-1 truncate">{node.name}</span>
                  <span className="text-[10px] text-text-muted">{node.kind}</span>
                  <span className="text-[10px] text-text-muted">L{node.depth}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
