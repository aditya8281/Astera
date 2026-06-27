// ─── All node kinds ───

export const ALL_KINDS = [
  'Function', 'Method', 'Class', 'Interface', 'Enum',
  'Module', 'Variable', 'Import', 'TypeAlias', 'Macro',
] as const

// ─── Semantic color tokens (warm charcoal + electric cyan identity) ───

export const COLORS = {
  // Background
  bg: '#1F2128',
  bgGradientTop: '#23252D',
  bgGradientBottom: '#1B1D23',

  // Surfaces
  surface: '#2A2D35',
  surfaceDim: '#252830',
  surfaceHover: '#32353D',

  // Borders
  border: '#3A3D45',
  borderLight: '#454850',

  // Text
  text: '#E0E4EC',
  textMuted: '#8B91A0',
  textDim: '#5A6070',

  // Accent (Electric Cyan)
  accent: '#59F6FF',
  accentDim: '#3AA8B0',

  // Graph nodes
  nodeDefault: '#A7B5C9',
  nodeHover: '#DCE8FF',
  nodeSelected: '#59F6FF',

  // Graph edges
  edgeDefault: 'rgba(180,190,210,0.22)',
  edgeHover: '#59F6FF',

  // Labels
  label: '#AEB8C7',

  // Legacy aliases (used by sidebar, panels, etc.)
  selection: '#59F6FF',
  selectionDim: '#3AA8B0',
  selectionGlow: '#59F6FF',
  relationship: '#59F6FF',
  relationshipDim: '#3AA8B0',
  relationshipGlow: '#59F6FF',
  success: '#00E676',
  error: '#FF5252',
  ai: '#B388FF',
  inactive: '#5A6070',
  warning: '#FFD740',
  muted: '#8B91A0',
} as const

// ─── Node colors by kind (muted, Obsidian-inspired) ───

export const NODE_COLORS: Record<string, string> = {
  File: '#6B7280',
  Module: '#A78BFA',
  Function: '#A7B5C9',
  Method: '#B0BAC9',
  Class: '#7DD3FC',
  Interface: '#67E8F9',
  Enum: '#FCD34D',
  Variable: '#F9A8D4',
  Field: '#FBBF7A',
  Parameter: '#C4B5FD',
  TypeAlias: '#6EE7B7',
  Import: '#6B7280',
  Macro: '#F9A8D4',
  Anonymous: '#94A3B8',
}

// ─── Node geometry mapping ───

export const NODE_SHAPES: Record<string, string> = {
  Module: 'sphere',
  Class: 'cube',
  Struct: 'cube',
  Function: 'capsule',
  Method: 'capsule',
  Interface: 'hexagon',
  Trait: 'hexagon',
  Enum: 'diamond',
  Variable: 'smallSphere',
  Field: 'smallSphere',
  Parameter: 'smallSphere',
  Import: 'line',
  TypeAlias: 'octahedron',
  Macro: 'smallSphere',
  Anonymous: 'capsule',
  File: 'sphere',
}

// ─── Node sizes (radius) ───

export const KIND_SIZE: Record<string, number> = {
  File: 0.6,
  Module: 0.5,
  Function: 0.35,
  Method: 0.3,
  Class: 0.45,
  Interface: 0.4,
  Enum: 0.35,
  Variable: 0.25,
  TypeAlias: 0.3,
  Import: 0.2,
}

// ─── Animation timing (ms) ───

export const TIMING = {
  ambient: 3000,
  micro: 120,
  selection: 200,
  panel: 250,
  camera: 350,
  nodeGrow: 400,
  layoutTransition: 800,
} as const

// ─── Performance budgets ───

export const BUDGETS = {
  targetFps: 60,
  maxCpuMs: 5,
  maxGpuMs: 8,
  maxMainThreadBlockMs: 4,
  maxMemoryMB: 500,
  maxDrawCalls: 50,
  maxNodes: 10_000,
  lodThresholds: {
    low: { distance: 30, importance: 0.1 },
    medium: { distance: 20, importance: 0.3 },
    high: { distance: 15, importance: 0.5 },
  },
} as const

// ─── Camera speed ───

export const CAMERA_SPEEDS: Record<string, number> = {
  slow: 0.03,
  normal: 0.06,
  fast: 0.1,
}

// ─── Particle density ───

export const PARTICLE_COUNTS: Record<string, number> = {
  off: 0,
  light: 200,
  medium: 400,
  heavy: 800,
}

// ─── Kind filter (all selected by default) ───

export const ALL_KINDS_SET = new Set(ALL_KINDS)

// ─── Default settings ───

export const DEFAULT_SETTINGS = {
  edgeAnimation: 'pulse' as const,
  particleDensity: 'medium' as const,
  showLabels: true,
  lodThreshold: 'medium' as const,
  edgeHighlightOnSelect: true,
  cameraSpeed: 'normal' as const,
  reducedMotion: false,
  showPerformanceTelemetry: false,
  layoutEngine: 'force' as const,
  graphType: 'dependency' as const,
}

// ─── Storage keys ───

export const STORAGE_KEYS = {
  settings: 'astera-settings',
  recentSearches: 'astera-recent-searches',
  recentSelections: 'astera-recent-selections',
  bookmarks: 'astera-bookmarks',
} as const
