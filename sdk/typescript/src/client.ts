/**
 * Astera SDK — TypeScript client for the Astera REST API.
 *
 * Usage:
 *   import { AsteraClient } from '@astera/sdk'
 *   const astera = new AsteraClient('http://localhost:8080')
 *   const stats = await astera.stats()
 */

import type {
  ApiResponse,
  StatsResponse,
  FileEntry,
  SymbolNode,
  Edge,
  GraphResponse,
  ModuleSummary,
  MetricsResponse,
  ImpactResponse,
  PluginInfo,
  PluginFinding,
  Snapshot,
  TrendResponse,
  WsEvent,
} from './types.js'

export interface AsteraClientOptions {
  /** Base URL of the Astera API server. Default: http://localhost:8080 */
  baseUrl?: string
  /** Custom fetch implementation (for Node < 18, testing, or proxies) */
  fetch?: typeof globalThis.fetch
  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number
}

export class AsteraClient {
  private baseUrl: string
  private fetch: typeof globalThis.fetch
  private timeout: number

  constructor(options: AsteraClientOptions | string = {}) {
    if (typeof options === 'string') {
      options = { baseUrl: options }
    }
    this.baseUrl = (options.baseUrl ?? 'http://localhost:8080').replace(/\/+$/, '')
    this.fetch = options.fetch ?? globalThis.fetch
    this.timeout = options.timeout ?? 30_000
  }

  // ─── Internal helpers ───

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    try {
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new AsteraError(res.status, res.statusText, body)
      }
      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    try {
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new AsteraError(res.status, res.statusText, text)
      }
      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  private query(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== '',
    )
    if (entries.length === 0) return ''
    return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  }

  // ─── Repository ───

  /** Get aggregate statistics (file, symbol, edge counts) */
  stats(): Promise<StatsResponse> {
    return this.get<StatsResponse>('/api/stats')
  }

  // ─── Files ───

  /** List all indexed files, optionally filtered by language */
  files(language?: string): Promise<ApiResponse<FileEntry[]>> {
    const q = this.query({ language })
    return this.get(`/api/files${q}`)
  }

  // ─── Symbols ───

  /** Search symbols by kind and/or name */
  symbols(params?: { kind?: string; name?: string }): Promise<ApiResponse<SymbolNode[]>> {
    const q = this.query({ kind: params?.kind, name: params?.name })
    return this.get(`/api/symbols${q}`)
  }

  /** Get a single symbol by ID */
  symbol(id: number): Promise<SymbolNode> {
    return this.get(`/api/symbols/${id}`)
  }

  /** Full-text search across all symbols */
  search(query: string): Promise<ApiResponse<SymbolNode[]>> {
    const q = encodeURIComponent(query)
    return this.get(`/api/search?q=${q}`)
  }

  // ─── Edges ───

  /** List edges, optionally filtered by kind */
  edges(params?: { kind?: string }): Promise<ApiResponse<Edge[]>> {
    const q = this.query({ kind: params?.kind })
    return this.get(`/api/edges${q}`)
  }

  // ─── Graph ───

  /** Get module-level graph summary */
  modules(): Promise<ApiResponse<ModuleSummary[]>> {
    return this.get('/api/graph/modules')
  }

  /** Get children of a container node (Module, Class, etc.) */
  children(nodeId: number): Promise<GraphResponse> {
    return this.get(`/api/graph/children/${nodeId}`)
  }

  /** Get the full dependency graph */
  dependencyGraph(): Promise<GraphResponse> {
    return this.get('/api/graph/dependency')
  }

  // ─── Metrics ───

  /** Get aggregate code metrics */
  metrics(): Promise<ApiResponse<MetricsResponse>> {
    return this.get('/api/metrics')
  }

  // ─── Impact Analysis ───

  /**
   * Run impact analysis from a root symbol.
   * Traces what would be affected if the root symbol changes.
   */
  impact(
    rootId: number,
    options?: { maxDepth?: number; direction?: 'forward' | 'reverse' },
  ): Promise<ApiResponse<ImpactResponse>> {
    const q = this.query({
      root_id: rootId,
      max_depth: options?.maxDepth,
      direction: options?.direction,
    })
    return this.get(`/api/impact${q}`)
  }

  // ─── Plugins ───

  /** List available plugins */
  plugins(): Promise<ApiResponse<PluginInfo[]>> {
    return this.get('/api/plugins')
  }

  /** Run a specific plugin and get findings */
  runPlugin(name: string): Promise<ApiResponse<PluginFinding>> {
    return this.post(`/api/plugins/${encodeURIComponent(name)}/run`)
  }

  /** Run all plugins */
  runAllPlugins(): Promise<ApiResponse<PluginFinding[]>> {
    return this.post('/api/plugins/run-all')
  }

  // ─── Export ───

  /** Export graph to JSON/CSV/DOT (returns the export data directly) */
  exportGraph(format: 'json' | 'csv' | 'dot'): Promise<unknown> {
    return this.get(`/api/export?format=${format}`)
  }

  // ─── Evolution / Trending ───

  /** Get all stored metric snapshots */
  snapshots(): Promise<ApiResponse<Snapshot[]>> {
    return this.get('/api/snapshots')
  }

  /** Get a trend for a specific metric over time */
  trend(metric: string): Promise<ApiResponse<TrendResponse>> {
    const q = encodeURIComponent(metric)
    return this.get(`/api/trend?q=${q}`)
  }

  /** Save the current state as a snapshot (called automatically after indexing) */
  saveSnapshot(): Promise<ApiResponse<Snapshot>> {
    return this.post('/api/snapshots')
  }

  // ─── WebSocket ───

  /**
   * Subscribe to real-time events (index progress, file changes).
   * Returns a cleanup function to close the connection.
   *
   * Usage:
   *   const unsub = astera.subscribeEvents((event) => {
   *     console.log(event.type, event.data)
   *   })
   *   // later: unsub()
   */
  subscribeEvents(
    onEvent: (event: WsEvent) => void,
    onError?: (error: Event) => void,
  ): () => void {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/api/ws`)

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WsEvent
        onEvent(event)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = (err) => {
      onError?.(err)
    }

    return () => {
      ws.close()
    }
  }
}

// ─── Error type ───

export class AsteraError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`Astera API error ${status}: ${statusText}`)
    this.name = 'AsteraError'
  }
}
