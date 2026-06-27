# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-27

### Added

- Multi-language parsing (TypeScript, JavaScript, Python, Rust, Go) via tree-sitter
- Code Property Graph with symbols, call graphs, dependency graphs, containment hierarchy
- SQLite storage with FTS5 full-text search
- CLI with init, index, query, serve, watch, export, stats commands
- REST API with 11 endpoints (stats, files, symbols, edges, search, modules, children, dependency, metrics, impact)
- Interactive 3D web UI with React Three Fiber force-directed graph
- Code metrics: cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling
- Change impact analysis via BFS transitive closure
- Circular dependency detection via Tarjan's SCC
- Export to JSON, CSV, DOT (Graphviz)
- File watching with incremental re-indexing
- Comprehensive benchmark suite (73 benchmarks across 11 groups, criterion)
- GitHub Actions CI (check, test, fmt, clippy)
- GitHub Actions release workflow (cross-platform binaries)
