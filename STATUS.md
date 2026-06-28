# Astera — Project Status

> Last updated: 2026-06-28

## Overview

Astera is a **local-first static analysis engine** that parses codebases into a queryable Code Property Graph (CPG). CLI + REST API + interactive 2D web UI. Single binary with embedded frontend.

**154 tests passing · 0 clippy warnings · 12 crates · 8 languages · 17 API endpoints**

---

## What's Implemented

### Backend (Rust, 12 crates)

| Crate | Status | What it does |
|---|---|---|
| `astera-core` | **Complete** | NodeKind (14 variants), EdgeKind (12 variants), SourceSpan, Node, Edge, FileInfo, AsteraConfig, WorkspaceConfig, ArchitectureRule, UnresolvedRef, BrokenRefKind, IndexReport |
| `astera-discovery` | **Complete** | Filesystem walk, gitignore support, language classification (8 langs), SHA-256 hashing |
| `astera-parser` | **Complete** | Tree-sitter 0.25 parsing for 8 languages, per-language extractors, call graph extraction, containment edges, error tolerance |
| `astera-resolver` | **Complete** | Scope chain tracking, import resolution (5 import kinds), reference resolution, broken reference detection (UnresolvedCall, DeadImport, UnresolvedRef) |
| `astera-storage` | **Complete** | SQLite + FTS5 (BM25), WAL mode, in-memory graph cache, files/nodes/edges/broken_refs/snapshots tables, batch inserts, CRUD for all entities |
| `astera-metrics` | **Complete** | Cyclomatic complexity, cognitive complexity, fan-in/fan-out coupling, instability, Tarjan's SCC for circular deps, importance scoring |
| `astera-impact` | **Complete** | BFS forward/reverse impact analysis, critical path, architecture rule validation with glob matching |
| `astera-plugins` | **Complete** | Plugin trait, PluginRegistry, native `.so/.dylib` loading, WASM support (optional), 2 built-in plugins (PatternChecker, MetricsSummary) |
| `astera-export` | **Complete** | JSON, CSV, DOT (Graphviz) export, git diff analysis |
| `astera-watcher` | **Complete** | Debounced file watching (notify), incremental re-index, deletion detection for all file types, WebSocket broadcast |
| `astera-api` | **Complete** | 17 REST endpoints + WebSocket, embedded frontend serving (rust-embed), CORS, tracing, auto port detection |
| `astera` (binary) | **Complete** | 7 commands + 18 subcommands, benchmark regression tracking, workspace management |

### CLI Commands

| Command | Status | Description |
|---|---|---|
| `astera init` | **Done** | Creates `.astera/` directory |
| `astera index` | **Done** | 4-phase pipeline: detect deletions → insert files → parse+extract → detect broken refs. Auto-saves snapshot |
| `astera serve` | **Done** | Auto-detects web UI, finds free port (8080-8180) |
| `astera watch` | **Done** | Spawns watcher thread + API server, broadcasts events via WebSocket |
| `astera query symbols` | **Done** | Filter by kind, name |
| `astera query edges` | **Done** | Filter by kind |
| `astera query files` | **Done** | Filter by language |
| `astera query search` | **Done** | Full-text search via FTS5/LIKE |
| `astera stats` | **Done** | File/symbol/edge counts with breakdown |
| `astera export -o file.{json,csv,dot}` | **Done** | Graph export in 3 formats |
| `astera workspace init/add/remove/list/index/stats` | **Done** | Full multi-repo workspace support |
| `astera bench save/check/show/report` | **Done** | Benchmark regression tracking with severity classification |

