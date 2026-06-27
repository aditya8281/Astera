# Astera

[![CI](https://github.com/user/astera/actions/workflows/ci.yml/badge.svg)](https://github.com/user/astera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust 1.80+](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org)
[![Release](https://img.shields.io/github/v/release/user/astera)](https://github.com/user/astera/releases)

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
- **File watching** — automatic re-index on file changes with debounced batch updates

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust | 1.80+ | `rustup install stable` |
| Node.js | 20+ | Only needed for frontend dev |
| clang/LLVM | Any recent | Required by tree-sitter grammar builds |

## Install

```bash
# Option 1: Install from source (requires Rust)
cargo install astera

# Option 2: Download pre-built binary from GitHub Releases
# https://github.com/user/astera/releases
# Available for Linux (x86_64, aarch64), macOS (x86_64, aarch64), Windows (x86_64)

# Option 3: Build locally from git clone
git clone https://github.com/user/astera.git
cd astera
cargo build --release
# Binary at: target/release/astera
```

## Uninstall

```bash
cargo uninstall astera
```

To also remove the index data, delete the `.astera/` directory from any repo you indexed:

```bash
rm -rf /path/to/your/project/.astera
```

## Quick Start

```bash
# 1. Navigate to any codebase
cd /path/to/your/project

# 2. Initialize Astera
astera init

# 3. Index the codebase (builds the full CPG)
astera index

# 4a. Start the API + Web UI (single command)
astera serve --port 8080
# Open http://localhost:8080

# 4b. OR just use the CLI
astera query symbols --kind Function
astera query edges --kind Calls
```

## Step-by-Step Usage

### 1. Initialize

Creates a `.astera/` directory at your repo root with the SQLite database:

```bash
cd /path/to/your/project
astera init
```

### 2. Index

Parses all source files and builds the code property graph:

```bash
astera index
```

Output shows what was indexed:
```
Indexing repository: /path/to/your/project
Found 476 parseable files
Indexing 476 files (0 unchanged, skipped)

Index complete:
  Files:        476 (476 indexed, 0 skipped)
  Symbols:      3,241
  Edges:        1,847
  Time:         2,340ms
```

Re-running `astera index` skips unchanged files (hash comparison).

### 3. Query (CLI)

```bash
# List all indexed symbols (with file paths)
astera query symbols

# Filter by kind
astera query symbols --kind Function
astera query symbols --kind Class
astera query symbols --kind Import

# Filter by name
astera query symbols --name "handleRequest"

# Full-text search across all symbols
astera query search "handle"

# List indexed files
astera query files

# Filter files by language
astera query files --language python

# List all edges (relationships)
astera query edges

# Filter edges by kind
astera query edges --kind Calls
astera query edges --kind Contains

# Show index statistics
astera stats

# Export graph to JSON, CSV, or DOT
astera export --output graph.json
astera export --output graph.dot
```

### 4. API Server + Web UI

```bash
# Start the server (serves both API and web UI)
astera serve --port 8080
```

Open `http://localhost:8080` in your browser for the 3D graph visualization.

#### API Endpoints

All endpoints return `{ data, meta: { count, elapsed_ms } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Index statistics (file/symbol/edge counts) |
| GET | `/api/files` | List all indexed files |
| GET | `/api/symbols` | List symbols (query: `?kind=`, `?name=`) |
| GET | `/api/symbols/{id}` | Get a single symbol by ID |
| GET | `/api/edges` | List edges (query: `?kind=`, `?source_node_id=`, `?target_node_id=`) |
| GET | `/api/search?q=` | Full-text search across symbols |
| GET | `/api/graph/modules` | Module-level summary (container kinds + child counts + importance) |
| GET | `/api/graph/children/{id}` | Children of a node (for drill-down navigation) |
| GET | `/api/graph/dependency` | Dependency graph data (nodes + edges) |
| GET | `/api/metrics` | Code metrics (complexity, coupling, circular deps) |
| GET | `/api/impact?root_id=` | Impact analysis (query: `?root_id=`, `?max_depth=`, `?direction=reverse`) |

#### Example API Calls

```bash
# Get stats
curl http://localhost:8080/api/stats

# Search for symbols
curl "http://localhost:8080/api/search?q=handle"

# Get symbols filtered by kind
curl "http://localhost:8080/api/symbols?kind=Function"

# Get dependency graph
curl http://localhost:8080/api/graph/dependency

# Get metrics
curl http://localhost:8080/api/metrics

# Impact analysis (what does symbol 42 affect?)
curl "http://localhost:8080/api/impact?root_id=42&direction=forward"
```

### 5. File Watching (Auto Re-index)

```bash
# Watch for changes + auto re-index + serve API
astera watch --port 8080
```

Files are watched recursively. Changes are debounced (500ms) and only changed files are re-indexed.

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
- **Metrics** — Cyclomatic/cognitive complexity, coupling, circular dependency detection
- **Impact** — What-if change impact analysis via BFS transitive closure

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   CLI (astera)                    │
│       init | index | query | serve | watch        │
└────────────┬─────────────────────┬───────────────┘
             │                     │
             ▼                     ▼
┌────────────────────┐  ┌─────────────────────┐
│  Indexer Pipeline   │  │  HTTP Server (Axum) │
│  Discover → Parse → │  │  REST API → JSON    │
│  Extract → Store    │  │  + Static Files     │
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
| `astera-api` | Axum HTTP server with REST endpoints + static file serving |
| `astera` | Clap-based CLI entry point (binary crate) |
| `astera-watcher` | File watching via notify crate |

### Frontend

| Directory | Purpose |
|---|---|
| `apps/web/src/components/Graph3D.tsx` | 3D force-directed graph (React Three Fiber) |
| `apps/web/src/components/Layout.tsx` | Sidebar with nav + kind filters |
| `apps/web/src/pages/` | Graph, Symbols, Files, Metrics, Impact pages |
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
# Run all tests (104 total)
cargo test

# Test a specific crate
cargo test -p astera-parser -- test_ts_extraction
cargo test -p astera-storage
cargo test -p astera-impact

# Run a specific test
cargo test -p astera-parser -- test_ts_call_graph

# Run benchmarks (73 benchmarks, 11 groups)
cargo bench --bench astera_bench
```

## Data Model

Astera builds a **Code Property Graph** with two core entities:

**Nodes** — symbols (functions, classes, methods, imports, variables, etc.) with source location
**Edges** — relationships (Calls, Contains, References, DependsOn, Inherits, etc.)

The graph is stored in SQLite and queried via SQL or the REST API. The 3D frontend renders it as a force-directed layout where nodes are color-coded by kind and edges show relationships.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow, and code style.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
