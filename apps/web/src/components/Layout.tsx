import { NavLink, Outlet } from 'react-router-dom'
import { useUIStore } from '../store'
import { NODE_COLORS } from '../types'

const navItems = [
  { to: '/', label: 'Graph', icon: '◆' },
  { to: '/symbols', label: 'Symbols', icon: 'ƒ' },
  { to: '/files', label: 'Files', icon: '≡' },
]

const allKinds = [
  'Function', 'Method', 'Class', 'Interface', 'Enum',
  'Module', 'Variable', 'Import', 'TypeAlias', 'Macro',
]

export function Layout() {
  const { kindFilter, toggleKind, resetFilters, showLabels, toggleLabels } = useUIStore()

  return (
    <div className="flex h-screen bg-bg-deep overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col">
        <div className="px-4 py-5 border-b border-border-subtle">
          <h1 className="text-sm font-bold tracking-widest text-text-primary uppercase">
            Astera
          </h1>
          <p className="text-[10px] text-text-muted mt-0.5">Code Property Graph</p>
        </div>

        <nav className="px-2 py-3 space-y-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-cyan/10 text-accent-cyan'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                }`
              }
            >
              <span className="text-sm">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 mt-4 border-t border-border-subtle pt-3">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">Filter by kind</p>
          <div className="space-y-1">
            {allKinds.map((kind) => (
              <label
                key={kind}
                className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={kindFilter.has(kind)}
                  onChange={() => toggleKind(kind)}
                  className="rounded border-border-subtle bg-transparent accent-accent-cyan"
                />
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: NODE_COLORS[kind] || '#64748b' }}
                />
                {kind}
              </label>
            ))}
          </div>
        </div>

        <div className="px-4 mt-3 border-t border-border-subtle pt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={toggleLabels}
              className="rounded border-border-subtle bg-transparent accent-accent-cyan"
            />
            Show labels
          </label>
          <button
            onClick={resetFilters}
            className="text-[10px] text-accent-cyan hover:underline"
          >
            Reset all filters
          </button>
        </div>

        <div className="mt-auto px-4 py-3 border-t border-border-subtle text-[10px] text-text-muted">
          Phase 1.4 · 3D Visualization
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
