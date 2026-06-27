import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { NODE_COLORS, COLORS } from '../constants'
import { useUIStore } from '../store'

export function SymbolsPage() {
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const selectNode = useUIStore((s) => s.selectNode)

  const { data, isLoading } = useQuery({
    queryKey: ['symbols', kind, search],
    queryFn: () => {
      if (search) return api.search(search)
      return api.symbols(kind ? { kind } : undefined)
    },
  })

  const symbols = data?.data || []

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-lg font-heading font-bold mb-4" style={{ color: COLORS.text }}>Symbols</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search functions, classes, and variables..."
          aria-label="Search symbols"
          className="flex-1 px-3 py-2 rounded text-xs font-mono outline-none"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Filter by symbol kind"
          className="px-3 py-2 rounded text-xs font-mono outline-none cursor-pointer"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        >
          <option value="">All kinds</option>
          {Object.keys(NODE_COLORS).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>{symbols.length} symbols</p>
          <div className="space-y-0.5">
            {symbols.map((s, i) => (
              <button
                key={s.id ?? i}
                onClick={() => { if (s.id !== null) selectNode(s.id) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors"
                style={{ color: COLORS.text }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[s.kind] || COLORS.inactive }} />
                <span className="text-xs font-mono flex-1">{s.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: COLORS.surfaceDim, color: COLORS.textMuted }}>{s.kind}</span>
                <span className="text-[10px]" style={{ color: COLORS.textDim }}>L{s.span.start_line}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