### REST API Endpoints (17)

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/stats` | **Done** | Index statistics (file/symbol/edge counts) |
| GET | `/api/files` | **Done** | List all indexed files |
| GET | `/api/symbols` | **Done** | List symbols (?kind=, ?name=, ?file_id=) |
| GET | `/api/symbols/{id}` | **Done** | Single symbol detail |
| GET | `/api/edges` | **Done** | List edges (?kind=, ?source_node_id=, ?target_node_id=) |
| GET | `/api/search` | **Done** | Full-text search (?q=) |
| GET | `/api/graph/modules` | **Done** | Container-level summaries with importance scores |
| GET | `/api/graph/children/{id}` | **Done** | Direct children for drill-down navigation |
| GET | `/api/graph/subtree/{id}` | **Done** | Recursive BFS dependency tree (callers + callees, configurable depth) |
| GET | `/api/graph/dependency` | **Done** | Full dependency graph with importance |
| GET | `/api/metrics` | **Done** | Cyclomatic/cognitive complexity, circular deps |
| GET | `/api/impact` | **Done** | Forward/reverse impact analysis (?root_id=, ?max_depth=, ?direction=) |
| GET | `/api/broken-refs` | **Done** | Unresolved calls, dead imports, broken references (?kind=) |
| GET | `/api/snapshots` | **Done** | Repository evolution snapshots |
| POST | `/api/snapshots` | **Done** | Save snapshot with auto-computed metrics |
| GET | `/api/snapshots/{id}` | **Done** | Single snapshot detail |
| GET | `/api/trend` | **Done** | Metric trend across snapshots (?q=metric_name) |
| WS | `/api/events` | **Done** | WebSocket live event stream (re-index progress) |

### Frontend (React + TypeScript + Vite + Tailwind)

| Component | Status | Description |
|---|---|---|
| **GraphCanvas** | **Done** | 2D force-directed graph, node selection, hover highlight, edge glow animation, ambient breathing |
| **ParticleField** | **Done** | Background particle animation with configurable density |
| **Sidebar** | **Done** | Collapsible nav (48px→200px), kind filters, symbol tree view, tooltips |
| **CommandPalette** | **Done** | ⌘K search with debounce, recent searches, keyboard navigation |
| **OverlayPanel** | **Done** | Slide-in panels for Symbols, Files, Metrics, Impact, Broken Refs, Settings |
| **KeyboardShortcuts** | **Done** | Global shortcuts with modal |
| **PerformanceOverlay** | **Done** | FPS + memory telemetry overlay |
| **Layout** | **Done** | App shell with routing, sidebar integration |
| **TreeView** | **Done** | Hierarchical symbol tree in sidebar |
| **EmptyState** | **Done** | Reusable empty state with icon + action button |
| **ContextMenu** | **Done** | Right-click context menu |
| **PluginRegistry** | **Done** | Plugin listing, findings display, severity badges |
| **AILayer** | **Stub** | Reserved for future LLM integration (mock only) |

### Pages

| Page | Status | Description |
|---|---|---|
| **GraphPage** | **Done** | Main visualization: force-directed graph, drill-down by container, dependency subtree on double-click, breadcrumb navigation, stat badges, node detail panel |
| **LandingPage** | **Done** | Overview/landing with project stats |
| **SymbolsPage** | **Done** | Symbol browser with kind/name filters |
| **FilesPage** | **Done** | File listing with language filters |
| **MetricsPage** | **Done** | Metrics dashboard with summary cards |
| **ImpactPage** | **Done** | Impact analysis with symbol search and depth control |

### Panels

| Panel | Status | Description |
|---|---|---|
| **SymbolsPanel** | **Done** | Symbol list with search, kind filter |
| **FilesPanel** | **Done** | File list with language filter |
| **MetricsPanel** | **Done** | Metrics display with complexity stats |
| **ImpactPanel** | **Done** | Impact analysis with symbol search, direction toggle, depth control |
| **BrokenRefsPanel** | **Done** | Broken reference display with kind grouping and filter buttons |
| **SettingsPanel** | **Done** | UI settings (edge animation, particles, LOD, camera speed, reduced motion) |

### Hooks

| Hook | Status | Description |
|---|---|---|
| `useForceLayout2D` | **Done** | Barnes-Hut quadtree O(n log n) force simulation |
| `useKeyboard` | **Done** | Global keyboard shortcuts |
| `useLiveUpdates` | **Done** | WebSocket connection for re-index events |
| `useLOD` | **Done** | Level-of-detail for large graphs |
| `usePerformanceBudget` | **Done** | Frame time budget tracking |

### Parser Language Support

| Language | Grammar | Extractor | Symbols |
|---|---|---|---|
| TypeScript | `tree-sitter-typescript` | `extract_ts` | Functions, classes, interfaces, enums, imports, type aliases, variables |
| JavaScript | `tree-sitter-javascript` | `extract_ts` | Functions, classes, imports, variables |
| Python | `tree-sitter-python` | `extract_python` | Functions, classes, imports, module variables |
| Rust | `tree-sitter-rust` | `extract_rust` | Functions, structs, enums, traits, impl blocks, imports, type aliases |
| Go | `tree-sitter-go` | `extract_go` | Functions, methods, structs, interfaces, imports, variables |
| C | `tree-sitter-c` | `extract_c` | Functions, structs, enums, typedefs, includes |
| C++ | `tree-sitter-cpp` | `extract_cpp` | Classes, functions, namespaces, enums, includes, methods |
| Java | `tree-sitter-java` | `extract_java` | Classes, interfaces, enums, packages, imports, methods |

All extractors: call graph extraction (Calls edges), containment edges (Contains), source span tracking, error tolerance.

### Storage Schema

| Table | Purpose |
|---|---|
| `files` | Indexed files with hash, language, line count |
| `nodes` | Symbol nodes with kind, name, file_id, span, doc_comment, properties |
| `edges` | Relationships (Contains, Calls, References, Inherits, Implements, etc.) |
| `broken_refs` | Unresolved references (UnresolvedCall, DeadImport, UnresolvedRef) |
| `snapshots` | Repository evolution snapshots with aggregate metrics |
| `metric_history` | Per-snapshot metric values for trend analysis |
| `nodes_fts` | FTS5 virtual table for full-text search (auto-populated via triggers) |

### Design System

- **OLED black** (#000000) background — dark by necessity, not decoration
- **Electric cyan** (#00BFFF) accent — ≤10% usage (Reticle Rule)
- **Tonal depth** — no shadows, no borders as decoration
- **Typography**: Space Grotesk (headings), IBM Plex Sans (body), IBM Plex Mono (code)
- **Design tokens**: defined in `apps/web/src/constants.ts` and `DESIGN.md`

### Tests (154 passing)

| Crate | Tests |
|---|---|
| astera-core | 10 |
| astera-discovery | 7 |
| astera-parser | 46 |
| astera-resolver | 25 |
| astera-storage | 10 |
| astera-metrics | 4 |
| astera-impact | 8 |
| astera-plugins | 9 |
| astera-export | 8 |
| astera-watcher | 1 |
| astera (binary) | 12 (benchmarks) |
| astera-api | 1 (integration) |
| astera-metrics (integration) | 1 |
| **Total** | **154** |

### CI/CD

- **GitHub Actions CI**: check, test, fmt, clippy (zero warnings gate)
- **GitHub Actions Release**: cross-platform binary builds (Linux x86_64/aarch64, macOS x86_64/aarch64, Windows x86_64)
- **Reusable GitHub Action**: `.github/actions/astera-index/` for CI indexing
- **Pre-commit hook**: `hooks/pre-commit` for impact checking

---

## What's Not Done (Future Work)

| Area | Priority | Notes |
|---|---|---|
| **AI Layer** | Future | LLM-powered code analysis — frontend stub exists, no backend integration |
| **File/metric range filters** | Low | Sidebar kind filter done; file-path and metric-range filters not implemented |
| **Incremental re-index optimization** | Medium | Currently full re-parse per changed file; could diff AST for very large files |
| **Cross-language reference resolution** | Low | Name resolution works within one language; cross-language calls (e.g., Python calling Rust FFI) not resolved |
| **IDE integration** | Future | VS Code extension, LSP — requires stable API |
| **Plugin system: WASM** | Future | Native loading works; WASM loading behind feature flag, not tested with real plugins |
| **Git history evolution** | Future | Cross-commit metric tracking — infrastructure (snapshots, trend) exists but no git-integrated analysis yet |
| **Multi-repo workspace graph** | Future | Workspace indexing works; unified cross-repo graph visualization not implemented |

---

## Architecture Summary

```
┌──────────────────────────────────────────────────┐
│                   CLI (astera)                    │
│  init | index | query | serve | watch | bench     │
│  workspace | export | stats                       │
└────────────┬─────────────────────┬───────────────┘
             │                     │
             ▼                     ▼
