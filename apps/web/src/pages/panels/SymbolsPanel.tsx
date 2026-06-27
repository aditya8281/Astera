import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { NODE_COLORS, COLORS } from '../../constants'
import { useUIStore } from '../../store'

export function SymbolsPanel() {
  const [search, setSearch] = useState('')
  const selectNode = useUIStore((s) => s.selectNode)
  const setActivePanel = useUIStore((s) => s.setActivePanel)

  const { data, isLoading } = useQuery({
    queryKey: ['symbols-panel', search],
    queryFn: () => search.length >= 2 ? api.search(search) : api.symbols(),
  })

  const symbols = data?.data || []

  return (
    <div className="p-3 space-y-3">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search functions, classes, and variables..."
        aria-label="Search symbols"
        className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
        style={{
          background: COLORS.bg,
          color: COLORS.text,
          border: `1px solid ${COLORS.border}`,
        }}
        autoFocus
      />

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono px-2 py-1" style={{ color: COLORS.textDim }}>
            {symbols.length} symbols
          </div>
          {symbols.map((s, i) => (
            <button
              key={s.id ?? i}
              onClick={() => {
                if (s.id !== null) {
                  selectNode(s.id)
                  setActivePanel(null)
                }
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
              style={{ color: COLORS.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: NODE_COLORS[s.kind] || COLORS.inactive }}
              />
              <span className="text-xs font-mono truncate flex-1">{s.name}</span>
              <span
                className="text-[10px] font-mono px-1 rounded"
                style={{ background: COLORS.surfaceDim, color: COLORS.textMuted }}
              >
                {s.kind}
              </span>
              <span className="text-[10px]" style={{ color: COLORS.textDim }}>
                L{s.span.start_line}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
