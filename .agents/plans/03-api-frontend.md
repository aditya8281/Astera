# Astera — API & 3D Frontend

## API Design Philosophy

1. **REST over HTTP/JSON** — Familiar, universal, no client library needed
2. **Stateless** — Server keeps no session state (except repo index on disk)
3. **Versioned** — `/api/v1/` prefix; breaking changes require new version
4. **Predictable errors** — Consistent JSON error format with machine-readable codes
5. **Cursor pagination** — For list endpoints; stable across index updates
6. **Self-documenting** — OpenAPI 3.0 spec auto-generated via utoipa
7. **CORS by default** — Locked to localhost in dev; configurable for remote

## HTTP Server: Axum

Axum on top of tokio handles HTTP, WebSocket, JSON, and static file serving:

```rust
#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/v1/repos", get(list_repos).post(create_repo))
        .route("/api/v1/repos/{id}", get(get_repo).delete(delete_repo))
        .route("/api/v1/repos/{id}/files", get(list_files))
        .route("/api/v1/repos/{id}/files/{*path}", get(get_file))
        .route("/api/v1/repos/{id}/symbols", get(list_symbols))
        .route("/api/v1/repos/{id}/symbols/{sym_id}", get(get_symbol))
        .route("/api/v1/repos/{id}/symbols/{sym_id}/callers", get(get_callers))
        .route("/api/v1/repos/{id}/symbols/{sym_id}/callees", get(get_callees))
        .route("/api/v1/repos/{id}/search", get(search_symbols))
        .route("/api/v1/repos/{id}/dependencies", get(get_dependencies))
        .route("/api/v1/repos/{id}/metrics", get(get_metrics))
        .route("/api/v1/repos/{id}/graph/call/{sym_id}", get(get_call_graph))
        .route("/api/v1/repos/{id}/graph/dependency", get(get_dep_graph))
        // WebSocket for live updates
        .route("/ws/repos/{id}", get(ws_handler))
        // Static files (served from embedded dist/ or filesystem)
        .nest_service("/", ServeDir::new("apps/web/dist"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

## Endpoint Reference

### Repository Management

```
POST   /api/v1/repos                      → Index a new repository
  Body:   { "path": "/path/to/repo", "name": "my-repo" }
  → 201:  { "data": { "id": 1, "name": "my-repo", "file_count": 247 } }

GET    /api/v1/repos                      → List indexed repositories
  → 200:  { "data": [ { "id": 1, "name": "my-repo", ... } ] }

GET    /api/v1/repos/{id}                 → Repository info + stats
  → 200:  { "data": { "id": 1, ... "total_files": 247, "total_symbols": 3412 } }

DELETE /api/v1/repos/{id}                 → Remove index
  → 204:  No Content

POST   /api/v1/repos/{id}/reindex         → Force full re-index
  → 202:  { "data": { "status": "reindexing" } }

POST   /api/v1/repos/{id}/watch           → Start file watching
  → 202:  { "data": { "status": "watching" } }
```

### Files

```
GET    /api/v1/repos/{id}/files?language=ts&cursor=&limit=50
  → 200:  { "data": [ { "id": 1, "relative_path": "src/main.ts", ... } ] }

GET    /api/v1/repos/{id}/files/{*path}   (URL-encoded path)
  → 200:  { "data": { ...file detail with symbols in file... } }

GET    /api/v1/repos/{id}/files/{*path}/content
  → 200:  { "data": { "content": "source code", "language": "typescript" } }
```

### Symbols

```
GET    /api/v1/repos/{id}/symbols?query=&kind=Function&cursor=&limit=50
  → 200:  { "data": [ { "id": 1847, "kind": "Function", "name": "handleRequest", ... } ] }

GET    /api/v1/repos/{id}/symbols/{sym_id}
  → 200:  { "data": { ...full symbol detail with properties } }

GET    /api/v1/repos/{id}/symbols/{sym_id}/references
  → 200:  { "data": [ { "node": {...}, "file": {...} } ] }

GET    /api/v1/repos/{id}/symbols/{sym_id}/callees
  → 200:  { "data": [ { "node": {...called function...}, "call_sites": [...] } ] }

GET    /api/v1/repos/{id}/symbols/{sym_id}/callers
  → 200:  { "data": [ { "node": {...caller...}, "call_sites": [...] } ] }
