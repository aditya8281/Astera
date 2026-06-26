export interface GraphNode {
  id: number
  kind: string
  name: string
  file_id: number
  start_line: number
  end_line: number
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

export interface StatsResponse {
  data: {
    files: number
    symbols: number
    edges: number
  }
}

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

export interface FileEntry {
  id: number
  relative_path: string
  language: string
  hash: string
  size: number
  line_count: number
}

export interface ApiResponse<T> {
  data: T
  meta: { count: number; elapsed_ms: number }
}

export const NODE_COLORS: Record<string, string> = {
  Function: '#06b6d4',
  Method: '#0ea5e9',
  Class: '#8b5cf6',
  Interface: '#a78bfa',
  Enum: '#f59e0b',
  Module: '#10b981',
  Variable: '#f43f5e',
  Field: '#fb923c',
  Parameter: '#94a3b8',
  TypeAlias: '#c084fc',
  Import: '#6b7280',
  File: '#374151',
  Macro: '#e879f9',
  Anonymous: '#64748b',
}

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
