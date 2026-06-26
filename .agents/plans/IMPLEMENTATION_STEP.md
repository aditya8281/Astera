# Astera — Implementation Step

## Current Status

**Phase 1.1 (Foundation)**: 6/7 items complete — core types, discovery, storage, parser, CLI all built and tested. CI yml is the only remaining item.

**Phase 1.2 (Parser Depth)**: 5/6 items complete — call graph extraction done, 5 languages supported (TS/JS, Python, Rust, Go). Resolver is the remaining item.

**Phase 1.3 (API Server)**: Axum HTTP server complete — 7 endpoints, CORS, 7 integration tests.

Last build: 57 tests pass — 6 core + 8 discovery + 27 parser + 9 storage + 7 API.

| Crate | Tests | Status |
|---|---|---|
| astera-core | 6 | ✅ |
| astera-discovery | 8 | ✅ |
| astera-parser | 27 | ✅ 4 languages, call graph, containment |
| astera-storage | 9 | ✅ FTS5+LIKE fallback |
| astera-cli | 0 | ✅ Builds, edge mapping implemented |

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

# Explore via CLI
./target/release/astera query symbols
./target/release/astera query edges

# Serve API + 3D frontend
./target/release/astera serve --port 8080
# Open http://localhost:8080
```

## Repository

```
astera/                    # Cargo workspace (Rust backend)
├── crates/               # 12 workspace crates
├── apps/web/             # React + Three.js frontend
├── tests/                # Test fixtures + integration tests
└── docs/                 # Documentation
```

See [05-repo-structure.md](./05-repo-structure.md) for full layout.

## Development Commands

```bash
# Build all
cargo build

# Run all tests
cargo test

# Run specific test
cargo test -p astera-parser -- test_ts_extraction

# Lint
cargo clippy --workspace -- -D warnings

# Format check
cargo fmt --check

# Watch mode (frontend)
cd apps/web && npm run dev

# API server + dev frontend
./target/debug/astera serve
```

## Build Pipeline

```
Source → cargo build → astera binary (statically linked)
Web app → vite build → dist/ → embedded via rust-embed
```

The binary ships with the frontend embedded. Single deployment artifact.

## Phase Sequence

| Phase | Duration | Goal |
|---|---|---|
| [Phase 1](./04-phases.md#phase-1-core-engine--mvp) | ~8 weeks | Working MVP: TS/JS + Python + Rust indexing, CLI, 3D web UI |
| [Phase 2](./04-phases.md#phase-2-analysis-depth--rich-visualization) | 8 weeks | Deep analysis, richer 3D, file watching, metrics |
| [Phase 3](./04-phases.md#phase-3-advanced-features) | 8 weeks | Plugins, exports, CI integration, architecture rules |
| [Phase 4](./04-phases.md#phase-4-ecosystem--scale) | Ongoing | IDE plugins, SDKs, scale, community |

## Testing Strategy

```
Unit tests       → #[test] alongside every module
Golden file tests→ Parse fixtures, compare JSON snapshots
Integration tests→ Index test repos, verify API responses
Property tests   → proptest for graph invariants
Benchmarks       → criterion for parsing, indexing, query latency
```

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

## Language Support Rollout

| Language | Phase | Notes |
|---|---|---|
| TypeScript / JavaScript | 1 | Primary focus — excellent tree-sitter grammar |
| Python | 1 | Very good tree-sitter grammar |
| Rust | 1 | Excellent grammar, complex module resolution |
| Go | 1 | Good grammar, simple module system |
| C / C++ | 3 | Large surface area, preprocessor complexity |
| Java | 3 | Very good grammar, complex type system |
| Ruby, PHP, Swift, Kotlin, Scala | 4 | Community-demand driven |

## Design Documents Index

| Document | Covers |
|---|---|
| [GUIDE.md](./GUIDE.md) | Product vision, philosophy, success criteria |
| [00-architecture.md](./00-architecture.md) | System architecture, subsystems, data flow |
| [01-data-model.md](./01-data-model.md) | Code Property Graph, SQLite schema, storage |
| [02-analysis-pipeline.md](./02-analysis-pipeline.md) | Parsing pipeline, incremental updates |
| [03-api-frontend.md](./03-api-frontend.md) | REST API, 3D frontend architecture, visualization |
| [04-phases.md](./04-phases.md) | Phase 1-4 detailed plans (Rust adapted) |
| [05-repo-structure.md](./05-repo-structure.md) | Code organization, conventions, file layout |
