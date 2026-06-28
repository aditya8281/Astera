// ─── All node kinds ───

export const ALL_KINDS = [
  'Function', 'Method', 'Class', 'Interface', 'Enum',
  'Module', 'Variable', 'Import', 'TypeAlias', 'Macro',
] as const

// ─── Semantic color tokens (warm charcoal + electric cyan identity) ───

export const COLORS = {
  // Background — OLED black
  bg: '#000000',
  bgGradientTop: '#050507',
  bgGradientBottom: '#000000',

  // Surfaces — lifted from true black for layering
  surface: '#0E0F12',
  surfaceDim: '#0A0B0E',
  surfaceHover: '#16171C',

  // Borders
  border: '#1E1F25',
  borderLight: '#26272E',

  // Text
  text: '#E0E4EC',
  textMuted: '#8B91A0',
  textDim: '#5A6070',

  // Accent (Electric Cyan)
  accent: '#59F6FF',
  accentDim: '#3AA8B0',

  // Graph nodes — vivid on OLED
  nodeDefault: '#CBD5E1',
  nodeHover: '#F1F5F9',
  nodeSelected: '#59F6FF',

  // Graph edges — bright on OLED
  edgeDefault: 'rgba(120,160,210,0.55)',
  edgeHover: '#59F6FF',

  // Labels
  label: '#AEB8C7',

  // Legacy aliases
  selection: '#59F6FF',
  selectionDim: '#3AA8B0',
  selectionGlow: '#59F6FF',
  relationship: '#59F6FF',
  relationshipDim: '#3AA8B0',
  relationshipGlow: '#59F6FF',
  success: '#4ADE80',
  error: '#F87171',
  ai: '#B388FF',
  inactive: '#5A6070',
  warning: '#FBBF24',
  muted: '#8B91A0',
} as const

// ─── Node colors by kind (vivid, OLED-contrast) ───

export const NODE_COLORS: Record<string, string> = {
  File: '#8B95A5',
  Module: '#C084FC',
  Function: '#60A5FA',
  Method: '#818CF8',
  Class: '#38BDF8',
  Interface: '#22D3EE',
  Enum: '#FBBF24',
  Variable: '#F472B6',
  Field: '#FB923C',
  Parameter: '#A78BFA',
  TypeAlias: '#34D399',
  Import: '#8B95A5',
  Macro: '#F472B6',
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
