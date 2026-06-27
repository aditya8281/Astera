# Astera

[![CI](https://github.com/user/astera/actions/workflows/ci.yml/badge.svg)](https://github.com/user/astera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust 1.80+](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org)
[![Release](https://img.shields.io/github/v/release/user/astera)](https://github.com/user/astera/releases)

Local-first static analysis engine that parses codebases into a queryable Code Property Graph (CPG). CLI + REST API + interactive 3D web UI. Single binary with embedded frontend.

## Features

- **Multi-language parsing** — TypeScript, JavaScript, Python, Rust, Go, C, C++, Java (8 languages) via tree-sitter
- **Code Property Graph** — symbols, call graphs, dependency graphs, containment hierarchy
- **3D visualization** — force-directed graph layout with React Three Fiber, LOD, instancing, minimap
- **Full-text search** — FTS5 with BM25 ranking over all indexed symbols
- **Code metrics** — cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability
- **Impact analysis** — BFS transitive closure to see what a change affects
- **File watching** — automatic re-index on file changes with debounced batch updates
- **Plugin system** — trait-based native plugins with 2 built-in analyzers (pattern checker, metrics summary)
- **Benchmark regression tracking** — save baselines, detect regressions by severity
- **Multi-repo workspace** — manage multiple repos from one config
- **Git-aware analysis** — diff-based change impact
- **Architecture rule validation** — layer constraint checking
- **WebSocket live events** — real-time re-index progress notifications
- **CLI + API** — query from terminal or HTTP, export to JSON/CSV/DOT
- **SQLite storage** — zero-setup, embedded, portable `.astera/` directory

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

## Quick Start

```bash
# 1. Navigate to any codebase
cd /path/to/your/project

# 2. Initialize Astera
astera init

# 3. Index the codebase (builds the full CPG)
astera index

# 4a. Start the API + Web UI (single command, embedded frontend)
astera serve --port 8080
# Open http://localhost:8080

# 4b. OR just use the CLI
astera query symbols --kind Function
astera query edges --kind Calls
```

## CLI Commands

```bash
astera init                    # Initialize .astera index
astera index                   # Index current repo
astera serve                   # Start API + embedded web UI
astera watch                   # Watch + re-index + serve
astera query symbols|edges|files|search
astera stats                   # Show index statistics
astera export -o graph.json    # Export graph (JSON/CSV/DOT)
astera workspace init|add|remove|list|index|stats
astera bench save|check|show   # Benchmark regression tracking
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
| GET | `/api/graph/modules` | Module-level summary (container kinds + child counts + importance) |
| GET | `/api/graph/children/{id}` | Children of a node (for drill-down navigation) |
| GET | `/api/graph/dependency` | Dependency graph data (nodes + edges) |
| GET | `/api/metrics` | Code metrics (complexity, coupling, circular deps) |
| GET | `/api/impact?root_id=` | Impact analysis (query: `?root_id=`, `?max_depth=`, `?direction=reverse`) |
| WS | `/api/events` | WebSocket live event stream (re-index progress) |

## Frontend Pages

- **Graph** — Interactive 3D force-directed graph with node selection, kind filtering, search, LOD, instancing, minimap
- **Symbols** — Searchable symbol list with kind filter
- **Files** — Indexed file listing with language, line count, size
- **Metrics** — Cyclomatic/cognitive complexity, coupling, circular dependency detection
- **Impact** — What-if change impact analysis via BFS transitive closure
- **Plugins** — Run built-in analyzers, view findings by severity
- **AI** — Reserved panel for future LLM-powered code analysis

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   CLI (astera)                    │
│  init | index | query | serve | watch | bench     │
│  workspace                                       │
└────────────┬─────────────────────┬───────────────┘
             │                     │
             ▼                     ▼
┌────────────────────┐  ┌─────────────────────┐
│  Indexer Pipeline   │  │  HTTP Server (Axum) │
│  Discover → Parse → │  │  REST API → JSON    │
│  Extract → Store    │  │  + Embedded Web UI  │
│                     │  │  + WebSocket Events  │
└────────┬───────────┘  └────────┬────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────┐
│              SQLite + FTS5 Storage            │
│   nodes | edges | files | full-text index    │
└──────────────────────────────────────────────┘
```

### Workspace Crates (12)

| Crate | Purpose |
|---|---|
| `astera-core` | Shared types: NodeKind, EdgeKind, Node, Edge, FileInfo, WorkspaceConfig, ArchitectureRule |
| `astera-discovery` | Filesystem walk, gitignore, language classification (8 langs) |
| `astera-parser` | Tree-sitter parsing, symbol extraction for 8 languages |
| `astera-resolver` | Scope chain tracking, import/reference resolution |
| `astera-storage` | SQLite CRUD, FTS5, batch inserts |
| `astera-metrics` | Cyclomatic/cognitive complexity, coupling, instability |
| `astera-impact` | BFS impact analysis, critical path, cycle detection, architecture validation |
| `astera-api` | Axum HTTP server with 12 REST endpoints + WebSocket + embedded frontend |
| `astera-plugins` | Plugin trait, registry, native/WASM loading, 2 built-in plugins |
| `astera-export` | JSON, CSV, DOT export + git diff analysis |
| `astera-watcher` | File watching via notify crate |
| `astera` | Clap-based CLI entry point (binary crate) |

### Frontend

| Directory | Purpose |
|---|---|
| `apps/web/src/components/Graph/` | 3D graph scene, nodes, edges, temporal animation, minimap |
| `apps/web/src/components/Plugins/` | Plugin registry UI |
| `apps/web/src/components/AI/` | AI layer reservation for future LLM integration |
| `apps/web/src/components/Sidebar/` | Navigation and kind filters |
| `apps/web/src/pages/` | Graph, Symbols, Files, Metrics, Impact, Plugins, AI pages |
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
| C | Functions, structs, enums, typedefs, includes |
| C++ | Classes, functions, namespaces, templates, enums, includes |
| Java | Classes, interfaces, enums, packages, imports, methods |

## Testing

```bash
# Run all tests (153 total)
cargo test

# Test a specific crate
cargo test -p astera-parser -- test_ts_extraction
cargo test -p astera-storage
cargo test -p astera-impact
cargo test -p astera-plugins

# Run benchmarks
cargo bench

# Benchmark regression tracking
astera bench save              # Save baseline
astera bench check             # Compare against baseline
astera bench show              # Display saved baseline
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow, and code style.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
