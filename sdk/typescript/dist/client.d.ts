/**
 * Astera SDK — TypeScript client for the Astera REST API.
 *
 * Usage:
 *   import { AsteraClient } from '@astera/sdk'
 *   const astera = new AsteraClient('http://localhost:8080')
 *   const stats = await astera.stats()
 */
import type { ApiResponse, StatsResponse, FileEntry, SymbolNode, Edge, GraphResponse, ModuleSummary, MetricsResponse, ImpactResponse, PluginInfo, PluginFinding, Snapshot, TrendResponse, WsEvent } from './types.js';
export interface AsteraClientOptions {
    /** Base URL of the Astera API server. Default: http://localhost:8080 */
    baseUrl?: string;
    /** Custom fetch implementation (for Node < 18, testing, or proxies) */
    fetch?: typeof globalThis.fetch;
    /** Request timeout in milliseconds. Default: 30000 */
    timeout?: number;
}
export declare class AsteraClient {
    private baseUrl;
    private fetch;
    private timeout;
    constructor(options?: AsteraClientOptions | string);
    private get;
    private post;
    private query;
    /** Get aggregate statistics (file, symbol, edge counts) */
    stats(): Promise<StatsResponse>;
    /** List all indexed files, optionally filtered by language */
    files(language?: string): Promise<ApiResponse<FileEntry[]>>;
    /** Search symbols by kind and/or name */
    symbols(params?: {
        kind?: string;
        name?: string;
    }): Promise<ApiResponse<SymbolNode[]>>;
    /** Get a single symbol by ID */
    symbol(id: number): Promise<SymbolNode>;
    /** Full-text search across all symbols */
    search(query: string): Promise<ApiResponse<SymbolNode[]>>;
    /** List edges, optionally filtered by kind */
    edges(params?: {
        kind?: string;
    }): Promise<ApiResponse<Edge[]>>;
    /** Get module-level graph summary */
    modules(): Promise<ApiResponse<ModuleSummary[]>>;
    /** Get children of a container node (Module, Class, etc.) */
    children(nodeId: number): Promise<GraphResponse>;
    /** Get the full dependency graph */
    dependencyGraph(): Promise<GraphResponse>;
    /** Get aggregate code metrics */
    metrics(): Promise<ApiResponse<MetricsResponse>>;
    /**
     * Run impact analysis from a root symbol.
     * Traces what would be affected if the root symbol changes.
     */
    impact(rootId: number, options?: {
        maxDepth?: number;
        direction?: 'forward' | 'reverse';
    }): Promise<ApiResponse<ImpactResponse>>;
    /** List available plugins */
    plugins(): Promise<ApiResponse<PluginInfo[]>>;
    /** Run a specific plugin and get findings */
    runPlugin(name: string): Promise<ApiResponse<PluginFinding>>;
    /** Run all plugins */
    runAllPlugins(): Promise<ApiResponse<PluginFinding[]>>;
    /** Export graph to JSON/CSV/DOT (returns the export data directly) */
    exportGraph(format: 'json' | 'csv' | 'dot'): Promise<unknown>;
    /** Get all stored metric snapshots */
    snapshots(): Promise<ApiResponse<Snapshot[]>>;
    /** Get a trend for a specific metric over time */
    trend(metric: string): Promise<ApiResponse<TrendResponse>>;
    /** Save the current state as a snapshot (called automatically after indexing) */
    saveSnapshot(): Promise<ApiResponse<Snapshot>>;
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
    subscribeEvents(onEvent: (event: WsEvent) => void, onError?: (error: Event) => void): () => void;
}
export declare class AsteraError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly body: string;
    constructor(status: number, statusText: string, body: string);
}
