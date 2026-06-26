import { create } from 'zustand'

interface UIState {
  selectedNodeId: number | null
  hoveredNodeId: number | null
  showLabels: boolean
  kindFilter: Set<string>
  searchQuery: string
  setSelectedNode: (id: number | null) => void
  setHoveredNode: (id: number | null) => void
  toggleLabels: () => void
  toggleKind: (kind: string) => void
  setSearchQuery: (q: string) => void
  resetFilters: () => void
}

const ALL_KINDS = new Set([
  'Function', 'Method', 'Class', 'Interface', 'Enum',
  'Module', 'Variable', 'Import', 'TypeAlias', 'Macro',
])

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  hoveredNodeId: null,
  showLabels: true,
  kindFilter: ALL_KINDS,
  searchQuery: '',
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleKind: (kind) =>
    set((s) => {
      const next = new Set(s.kindFilter)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return { kindFilter: next }
    }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  resetFilters: () => set({ kindFilter: ALL_KINDS, searchQuery: '', selectedNodeId: null }),
}))
