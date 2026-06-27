# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Astera — local-first static analysis engine. Parses repos into a queryable Code Property Graph (CPG) of symbols, calls, dependencies, and metrics. CLI + 3D Web UI.

- **Language**: Rust (backend), TypeScript/React + Three.js (frontend)
- **Build**: Cargo workspace
- **MSRV**: 1.80+
- **Design docs**: `.agents/plans/` — read before implementing anything

## Commands

```bash
# Build
cargo build

# Run all tests
cargo test

# Test specific crate
cargo test -p astera-parser -- test_ts_extraction

# Lint
cargo clippy --workspace -- -D warnings

# Format
cargo fmt --check

# Frontend dev
cd apps/web && npm run dev

# Frontend build
cd apps/web && npm run build

# Release build
cargo build --release
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
| `astera-core` | NodeKind, EdgeKind, config, error types |
| `astera-discovery` | Filesystem walk, gitignore, language classification |
| `astera-parser` | Tree-sitter integration, symbol extraction |
| `astera-resolver` | Reference resolution, import resolution |
| `astera-graph` | CPG builder, graph algorithms |
| `astera-storage` | SQLite + FTS5 via rusqlite |
| `astera-metrics` | Complexity, coupling, cohesion (Phase 2) |
| `astera-impact` | Change impact analysis (Phase 2) |
| `astera-api` | Axum HTTP server, routes, middleware |
| `astera` | CLAP entry point (binary crate) |
| `astera-watcher` | File watching via notify crate (Phase 2) |
| `astera-export` | Export/import formats (Phase 3) |

Key libs: tree-sitter (parsing), rusqlite (storage), axum/tokio (HTTP), serde (JSON), rayon (parallel), tracing (logging), clap (CLI).

Frontend: `apps/web/` — React + TypeScript + Vite + React Three Fiber (3D).

## Key Files

- `Cargo.toml` — workspace membership + shared dependencies
- `.agents/plans/` — architecture and phase plans

## Conventions

- Rust edition 2021 — idiomatic Rust patterns
- No `unsafe` in application code
- `#[derive(Debug, Clone, Serialize, Deserialize)]` on data types
- `anyhow::Result` for fallible functions
- Snake_case functions/vars, PascalCase types
- `#[cfg(test)] mod tests` in every source file
- Conventional commits for git history