```

### Dependencies & Impact

```
GET    /api/v1/repos/{id}/dependencies
  → 200:  { "data": { "modules": [...], "edges": [...] } }

GET    /api/v1/repos/{id}/circular
  → 200:  { "data": [ { "cycle": ["src/a.ts", "src/b.ts", "src/c.ts"] } ] }

POST   /api/v1/repos/{id}/impact
  Body:   { "symbol_id": 1847, "max_depth": 5 }
  → 200:  { "data": { "affected_files": [...], "affected_symbols": [...] } }
```

### Metrics

```
GET    /api/v1/repos/{id}/metrics
  → 200:  { "data": { "total_files": 247, "avg_complexity": 4.2, ... } }

GET    /api/v1/repos/{id}/metrics/functions?sort_by=complexity&order=desc&limit=20
  → 200:  { "data": [ { "function": {...}, "complexity": 47 } ] }
```

### Search

```
GET    /api/v1/repos/{id}/search?q=handleRequest&kinds=Function&cursor=&limit=20
  → 200:  { "data": [...ranked results with snippets...], "meta": { "total_hits": 7 } }
```

### Graph Visualization Data

```
GET    /api/v1/repos/{id}/graph/dependency
  → 200:  { "data": { "nodes": [...], "edges": [...] } }

GET    /api/v1/repos/{id}/graph/call/{sym_id}?max_depth=3&max_fan_out=20
  → 200:  { "data": { "nodes": [...], "edges": [...] } }

GET    /api/v1/repos/{id}/graph/impact/{sym_id}?max_depth=5
  → 200:  { "data": { "nodes": [...], "edges": [...] } }
