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
- REST API with 17 endpoints + WebSocket live event stream
- Interactive 2D web UI with force-directed graph (Canvas 2D, LOD, particle background)
- Code metrics: cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability
- Change impact analysis via BFS transitive closure with critical path computation
- Circular dependency detection via Tarjan's SCC
- Export to JSON, CSV, DOT (Graphviz)
- Git-aware diff analysis
- Architecture rule validation (layer constraint checking)
- File watching with incremental re-indexing and deletion detection
- Plugin system: trait-based, native loading, 2 built-in analyzers (pattern checker, metrics summary)
- Benchmark regression tracking with baseline storage and severity classification
- Multi-repo workspace support (WorkspaceConfig, workspace commands)
- Frontend embedded in binary via rust-embed (single release binary)
- WebSocket live events for re-index progress
- Plugin registry UI with findings display and severity badges
- Pre-commit hook for impact checking
- GitHub Action for CI indexing (reusable action)
- GitHub Actions CI (check, test, fmt, clippy)
- GitHub Actions release workflow (cross-platform binaries)
- 154 tests across all crates

### Changed (2026-06-28)

- Graph visual overhaul: OLED black background, electric cyan accent, particle field, edge glow
- Watcher now detects ALL file system events including deleted files
- Added .c, .cpp, .java to file watcher extension list

### Added (2026-06-28)

- Broken reference detection: UnresolvedRef type, broken_refs table, /api/broken-refs endpoint, BrokenRefsPanel
- Dependency subtree on double-click: recursive BFS through callers + callees via /api/graph/subtree/{id}
- Resolver: find_unresolved_refs() method detecting UnresolvedCall, DeadImport, UnresolvedRef
- Design system polish pass (OverlayPanel, KeyboardShortcuts, CommandPalette, Sidebar, PerformanceOverlay)
- PRODUCT.md creation
