# Astera — Implementation Step

## Current Status

**Phase 1 (Core Engine — MVP)**: ✅ COMPLETE

**Phase 2 (Analysis & Rich Visualization)**: ✅ COMPLETE

All Phase 2 milestones achieved:
- Reference resolution (scope chain + import resolution for 5 languages)
- Code metrics (cyclomatic/cognitive complexity, coupling, circular deps via Tarjan's SCC)
- Impact analysis (BFS transitive closure, forward/reverse, critical path)
- File watching (notify v7, debounced, incremental re-index)
- Frontend serving (API server serves static files with SPA fallback)
- Frontend pages: Metrics + Impact added to existing Graph, Symbols, Files

**96 tests passing** — 6 core + 8 discovery + 27 parser + 25 resolver + 9 storage + 4 metrics + 7 impact + 9 API + 1 watcher.

| Crate | Tests | Status |
|---|---|---|
| astera-core | 6 | ✅ |
| astera-discovery | 8 | ✅ |
| astera-parser | 27 | ✅ 5 languages, call graph, containment |
| astera-resolver | 25 | ✅ scope chain, import resolution |
| astera-storage | 9 | ✅ FTS5+LIKE fallback |
| astera-metrics | 4 | ✅ cyclomatic/cognitive complexity, coupling, instability, Tarjan SCC |
| astera-impact | 7 | ✅ BFS transitive closure, critical path, cycle detection |
| astera | 0 | ✅ Builds, edge mapping, serve with --web-dir |
| astera-api | 9 | ✅ 9 REST endpoints (stats, files, symbols, edges, search, graph, metrics, impact, symbol-by-id) + static file serving |
| astera-watcher | 1 | ✅ notify v7 file watching, debounced incremental re-index |
| apps/web | — | ✅ 3D frontend, 5 pages (Graph, Symbols, Files, Metrics, Impact) |

## Prerequisites

- **Rust**: MSRV 1.80+ (`rustup`, stable toolchain)
- **Node.js**: ≥20 LTS (for web frontend)
- **clang/LLVM**: Required by tree-sitter grammar build

## Quick Start

```bash
# Build CLI
cargo build --release

# Index a repo
./target/release/astera init /path/to/repo
./target/release/astera index /path/to/repo

# Serve API + 3D frontend
./target/release/astera serve --port 8080
# Open http://localhost:8080

# OR: explore via CLI
./target/release/astera query symbols
./target/release/astera query edges --kind Calls
```

## Repository

```
astera/                    # Cargo workspace (Rust backend)
├── crates/               # 10 workspace crates
│   ├── astera-core/      # Types, config, error types
│   ├── astera-discovery/ # Filesystem walk, language classification
│   ├── astera-parser/    # Tree-sitter integration, symbol extraction
│   ├── astera-resolver/  # Scope chain, import resolution
│   ├── astera-storage/   # SQLite + FTS5
│   ├── astera-metrics/   # Complexity, coupling, instability
│   ├── astera-impact/    # BFS impact analysis
│   ├── astera-api/       # Axum HTTP server + static file serving
│   ├── astera/           # CLI binary
│   └── astera-watcher/   # File watching via notify
├── apps/web/             # React + Three.js frontend
├── tests/                # Test fixtures + integration tests
└── docs/                 # Documentation
```

## Development Commands

```bash
# Build all
cargo build

# Run all tests
cargo test

# Run specific test
cargo test -p astera-parser -- test_ts_extraction

# Lint
cargo clippy --workspace

# Format check
cargo fmt --check

# Watch mode (frontend)
cd apps/web && npm run dev

# API server + dev frontend
./target/debug/astera serve
```

## Phase Sequence

| Phase | Status | Goal |
|---|---|---|
| [Phase 1](./04-phases.md#phase-1-core-engine--mvp) | ✅ Complete | Working MVP: 5 languages, CLI, 3D web UI |
| [Phase 2](./04-phases.md#phase-2-analysis-depth--rich-visualization) | ✅ Complete | Deep analysis, metrics, impact, file watching |
| [Phase 3](./04-phases.md#phase-3-advanced-features) | Next | Plugins, exports, CI integration, architecture rules |
| [Phase 4](./04-phases.md#phase-4-ecosystem--scale) | Planned | IDE plugins, SDKs, scale, community |

## Language Support

| Language | Phase | Status |
|---|---|---|
| TypeScript / JavaScript | 1 | ✅ Full extraction |
| Python | 1 | ✅ Full extraction |
| Rust | 1 | ✅ Full extraction |
| Go | 1 | ✅ Full extraction |
| C / C++ | 3 | Planned |
| Java | 3 | Planned |

## Key Dependencies

| Crate | Purpose |
|---|---|
| `tree-sitter` + language grammars | Multi-language parsing |
| `rusqlite` (bundled) | Storage engine |
| `axum` + `tokio` | HTTP server + async runtime |
| `clap` (derive) | CLI argument parsing |
| `serde` / `serde_json` | Serialization |
| `tracing` | Logging |
| `rayon` | Parallelism |
| `ignore` | Gitignore-aware file walk |
| `notify` v7 | File system watching |
| `mime_guess` | Static file MIME detection |

**Frontend:**
| Package | Purpose |
|---|---|
| `react` / `react-dom` | UI framework |
| `@react-three/fiber` + `drei` | 3D rendering (Three.js) |
| `three` | WebGL engine |
| `vite` | Build tool |
| `@tanstack/react-query` | Server state |
| `zustand` | UI state |
| `tailwindcss` | Styling |

## Design Documents Index

| Document | Covers |
|---|---|
| [GUIDE.md](./GUIDE.md) | Product vision, philosophy, success criteria |
| [00-architecture.md](./00-architecture.md) | System architecture, subsystems, data flow |
| [01-data-model.md](./01-data-model.md) | Code Property Graph, SQLite schema, storage |
| [02-analysis-pipeline.md](./02-analysis-pipeline.md) | Parsing pipeline, incremental updates |
| [03-api-frontend.md](./03-api-frontend.md) | REST API, 3D frontend architecture, visualization |
| [04-phases.md](./04-phases.md) | Phase 1-4 detailed plans |
| [05-repo-structure.md](./05-repo-structure.md) | Code organization, conventions, file layout |
