# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Astera — local-first static analysis engine. Parses repos into a queryable Code Property Graph (CPG) of symbols, calls, dependencies, and metrics. CLI + Web UI.

- **Language**: C++20 (backend), TypeScript/React (frontend)
- **Build**: CMake 3.28+ with vcpkg manifest mode
- **Compiler**: GCC 13+ or Clang 16+
- **Design docs**: `.agents/plans/` — read before implementing anything

## Commands

```bash
# Build
cmake --preset debug && cmake --build build/debug

# Test specific target
./build/debug/tests/test_parser --gtest_filter="*TypeScript*"

# Run all tests
ctest --preset debug

# Lint
cmake --build build/debug --target clang-tidy

# Format
cmake --build build/debug --target clang-format

# Frontend dev
cd apps/web && npm run dev

# Frontend build
cd apps/web && npm run build
```

## Commit Rule

After every logically complete change, commit with a single-line message. No co-authored-by or other trailers. Examples:
```
feat: add TypeScript symbol extraction for function declarations
fix: resolve crash on empty file parsing
chore: set up vcpkg manifest with dependencies
docs: update architecture diagram in 00-architecture.md
```

## Design Rule

Before starting any design or architecture work, always invoke the `impeccable` skill first. This ensures design follows established patterns before code is written.

## Architecture

Backend is organized as modules under `include/astera/` + `src/`:

| Module | Responsibility |
|---|---|
| `core` | NodeKind, EdgeKind, config, error types |
| `discovery` | Filesystem walk, gitignore, language classification |
| `parser` | Tree-sitter integration, symbol extraction |
| `resolver` | Reference resolution, import resolution |
| `graph` | CPG builder, graph algorithms |
| `storage` | SQLite + FTS5 layer |
| `metrics` | Complexity, coupling, cohesion (Phase 2) |
| `impact` | Change impact analysis (Phase 2) |
| `api` | Drogon HTTP server, routes, middleware |
| `cli` | CLI11 entry point |
| `watcher` | File watching, incremental updates (Phase 2) |
| `export` | Export/import formats (Phase 3) |

Key libs: Drogon (HTTP), tree-sitter (parsing), SQLite3 (storage), nlohmann/json (JSON), oneTBB (parallel), spdlog (logging), Google Test (testing), CLI11 (CLI).

## Key Files

- `vcpkg.json` — all third-party dependencies
- `CMakePresets.json` — build configurations
- `.agents/plans/` — architecture and phase plans

## Conventions

- C++20 with `std::format`, `std::span`
- No raw `new`/`delete` — use RAII, `unique_ptr`, or flat arrays
- Error handling: `Result<T,E>` or `std::optional` in hot paths, exceptions for infra
- Headers: `.h`, one class per header or closely related group
- Namespaces: `astera::core`, `astera::parser`, etc.
- clang-format with LLVM style, 100 column limit
- No `#pragma once` — use `#ifndef` guards
