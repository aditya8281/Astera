import { useEffect } from 'react'
import { useUIStore } from '../store'

const PANELS = ['symbols', 'files', 'metrics', 'impact', 'settings'] as const

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const store = useUIStore.getState()
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Command palette: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        store.toggleCommandPalette()
        return
      }

      // Skip if in input
      if (isInput) return

      switch (e.key) {
        case 'Escape': {
          if (store.commandPaletteOpen) {
            store.setCommandPaletteOpen(false)
          } else if (store.activePanel) {
            store.setActivePanel(null)
          } else {
            store.clearSelection()
            store.setGraphState({ phase: 'overview' })
          }
          break
        }

        case ' ':
          e.preventDefault()
          store.clearSelection()
          store.setGraphState({ phase: 'overview' })
          store.setCameraTarget(null)
          break

        case 'f':
        case 'F':
          // Focus selected node
          break

        case 'p':
        case 'P':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (store.selectedNodeId !== null) {
              store.togglePin(store.selectedNodeId)
            }
          }
          break

        case '1': case '2': case '3': case '4': case '5': {
          const idx = parseInt(e.key) - 1
          if (idx < PANELS.length) {
            store.togglePanel(PANELS[idx])
          }
          break
        }

        case ',':
          store.togglePanel('settings')
          break

        case '?':
          // TODO: keyboard shortcuts overlay
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
