import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { COLORS } from '../constants'
import type { MetricsResponse } from '../types'
import { CheckIcon } from '../components/Common/Icons'

export function MetricsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="space-y-3 w-96">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-sm" style={{ color: COLORS.error }}>Failed to load metrics. Ensure astera serve is running.</div>
        <div className="text-xs font-mono px-3 py-2 rounded" style={{ background: COLORS.surface, color: COLORS.textMuted }}>
          astera serve --port 8080
        </div>
      </div>
    )
  }

  const m: MetricsResponse | undefined = data?.data
  if (!m) return null

  const complexityColor = m.avg_complexity > 10 ? COLORS.error : m.avg_complexity > 5 ? COLORS.warning : COLORS.success

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="text-lg font-heading font-bold mb-6" style={{ color: COLORS.text }}>Code Metrics</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Functions" value={String(m.function_count)} color={COLORS.selection} />
        <MetricCard label="Modules" value={String(m.module_count)} color={COLORS.ai} />
        <MetricCard label="Avg Complexity" value={m.avg_complexity.toFixed(1)} color={complexityColor} />
        <MetricCard label="Max Complexity" value={String(m.max_complexity)} color={m.max_complexity > 15 ? COLORS.error : COLORS.text} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard label="Total Nodes" value={m.total_nodes.toLocaleString()} color={COLORS.relationship} />
        <MetricCard label="Total Edges" value={m.total_edges.toLocaleString()} color={COLORS.relationshipDim} />
        <MetricCard label="Total Files" value={m.total_files.toLocaleString()} color={COLORS.textMuted} />
      </div>

      {m.circular_dependencies.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-heading font-bold mb-3" style={{ color: COLORS.error }}>Circular Dependencies</h3>
          <div className="space-y-2">
            {m.circular_dependencies.map(([a, b], i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono" style={{ background: COLORS.surface, color: COLORS.error }}>
                <span className="truncate">{a}</span>
                <span style={{ color: COLORS.textDim }}>↔</span>
                <span className="truncate">{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.circular_dependencies.length === 0 && (
        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-sm font-heading font-bold mb-3" style={{ color: COLORS.success }}><CheckIcon size={14} color={COLORS.success} /> No Circular Dependencies</h3>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>All module dependencies flow in one direction (no cycles).</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: COLORS.textDim }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.success }} /> Low (1-5)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.warning }} /> Medium (6-10)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.error }} /> High (11+)</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>{label}</p>
      <p className="text-2xl font-heading font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
