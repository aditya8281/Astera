import type { GraphResponse, StatsResponse, ApiResponse, SymbolNode, FileEntry, MetricsResponse, ImpactResponse, ModuleSummary } from './types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

export const api = {
  stats: () => get<StatsResponse>('/stats'),
  files: () => get<ApiResponse<FileEntry[]>>('/files'),
  symbols: (params?: { kind?: string; name?: string }) => {
    const q = new URLSearchParams()
    if (params?.kind) q.set('kind', params.kind)
    if (params?.name) q.set('name', params.name)
    return get<ApiResponse<SymbolNode[]>>(`/symbols?${q}`)
  },
  symbol: (id: number) => get<SymbolNode>(`/symbols/${id}`),
  edges: (params?: { kind?: string }) => {
    const q = new URLSearchParams()
    if (params?.kind) q.set('kind', params.kind)
    return get<ApiResponse<unknown[]>>(`/edges?${q}`)
  },
  search: (q: string) => get<ApiResponse<SymbolNode[]>>(`/search?q=${encodeURIComponent(q)}`),
  modules: () => get<ApiResponse<ModuleSummary[]>>('/graph/modules'),
  children: (nodeId: number) => get<GraphResponse>(`/graph/children/${nodeId}`),
  dependencyGraph: () => get<GraphResponse>('/graph/dependency'),
  metrics: () => get<ApiResponse<MetricsResponse>>('/metrics'),
  impact: (rootId: number, maxDepth?: number, direction?: string) => {
    const q = new URLSearchParams({ root_id: String(rootId) })
    if (maxDepth) q.set('max_depth', String(maxDepth))
    if (direction) q.set('direction', direction)
    return get<ApiResponse<ImpactResponse>>(`/impact?${q}`)
  },
}
