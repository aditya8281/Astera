import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useUIStore } from '../../store'
import { COLORS } from '../../constants'
import { ClipboardIcon, TreeIcon, ImpactIcon, MetricsIcon } from './Icons'

// ─── Types ───

interface ContextMenuProps {
  nodeName: string
  nodeKind: string
  position: { x: number; y: number }
  onClose: () => void
}

// ─── Menu item definition ───

interface MenuItem {
  icon: ReactNode
  label: string
  action: () => void
  separator?: boolean
}

// ─── Component ───

export function ContextMenu({ nodeName, nodeKind, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(nodeName).catch(() => {})
    onClose()
  }, [nodeName, onClose])

  const handleShowInTree = useCallback(() => {
    useUIStore.getState().setActivePanel('symbols')
    onClose()
  }, [onClose])

  const handleImpactFromHere = useCallback(() => {
    useUIStore.getState().setActivePanel('impact')
    onClose()
  }, [onClose])

  const handleMetricsForThis = useCallback(() => {
    useUIStore.getState().setActivePanel('metrics')
    onClose()
  }, [onClose])

  // ─── Build menu items ───

  const items: MenuItem[] = [
    { icon: <ClipboardIcon size={14} />, label: 'Copy name', action: handleCopyName },
    { icon: <TreeIcon size={14} />, label: 'Show in tree', action: handleShowInTree },
    { icon: <ImpactIcon size={14} />, label: 'Impact from here', action: handleImpactFromHere },
    { icon: null as any, label: '', action: () => {}, separator: true },
    { icon: <MetricsIcon size={14} />, label: 'Metrics for this', action: handleMetricsForThis },
  ]

  // ─── Close on click outside ───

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    // Delay to avoid the opening click itself closing the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // ─── Clamp to viewport ───

  const MENU_WIDTH = 200
  const MENU_HEIGHT = 200

  const x = Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)
  const y = Math.min(position.y, window.innerHeight - MENU_HEIGHT - 8)

  // ─── Render ───

  return (
    <div
      ref={menuRef}
      className="fixed"
      style={{
        left: Math.max(x, 8),
        top: Math.max(y, 8),
        width: MENU_WIDTH,
        zIndex: 'var(--z-tooltip)',
      }}
    >
      <div
        className="rounded-lg overflow-hidden py-1 animate-fade-in"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          /* no shadow — tonal depth only */
        }}
      >
        {/* Header — node identity */}
        <div
          className="px-3 py-2 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <div
            className="text-[10px] uppercase tracking-wider font-semibold truncate"
            style={{ color: COLORS.textDim }}
          >
            {nodeKind}
          </div>
          <div
            className="text-xs font-mono truncate mt-0.5"
            style={{ color: COLORS.text }}
          >
            {nodeName}
          </div>
        </div>

        {/* Items */}
        {items.map((item, i) => {
          if (item.separator) {
            return (
              <div
                key={`sep-${i}`}
                className="my-1 mx-2"
                style={{ height: 1, background: COLORS.border }}
              />
            )
          }

          return (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors"
              style={{ color: COLORS.text }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="flex-shrink-0 w-4 flex items-center justify-center" style={{ lineHeight: 1 }}>
                {item.icon}
              </span>
              <span className="font-body">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
