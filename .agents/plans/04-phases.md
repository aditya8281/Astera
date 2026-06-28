# Astera — Phase Plans (Rust + 3D Frontend)

---

## Phase 1: Core Engine — MVP ✅ COMPLETE

**Goal**: Index a repo, extract symbols + edges, serve via API, CLI + 3D web UI.
**Languages**: TypeScript, JavaScript, Python, Rust, Go
**Duration**: Completed

### Phase 1.1: Foundation ✅

- [x] Rust workspace with crate structure
- [x] `astera-core`: NodeKind, EdgeKind, SourceSpan, FileInfo, Node, Edge types
- [x] `astera-discovery`: filesystem walker via `ignore` crate, gitignore, language classifier
- [x] `astera-storage`: SQLite schema via `rusqlite`, CRUD, FTS5, transaction helpers
- [x] `astera-parser`: tree-sitter integration, TS/JS extractor
- [x] `astera`: `clap`-based CLI with `init`, `index`, `query` subcommands

### Phase 1.2: Parser Depth ✅

- [x] Python extractor (functions, classes, imports, module vars)
- [x] Rust extractor (functions, structs, enums, traits, impl blocks)
- [x] Containment edges (file→symbol, class→method)
- [x] Call graph extraction (Calls edges)
- [x] Go extractor (functions, structs, interfaces, packages)
- [x] `astera-resolver`: basic scope chain + import resolution *(deferred to Phase 2 — now complete)*

### Phase 1.3: API Server ✅

- [x] `astera-api`: Axum HTTP server with CORS + tracing
- [x] 7 REST endpoints (stats, files, symbols, edges, search, dependency graph)
- [x] Integration tests (tower::oneshot pattern)

### Phase 1.4: 3D Frontend ✅

- [x] Vite + React 19 + TypeScript + Tailwind scaffold
- [x] React Three Fiber + drei setup
- [x] Force-directed 3D graph component (nodes + edges + labels)
- [x] OrbitControls, click-to-select, kind filtering
- [x] Graph page (3D visualization with search overlay)
- [x] Symbol Explorer page (search + list + detail)
- [x] File Explorer page (list with language, lines, size)
- [x] `rust-embed` frontend dist into binary
- [x] Single `astera` binary release (embedded frontend)

**Phase 1 Deliverables:**
- 5 languages (TS/JS, Python, Rust, Go) indexed
- 57 backend tests, 7 API tests
- CLI + HTTP interface
- Interactive 3D web UI with force-directed layout

---

## Phase 2: Analysis Depth & Rich Visualization

**Goal**: Deep analysis, accurate graphs, richer 3D, file watching.

### Tasks

- [x] **Reference resolution** (`astera-resolver`)
  - [x] Scope chain tracking
  - [x] Import resolution (TS, Python, Rust, Go)
  - [x] Reference resolution (identifier → definition)
