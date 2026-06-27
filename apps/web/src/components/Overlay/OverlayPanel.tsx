import { useEffect, useCallback } from 'react'
import { useUIStore } from '../../store'
import { COLORS } from '../../constants'
import type { PanelId } from '../../types'
import { CloseIcon } from '../Common/Icons'

interface OverlayPanelProps {
  id: PanelId
  title: string
  children: React.ReactNode
  width?: number
}

export function OverlayPanel({ id, title, children, width = 380 }: OverlayPanelProps) {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const isOpen = activePanel === id

  const handleClose = useCallback(() => {
    setActivePanel(null)
  }, [setActivePanel])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.4)', zIndex: 'var(--z-panel)' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col animate-slide-in-right overflow-hidden"
        style={{
          width: window.innerWidth <= 768 ? '100vw' : width,
          background: COLORS.surfaceDim,
          borderLeft: `1px solid ${COLORS.border}`,
          zIndex: 'calc(var(--z-panel) + 1)',
        }}
        role="dialog"
        aria-label={title}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <h2
            className="text-sm font-heading font-bold tracking-wide uppercase"
            style={{ color: COLORS.text }}
          >
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
            style={{ color: COLORS.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
            aria-label="Close panel"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  )
}
