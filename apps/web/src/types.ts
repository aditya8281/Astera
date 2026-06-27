// ─── Graph types ───

export interface GraphNode {
  id: number
  kind: string
  name: string
  file_id: number
  start_line: number
  end_line: number
  importance?: number
}

export interface GraphEdge {
  source: number
  target: number
  kind: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ─── Stats ───

export interface StatsResponse {
  data: {
    files: number
    symbols: number
    edges: number
  }
}

// ─── Symbols ───

export interface SymbolNode {
  id: number | null
  kind: string
  name: string
  file_id: number
  span: {
    start_line: number
    start_col: number
    end_line: number
    end_col: number
  }
  doc_comment: string | null
  properties: Record<string, unknown>
}

// ─── Files ───

export interface FileEntry {
  id: number
  relative_path: string
  language: string
  hash: string
  size: number
  line_count: number
}

// ─── API response wrapper ───

export interface ApiResponse<T> {
  data: T
  meta: { count: number; elapsed_ms: number }
}

// ─── Metrics ───

export interface MetricsResponse {
  total_nodes: number
  total_edges: number
  total_files: number
  avg_complexity: number
  max_complexity: number
  function_count: number
  module_count: number
  circular_dependencies: [string, string][]
}

// ─── Impact ───

export interface ImpactNode {
  node_id: number
  name: string
  kind: string
  depth: number
  edge_path: string[]
}

export interface ImpactResponse {
  root: number
  root_name: string
  total_affected: number
  max_depth: number
  cycle_detected: boolean
  affected: ImpactNode[]
}

// ─── Graph state machine ───

export type GraphState =
  | { phase: 'loading' }
  | { phase: 'overview' }
  | { phase: 'moduleFocused'; moduleId: number; moduleName: string }
  | { phase: 'classFocused'; classId: number; className: string; parentId: number }
  | { phase: 'functionFocused'; functionId: number; functionName: string; parentId: number }
  | { phase: 'searchFocused'; query: string }
  | { phase: 'impactFocused'; rootId: number }
  | { phase: 'selectionLocked'; nodeIds: number[] }

// ─── Camera state ───

export type CameraState =
  | { mode: 'idle' }
  | { mode: 'transitioning'; from: [number, number, number]; to: [number, number, number]; progress: number }
  | { mode: 'userControlled' }
  | { mode: 'autoFocus'; target: [number, number, number]; lookAt: [number, number, number] }
  | { mode: 'overviewReset' }

// ─── Layout engine ───

export type LayoutEngine = 'force' | 'hierarchical' | 'radial' | 'dagre' | 'circular'
export type GraphType = 'dependency' | 'call' | 'tree' | 'circular-deps'

// ─── Overlay panel ───

export type PanelId =
  | 'symbols'
  | 'files'
  | 'metrics'
  | 'impact'
  | 'settings'
  | 'search'
  | null

// ─── Settings ───

export interface Settings {
  edgeAnimation: 'dots' | 'glow' | 'both' | 'none'
  particleDensity: 'off' | 'light' | 'medium' | 'heavy'
  showLabels: boolean
  lodThreshold: 'low' | 'medium' | 'high'
  edgeHighlightOnSelect: boolean
  cameraSpeed: 'slow' | 'normal' | 'fast'
  reducedMotion: boolean
  showPerformanceTelemetry: boolean
  layoutEngine: LayoutEngine
  graphType: GraphType
}

export const DEFAULT_SETTINGS: Settings = {
  edgeAnimation: 'glow',
  particleDensity: 'medium',
  showLabels: true,
  lodThreshold: 'medium',
  edgeHighlightOnSelect: true,
  cameraSpeed: 'normal',
  reducedMotion: false,
  showPerformanceTelemetry: false,
  layoutEngine: 'force',
  graphType: 'dependency',
}
