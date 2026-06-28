import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { COLORS } from '../../constants'
import type { BrokenRef } from '../../types'
import { AlertIcon } from '../../components/Common/Icons'

const KIND_LABELS: Record<string, string> = {
  UnresolvedCall: 'Unresolved call',
  DeadImport: 'Dead import',
  UnresolvedRef: 'Unresolved reference',
}

const KIND_COLORS: Record<string, string> = {
  UnresolvedCall: COLORS.error,
  DeadImport: COLORS.warning,
  UnresolvedRef: COLORS.relationship,
}

export function BrokenRefsPanel() {
  const [kindFilter, setKindFilter] = useState<string | undefined>(undefined)

  const { data, isLoading, error } = useQuery({
    queryKey: ['broken-refs', kindFilter],
    queryFn: () => api.brokenRefs(kindFilter),
  })

  const refs: BrokenRef[] = data?.data || []

  // Group by kind
  const byKind = refs.reduce<Record<string, BrokenRef[]>>((acc, r) => {
    ;(acc[r.kind] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="p-3 space-y-3">
      {/* Filter buttons */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setKindFilter(undefined)}
          className="px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer"
          style={{
            background: !kindFilter ? `${COLORS.selection}20` : COLORS.bg,
            color: !kindFilter ? COLORS.selection : COLORS.textMuted,
            border: `1px solid ${!kindFilter ? COLORS.selection : COLORS.border}`,
          }}
        >
          All ({refs.length})
        </button>
        {Object.keys(byKind).map((kind) => (
          <button
            key={kind}
            onClick={() => setKindFilter(kind === kindFilter ? undefined : kind)}
            className="px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer"
            style={{
              background: kind === kindFilter ? `${KIND_COLORS[kind]}20` : COLORS.bg,
              color: kind === kindFilter ? KIND_COLORS[kind] : COLORS.textMuted,
              border: `1px solid ${kind === kindFilter ? KIND_COLORS[kind] : COLORS.border}`,
            }}
          >
            {KIND_LABELS[kind] || kind} ({byKind[kind].length})
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-6 w-full" />)}
        </div>
      )}

      {error && (
        <div className="text-xs text-center py-4" style={{ color: COLORS.error }}>
          Failed to load broken references. Re-index your project first.
        </div>
      )}

      {!isLoading && refs.length === 0 && (
        <div className="text-center py-6">
          <div style={{ opacity: 0.4 }}>
            <AlertIcon size={24} color={COLORS.textDim} />
          </div>
          <div className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
            No broken references found
          </div>
          <div className="text-[10px] mt-1" style={{ color: COLORS.textDim }}>
            Run <code className="px-1 py-0.5 rounded" style={{ background: COLORS.bg }}>astera index</code> to detect unresolved calls and dead imports
          </div>
        </div>
      )}

      {/* Grouped list */}
      {Object.entries(byKind).map(([kind, items]) => (
        <div key={kind} className="space-y-0.5">
          <div className="flex items-center gap-1.5 px-1 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLORS[kind] || COLORS.textDim }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>
              {KIND_LABELS[kind] || kind}
            </span>
            <span className="text-[10px] font-mono" style={{ color: COLORS.textDim }}>
              ({items.length})
            </span>
          </div>
          {items.map((ref) => (
            <div
              key={ref.id ?? `${ref.source_node_id}-${ref.ref_name}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
              style={{ color: COLORS.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-[11px] font-mono truncate flex-1" style={{ color: COLORS.text }}>
                {ref.ref_name}
              </span>
              {ref.target_name && ref.target_name !== ref.ref_name && (
                <span className="text-[9px] font-mono" style={{ color: COLORS.textDim }}>
                  from {ref.target_name}
                </span>
              )}
              <span className="text-[9px] font-mono" style={{ color: COLORS.textDim }}>
                L{ref.line}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
