# Astera — Repository Structure (Rust)

## Top-Level Layout

```
astera/
├── Cargo.toml                 # Workspace root — defines crate members
├── Cargo.lock
├── rust-toolchain.toml        # MSRV pinning (1.80+)
├── README.md
├── LICENSE                    # MIT or Apache 2.0
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml             # cargo build, test, clippy, fmt
│       └── release.yml        # Cargo publish, binary release
│
├── crates/
│   ├── astera-core/           # Foundation types — NodeKind, EdgeKind, Span, Config
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   ├── astera-discovery/      # Filesystem walk, gitignore, language classifier
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   ├── astera-parser/         # Tree-sitter integration, language extractors
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── parsers/
│   │       │   ├── mod.rs
│   │       │   ├── typescript.rs
│   │       │   ├── python.rs
│   │       │   └── rust.rs
│   │       └── extractors/
│   │           ├── mod.rs
│   │           ├── ts_extractor.rs
│   │           ├── py_extractor.rs
│   │           └── rs_extractor.rs
│   │
│   ├── astera-resolver/       # Reference resolution, scoping (Phase 1.3+)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── scope.rs
│   │       └── imports.rs
│   │
│   ├── astera-graph/          # CPG builder, graph algorithms
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── builder.rs
│   │       └── algorithms.rs
│   │
│   ├── astera-storage/        # SQLite + FTS5 via rusqlite
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   ├── astera-metrics/        # Code metrics computation (Phase 2)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   ├── astera-impact/         # Change impact analysis (Phase 2)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   ├── astera-api/            # HTTP server — Axum routes
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── routes/
│   │       │   ├── mod.rs
│   │       │   ├── repos.rs
│   │       │   ├── files.rs
│   │       │   ├── symbols.rs
│   │       │   └── search.rs
│   │       └── middleware.rs
│   │
│   ├── astera/                # CLI binary
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       └── commands/
│   │           ├── mod.rs
│   │           ├── init.rs
│   │           ├── index.rs
│   │           ├── serve.rs
│   │           └── query.rs
│   │
│   ├── astera-watcher/        # File watching (notify crate, Phase 2)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   │
│   └── astera-export/         # Export formats (Phase 3)
│       ├── Cargo.toml
│       └── src/lib.rs
│
├── apps/
│   └── web/                   # React + Three.js frontend
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/           # API client (fetch wrapper + React Query hooks)
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── FileExplorer.tsx
│           │   ├── SymbolExplorer.tsx
│           │   ├── CallGraph.tsx
│           │   ├── DependencyGraph.tsx
│           │   ├── ImpactAnalysis.tsx
│           │   ├── Metrics.tsx
│           │   └── Search.tsx
│           ├── components/
│           │   ├── common/    # CodeBlock, SymbolBadge, Breadcrumb, LoadingSkeleton
│           │   ├── graph/     # 3D graph components
│           │   │   ├── GraphScene.tsx
│           │   │   ├── ForceDirectedGraph.tsx
│           │   │   ├── Node.tsx
│           │   │   ├── Edge.tsx
│           │   │   ├── NodeLabel.tsx
│           │   │   ├── GraphControls.tsx
│           │   │   ├── GraphOverlay.tsx
│           │   │   ├── FilterPanel.tsx
│           │   │   └── MiniMap.tsx
│           │   ├── code/      # Monaco Editor wrapper
│           │   └── layout/    # TopBar, Sidebar, Content
│           ├── hooks/         # Custom hooks (useGraphSelection, useCamera)
│           ├── stores/        # Zustand stores
│           ├── types/         # TypeScript types
│           └── utils/         # Force simulation, layout helpers
│
├── tests/                    # Integration tests
│   ├── fixtures/
│   │   ├── ts-project/       # Small TypeScript repo
│   │   ├── python-project/   # Small Python repo
│   │   └── mixed-project/    # Mixed language repo
│   └── integration/
│       ├── test_indexing.rs
│       ├── test_api.rs
│       └── test_queries.rs
│
├── docs/
│   ├── README.md
│   ├── getting-started.md
│   ├── architecture.md
│   ├── api-reference.md       # Generated from utoipa
│   ├── configuration.md
│   ├── development.md
│   ├── cli-reference.md
│   ├── language-support.md
│   ├── faq.md
│   └── guides/
│       ├── ci-integration.md
│       └── contributing.md
│
├── _archive/                 # Deprecated C++ implementation (kept for reference)
│   ├── cmake/
│   ├── include/
│   ├── src/
│   └── ...
│
└── .agents/                  # Design docs and plans
    └── plans/
```

