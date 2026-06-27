# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-27

### Added

- Multi-language parsing (TypeScript, JavaScript, Python, Rust, Go, C, C++, Java) via tree-sitter 0.25
- Code Property Graph with symbols, call graphs, dependency graphs, containment hierarchy
- SQLite storage with FTS5 full-text search (BM25 ranking)
- CLI with init, index, query, serve, watch, export, stats, workspace, bench commands
- REST API with 12 endpoints + WebSocket live event stream
- Interactive 3D web UI with React Three Fiber force-directed graph (LOD, instancing, minimap)
- Code metrics: cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability
- Change impact analysis via BFS transitive closure with critical path computation
- Circular dependency detection via Tarjan's SCC
- Export to JSON, CSV, DOT (Graphviz)
- Git-aware diff analysis
- Architecture rule validation (layer constraint checking)
- File watching with incremental re-indexing
- Plugin system: trait-based, native loading, 2 built-in analyzers (pattern checker, metrics summary)
- Benchmark regression tracking with baseline storage and severity classification
- Multi-repo workspace support (WorkspaceConfig, workspace commands)
- Frontend embedded in binary via rust-embed (single release binary)
- WebSocket live events for re-index progress with temporal animation
- Temporal animation for graph updates (fade-in/out for added/removed nodes, glow rings)
- Plugin registry UI with findings display and severity badges
- AI layer reservation for future LLM integration
- Pre-commit hook for impact checking
- GitHub Action for CI indexing (reusable action)
- GitHub Actions CI (check, test, fmt, clippy)
- GitHub Actions release workflow (cross-platform binaries)
- 153 tests across all crates
