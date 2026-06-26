# Astera — API & Frontend

## API Design Philosophy

1. **REST over HTTP/JSON** — Familiar, universal, no client library needed
2. **Stateless** — Server keeps no session state (except repo index on disk)
3. **Versioned** — `/api/v1/` prefix; breaking changes require new version
4. **Predictable errors** — Consistent JSON error format with machine-readable codes
5. **Cursor pagination** — For list endpoints; stable across index updates
6. **Self-documenting** — OpenAPI 3.0 spec auto-generated (OpenAPI macros)
7. **CORS by default** — Locked to localhost in dev; configurable for remote

## HTTP Server: Drogon

Drogon handles HTTP, WebSocket, JSON, and static file serving in one framework:

```cpp
// App setup
int main() {
    drogon::app()
        .addListener("0.0.0.0", 8080)
        .setDocumentRoot("./web/dist")
        .enableCORS("*")
        .registerController(std::make_shared<SymbolController>())
        .registerController(std::make_shared<FileController>())
        .registerController(std::make_shared<RepoController>())
        .run();
}

// Controller example
class SymbolController : public drogon::HttpController<SymbolController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(SymbolController::getSymbol,
                      "/api/v1/repos/{repo_id}/symbols/{symbol_id}",
                      drogon::Get);
        ADD_METHOD_TO(SymbolController::getCallers,
                      "/api/v1/repos/{repo_id}/symbols/{symbol_id}/callers",
                      drogon::Get);
    METHOD_LIST_END

    void getSymbol(const drogon::HttpRequestPtr& req,
                   std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                   int64_t repo_id, int64_t symbol_id);

    void getCallers(const drogon::HttpRequestPtr& req,
                    std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                    int64_t repo_id, int64_t symbol_id);
};
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

GET    /api/v1/repos/{id}/files/{path}    (URL-encoded path)
  → 200:  { "data": { ...file detail with symbols in file... } }

GET    /api/v1/repos/{id}/files/{path}/content
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

### Visualization Data

```
GET    /api/v1/repos/{id}/graph/dependency
  → 200:  { "data": { "nodes": [...cytoscape nodes...], "edges": [...cytoscape edges...] } }

GET    /api/v1/repos/{id}/graph/call/{sym_id}?max_depth=3&max_fan_out=20
  → 200:  { "data": { "nodes": [...], "edges": [...] } }

GET    /api/v1/repos/{id}/graph/impact/{sym_id}?max_depth=5
  → 200:  { "data": { "nodes": [...], "edges": [...] } }
```

Graph endpoints return data in Cytoscape-compatible format:

```json
{
  "data": {
    "nodes": [
      { "data": { "id": "1847", "label": "handleRequest", "kind": "Function", "file": "src/api.ts" } }
    ],
    "edges": [
      { "data": { "id": "e1", "source": "1847", "target": "1901", "kind": "Calls" } }
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

Error format:
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

## Frontend Architecture

### Tech Stack

| Technology | Use |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool (fast HMR) |
| React Router v7 | Client-side routing |
| TanStack React Query | Server state, caching, pagination |
| Zustand | UI state (selected repo, active view, filters) |
| Cytoscape.js | Graph visualization |
| Monaco Editor | Code display |
| Recharts | Metrics charts |
| Tailwind CSS v4 | Styling |

### Pages

**Dashboard**: Repo stats cards, language breakdown, top issues  
**File Explorer**: File tree + Monaco code view + symbol gutter markers  
**Symbol Explorer**: Typeahead search, result list, detail panel with refs + mini call graph  
**Dependency Graph**: Interactive Cytoscape, module/file level, filter, dagre/cose-bilkent layouts  
**Call Graph**: Function selector, depth control, dagre layout, module-colored  
**Impact Analysis**: Symbol selector, breadth-first rings, affected file list  
**Metrics Page**: Summary cards, complexity histogram, module table, coupling plot  
**Search**: Typeahead, kind-filtered, result snippets

### Component Structure

```
Layout
├── TopBar (repo selector, global search, theme toggle)
├── Sidebar (navigation)
└── Content (route-based pages)

Common: CodeBlock, SymbolBadge, Breadcrumb, LoadingSkeleton, EmptyState, Pagination
Graph: GraphContainer (Cytoscape), GraphControls, GraphTooltip, GraphFilter
Pages: Dashboard, FileExplorer, SymbolExplorer, Dependency, CallGraph, Impact, Metrics, Search
```

### State Management

```
TanStack React Query — all API data cached
Zustand — UI state (selectedRepo, activeView, filters, preferences)
URL params — shareable view links
```

### Build & Deployment

```bash
# Development
cd apps/web && npm run dev         # :5173, proxies /api to :8080

# Production build
npm run build                      # Outputs to apps/web/dist/

# In C++ binary: either embedded via custom resource compilation
# or shipped alongside as a directory (simpler approach)
```

Frontend gets embedded in the binary via CMake resource compilation, or shipped alongside as a static directory that Drogon serves. The `astera serve` command serves both API and frontend from port 8080.
