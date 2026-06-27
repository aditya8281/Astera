# Astera

Local-first static analysis engine that parses codebases into a queryable Code Property Graph (CPG). CLI + REST API + interactive 3D web UI.

## Features

- **Multi-language parsing** — TypeScript, JavaScript, Python, Rust, Go via tree-sitter
- **Code Property Graph** — symbols, call graphs, dependency graphs, containment hierarchy
- **3D visualization** — force-directed graph layout with React Three Fiber
- **Full-text search** — FTS5 with LIKE fallback over all indexed symbols
- **Code metrics** — cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability
- **Impact analysis** — BFS transitive closure to see what a change affects
- **CLI + API** — query from terminal or HTTP
- **SQLite storage** — zero-setup, embedded, portable `.astera/` directory

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust | 1.80+ | `rustup install stable` |
| Node.js | 20+ | Only needed for frontend dev |
| clang/LLVM | Any recent | Required by tree-sitter grammar builds |

## Install from Source

```bash
git clone https://github.com/your-username/astera.git
cd astera
cargo build --release
```

The binary will be at `target/release/astera`.

## Quick Start

```bash
# 1. Initialize an Astera index in your repo
astera init /path/to/your/repo

# 2. Index the codebase
astera index /path/to/your/repo

# 3. Query from CLI
astera query symbols
astera query symbols --kind Function
astera query edges --kind Calls

# 4. Start the API server + web UI
astera serve --port 8080
# Open http://localhost:8080
```

## CLI Commands

```
astera init [PATH]           Initialize .astera/ directory at repo root
astera index [PATH]          Parse and index all source files
astera query symbols         List indexed symbols
  --kind <KIND>              Filter by kind (Function, Class, etc.)
  --name <NAME>              Filter by name
astera query edges           List indexed edges
  --kind <KIND>              Filter by kind (Calls, Contains, etc.)
astera serve --port <PORT>   Start HTTP API server (default: 8080)
```

## API Endpoints

All endpoints return `{ data, meta: { count, elapsed_ms } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Index statistics (file/symbol/edge counts) |
| GET | `/api/files` | List all indexed files |
| GET | `/api/symbols` | List symbols (query: `?kind=`, `?name=`) |
| GET | `/api/symbols/{id}` | Get a single symbol by ID |
| GET | `/api/edges` | List edges (query: `?kind=`, `?source_node_id=`, `?target_node_id=`) |
| GET | `/api/search?q=` | Full-text search across symbols |
| GET | `/api/graph/dependency` | Dependency graph data (nodes + edges) |

### Example

```bash
# Get stats
curl http://localhost:8080/api/stats

# Search for symbols
curl "http://localhost:8080/api/search?q=handle"

# Get dependency graph
curl http://localhost:8080/api/graph/dependency
```

## Frontend Development

The web UI is a React + TypeScript app using React Three Fiber for 3D visualization.

```bash
cd apps/web

# Install dependencies
npm install

# Start dev server (proxies /api to localhost:8080)
npm run dev
# Open http://localhost:5173

# Production build
npm run build
```

### Pages

- **Graph** — Interactive 3D force-directed graph with node selection, kind filtering, search
- **Symbols** — Searchable symbol list with kind filter
- **Files** — Indexed file listing with language, line count, size

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   CLI (astera)                    │
│          init | index | query | serve             │
└────────────┬─────────────────────┬───────────────┘
             │                     │
             ▼                     ▼
┌────────────────────┐  ┌─────────────────────┐
│  Indexer Pipeline   │  │  HTTP Server (Axum) │
│  Discover → Parse → │  │  REST API → JSON    │
│  Extract → Store    │  │  CORS + Tracing     │
└────────┬───────────┘  └────────┬────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────┐
│              SQLite + FTS5 Storage            │
│   nodes | edges | files | full-text index    │
└──────────────────────────────────────────────┘
```

### Workspace Crates

| Crate | Purpose |
|---|---|
| `astera-core` | Shared types: NodeKind, EdgeKind, Node, Edge, FileInfo |
| `astera-discovery` | Filesystem walk, gitignore, language classification |
| `astera-parser` | Tree-sitter parsing, symbol extraction for 5 languages |
| `astera-resolver` | Scope chain tracking, import/reference resolution |
| `astera-storage` | SQLite CRUD, FTS5, batch inserts |
| `astera-metrics` | Cyclomatic/cognitive complexity, coupling, instability |
| `astera-impact` | BFS impact analysis, critical path, cycle detection |
| `astera-api` | Axum HTTP server with 7 REST endpoints |
| `astera-cli` | Clap-based CLI entry point |

### Frontend

| Directory | Purpose |
|---|---|
| `apps/web/src/components/Graph3D.tsx` | 3D force-directed graph (React Three Fiber) |
| `apps/web/src/components/Layout.tsx` | Sidebar with nav + kind filters |
| `apps/web/src/pages/` | Graph, Symbols, Files pages |
| `apps/web/src/store.ts` | Zustand UI state |
| `apps/web/src/api.ts` | React Query API client |

## Supported Languages

| Language | Symbols Extracted |
|---|---|
| TypeScript | Functions, classes, interfaces, enums, imports, type aliases, variables |
| JavaScript | Functions, classes, imports, variables |
| Python | Functions, classes, imports, module variables |
| Rust | Functions, structs, enums, traits, impl blocks, imports, type aliases |
| Go | Functions, methods, structs, interfaces, imports, variables |

## Testing

```bash
# Run all tests (93 total)
cargo test

# Test a specific crate
cargo test -p astera-parser
cargo test -p astera-storage
cargo test -p astera-impact

# Run a specific test
cargo test -p astera-parser -- test_ts_call_graph
```

## Data Model

Astera builds a **Code Property Graph** with two core entities:

**Nodes** — symbols (functions, classes, methods, imports, variables, etc.) with source location
**Edges** — relationships (Calls, Contains, References, DependsOn, Inherits, etc.)

The graph is stored in SQLite and queried via SQL or the REST API. The 3D frontend renders it as a force-directed layout where nodes are color-coded by kind and edges show relationships.

## License

MIT
