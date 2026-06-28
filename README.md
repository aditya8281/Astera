# Astera

[![CI](https://github.com/user/astera/actions/workflows/ci.yml/badge.svg)](https://github.com/user/astera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust 1.80+](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org)

Local-first static analysis engine that parses codebases into a queryable Code Property Graph (CPG). CLI + REST API + interactive 2D web UI. Single binary with embedded frontend.

## Features

- **Multi-language parsing** — TypeScript, JavaScript, Python, Rust, Go, C, C++, Java (8 languages) via tree-sitter 0.25
- **Code Property Graph** — symbols, call graphs, dependency graphs, containment hierarchy
- **Broken reference detection** — finds unresolved calls, dead imports, dangling identifiers
- **Dependency subtree visualization** — double-click any node to explore its full recursive dependency tree (callers + callees)
- **Interactive graph** — 2D force-directed layout with hover glow, edge animation, particle background, LOD for large graphs
- **Full-text search** — FTS5 with BM25 ranking over all indexed symbols
- **Code metrics** — cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability, Tarjan's SCC
- **Impact analysis** — BFS transitive closure (forward/reverse) with critical path computation
- **Architecture rule validation** — layer constraint checking with glob matching
- **File watching** — automatic re-index on file changes (all file types), deletion detection, WebSocket broadcast
- **Plugin system** — trait-based native plugins with 2 built-in analyzers
- **Benchmark regression tracking** — save baselines, detect regressions by severity
- **Multi-repo workspace** — manage multiple repos from one config
- **Git-aware analysis** — diff-based change impact
- **Export** — JSON, CSV, DOT (Graphviz) graph export
- **SQLite storage** — zero-setup, embedded, portable `.astera/` directory

## Install

```bash
# From source
cargo install --path crates/astera

# Or build locally
git clone https://github.com/user/astera.git
cd astera
cargo build --release
# Binary at: target/release/astera
```

**Prerequisites:** Rust 1.80+, clang/LLVM (for tree-sitter grammar builds). Node.js 20+ only for frontend dev.

## Quick Start

```bash
# 1. Navigate to any codebase
cd /path/to/your/project

# 2. Initialize Astera
astera init

# 3. Index the codebase
astera index

# 4a. Start the API + Web UI
astera serve
# Open http://localhost:8080

# 4b. OR use the CLI
astera query symbols --kind Function
astera query edges --kind Calls
astera query search --query "parse"
```

## CLI Commands

```bash
astera init                    # Initialize .astera index
astera index                   # Index current repo (4-phase pipeline)
astera serve                   # Start API + embedded web UI (auto port)
astera watch                   # Watch files + re-index + serve
astera query symbols|edges|files|search
astera stats                   # Show index statistics
astera export -o graph.json    # Export graph (JSON/CSV/DOT)
astera workspace init|add|remove|list|index|stats
astera bench save|check|show|report
```

## API Endpoints (17)

All endpoints return `{ data, meta: { count, elapsed_ms } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Index statistics (file/symbol/edge counts) |
| GET | `/api/files` | List all indexed files |
| GET | `/api/symbols` | List symbols (?kind=, ?name=, ?file_id=) |
| GET | `/api/symbols/{id}` | Single symbol detail |
| GET | `/api/edges` | List edges (?kind=, ?source_node_id=, ?target_node_id=) |
| GET | `/api/search?q=` | Full-text search across symbols |
| GET | `/api/graph/modules` | Container-level summaries with importance |
| GET | `/api/graph/children/{id}` | Direct children for drill-down |
| GET | `/api/graph/subtree/{id}` | Recursive BFS dependency tree (?max_depth=) |
| GET | `/api/graph/dependency` | Full dependency graph with importance |
| GET | `/api/metrics` | Cyclomatic/cognitive complexity, circular deps |
| GET | `/api/impact` | Impact analysis (?root_id=, ?max_depth=, ?direction=) |
| GET | `/api/broken-refs` | Unresolved calls, dead imports (?kind=) |
| GET | `/api/snapshots` | Repository evolution snapshots |
| POST | `/api/snapshots` | Save snapshot |
| GET | `/api/trend` | Metric trend across snapshots (?q=metric_name) |
| WS | `/api/events` | WebSocket live event stream |

## Frontend

- **Graph** — Interactive 2D force-directed graph with kind filtering, hover glow, edge animation, dependency subtree drill-down
- **Symbols** — Searchable symbol list with kind filter
- **Files** — Indexed file listing with language, line count, size
- **Metrics** — Cyclomatic/cognitive complexity, coupling, circular dependency detection
- **Impact** — What-if change impact analysis
- **Broken Refs** — Unresolved references, dead imports, broken call graph detection
- **Plugins** — Run built-in analyzers, view findings

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   CLI (astera)                    │
│  init | index | query | serve | watch | bench     │
└────────────┬─────────────────────┬───────────────┘
             │                     │
             ▼                     ▼
┌────────────────────┐  ┌─────────────────────┐
│  Indexer Pipeline   │  │  HTTP Server (Axum) │
│  Discover → Parse → │  │  17 REST + WS       │
│  Extract → Resolve →│  │  + Embedded Web UI  │
│  Store              │  │                     │
└────────┬───────────┘  └────────┬────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────┐
│          SQLite + FTS5 Storage                │
│  files | nodes | edges | broken_refs         │
│  snapshots | metric_history | nodes_fts      │
└──────────────────────────────────────────────┘
```

### Workspace Crates (12)

| Crate | Purpose |
|---|---|
| `astera-core` | Shared types: NodeKind, EdgeKind, Node, Edge, UnresolvedRef, WorkspaceConfig |
| `astera-discovery` | Filesystem walk, gitignore, language classification (8 langs) |
| `astera-parser` | Tree-sitter 0.25 parsing, per-language extractors, call graph |
| `astera-resolver` | Scope chain, import/reference resolution, broken reference detection |
| `astera-storage` | SQLite + FTS5, batch inserts, graph cache, broken_refs table |
| `astera-metrics` | Complexity, coupling, instability, Tarjan's SCC |
| `astera-impact` | BFS impact analysis, critical path, architecture rule validation |
| `astera-api` | 17 REST endpoints + WebSocket + embedded frontend |
| `astera-plugins` | Plugin trait, registry, native loading, 2 built-in plugins |
| `astera-export` | JSON, CSV, DOT export + git diff analysis |
| `astera-watcher` | File watching, incremental re-index, deletion detection |
| `astera` | CLI binary entry point, benchmark regression tracking |

## Supported Languages

| Language | Symbols Extracted |
|---|---|
| TypeScript | Functions, classes, interfaces, enums, imports, type aliases, variables |
| JavaScript | Functions, classes, imports, variables |
| Python | Functions, classes, imports, module variables |
| Rust | Functions, structs, enums, traits, impl blocks, imports, type aliases |
| Go | Functions, methods, structs, interfaces, imports, variables |
| C | Functions, structs, enums, typedefs, includes |
| C++ | Classes, functions, namespaces, enums, includes, methods |
| Java | Classes, interfaces, enums, packages, imports, methods |

## Testing

```bash
# Run all tests (154 total)
cargo test

# Test a specific crate
cargo test -p astera-parser -- test_ts_extraction

# Lint (zero warnings required)
cargo clippy --workspace -- -D warnings

# Benchmarks
cargo bench
astera bench save    # Save baseline
astera bench check   # Compare against baseline
```

## Project Status

See [STATUS.md](STATUS.md) for detailed implementation status of every component.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow, and code style.

## License

[MIT](LICENSE)
