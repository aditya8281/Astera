import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { COLORS } from '../../constants'
import type { MetricsResponse } from '../../types'
import { CheckIcon } from '../../components/Common/Icons'

export function MetricsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics-panel'],
    queryFn: () => api.metrics(),
  })

  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <span className="text-xs" style={{ color: COLORS.error }}>Failed to load metrics</span>
      </div>
    )
  }

  const m: MetricsResponse | undefined = data?.data
  if (!m) return null

  const complexityColor = m.avg_complexity > 10 ? COLORS.error : m.avg_complexity > 5 ? COLORS.warning : COLORS.success

  return (
    <div className="p-3 space-y-4">
      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Functions" value={String(m.function_count)} color={COLORS.selection} />
        <MetricCard label="Modules" value={String(m.module_count)} color={COLORS.ai} />
        <MetricCard label="Nodes" value={m.total_nodes.toLocaleString()} color={COLORS.relationship} />
        <MetricCard label="Edges" value={m.total_edges.toLocaleString()} color={COLORS.relationshipDim} />
      </div>

      {/* Complexity */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>
          Complexity
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-heading font-bold" style={{ color: complexityColor }}>
                {m.avg_complexity.toFixed(1)}
              </span>
              <span className="text-[10px]" style={{ color: COLORS.textMuted }}>avg</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-heading font-bold" style={{ color: m.max_complexity > 15 ? COLORS.error : COLORS.text }}>
                {m.max_complexity}
              </span>
              <span className="text-[10px]" style={{ color: COLORS.textMuted }}>max</span>
            </div>
          </div>
        </div>
        {/* Complexity bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.bg }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((m.avg_complexity / 20) * 100, 100)}%`,
              background: complexityColor,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono" style={{ color: COLORS.textDim }}>
          <span>0</span>
          <span>low · med · high</span>
          <span>20+</span>
        </div>
      </div>

      {/* Circular deps */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>
          Circular Dependencies
        </div>
        {m.circular_dependencies.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs" style={{ background: `${COLORS.success}10`, color: COLORS.success }}>
            <CheckIcon size={12} color={COLORS.success} /> None detected
          </div>
        ) : (
          <div className="space-y-1">
            {m.circular_dependencies.map(([a, b], i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono"
                style={{ background: `${COLORS.error}08`, color: COLORS.error }}
              >
                <span className="truncate">{a}</span>
                <span style={{ color: COLORS.textDim }}>↔</span>
                <span className="truncate">{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: COLORS.textDim }}>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.success }} /> Low (1-5)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.warning }} /> Med (6-10)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.error }} /> High (11+)</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-3 py-2 rounded" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
      <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</div>
      <div className="text-base font-heading font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
