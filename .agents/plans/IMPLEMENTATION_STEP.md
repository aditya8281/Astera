# Astera — Implementation Step

## Prerequisites

- **Compiler**: GCC 13+ or Clang 16+ (C++20)
- **Build system**: CMake ≥3.28
- **Package manager**: vcpkg (manifest mode)
- **Node.js**: ≥20 LTS (for web frontend)

## Quick Start

```bash
# Clone and build
git clone <repo> && cd astera
cmake --preset release
cmake --build build/release

# Index a repo
./build/release/apps/cli/astera init /path/to/repo
./build/release/apps/cli/astera index /path/to/repo

# Explore
./build/release/apps/cli/astera serve --port 8080
# Open http://localhost:8080
```

## Repository

```
astera/                    # CMake project (C++ backend)
├── include/astera/       # Public headers (12 modules)
├── src/                  # Implementations
├── apps/cli/             # CLI binary
├── apps/web/             # React frontend
├── tests/                # Test fixtures + suites
└── docs/                 # Documentation
```

See [05-repo-structure.md](./05-repo-structure.md) for full layout.

## Development Commands

```bash
# Configure + build (debug)
cmake --preset debug
cmake --build build/debug

# Run all tests
ctest --preset debug

# Run specific test
./build/debug/tests/test_parser --gtest_filter="*TypeScript*"

# Lint
cmake --build build/debug --target clang-tidy

# Format check
cmake --build build/debug --target clang-format

# Watch mode (frontend)
cd apps/web && npm run dev

# API server + dev frontend
./build/debug/apps/cli/astera serve    # serves API on :8080
```

## Build Pipeline

```
Source → cmake + vcpkg → astera binary (statically linked)
Web app → vite build → dist/ → embedded in binary via cfile or similar
```

The binary ships with the frontend embedded. Single deployment artifact.

## Phase Sequence

| Phase | Duration | Goal |
|---|---|---|
| [Phase 1](./04-phases.md#phase-1-core-engine--mvp) | 10 weeks | Working MVP: TS/JS + Python indexing, CLI, basic web UI |
| [Phase 2](./04-phases.md#phase-2-analysis-depth--rich-visualization) | 8 weeks | Deep analysis, Rust/Go, rich web UI, file watching |
| [Phase 3](./04-phases.md#phase-3-advanced-features) | 8 weeks | Plugins, exports, CI integration, architecture rules |
| [Phase 4](./04-phases.md#phase-4-ecosystem--scale) | Ongoing | IDE plugins, SDKs, scale, community |

## Testing Strategy

```
Unit tests       → Every extractor, algorithm, metric function (Google Test)
Golden file tests→ Parse fixtures, compare JSON snapshots
Integration tests→ Index test repos, verify API responses
Property tests   → Graph invariants (no dangling edges, all nodes reachable)
Benchmarks       → Google Benchmark for parsing, indexing, query latency
Fuzz tests       → Invalid source should never crash parser
```

## Key Dependencies (vcpkg)

| Package | Purpose |
|---|---|
| `tree-sitter` + grammars | Multi-language parsing (C API) |
| `drogon` | HTTP server + WebSocket |
| `sqlite3` | Storage engine |
| `nlohmann-json` | JSON serialization |
| `cli11` | CLI argument parsing |
| `fmt` | String formatting |
| `spdlog` | Logging |
| `gtest` / `google-benchmark` | Testing + benchmarks |
| `tbb` | Parallelism (work-stealing thread pool) |
| `cxxopts` | CLI parsing (or CLI11) |
| `efsw` | Cross-platform file watching (Phase 2) |

## Language Support Rollout

| Language | Phase | Notes |
|---|---|---|
| TypeScript / JavaScript | 1 | Primary focus — tree-sitter grammar is excellent |
| Python | 1 | Very good tree-sitter grammar |
| Rust | 2 | Excellent grammar, complex module resolution |
| Go | 2 | Good grammar, simple module system |
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
| [03-api-frontend.md](./03-api-frontend.md) | REST API, frontend architecture, visualization |
| [04-phases.md](./04-phases.md) | Phase 1-4 detailed plans (C++ adapted) |
| [05-repo-structure.md](./05-repo-structure.md) | Code organization, conventions, file layout |
