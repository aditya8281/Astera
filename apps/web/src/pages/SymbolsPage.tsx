import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { NODE_COLORS } from '../types'

export function SymbolsPage() {
  const [kind, setKind] = useState<string>('')
  const [search, setSearch] = useState('')

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
      <h2 className="text-lg font-semibold text-text-primary mb-4">Symbols</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbols…"
          className="bg-bg-surface border border-border-subtle rounded px-3 py-2 text-xs text-text-primary placeholder-text-muted flex-1 focus:outline-none focus:border-accent-cyan"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-bg-surface border border-border-subtle rounded px-3 py-2 text-xs text-text-primary focus:outline-none"
        >
          <option value="">All kinds</option>
          {Object.keys(NODE_COLORS).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-text-muted text-sm animate-pulse">Loading…</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] text-text-muted mb-2">{symbols.length} symbols</p>
          <div className="space-y-1">
            {symbols.map((s, i) => (
              <div
                key={s.id ?? i}
                className="flex items-center gap-3 px-3 py-2 rounded bg-bg-surface hover:bg-bg-card transition-colors cursor-default group"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: NODE_COLORS[s.kind] || '#64748b' }}
                />
                <span className="text-xs text-text-primary font-mono">{s.name}</span>
                <span className="text-[10px] text-text-muted ml-auto">{s.kind}</span>
                <span className="text-[10px] text-text-muted">L{s.span.start_line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
