import { useState, useEffect, useCallback } from 'react'
import { COLORS } from '../../constants'

const SHORTCUTS: Array<{ key: string; action: string }> = [
  { key: 'Ctrl+K', action: 'Command palette' },
  { key: 'Ctrl+P', action: 'Pin selection' },
  { key: 'Tab', action: 'Cycle through nodes' },
  { key: 'Arrow keys', action: 'Navigate to nearest node' },
  { key: '+/−', action: 'Zoom in/out' },
  { key: 'Space', action: 'Reset to overview' },
  { key: 'Escape', action: 'Back / close panel / clear selection' },
  { key: '1-5', action: 'Toggle side panels' },
  { key: ',', action: 'Toggle settings' },
  { key: '?', action: 'Keyboard shortcuts' },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    },
    [open],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center animate-fade-in"
      style={{ zIndex: 'var(--z-command-palette)' }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-lg overflow-hidden animate-slide-up"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          /* no shadow — tonal depth only */
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>
            Keyboard Shortcuts
          </h2>
          <kbd
            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: COLORS.surfaceDim,
              color: COLORS.textDim,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: COLORS.border }}
              >
                <th
                  className="px-5 py-2.5 font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: COLORS.textDim }}
                >
                  Key
                </th>
                <th
                  className="px-5 py-2.5 font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: COLORS.textDim }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map(({ key, action }) => (
                <tr
                  key={key}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = `${COLORS.surfaceHover}`)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <td className="px-5 py-2.5">
                    <kbd
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{
                        background: COLORS.surfaceDim,
                        color: COLORS.selectionGlow,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {key}
                    </kbd>
                  </td>
                  <td
                    className="px-5 py-2.5 font-body"
                    style={{ color: COLORS.text }}
                  >
                    {action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-center px-5 py-2.5 border-t text-[10px]"
          style={{ borderColor: COLORS.border, color: COLORS.textDim }}
        >
          Press <kbd className="mx-1 px-1 py-0.5 rounded font-mono" style={{ background: COLORS.surfaceDim, border: `1px solid ${COLORS.border}` }}>?</kbd> to toggle this overlay
        </div>
      </div>
    </div>
  )
}