## Crate Dependencies

```
astera-core        → (no internal deps)
astera-discovery   → astera-core
astera-parser      → astera-core
astera-resolver    → astera-core
astera-graph       → astera-core
astera-storage     → astera-core
astera-metrics     → astera-core
astera-impact      → astera-graph
astera-api         → astera-core, astera-storage
astera (binary)    → all crates
astera-watcher     → astera-core, astera-storage
astera-export      → astera-core, astera-storage
```

## Key Dependencies (crates.io)

| Crate | Purpose |
|---|---|
| `tree-sitter` + language grammars | Multi-language parsing |
| `rusqlite` (bundled) | Storage engine |
| `axum` + `tokio` | HTTP server + async runtime |
| `tower-http` | CORS, trace middleware |
| `utoipa` + `utoipa-swagger-ui` | OpenAPI spec generation |
| `clap` (derive) | CLI argument parsing |
| `serde` / `serde_json` | Serialization |
| `tracing` / `tracing-subscriber` | Structured logging |
| `rayon` | Parallelism |
| `ignore` + `walkdir` | Gitignore-aware filesystem walk |
| `sha2` | Content hashing |
| `chrono` | Timestamps |
| `notify` | File system watching (Phase 2) |
| `thiserror` / `anyhow` | Error handling |

**Frontend:**
| Package | Purpose |
|---|---|
| `react` / `react-dom` | UI framework |
| `typescript` | Type safety |
| `vite` | Build tool |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | R3F helpers (controls, text, shapes) |
| `three` | WebGL 3D engine |
| `@tanstack/react-query` | Server state |
| `zustand` | UI state |
| `react-router-dom` | Routing |
| `monaco-editor` | Code display |
| `tailwindcss` | Styling |
| `recharts` | Metrics charts |
| `rust-embed` | Embed frontend dist in binary |

## Conventions

### Rust
- **Edition 2021** — idiomatic Rust patterns
- **No `unsafe`** in application code (tree-sitter crate uses it internally)
- **`Result<T, E>`** via `anyhow::Result` in public API, specific error types internally
- **`#[derive(Debug, Clone, Serialize, Deserialize)]`** on all data types
- **Module structure**: `mod.rs` or files named `module.rs` — follow rustfmt defaults
- **Naming**: `snake_case` for functions/vars, `PascalCase` for types, `SCREAMING_CASE` for constants
- **Doc comments**: `///` on public API, `//` on internals
- **Tests**: inline `#[cfg(test)] mod tests` in source files

### TypeScript / Frontend
- Strict TypeScript, no `any`
- PascalCase components, camelCase functions/vars
- React Query for all API calls
- Three.js scene objects wrapped in R3F components

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`
- Single-line commit messages, no trailers
- `.astera/` in `.gitignore`

### Testing
- `#[test]` for unit tests alongside code
- `#[cfg(test)]` module in every source file
- Integration tests in `tests/` directory
- `criterion` for benchmarks (Phase 2)
- Golden file tests for parser output

## Build Commands

```bash
# Build all
cargo build

# Run all tests
cargo test

# Run specific test
cargo test -p astera-parser -- test_ts_extraction

# Lint
cargo clippy --workspace -- -D warnings

# Format
cargo fmt --check

# Frontend dev
cd apps/web && npm run dev

# Frontend build
cd apps/web && npm run build

# Full release build
cargo build --release
```
