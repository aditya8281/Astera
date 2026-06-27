# Astera — Implementation Step

## Current Status

**Phase 1 (Core Engine — MVP)**: ✅ COMPLETE

**Phase 2 (Analysis & Rich Visualization)**: ✅ COMPLETE

**Infrastructure & Polish**: ✅ COMPLETE

All Phase 2 milestones achieved:
- Reference resolution (scope chain + import resolution for 5 languages)
- Code metrics (cyclomatic/cognitive complexity, coupling, circular deps via Tarjan's SCC)
- Impact analysis (BFS transitive closure, forward/reverse, critical path)
- File watching (notify v7, debounced, incremental re-index)
- Frontend serving (API server serves static files with SPA fallback)
- Frontend pages: Metrics + Impact added to existing Graph, Symbols, Files
- Export to JSON, CSV, DOT formats (`astera-export` crate)
- `astera stats` command with full breakdown
- Edges display node names instead of raw IDs

Infrastructure complete:
- GitHub Actions CI (check, test, fmt, clippy)
- GitHub Actions release workflow (cross-platform binaries)
- LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG
- Issue templates (bug report, feature request) + PR template
- Workspace metadata (version, license, repository)
- README with badges and comprehensive documentation

**101 tests passing** — 6 core + 8 discovery + 27 parser + 25 resolver + 9 storage + 4 metrics + 7 impact + 9 API + 1 watcher + 5 export.

| Crate | Tests | Status |
|---|---|---|
| astera-core | 6 | ✅ |
| astera-discovery | 8 | ✅ |
| astera-parser | 27 | ✅ 5 languages, call graph, containment |
| astera-resolver | 25 | ✅ scope chain, import resolution |
| astera-storage | 9 | ✅ FTS5+LIKE fallback |
| astera-metrics | 4 | ✅ cyclomatic/cognitive complexity, coupling, instability, Tarjan SCC |
| astera-impact | 7 | ✅ BFS transitive closure, critical path, cycle detection |
| astera | 0 | ✅ Builds, all commands work |
| astera-api | 9 | ✅ 9 REST endpoints + static file serving |
| astera-watcher | 1 | ✅ notify v7 file watching, debounced incremental re-index |
| astera-export | 5 | ✅ JSON, CSV, DOT export |
| apps/web | — | ✅ 3D frontend, 5 pages (Graph, Symbols, Files, Metrics, Impact) |

## Prerequisites

- **Rust**: MSRV 1.80+ (`rustup`, stable toolchain)
- **Node.js**: ≥20 LTS (for web frontend)
- **clang/LLVM**: Required by tree-sitter grammar build

## Quick Start

```bash
# Install globally
cargo install astera

# OR: download from GitHub Releases
# https://github.com/user/astera/releases

# Navigate to any codebase
cd /path/to/your/project

# Initialize and index
astera init
astera index

# Serve API + 3D frontend
astera serve --port 8080
# Open http://localhost:8080

# OR: explore via CLI
astera query symbols
astera query edges --kind Calls
astera stats
```

## Repository

```
astera/                    # Cargo workspace (Rust backend)
├── crates/               # 11 workspace crates
│   ├── astera-core/      # Types, config, error types
│   ├── astera-discovery/ # Filesystem walk, language classification
│   ├── astera-parser/    # Tree-sitter integration, symbol extraction
│   ├── astera-resolver/  # Scope chain, import resolution
│   ├── astera-storage/   # SQLite + FTS5
│   ├── astera-metrics/   # Complexity, coupling, instability
│   ├── astera-impact/    # BFS impact analysis
│   ├── astera-export/    # JSON, CSV, DOT export
│   ├── astera-api/       # Axum HTTP server + static file serving
│   ├── astera-watcher/   # File watching via notify
│   └── astera/           # CLI binary
├── apps/web/             # React + Three.js frontend
├── .github/workflows/    # CI + release workflows
└── docs/                 # Documentation
```

## Development Commands

```bash
# Build all
cargo build

# Run all tests
cargo test --workspace

# Run specific test
cargo test -p astera-parser -- test_ts_extraction

# Lint (CI-strict)
cargo clippy --workspace -- -D warnings

# Format check
cargo fmt --check

# Install globally
cargo install --path crates/astera

# Frontend dev
cd apps/web && npm install && npm run dev
```

## Phase Sequence

| Phase | Status | Goal |
|---|---|---|
| [Phase 1](./04-phases.md#phase-1-core-engine--mvp) | ✅ Complete | Working MVP: 5 languages, CLI, 3D web UI |
| [Phase 2](./04-phases.md#phase-2-analysis-depth--rich-visualization) | ✅ Complete | Deep analysis, metrics, impact, file watching |
| Phase 3 | Next | Plugins, CI integration, architecture rules, C/C++/Java |
| Phase 4 | Planned | IDE plugins, SDKs, scale, community |

## What's Done (Phase 1-2 + Infrastructure)

- [x] 5 languages (TS/JS, Python, Rust, Go)
- [x] CLI: init, index, query, serve, watch, export, stats
- [x] REST API: 9 endpoints
- [x] 3D web UI: Graph, Symbols, Files, Metrics, Impact pages
- [x] Reference resolution (scope chain + imports)
- [x] Code metrics (complexity, coupling, circular deps)
- [x] Impact analysis (BFS transitive closure, critical path)
- [x] File watching + incremental re-index
- [x] Export to JSON, CSV, DOT
- [x] `astera stats` command
- [x] GitHub Actions CI + release workflows
- [x] Professional docs (LICENSE, CONTRIBUTING, SECURITY, CHANGELOG)
- [x] README with badges, install options, complete reference
- [x] Cross-platform safe (Path::join everywhere, bundled SQLite)

## What's Next (Phase 3)

- [ ] GitHub Action for CI indexing
- [ ] Pre-commit hook
- [ ] Architecture rule validation
- [ ] C/C++/Java grammar + extractors
- [ ] Multi-repo workspace support
- [ ] Frontend: LOD for large graphs, MiniMap, filter panel
- [ ] Performance benchmarks (criterion)
- [ ] Frontend embedding into binary (rust-embed)

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
