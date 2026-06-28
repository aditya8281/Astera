/**
 * Astera SDK — TypeScript types for the Astera REST API.
 * Auto-generated from the Rust API types. Keep in sync with the server.
 */

// ─── Base response wrappers ───

export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ResponseMeta {
  count: number;
  elapsed_ms: number;
}

// ─── Stats ───

export interface StatsResponse {
  files: number;
  symbols: number;
  edges: number;
}

// ─── Files ───

export interface FileEntry {
  id: number;
  relative_path: string;
  language: string;
  hash: string;
  size: number;
  line_count: number;
}

// ─── Symbols ───

export interface SymbolNode {
  id: number;
  kind: NodeKind;
  name: string;
  file_id: number;
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
  doc_comment: string | null;
  properties: Record<string, unknown>;
}

export type NodeKind =
  | 'File' | 'Module' | 'Function' | 'Class' | 'Method'
  | 'Interface' | 'Enum' | 'Variable' | 'Field' | 'Parameter'
  | 'TypeAlias' | 'Import' | 'Macro' | 'Anonymous' | 'Block';

// ─── Edges ───

export interface Edge {
  id: number;
  source_node_id: number;
  target_node_id: number;
  kind: EdgeKind;
  properties: Record<string, unknown>;
  file_id: number | null;
}

export type EdgeKind =
  | 'Contains' | 'Calls' | 'References' | 'Defines'
  | 'Inherits' | 'Implements' | 'Overrides' | 'Imports'
  | 'Exports' | 'DependsOn' | 'Declares' | 'Next';

// ─── Graph ───

export interface GraphNode {
  id: number;
  kind: string;
  name: string;
  file_id: number;
  start_line: number;
  end_line: number;
  importance: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  kind: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ModuleSummary {
  id: number;
  kind: string;
  name: string;
  file_id: number;
  start_line: number;
  end_line: number;
  importance: number;
}

// ─── Metrics ───

export interface MetricsResponse {
  total_nodes: number;
  total_edges: number;
  total_files: number;
  avg_complexity: number;
  max_complexity: number;
  function_count: number;
  module_count: number;
  circular_dependencies: [string, string][];
}

// ─── Impact ───

export interface ImpactResponse {
  root_name: string;
  root_id: number;
  total_affected: number;
  max_depth: number;
  cycle_detected: boolean;
  affected: ImpactNode[];
}

export interface ImpactNode {
  node_id: number;
  name: string;
  kind: string;
  depth: number;
}

// ─── Plugins ───

export interface PluginInfo {
  name: string;
  kind: string;
  description: string;
  version: string;
}

export interface PluginFinding {
  plugin: string;
  findings: PluginFindingItem[];
}

export interface PluginFindingItem {
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  file: string;
  line: number;
}

// ─── Export ───

export interface ExportResponse {
  format: string;
  node_count: number;
  edge_count: number;
}

// ─── Evolution / Trending ───

export interface Snapshot {
  id: number;
  timestamp: string;
  commit: string | null;
  total_nodes: number;
  total_edges: number;
  total_files: number;
  avg_complexity: number;
  max_complexity: number;
  circular_deps: number;
}

export interface TrendPoint {
  timestamp: string;
  value: number;
}

export interface TrendResponse {
  metric: string;
  points: TrendPoint[];
}

// ─── WebSocket Events ───

export interface WsEvent {
  type: 'index_started' | 'index_progress' | 'index_completed' | 'index_error' | 'files_changed';
  data: Record<string, unknown>;
}
