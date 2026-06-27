import { useState, useRef, useEffect, useCallback } from 'react'
import { useUIStore } from '../../store'
import { NODE_COLORS } from '../../constants'
import { COLORS } from '../../constants'
import type { PanelId } from '../../types'

interface NavItem {
  id: PanelId
  icon: string
  label: string
  shortcut?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: null, icon: '◆', label: 'Graph', shortcut: '1' },
  { id: 'search', icon: '🔍', label: 'Search', shortcut: '⌘K' },
  { id: 'symbols', icon: 'ƒ', label: 'Symbols', shortcut: '2' },
  { id: 'files', icon: '≡', label: 'Files', shortcut: '3' },
  { id: 'metrics', icon: '◈', label: 'Metrics', shortcut: '4' },
  { id: 'impact', icon: '◎', label: 'Impact', shortcut: '5' },
  { id: 'settings', icon: '⚙', label: 'Settings', shortcut: ',' },
]

export function Sidebar() {
  const {
    activePanel, togglePanel, sidebarExpanded, setSidebarExpanded,
    kindFilter, toggleKind,
  } = useUIStore()
  const [kindExpanded, setKindExpanded] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const expandTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Auto-collapse on mouse leave
  const handleMouseEnter = useCallback(() => {
    clearTimeout(expandTimeout.current)
    setSidebarExpanded(true)
  }, [setSidebarExpanded])

  const handleMouseLeave = useCallback(() => {
    expandTimeout.current = setTimeout(() => setSidebarExpanded(false), 300)
  }, [setSidebarExpanded])

  useEffect(() => () => clearTimeout(expandTimeout.current), [])

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'search') {
      useUIStore.getState().setCommandPaletteOpen(true)
      return
    }
    togglePanel(item.id)
  }

  return (
    <nav
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed left-0 top-0 h-full z-sidebar flex flex-col items-center transition-all duration-panel ease-out-expo"
      style={{
        width: sidebarExpanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-width)',
        background: COLORS.surfaceDim,
        borderRight: `1px solid ${COLORS.border}`,
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="w-full flex items-center justify-center h-12 border-b border-border-subtle">
        <span
          className="font-heading font-bold text-xs tracking-widest uppercase"
          style={{ color: COLORS.selection }}
        >
          {sidebarExpanded ? 'ASTERA' : 'A'}
        </span>
      </div>

      {/* Nav items */}
      <div className="flex-1 w-full py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activePanel === item.id
          return (
            <button
              key={item.id ?? 'graph'}
              onClick={() => handleNavClick(item)}
              className="w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-micro ease-out-quart relative group"
              style={{
                color: isActive ? COLORS.selection : COLORS.textMuted,
                background: isActive ? `${COLORS.selection}10` : 'transparent',
              }}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: COLORS.selection }}
                />
              )}

              <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>

              {sidebarExpanded && (
                <span className="text-xs font-medium truncate flex-1 text-left">
                  {item.label}
                </span>
              )}

              {sidebarExpanded && item.shortcut && (
                <span className="text-[10px] text-text-dim font-mono">{item.shortcut}</span>
              )}

              {/* Tooltip when collapsed */}
              {!sidebarExpanded && (
                <span
                  className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                  style={{
                    background: COLORS.surface,
                    color: COLORS.text,
                    border: `1px solid ${COLORS.border}`,
                    zIndex: 'var(--z-tooltip)',
                  }}
                >
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-2 text-text-dim">{item.shortcut}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Kind filter section (expanded mode only) */}
      {sidebarExpanded && (
        <div className="w-full border-t border-border-subtle px-3 py-2">
          <button
            onClick={() => setKindExpanded(!kindExpanded)}
            className="flex items-center gap-2 w-full py-1 text-[10px] uppercase tracking-wider font-semibold text-text-dim hover:text-text-muted transition-colors"
          >
            <span>{kindExpanded ? '▾' : '▸'}</span>
            Filters
          </button>

          {kindExpanded && (
            <div className="mt-1 space-y-0.5 animate-fade-in">
              {Object.entries(NODE_COLORS).map(([kind, color]) => (
                <label
                  key={kind}
                  className="flex items-center gap-2 py-0.5 text-[11px] text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={kindFilter.has(kind)}
                    onChange={() => toggleKind(kind)}
                    className="w-3 h-3 rounded-sm border-border-subtle bg-transparent accent-accent-orange"
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="truncate">{kind}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version footer */}
      {sidebarExpanded && (
        <div className="w-full px-3 py-2 border-t border-border-subtle text-[10px] text-text-dim font-mono">
          v0.1.0
        </div>
      )}
    </nav>
  )
}
