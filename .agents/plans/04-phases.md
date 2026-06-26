# Astera — Phase Plans (Rust + 3D Frontend)

---

## Phase 1: Core Engine — MVP

**Goal**: Index a repo, extract symbols + edges, serve via API, CLI + 3D web UI.  
**Languages**: TypeScript, JavaScript, Python, Rust  
**Duration target**: ~8 weeks

### Phase 1.1: Foundation

**Objective**: Rust workspace, core types, discovery, storage

- [x] Rust workspace with crate structure
- [x] `astera-core`: NodeKind, EdgeKind, SourceSpan, FileInfo, Node, Edge types
- [x] `astera-discovery`: filesystem walker via `ignore` crate, gitignore, language classifier
- [x] `astera-storage`: SQLite schema via `rusqlite`, CRUD, FTS5, transaction helpers
- [x] `astera-parser`: tree-sitter integration, TS/JS extractor (functions, classes, imports, variables)
- [x] `astera-cli`: `clap`-based CLI with `init`, `index`, `query` subcommands
- [ ] CI pipeline: `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt`

### Phase 1.2: Parser Depth + Python

**Objective**: Full symbol extraction for TS/JS and Python, call graph

- [x] Python extractor (functions, classes, imports, module vars)
- [x] Rust extractor (functions, structs, enums, traits, impl blocks)
- [x] Containment edges (file→symbol, class→method)
- [x] Call graph extraction (Calls edges)
- [x] Go extractor (functions, structs, interfaces, packages)
- [ ] `astera-resolver`: basic scope chain + import resolution

### Phase 1.3: API Server

**Objective**: REST API for indexed data

- [ ] `astera-api`: Axum HTTP server
- [ ] Repo CRUD endpoints
- [ ] File listing + content endpoints
- [ ] Symbol query + search endpoints
- [ ] Graph data endpoints (for 3D frontend)
- [ ] CORS, error middleware, request logging
- [ ] utoipa OpenAPI spec

### Phase 1.4: 3D Frontend

**Objective**: Interactive 3D web UI

- [ ] Vite + React + TypeScript + Tailwind scaffold
- [ ] React Three Fiber + drei setup
- [ ] Force-directed 3D graph component (nodes + edges)
- [ ] OrbitControls, click-to-focus, search-to-focus
- [ ] Dashboard page (repo stats, language breakdown)
- [ ] Symbol Explorer page (search + list + detail)
- [ ] Call Graph page (3D hierarchical layout)
- [ ] File Explorer page (tree + Monaco code view)
- [ ] `rust-embed` frontend dist into binary
- [ ] Single `astera` binary release

**Phase 1 Deliverables:**
- Single `astera` binary (Linux, macOS, Windows)
- TypeScript/JavaScript + Python + Rust indexing
- Call graph, dependency graph, full-text search
- CLI and HTTP interface
- Interactive 3D web UI

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