- [x] **Metrics module** (`astera-metrics`)
  - [x] Cyclomatic complexity
  - [x] Cognitive complexity
  - [x] Fan-in/fan-out coupling
  - [x] Circular dependency detection (Tarjan's SCC)
  - [x] Module metrics (size, coupling, instability)
  - [x] API endpoint (`/api/metrics`)
- [x] **Impact module** (`astera-impact`)
  - [x] BFS transitive closure (depth-limited)
  - [x] Cycle-aware traversal
  - [x] Forward and reverse impact analysis
  - [x] Critical path computation
  - [x] API endpoint (`/api/impact`)
- [x] **File watcher** (`astera-watcher`)
  - [x] Cross-platform event handling via `notify` v7
  - [x] Event debouncing (500ms)
  - [x] Incremental re-index (hash-based diff)
  - [x] `astera watch` daemon mode
  - [x] Deletion detection for ALL file types (removed extension filter from debouncer)
  - [x] Added .c, .cpp, .java to watchable extensions
- [x] **Frontend serving** — API server serves static files with SPA fallback
- [x] **Frontend pages**
  - [x] Metrics page (summary cards, circular deps, complexity legend)
  - [x] Impact page (symbol search, direction toggle, depth control)
- [x] **FTS5 full-text search** (BM25 via SQLite FTS5, LIKE fallback)
- [ ] **3D frontend enhancements**
  - [x] LOD and instancing for >10K nodes (useLOD hook, InstancedMesh nodes/edges)
  - [x] MiniMap (SVG minimap with click-to-navigate)
  - [ ] Filter panel — kind filter done in Sidebar; file/metric range filters not implemented
  - [x] WebSocket integration for re-index progress
- [x] **Broken reference detection** (Phase 2 — completed 2026-06-28)
  - [x] `UnresolvedRef` type in `astera-core` (UnresolvedCall, DeadImport, UnresolvedRef)
  - [x] `find_unresolved_refs()` in `astera-resolver`
  - [x] `broken_refs` table in SQLite schema
  - [x] `/api/broken-refs` REST endpoint
  - [x] `BrokenRefsPanel` in frontend sidebar + overlay
  - [x] Integrated into `astera index` pipeline (Phase 4 of indexing)
- [x] **Dependency subtree visualization** (Phase 2 — completed 2026-06-28)
  - [x] `/api/graph/subtree/{id}` endpoint (bidirectional BFS, configurable depth)
  - [x] Double-click on leaf nodes shows full recursive dependency tree
  - [x] Double-click on container nodes does drill-down navigation
- [x] **Performance benchmarks** (criterion — 73 benchmarks, 11 groups)
  - [x] Parsing throughput (5 languages × multiple scales)
  - [x] Symbol extraction + full pipeline
  - [x] Storage ops (insert, query, search, FTS5, children)
  - [x] Metrics computation (complexity, importance)
  - [x] Impact analysis (forward, reverse, depth-limited, critical path)
  - [x] Discovery utilities (hash, line count, classification)
  - [x] End-to-end pipeline (parse → extract → store)
  - [x] Scalability curves (50–10K nodes)
  - [x] Parse edge cases (empty, malformed, nested, long lines, unicode)
  - [x] Concurrent storage reads + API response simulation
  - [ ] Memory profiling (deferred)
  - [x] Benchmark regression tracking (astera bench save/check/show)

**Phase 2 Deliverables:**
- 5 languages (TS/JS, Python, Rust, Go)
- Reference resolution (scope + imports)
- Code metrics (complexity, coupling, circular deps)
- Impact analysis (forward + reverse)
- File watching + incremental re-index
- Frontend with Metrics and Impact pages
- Single-command serve (API + web UI)
- 104 backend tests
- 73 criterion benchmarks

---

## Phase E: Frontend Redesign ✅ COMPLETE

**Goal**: Living codebase feel — warm black + deep orange, animated backgrounds, performance-optimized.

### Tasks

- [x] WebSocket live events for re-index progress
- [x] Temporal animation (fade-in/out for added/removed nodes, glow rings)
- [x] Plugin registry UI (findings display, severity badges)
- [x] AI layer reservation (stub + chat panel for future LLM integration)

---

## Phase 3: Advanced Features ✅ COMPLETE

**Goal**: Plugins, exports, CI integration, architecture rules.

### Tasks

- [x] **Export formats** (JSON, CSV, DOT) via `astera-export` crate
- [x] **Multi-repo workspace** — WorkspaceConfig with add/remove/index/stats commands
- [x] **Git-aware analysis** — diff-based change impact via `astera-export`
- [x] **Architecture rule validation** — layer constraints via `ArchitectureRule` + `validate_architecture()`
- [x] **GitHub Action** — reusable action for CI indexing (`.github/actions/astera-index/`)
- [x] **Pre-commit hook** for impact checks (`hooks/pre-commit`)
- [x] **C grammar + extractor** (functions, structs, #include)
- [x] **C++ grammar + extractor** (classes, functions, templates)
- [x] **Java grammar + extractor** (classes, interfaces, packages)
- [x] **Plugin system** — `astera-plugins` with trait, registry, native loading, built-in pattern checker & metrics summary
- [x] **Benchmark regression tracking** — compare against baselines (astera bench save/check/show)
- [x] **Frontend embedding** — rust-embed static files into binary

**Phase 3 Deliverables:**
- 3 export formats (JSON, CSV, DOT)
- GitHub Action for CI indexing
- Architecture rule engine with validation
- Pre-commit hook for impact checks
- 8 languages (TS, JS, Python, Rust, Go, C, C++, Java)
- Plugin system (trait-based, native loading, 2 built-in plugins)
- Benchmark regression tracking (save/check/show)
- Embedded frontend in single binary
- Multi-repo workspace support
- Git-aware diff analysis

---

## Phase 4: Ecosystem & Scale

**Goal**: IDE integration, SDKs, community, performance at scale.

### Tasks

- [ ] **VS Code extension**
  - [ ] Symbol tree view
  - [ ] Hover provider
  - [ ] Find all references via Astera API
- [ ] **Client libraries** (TypeScript, Python SDKs)
- [ ] **Repository evolution analysis**
  - [ ] Cross-commit snapshots
  - [ ] Metric trending over time
- [ ] **Performance at scale**
  - [ ] PGO builds
  - [ ] Lazy loading of graph regions
  - [ ] Query result caching
- [ ] **Additional languages** (community demand)
  - [ ] Ruby, PHP, Swift, Kotlin, Scala, Elixir

**Phase 4 Deliverables:**
- VS Code extension
- Client SDKs
- 10+ languages
- Production-tested at 10M+ LOC scale