```

Graph endpoints return data in force-directed 3D layout compatible format:

```json
{
  "data": {
    "nodes": [
      { "id": "1847", "label": "handleRequest", "kind": "Function", "file": "src/api.ts" }
    ],
    "edges": [
      { "source": "1847", "target": "1901", "kind": "Calls" }
    ]
  }
}
```

## Response & Error Conventions

Success:
```json
{ "data": { ... }, "meta": { "elapsed_ms": 4 } }
```

Paginated:
```json
{
  "data": [ ... ],
  "meta": {
    "page": { "cursor": "eyJpZCI6MTAwfQ==", "next_cursor": "eyJpZCI6MjAwfQ==", "limit": 50, "has_more": true },
    "elapsed_ms": 12
  }
}
```

Error:
```json
{
  "error": {
    "code": "SYMBOL_NOT_FOUND",
    "message": "Symbol with id 12345 not found in repo 'my-repo'",
    "details": {}
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `REPO_NOT_FOUND` | 404 | Repository ID doesn't exist |
| `SYMBOL_NOT_FOUND` | 404 | Symbol ID doesn't exist |
| `INVALID_PARAMETER` | 400 | Bad query parameter |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## 3D Frontend Architecture

### Tech Stack

| Technology | Use |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool (fast HMR) |
| React Router v7 | Client-side routing |
| TanStack React Query | Server state, caching, pagination |
| Zustand | UI state (selected repo, active view, filters) |
| React Three Fiber (@react-three/fiber) | 3D rendering via Three.js |
| @react-three/drei | R3F helpers (controls, text, shapes) |
| Three.js | WebGL 3D engine |
| Monaco Editor | Code display |
| Recharts | 2D metrics charts |
| Tailwind CSS v4 | Styling |

### Why 3D?

Code graphs are inherently multi-dimensional — dependencies, call chains, containment hierarchies, and metrics all coexist in the same structure. 3D visualization lets users:

- **Navigate naturally** — orbit, pan, zoom through the code graph like a 3D space
- **See clusters** — force-directed 3D layout reveals module groupings, tightly-coupled clusters, and architectural layers
- **Multi-dimensional filtering** — color by kind, size by complexity, height by file depth — all in one view
- **Spatial memory** — humans remember spatial layouts; 3D gives each symbol a persistent position in space

### 3D Visualization Engine

Built on React Three Fiber, with a custom graph rendering layer:

```
<Canvas>
  <GraphScene>
    <ForceDirectedGraph>      ← nodes + edges with force simulation
      <Node />                 ← spheres/cubes per symbol, color=kind, size=metrics
      <Edge />                 ← lines/curves between connected nodes
      <NodeLabel />            ← HTML overlays (CSS2DRenderer) for names
    </ForceDirectedGraph>
    <Controls />               ← OrbitControls + zoom-to-target
    <GraphOverlay />           ← info panel on hover/select
    <Background />             ← subtle gradient or particle field
  </GraphScene>
</Canvas>
```

Layout strategies (switched per view):
- **Force-directed 3D** — d3-force-3d or custom force sim — shows natural clusters
- **Layered 3D** — files by directory depth on Y-axis, symbols by layer
- **Ring/breadthfirst** — impact analysis: root at center, rings of transitive dependencies

### Pages

**Dashboard**: Repo stats cards, language breakdown, 3D overview globe showing module stars  
**File Explorer**: File tree + Monaco code view + symbol gutter markers  
**Symbol Explorer**: Typeahead search, result list, 3D ego-graph of selected symbol  
**Dependency Graph**: Full-screen 3D force-directed graph, color-coded by module  
**Call Graph**: 3D hierarchical layout, depth slider, search to focus  
**Impact Analysis**: 3D ring layout — symbol at center, affected files radiating out  
**Metrics Page**: Summary cards, complexity histogram, module table, coupling plot  
**Search**: Typeahead, kind-filtered, result snippets

### Component Structure

```
Layout
├── TopBar (repo selector, global search, theme toggle)
├── Sidebar (navigation)
└── Content (route-based pages)

Common: CodeBlock, SymbolBadge, Breadcrumb, LoadingSkeleton, EmptyState, Pagination
3D: Canvas, GraphScene, ForceDirectedGraph, Node, Edge, NodeLabel, Controls, GraphOverlay
Pages: Dashboard, FileExplorer, SymbolExplorer, Dependency, CallGraph, Impact, Metrics, Search
```

### 3D-specific Components

| Component | Responsibility |
|---|---|
| `<GraphScene>` | Three.js scene setup, lighting, camera defaults |
| `<ForceDirectedGraph>` | d3-force-3d simulation, tick update, node/edge layout |
| `<Node>` | 3D mesh (sphere/cube/icosahedron per kind), color, size, glow |
| `<Edge>` | Line/curve between nodes, kind-colored, animated flow |
| `<NodeLabel>` | CSS2DRenderer text labels, fade at distance |
| `<GraphControls>` | OrbitControls, zoom-to-selection, auto-rotate toggle |
| `<GraphOverlay>` | Floating HTML panel on hover/select shows symbol info |
| `<FilterPanel>` | Side panel to filter by kind, file, depth, metric range |
| `<MiniMap>` | Corner minimap showing camera position in full graph |

### Camera & Navigation

- Default perspective: 45° isometric view of the graph
- Orbit controls: rotate, pan, zoom
- Click-to-focus: click a node → camera animates to center it
- Search-to-focus: search a symbol → camera flies to it, highlights it
- Bookmarks: save camera positions for views
- Auto-rotate: toggle for ambient rotation of the graph

### Visual Design Language

- **Color by kind**: each NodeKind gets a distinct hue (Function=cyan, Class=purple, Variable=yellow, etc.)
- **Size by metric**: node radius scales with complexity, line count, or coupling
- **Glow on hover**: selected nodes get emissive glow, connected edges highlight
- **Edge animation**: data flow direction shown via animated dashes or particle streams
- **Background**: dark theme with subtle nebula/grid, light theme with clean white
- **Transitions**: smooth 300ms camera animations, 150ms hover transitions

### Performance Strategy

- Use `@react-three/drei` `<Instances>` for repeated geometry (many nodes of same kind)
- LOD (level of detail): simplify geometry at distance
- Frustum culling: don't render off-screen nodes
- 60fps target for graphs up to 10K nodes
- Progressive loading: render core subgraph first, full graph on interaction
- WebGL 2.0 with hardware instancing

### State Management

```
TanStack React Query — all API data cached
Zustand — UI state (selectedRepo, activeView, filters, camera position)
URL params — shareable view links
```

### Build & Deployment

```bash
# Development
cd apps/web && npm run dev         # :5173, proxies /api to :8080

# Production build
npm run build                      # Outputs to apps/web/dist/

# Single binary: cargo build --release bundles dist/ via rust-embed
```

Frontend gets embedded in the Rust binary via `rust-embed` crate — single deployment artifact.
