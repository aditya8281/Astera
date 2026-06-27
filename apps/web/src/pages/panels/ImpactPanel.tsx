import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { NODE_COLORS, COLORS } from '../../constants'
import type { ImpactResponse } from '../../types'
import { CheckIcon, AlertIcon } from '../../components/Common/Icons'

export function ImpactPanel() {
  const [rootId, setRootId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [maxDepth, setMaxDepth] = useState('5')

  const { data: searchData } = useQuery({
    queryKey: ['impact-search', searchName],
    queryFn: () => api.search(searchName),
    enabled: searchName.length >= 2,
  })

  const searchResults = searchData?.data || []

  const { data, isLoading, error } = useQuery({
    queryKey: ['impact-panel', rootId, maxDepth],
    queryFn: () => api.impact(Number(rootId), Number(maxDepth) || 5, 'forward'),
    enabled: rootId !== '',
  })

  const impact: ImpactResponse | undefined = data?.data

  return (
    <div className="p-3 space-y-3">
      {/* Search for root */}
      <input
        type="text"
        value={searchName}
        onChange={(e) => setSearchName(e.target.value)}
        placeholder="Search symbol for root..."
        className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
        style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      />

      {/* Depth */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono" style={{ color: COLORS.textDim }}>Depth:</span>
        <input
          type="number"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          min={1}
          max={20}
          className="w-16 px-2 py-1 rounded text-xs font-mono outline-none"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && rootId === '' && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono px-1" style={{ color: COLORS.textDim }}>Click to set as root</div>
          {searchResults.map((s) => (
            <button
              key={s.id}
              onClick={() => { setRootId(String(s.id)); setSearchName('') }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
              style={{ color: COLORS.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[s.kind] || COLORS.inactive }} />
              <span className="text-xs font-mono truncate flex-1">{s.name}</span>
              <span className="text-[10px]" style={{ color: COLORS.textDim }}>{s.kind}</span>
            </button>
          ))}
        </div>
      )}

      {/* Root indicator */}
      {rootId && (
        <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
          <span>Root:</span>
          <span className="font-mono" style={{ color: COLORS.relationship }}>#{rootId}</span>
          {impact && <span className="font-mono" style={{ color: COLORS.text }}>{impact.root_name}</span>}
          <button onClick={() => setRootId('')} className="ml-auto text-[10px] hover:underline" style={{ color: COLORS.error }}>clear</button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-6 w-full" />)}
        </div>
      )}

      {error && (
        <div className="text-xs text-center py-4" style={{ color: COLORS.error }}>
          Failed to run impact analysis
        </div>
      )}

      {impact && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="px-2 py-1.5 rounded text-center" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
              <div className="text-base font-heading font-bold" style={{ color: COLORS.relationship }}>{impact.total_affected}</div>
              <div className="text-[9px] font-mono" style={{ color: COLORS.textDim }}>affected</div>
            </div>
            <div className="px-2 py-1.5 rounded text-center" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
              <div className="text-base font-heading font-bold" style={{ color: COLORS.text }}>{impact.max_depth}</div>
              <div className="text-[9px] font-mono" style={{ color: COLORS.textDim }}>depth</div>
            </div>
            <div className="px-2 py-1.5 rounded text-center" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
              <div className="text-base font-heading font-bold" style={{ color: impact.cycle_detected ? COLORS.error : COLORS.success }}>
                {impact.cycle_detected ? <AlertIcon size={16} color={COLORS.error} /> : <CheckIcon size={16} color={COLORS.success} />}
              </div>
              <div className="text-[9px] font-mono" style={{ color: COLORS.textDim }}>cycle</div>
            </div>
          </div>

          {/* Affected list */}
          <div className="space-y-0.5">
            <div className="text-[10px] font-mono px-1" style={{ color: COLORS.textDim }}>
              {impact.affected.length} affected symbols
            </div>
            {impact.affected.map((node) => (
              <div
                key={node.node_id}
                className="flex items-center gap-2 px-2 py-1 rounded transition-colors"
                style={{ color: COLORS.text }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[10px] font-mono w-4 text-right" style={{ color: COLORS.textDim }}>
                  d{node.depth}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[node.kind] || COLORS.inactive }} />
                <span className="text-[11px] font-mono truncate flex-1">{node.name}</span>
                <span className="text-[9px]" style={{ color: COLORS.textDim }}>{node.kind}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
