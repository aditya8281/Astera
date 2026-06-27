# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Astera — local-first static analysis engine. Parses repos into a queryable Code Property Graph (CPG) of symbols, calls, dependencies, and metrics. CLI + 3D Web UI. Single binary with embedded frontend.

- **Languages**: Rust (backend), TypeScript/React + Three.js (frontend)
- **Supported code languages**: TypeScript, JavaScript, Python, Rust, Go, C, C++, Java (8 total)
- **Build**: Cargo workspace
- **MSRV**: 1.80+
- **Tests**: 153 passing
- **Design docs**: `.agents/plans/` — read before implementing anything

## Commands

```bash
# Build
cargo build

# Run all tests (153 total)
cargo test

# Test specific crate
cargo test -p astera-parser -- test_ts_extraction

# Lint (must be zero warnings)
cargo clippy --workspace -- -D warnings

# Format
cargo fmt --check

# Frontend dev
cd apps/web && npm run dev

# Frontend build (embeds into binary via rust-embed)
cd apps/web && npm run build

# Release build (single binary with embedded frontend)
cargo build --release

# Run benchmarks
cargo bench

# Benchmark regression tracking
astera bench save              # Save baseline
astera bench check             # Compare against baseline
astera bench show              # Display saved baseline
```

## Commit Rule

After every logically complete change, commit with a single-line message. No co-authored-by or other trailers. Examples:
```
feat: add TypeScript symbol extraction for function declarations
fix: resolve crash on empty file parsing
chore: set up Rust workspace with crate structure
docs: update architecture for Rust + 3D frontend
```

## Design Rule

Before starting any design or architecture work, always invoke the `impeccable` skill first. This ensures design follows established patterns before code is written.

## Architecture

Backend organized as Cargo workspace crates under `crates/`:

| Crate | Responsibility |
|---|---|
| `astera-core` | NodeKind, EdgeKind, config, WorkspaceConfig, ArchitectureRule |
| `astera-discovery` | Filesystem walk, gitignore, language classification (8 langs) |
| `astera-parser` | Tree-sitter 0.25 integration, symbol extraction per language |
| `astera-resolver` | Reference resolution, import resolution |
| `astera-storage` | SQLite + FTS5 via rusqlite |
| `astera-metrics` | Complexity, coupling, importance scoring |
| `astera-impact` | BFS impact analysis, critical path, cycle detection, architecture rule validation |
| `astera-api` | Axum HTTP server (12 REST endpoints + WebSocket) + embedded frontend serving |
| `astera-plugins` | Plugin system: trait, registry, native/WASM loading, built-in pattern checker & metrics |
| `astera-export` | JSON, CSV, DOT export + git diff analysis |
| `astera-watcher` | File watching via notify crate |
| `astera` | CLAP entry point (binary crate) with workspace, bench, watch commands |

Key libs: tree-sitter 0.25 (parsing), rusqlite (storage), axum/tokio (HTTP + WebSocket), serde (JSON), rayon (parallel), tracing (logging), clap (CLI), rust-embed (frontend embedding).

Frontend: `apps/web/` — React + TypeScript + Vite + React Three Fiber (3D). Components:
- `Graph/` — 3D graph scene, node/edge instances, temporal animation, mini-map
- `Plugins/` — Plugin registry UI
- `AI/` — AI layer reservation for future LLM integration
- `Sidebar/`, `CommandPalette/`, `Overlay/` — Navigation and panels

## Key Files

- `Cargo.toml` — workspace membership + shared dependencies
- `.agents/plans/` — architecture and phase plans
- `crates/astera/src/benchmarks.rs` — benchmark regression tracking
- `crates/astera/src/main.rs` — CLI entry point (all commands)
- `crates/astera-api/src/ws.rs` — WebSocket live event broadcasting
- `.github/actions/astera-index/` — Reusable GitHub Action for CI
- `hooks/pre-commit` — Pre-commit hook for impact checking

## CLI Commands

```
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

## Conventions

- Rust edition 2021 — idiomatic Rust patterns
- No `unsafe` in application code
- `#[derive(Debug, Clone, Serialize, Deserialize)]` on data types
- `anyhow::Result` for fallible functions
- Snake_case functions/vars, PascalCase types
- `#[cfg(test)] mod tests` in every source file
- Conventional commits for git history
- `pub(crate)` for internal APIs, `pub` only for cross-crate interfaces
