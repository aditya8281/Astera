import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUIStore } from '../../store'
import { api } from '../../api'
import { NODE_COLORS, COLORS } from '../../constants'
import { SearchIcon, ClockIcon } from '../Common/Icons'
import type { SymbolNode } from '../../types'

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const selectNode = useUIStore((s) => s.selectNode)
  const addRecentSearch = useUIStore((s) => s.addRecentSearch)
  const recentSearches = useUIStore((s) => s.recentSearches)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['command-palette', query],
    queryFn: () => api.search(query),
    enabled: query.length >= 1,
  })

  const results = data?.data || []

  // Show recent searches when empty
  const showRecent = query.length === 0 && recentSearches.length > 0

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = useCallback((symbol: SymbolNode) => {
    if (symbol.id !== null) {
      selectNode(symbol.id)
      // Focus camera would need graph positions — skip for now
    }
    addRecentSearch(query)
    setOpen(false)
  }, [query, selectNode, addRecentSearch, setOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = results
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (items[selectedIndex]) handleSelect(items[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }, [results, selectedIndex, handleSelect, setOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[15vh] animate-fade-in"
      style={{ zIndex: 'var(--z-command-palette)' }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg rounded-xl overflow-hidden animate-slide-up"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: COLORS.border }}>
          <span style={{ color: COLORS.textMuted }}><SearchIcon size={16} /></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search symbols, files, modules..."
            className="flex-1 bg-transparent text-sm font-body outline-none"
            style={{ color: COLORS.text }}
          />
          <kbd
            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: COLORS.surfaceDim, color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {showRecent && (
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1" style={{ color: COLORS.textDim }}>
                Recent searches
              </div>
              {recentSearches.slice(0, 5).map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s); inputRef.current?.focus() }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors"
                  style={{ color: COLORS.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.surfaceHover}`)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span><ClockIcon size={12} color={COLORS.textDim} /></span>
                  <span className="font-mono">{s}</span>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1" style={{ color: COLORS.textDim }}>
                Results
              </div>
              {results.map((symbol, i) => (
                <button
                  key={symbol.id ?? i}
                  onClick={() => handleSelect(symbol)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors"
                  style={{
                    background: i === selectedIndex ? `${COLORS.selection}15` : 'transparent',
                    color: COLORS.text,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: NODE_COLORS[symbol.kind] || COLORS.inactive }}
                  />
                  <span className="text-xs font-mono truncate flex-1">{symbol.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: COLORS.surfaceDim, color: COLORS.textMuted }}>
                    {symbol.kind}
                  </span>
                  <span className="text-[10px]" style={{ color: COLORS.textDim }}>
                    L{symbol.span.start_line}
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 1 && results.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>
              No results for "{query}"
            </div>
          )}

          {query.length === 0 && !showRecent && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>
              Type to search across all symbols, files, and modules
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] font-mono" style={{ borderColor: COLORS.border, color: COLORS.textDim }}>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
