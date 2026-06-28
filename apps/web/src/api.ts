import type { GraphResponse, StatsResponse, ApiResponse, SymbolNode, FileEntry, MetricsResponse, ImpactResponse, ModuleSummary, BrokenRef } from './types'

const BASE = '/api'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

async function get<T>(path: string, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${res.statusText}${body ? ` — ${body}` : ''}`)
      }
      return res.json()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Don't retry on 4xx (client errors)
      if (lastError.message.startsWith('HTTP 4')) throw lastError
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      }
    }
  }
  throw lastError
}

export const api = {
  stats: () => get<StatsResponse>('/stats'),
  files: () => get<ApiResponse<FileEntry[]>>('/files'),
  symbols: (params?: { kind?: string; name?: string }) => {
    const q = new URLSearchParams()
    if (params?.kind) q.set('kind', params.kind)
    if (params?.name) q.set('name', params.name)
    const qs = q.toString()
    return get<ApiResponse<SymbolNode[]>>(`/symbols${qs ? `?${qs}` : ''}`)
  },
  symbol: (id: number) => get<SymbolNode>(`/symbols/${id}`),
  edges: (params?: { kind?: string }) => {
    const q = new URLSearchParams()
    if (params?.kind) q.set('kind', params.kind)
    const qs = q.toString()
    return get<ApiResponse<unknown[]>>(`/edges${qs ? `?${qs}` : ''}`)
  },
  search: (q: string) => get<ApiResponse<SymbolNode[]>>(`/search?q=${encodeURIComponent(q)}`),
  modules: () => get<ApiResponse<ModuleSummary[]>>('/graph/modules'),
  children: (nodeId: number) => get<GraphResponse>(`/graph/children/${nodeId}`),
  subtree: (nodeId: number, maxDepth?: number) => {
    const q = new URLSearchParams()
    if (maxDepth) q.set('max_depth', String(maxDepth))
    const qs = q.toString()
    return get<GraphResponse>(`/graph/subtree/${nodeId}${qs ? `?${qs}` : ''}`)
  },
  dependencyGraph: () => get<GraphResponse>('/graph/dependency'),
  metrics: () => get<ApiResponse<MetricsResponse>>('/metrics'),
  impact: (rootId: number, maxDepth?: number, direction?: string) => {
    const q = new URLSearchParams({ root_id: String(rootId) })
    if (maxDepth) q.set('max_depth', String(maxDepth))
    if (direction) q.set('direction', direction)
    return get<ApiResponse<ImpactResponse>>(`/impact?${q}`)
  },
  brokenRefs: (kind?: string) => {
    const q = new URLSearchParams()
    if (kind) q.set('kind', kind)
    const qs = q.toString()
    return get<ApiResponse<BrokenRef[]>>(`/broken-refs${qs ? `?${qs}` : ''}`)
  },
}

// ─── React Query defaults ───

export const QUERY_DEFAULTS = {
  staleTime: 5 * 60 * 1000,      // 5 minutes — graph data doesn't change often
  gcTime: 10 * 60 * 1000,        // 10 minutes cache retention
  retry: 2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
  refetchOnWindowFocus: false,    // Don't re-fetch on tab switch
  refetchOnReconnect: false,      // Don't re-fetch on network恢复
}
