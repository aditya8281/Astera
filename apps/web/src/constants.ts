// ─── All node kinds ───

export const ALL_KINDS = [
  'Function', 'Method', 'Class', 'Interface', 'Enum',
  'Module', 'Variable', 'Import', 'TypeAlias', 'Macro',
] as const

// ─── Semantic color tokens ───

export const COLORS = {
  selection: '#E65100',
  selectionDim: '#BF360C',
  selectionGlow: '#FF6D00',
  relationship: '#00E5FF',
  relationshipDim: '#00B8D4',
  relationshipGlow: '#18FFFF',
  success: '#00E676',
  error: '#FF1744',
  ai: '#B388FF',
  inactive: '#555555',
  warning: '#FFD740',
  bg: '#0D0D0D',
  surface: '#151515',
  surfaceDim: '#111111',
  surfaceHover: '#1A1A1A',
  border: '#222222',
  borderLight: '#333333',
  text: '#F0F0F0',
  textMuted: '#888888',
  textDim: '#555555',
} as const

// ─── Node colors by kind ───

export const NODE_COLORS: Record<string, string> = {
  File: '#546E7A',
  Module: '#B388FF',
  Function: '#E65100',
  Method: '#FF6D00',
  Class: '#00E5FF',
  Interface: '#80DEEA',
  Enum: '#FFD740',
  Variable: '#FF80AB',
  Field: '#FFAB91',
  Parameter: '#CE93D8',
  TypeAlias: '#80CBC4',
  Import: '#78909C',
  Macro: '#F48FB1',
  Anonymous: '#90A4AE',
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
  selection: 150,
  panel: 250,
  camera: 650,
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
  light: 500,
  medium: 1500,
  heavy: 3000,
}

// ─── Kind filter (all selected by default) ───

export const ALL_KINDS_SET = new Set(ALL_KINDS)

// ─── Default settings ───

export const DEFAULT_SETTINGS = {
  edgeAnimation: 'glow' as const,
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
