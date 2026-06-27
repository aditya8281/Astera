/**
 * Astera SDK — TypeScript client for the Astera REST API.
 *
 * Usage:
 *   import { AsteraClient } from '@astera/sdk'
 *   const astera = new AsteraClient('http://localhost:8080')
 *   const stats = await astera.stats()
 */
export class AsteraClient {
    baseUrl;
    fetch;
    timeout;
    constructor(options = {}) {
        if (typeof options === 'string') {
            options = { baseUrl: options };
        }
        this.baseUrl = (options.baseUrl ?? 'http://localhost:8080').replace(/\/+$/, '');
        this.fetch = options.fetch ?? globalThis.fetch;
        this.timeout = options.timeout ?? 30_000;
    }
    // ─── Internal helpers ───
    async get(path) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const res = await this.fetch(`${this.baseUrl}${path}`, {
                signal: controller.signal,
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new AsteraError(res.status, res.statusText, body);
            }
            return res.json();
        }
        finally {
            clearTimeout(timer);
        }
    }
    async post(path, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const res = await this.fetch(`${this.baseUrl}${path}`, {
                method: 'POST',
                headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new AsteraError(res.status, res.statusText, text);
            }
            return res.json();
        }
        finally {
            clearTimeout(timer);
        }
    }
    query(params) {
        const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
        if (entries.length === 0)
            return '';
        return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    }
    // ─── Repository ───
    /** Get aggregate statistics (file, symbol, edge counts) */
    stats() {
        return this.get('/api/stats');
    }
    // ─── Files ───
    /** List all indexed files, optionally filtered by language */
    files(language) {
        const q = this.query({ language });
        return this.get(`/api/files${q}`);
    }
    // ─── Symbols ───
    /** Search symbols by kind and/or name */
    symbols(params) {
        const q = this.query({ kind: params?.kind, name: params?.name });
        return this.get(`/api/symbols${q}`);
    }
    /** Get a single symbol by ID */
    symbol(id) {
        return this.get(`/api/symbols/${id}`);
    }
    /** Full-text search across all symbols */
    search(query) {
        const q = encodeURIComponent(query);
        return this.get(`/api/search?q=${q}`);
    }
    // ─── Edges ───
    /** List edges, optionally filtered by kind */
    edges(params) {
        const q = this.query({ kind: params?.kind });
        return this.get(`/api/edges${q}`);
    }
    // ─── Graph ───
    /** Get module-level graph summary */
    modules() {
        return this.get('/api/graph/modules');
    }
    /** Get children of a container node (Module, Class, etc.) */
    children(nodeId) {
        return this.get(`/api/graph/children/${nodeId}`);
    }
    /** Get the full dependency graph */
    dependencyGraph() {
        return this.get('/api/graph/dependency');
    }
    // ─── Metrics ───
    /** Get aggregate code metrics */
    metrics() {
        return this.get('/api/metrics');
    }
    // ─── Impact Analysis ───
    /**
     * Run impact analysis from a root symbol.
     * Traces what would be affected if the root symbol changes.
     */
    impact(rootId, options) {
        const q = this.query({
            root_id: rootId,
            max_depth: options?.maxDepth,
            direction: options?.direction,
        });
        return this.get(`/api/impact${q}`);
    }
    // ─── Plugins ───
    /** List available plugins */
    plugins() {
        return this.get('/api/plugins');
    }
    /** Run a specific plugin and get findings */
    runPlugin(name) {
        return this.post(`/api/plugins/${encodeURIComponent(name)}/run`);
    }
    /** Run all plugins */
    runAllPlugins() {
        return this.post('/api/plugins/run-all');
    }
    // ─── Export ───
    /** Export graph to JSON/CSV/DOT (returns the export data directly) */
    exportGraph(format) {
        return this.get(`/api/export?format=${format}`);
    }
    // ─── Evolution / Trending ───
    /** Get all stored metric snapshots */
    snapshots() {
        return this.get('/api/snapshots');
    }
    /** Get a trend for a specific metric over time */
    trend(metric) {
        const q = encodeURIComponent(metric);
        return this.get(`/api/trend?q=${q}`);
    }
    /** Save the current state as a snapshot (called automatically after indexing) */
    saveSnapshot() {
        return this.post('/api/snapshots');
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
    subscribeEvents(onEvent, onError) {
        const wsUrl = this.baseUrl.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsUrl}/api/ws`);
        ws.onmessage = (msg) => {
            try {
                const event = JSON.parse(msg.data);
                onEvent(event);
            }
            catch {
                // ignore malformed messages
            }
        };
        ws.onerror = (err) => {
            onError?.(err);
        };
        return () => {
            ws.close();
        };
    }
}
// ─── Error type ───
export class AsteraError extends Error {
    status;
    statusText;
    body;
    constructor(status, statusText, body) {
        super(`Astera API error ${status}: ${statusText}`);
        this.status = status;
        this.statusText = statusText;
        this.body = body;
        this.name = 'AsteraError';
    }
}
