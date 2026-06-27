import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { MetricsResponse } from '../types'

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg p-4">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

export function MetricsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm animate-pulse">Loading metrics…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-accent-rose text-sm">Failed to load metrics</div>
        <div className="text-text-muted text-xs max-w-md text-center">
          Make sure the Astera API server is running:<br />
          <code className="bg-bg-card px-2 py-1 rounded text-accent-cyan mt-1 inline-block">
            astera serve --port 8080
          </code>
        </div>
      </div>
    )
  }

  const m: MetricsResponse | undefined = data?.data
  if (!m) return null

  const topFunctions = m.circular_dependencies || []

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-6">Code Metrics</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Functions" value={m.function_count} color="text-accent-cyan" />
        <MetricCard label="Modules" value={m.module_count} color="text-accent-violet" />
        <MetricCard
          label="Avg Complexity"
          value={m.avg_complexity.toFixed(1)}
          color={m.avg_complexity > 10 ? 'text-accent-rose' : m.avg_complexity > 5 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <MetricCard
          label="Max Complexity"
          value={m.max_complexity}
          color={m.max_complexity > 15 ? 'text-accent-rose' : 'text-text-primary'}
        />
      </div>

      {/* Graph stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard label="Total Nodes" value={m.total_nodes.toLocaleString()} />
        <MetricCard label="Total Edges" value={m.total_edges.toLocaleString()} />
        <MetricCard label="Total Files" value={m.total_files.toLocaleString()} />
      </div>

      {/* Circular dependencies */}
      {topFunctions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-accent-rose mb-3">⚠ Circular Dependencies</h3>
          <div className="space-y-2">
            {topFunctions.map(([a, b], i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded bg-bg-surface text-xs">
                <span className="text-accent-rose font-mono">{a}</span>
                <span className="text-text-muted">↔</span>
                <span className="text-accent-rose font-mono">{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topFunctions.length === 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">✓ No Circular Dependencies</h3>
          <p className="text-xs text-text-muted">All module dependencies are acyclic.</p>
        </div>
      )}

      {/* Complexity legend */}
      <div className="flex items-center gap-4 mb-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Low (1-5)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Medium (6-10)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High (11+)</span>
      </div>
    </div>
  )
}
