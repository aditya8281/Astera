import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { NODE_COLORS, COLORS } from '../constants'
import type { ImpactResponse } from '../types'
import { AlertIcon, ArrowRightIcon } from '../components/Common/Icons'

export function ImpactPage() {
  const [rootId, setRootId] = useState('')
  const [maxDepth, setMaxDepth] = useState('5')
  const [direction, setDirection] = useState('forward')
  const [searchName, setSearchName] = useState('')

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
      <h2 className="text-lg font-heading font-bold mb-4" style={{ color: COLORS.text }}>Impact Analysis</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Search symbol for root..."
          aria-label="Search symbol for impact root"
          className="flex-1 px-3 py-2 rounded text-xs font-mono outline-none"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
        <input
          type="number"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          min={1} max={20}
          aria-label="Max analysis depth"
          className="w-20 px-3 py-2 rounded text-xs font-mono outline-none"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          aria-label="Analysis direction"
          className="px-3 py-2 rounded text-xs font-mono outline-none cursor-pointer"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        >
          <option value="forward">Forward (who affects)</option>
          <option value="reverse">Reverse (what affects me)</option>
        </select>
      </div>

      {searchResults.length > 0 && rootId === '' && (
        <div className="mb-4 rounded-lg p-3 max-h-40 overflow-auto" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.textDim }}>Click a symbol to set as root</p>
          {searchResults.map((s) => (
            <button
              key={s.id}
              onClick={() => { setRootId(String(s.id)); setSearchName('') }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left transition-colors"
              style={{ color: COLORS.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[s.kind] || COLORS.inactive }} />
              <span className="text-xs font-mono">{s.name}</span>
              <span className="text-[10px] ml-auto" style={{ color: COLORS.textDim }}>{s.kind}</span>
            </button>
          ))}
        </div>
      )}

      {rootId && (
        <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: COLORS.textMuted }}>
          <span>Root:</span>
          <span className="font-mono" style={{ color: COLORS.relationship }}>#{rootId}</span>
          {impact && <span className="font-mono" style={{ color: COLORS.text }}>{impact.root_name}</span>}
          <button onClick={() => setRootId('')} className="ml-2 hover:underline" style={{ color: COLORS.error }}>clear</button>
        </div>
      )}

      {isLoading && rootId && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      )}

      {error && rootId && (
        <div className="text-sm" style={{ color: COLORS.error }}>Failed to run impact analysis. Check that the API server is running.</div>
      )}

      {impact && (
        <>
          <div className="flex gap-4 mb-4">
            <div className="rounded px-4 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-[10px] font-mono" style={{ color: COLORS.textDim }}>Affected</p>
              <p className="text-xl font-heading font-bold" style={{ color: COLORS.relationship }}>{impact.total_affected}</p>
            </div>
            <div className="rounded px-4 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-[10px] font-mono" style={{ color: COLORS.textDim }}>Max Depth</p>
              <p className="text-xl font-heading font-bold" style={{ color: COLORS.text }}>{impact.max_depth}</p>
            </div>
            {impact.cycle_detected && (
              <div className="rounded px-4 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.error}40` }}>
                <p className="text-[10px]" style={{ color: COLORS.error }}>Cycle Detected</p>
                <p className="text-xl font-heading font-bold" style={{ color: COLORS.error }}><AlertIcon size={20} color={COLORS.error} /></p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <div className="space-y-0.5">
              {impact.affected.map((node) => (
                <div
                  key={node.node_id}
                  className="flex items-center gap-3 px-3 py-2 rounded transition-colors"
                  style={{ color: COLORS.text }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="flex items-center w-8 justify-end" style={{ color: COLORS.textDim }}>
                    {Array.from({ length: Math.min(node.depth, 5) }, (_, i) => (
                      <ArrowRightIcon key={i} size={8} color={COLORS.textDim} />
                    ))}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[node.kind] || COLORS.inactive }} />
                  <span className="text-xs font-mono flex-1 truncate">{node.name}</span>
                  <span className="text-[10px]" style={{ color: COLORS.textDim }}>{node.kind}</span>
                  <span className="text-[10px]" style={{ color: COLORS.textDim }}>L{node.depth}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
