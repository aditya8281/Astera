import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUIStore } from '../../store'
import { NODE_COLORS, COLORS } from '../../constants'
import type { PanelId } from '../../types'
import { TreeView } from './TreeView'
import { HomeIcon, GraphIcon, SearchIcon, FunctionIcon, FilesIcon, MetricsIcon, ImpactIcon, SettingsIcon, ChevronDownIcon, ChevronRightIcon } from '../Common/Icons'

interface NavItem {
  id: PanelId
  icon: ReactNode
  label: string
  shortcut?: string
  path?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: null, icon: <HomeIcon size={16} />, label: 'Home', shortcut: '0', path: '/' },
  { id: null, icon: <GraphIcon size={16} />, label: 'Graph', shortcut: '1', path: '/graph' },
  { id: 'search', icon: <SearchIcon size={16} />, label: 'Search', shortcut: '⌘K' },
  { id: 'symbols', icon: <FunctionIcon size={16} />, label: 'Symbols', shortcut: '2' },
  { id: 'files', icon: <FilesIcon size={16} />, label: 'Files', shortcut: '3' },
  { id: 'metrics', icon: <MetricsIcon size={16} />, label: 'Metrics', shortcut: '4' },
  { id: 'impact', icon: <ImpactIcon size={16} />, label: 'Impact', shortcut: '5' },
  { id: 'settings', icon: <SettingsIcon size={16} />, label: 'Settings', shortcut: ',' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
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
    if (item.path) {
      navigate(item.path)
      return
    }
    if (item.id === 'search') {
      useUIStore.getState().setCommandPaletteOpen(true)
      return
    }
    togglePanel(item.id)
  }

  const isActive = (item: NavItem) => {
    if (item.path) return location.pathname === item.path
    return activePanel === item.id
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
          const active = isActive(item)
          return (
            <button
              key={item.id ?? 'graph'}
              onClick={() => handleNavClick(item)}
              className="w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-micro ease-out-quart relative group"
              style={{
                color: active ? COLORS.selection : COLORS.textMuted,
                background: active ? `${COLORS.selection}10` : 'transparent',
              }}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active indicator */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: COLORS.selection }}
                />
              )}

              <span className="flex-shrink-0 w-5 flex items-center justify-center">{item.icon}</span>

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
            <span>{kindExpanded ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />}</span>
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
                    className="w-3 h-3 rounded-sm border-border-subtle bg-transparent accent-accent"
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

      {/* Tree view (expanded mode only, always visible for navigation) */}
      {sidebarExpanded && (
        <div className="w-full border-t border-border-subtle overflow-y-auto max-h-64">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS.textDim }}>
            Tree
          </div>
          <TreeView />
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
