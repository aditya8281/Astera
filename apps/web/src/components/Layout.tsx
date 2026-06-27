import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar/Sidebar'
import { CommandPalette } from './CommandPalette/CommandPalette'
import { PerformanceOverlay } from './Telemetry/PerformanceOverlay'
import { KeyboardShortcuts } from './Common/KeyboardShortcuts'
import { useKeyboard } from '../hooks/useKeyboard'
import { useUIStore } from '../store'

export function Layout() {
  useKeyboard()

  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded)
  const showTelemetry = useUIStore((s) => s.settings.showPerformanceTelemetry)

  // Trigger FOUC prevention
  useEffect(() => {
    document.getElementById('root')?.classList.add('loaded')
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main
        className="flex-1 relative overflow-hidden transition-all duration-panel ease-out-expo"
        style={{ marginLeft: sidebarExpanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-width)' }}
      >
        <Outlet />
      </main>

      {/* Command palette overlay */}
      <CommandPalette />

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcuts />

      {/* Performance telemetry overlay */}
      {showTelemetry && <PerformanceOverlay />}
    </div>
  )
}