┌────────────────────┐  ┌─────────────────────┐
│  Indexer Pipeline   │  │  HTTP Server (Axum) │
│  Discover → Parse → │  │  17 REST endpoints  │
│  Extract → Resolve →│  │  + WebSocket        │
│  Store              │  │  + Embedded Web UI  │
└────────┬───────────┘  └────────┬────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────┐
│          SQLite + FTS5 Storage                │
│  files | nodes | edges | broken_refs         │
│  snapshots | metric_history | nodes_fts      │
└──────────────────────────────────────────────┘
```

### Index Pipeline

```
Phase 0: Detect deleted files (compare DB vs filesystem)
Phase 1: Insert/update file records
Phase 2: Parallel parse + extract (rayon thread pool, 8 languages)
Phase 3: Insert nodes + edges into SQLite
Phase 4: Detect broken/unresolved references via resolver
Phase 5: Auto-save snapshot for evolution tracking
```

### Frontend Rendering

```
GraphCanvas (Canvas 2D, z-index layered)
  ├── ParticleField (background, z-index: 0)
  ├── Edges (glow animation, z-index: 1)
  ├── Nodes (kind-colored, hover highlight, z-index: 2)
  ├── Labels (LOD-filtered, z-index: 3)
  └── Overlays (stat badges, breadcrumbs, detail panel, z-index: 10+)
```
