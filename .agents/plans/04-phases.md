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
- [x] `astera-cli`: `clap`-based CLI with `init`, `index`, `query` subcommands

### Phase 1.2: Parser Depth ✅

- [x] Python extractor (functions, classes, imports, module vars)
- [x] Rust extractor (functions, structs, enums, traits, impl blocks)
- [x] Containment edges (file→symbol, class→method)
- [x] Call graph extraction (Calls edges)
- [x] Go extractor (functions, structs, interfaces, packages)
- [ ] `astera-resolver`: basic scope chain + import resolution *(deferred to Phase 2)*

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
- [ ] `rust-embed` frontend dist into binary *(deferred to Phase 2)*
- [ ] Single `astera` binary release *(deferred to Phase 2)*

**Phase 1 Deliverables:**
- 5 languages (TS/JS, Python, Rust, Go) indexed
- 57 backend tests, 7 API tests
- CLI + HTTP interface
- Interactive 3D web UI with force-directed layout

---

## Phase 2: Analysis Depth & Rich Visualization

**Goal**: Deep analysis, accurate graphs, richer 3D, file watching.

### Tasks

- [ ] **Go extractor refinement**
- [ ] **Reference resolution improvements**
  - [ ] Qualified name resolution
  - [ ] Cross-file resolution
  - [ ] Caching resolved references
- [ ] **Inheritance hierarchy**
  - [ ] Class hierarchy tree
  - [ ] Interface implementation tracking
  - [ ] Method override detection
- [ ] **Metrics module** (`astera-metrics`)
  - [ ] Cyclomatic complexity
  - [ ] Cogitative complexity
  - [ ] Fan-in/fan-out coupling
  - [ ] Maintainability index
  - [ ] Doc coverage percentage
- [ ] **Impact module** (`astera-impact`)
  - [ ] BFS transitive closure (depth-limited)
  - [ ] Cycle-aware traversal
  - [ ] Impact set computation
- [ ] **File watcher** (`notify` crate)
  - [ ] Cross-platform event handling
  - [ ] Event debouncing (500ms via tokio timer)
  - [ ] Incremental re-index
  - [ ] WebSocket push to frontend
  - [ ] `astera watch` daemon mode
- [ ] **FTS5 full-text search** (bundled rusqlite)
  - [ ] BM25 relevance ranking
  - [ ] Prefix matching for typeahead
  - [ ] Kind and file-scoped filtering
- [ ] **3D frontend enhancements**
  - [ ] Impact analysis view (ring layout)
  - [ ] Metrics dashboard (charts + 3D node scaling by metric)
  - [ ] LOD and instancing for >10K nodes
  - [ ] MiniMap
  - [ ] Filter panel (by kind, file, metric range)
  - [ ] Auto-rotate and camera bookmarks
  - [ ] WebSocket integration for re-index progress
- [ ] **Performance benchmarks** (criterion)
  - [ ] Parsing throughput
  - [ ] Query latency
  - [ ] Memory profiling
  - [ ] Scaling tests

**Phase 2 Deliverables:**
- 5+ languages (TS/JS, Python, Rust, Go)
- Accurate call graphs for static languages
- Rich interactive 3D web UI
- File watching + incremental updates
- Code metrics
- Benchmark suite

---

## Phase 3: Advanced Features

**Goal**: Plugins, exports, CI integration, architecture rules.

### Tasks

- [ ] **Export formats** (JSON, GraphML, DOT, CSV) via `serde`
- [ ] **Multi-repo workspace** — multiple repos served from one daemon
- [ ] **Git-aware analysis** — diff-based change impact
- [ ] **Architecture rule validation** — layer constraints in config
- [ ] **GitHub Action** — reusable action for CI indexing
- [ ] **Pre-commit hook** for impact checks
- [ ] **C grammar + extractor** (functions, structs, #include)
- [ ] **C++ grammar + extractor** (classes, functions, templates)
- [ ] **Java grammar + extractor** (classes, interfaces, packages)

**Phase 3 Deliverables:**
- 4 export formats
- GitHub Action
- Architecture rule engine
- Pre-commit hook
- 8+ languages

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
