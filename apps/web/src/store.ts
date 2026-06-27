import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { ALL_KINDS_SET, STORAGE_KEYS, DEFAULT_SETTINGS } from './constants'
import type { Settings, PanelId, GraphState, LayoutEngine } from './types'

// ─── Load settings from localStorage ───

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s)) } catch { /* ignore */ }
}

// ─── Combined UI store ───

interface UIState {
  // Graph state machine
  graphState: GraphState
  setGraphState: (s: GraphState) => void

  // Selection
  selectedNodeId: number | null
  hoveredNodeId: number | null
  multiSelectIds: Set<number>
  pinIds: Set<number>
  selectNode: (id: number | null) => void
  setHoveredNode: (id: number | null) => void
  toggleMultiSelect: (id: number) => void
  togglePin: (id: number) => void
  clearSelection: () => void

  // Camera
  cameraTarget: [number, number, number] | null
  setCameraTarget: (pos: [number, number, number] | null) => void

  // Overlay panel
  activePanel: PanelId
  setActivePanel: (p: PanelId) => void
  togglePanel: (p: PanelId) => void

  // Kind filter
  kindFilter: Set<string>
  toggleKind: (kind: string) => void
  resetFilters: () => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void
  commandPaletteOpen: boolean
  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void

  // Recent
  recentSearches: string[]
  addRecentSearch: (q: string) => void
  recentSelections: number[]
  addRecentSelection: (id: number) => void

  // Layout
  layoutEngine: LayoutEngine
  setLayoutEngine: (l: LayoutEngine) => void

  // Settings
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void

  // Sidebar
  sidebarExpanded: boolean
  setSidebarExpanded: (v: boolean) => void

  // Breadcrumbs
  breadcrumbs: Array<{ label: string; state: GraphState }>
  pushBreadcrumb: (label: string, state: GraphState) => void
  popBreadcrumb: () => void
}

const initialSettings = loadSettings()

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    // Graph state
    graphState: { phase: 'loading' },
    setGraphState: (s) => set({ graphState: s }),

    // Selection
    selectedNodeId: null,
    hoveredNodeId: null,
    multiSelectIds: new Set<number>(),
    pinIds: new Set<number>(),
    selectNode: (id) => {
      if (id !== null) get().addRecentSelection(id)
      set({ selectedNodeId: id })
    },
    setHoveredNode: (id) => set({ hoveredNodeId: id }),
    toggleMultiSelect: (id) =>
      set((s) => {
        const next = new Set(s.multiSelectIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { multiSelectIds: next, selectedNodeId: id }
      }),
    togglePin: (id) =>
      set((s) => {
        const next = new Set(s.pinIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { pinIds: next }
      }),
    clearSelection: () => set({ selectedNodeId: null, multiSelectIds: new Set() }),

    // Camera
    cameraTarget: null,
    setCameraTarget: (pos) => set({ cameraTarget: pos }),

    // Overlay panel
    activePanel: null,
    setActivePanel: (p) => set({ activePanel: p }),
    togglePanel: (p) => set((s) => ({ activePanel: s.activePanel === p ? null : p })),

    // Kind filter
    kindFilter: new Set(ALL_KINDS_SET),
    toggleKind: (kind) =>
      set((s) => {
        const next = new Set(s.kindFilter)
        if (next.has(kind)) next.delete(kind)
        else next.add(kind)
        return { kindFilter: next }
      }),
    resetFilters: () => set({ kindFilter: new Set(ALL_KINDS_SET), searchQuery: '', selectedNodeId: null }),

    // Search
    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    commandPaletteOpen: false,
    toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

    // Recent
    recentSearches: (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.recentSearches) || '[]') } catch { return [] }
    })(),
    addRecentSearch: (q) =>
      set((s) => {
        const next = [q, ...s.recentSearches.filter(x => x !== q)].slice(0, 20)
        try { localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next)) } catch { /* */ }
        return { recentSearches: next }
      }),
    recentSelections: (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.recentSelections) || '[]') } catch { return [] }
    })(),
    addRecentSelection: (id) =>
      set((s) => {
        const next = [id, ...s.recentSelections.filter(x => x !== id)].slice(0, 20)
        try { localStorage.setItem(STORAGE_KEYS.recentSelections, JSON.stringify(next)) } catch { /* */ }
        return { recentSelections: next }
      }),

    // Layout
    layoutEngine: initialSettings.layoutEngine,
    setLayoutEngine: (l) => set({ layoutEngine: l }),

    // Settings
    settings: initialSettings,
    updateSettings: (partial) =>
      set((s) => {
        const next = { ...s.settings, ...partial }
        saveSettings(next)
        return { settings: next }
      }),

    // Sidebar
    sidebarExpanded: false,
    setSidebarExpanded: (v) => set({ sidebarExpanded: v }),

    // Breadcrumbs
    breadcrumbs: [{ label: 'Overview', state: { phase: 'overview' } }],
    pushBreadcrumb: (label, state) =>
      set((s) => ({ breadcrumbs: [...s.breadcrumbs, { label, state }] })),
    popBreadcrumb: () =>
      set((s) => {
        if (s.breadcrumbs.length <= 1) return s
        return { breadcrumbs: s.breadcrumbs.slice(0, -1) }
      }),
  }))
)
