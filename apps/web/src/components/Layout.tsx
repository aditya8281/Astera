import { useEffect, useState } from 'react'
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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Trigger FOUC prevention
  useEffect(() => {
    document.getElementById('root')?.classList.add('loaded')
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop */}
      <main
        className="flex-1 relative overflow-hidden transition-all duration-panel ease-out-expo"
        style={{ marginLeft: isMobile ? '0px' : sidebarExpanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-width)' }}
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
