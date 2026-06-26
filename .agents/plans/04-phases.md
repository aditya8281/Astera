# Astera — Phase Plans (C++)

---

## Phase 1: Core Engine — MVP

**Duration**: 10 weeks (C++ build system + stricter QA add ~2 weeks vs Rust)  
**Goal**: Index a repo, extract symbols + call graph, serve via API, basic CLI + minimal web UI.  
**Languages**: TypeScript, JavaScript, Python  
**Team**: 1-2 developers

### Phase 1.1: Foundation (Week 1-3)

**Objective**: CMake + vcpkg setup, core types, discovery, storage

- [ ] Initialize project structure: `include/`, `src/`, `apps/cli/`, `tests/`
- [ ] vcpkg manifest (`vcpkg.json`) with all Phase 1 dependencies:
      `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-python`,
      `drogon`, `sqlite3`, `nlohmann-json`, `cli11`, `fmt`, `spdlog`, `gtest`, `tbb`
- [ ] CMake presets: `debug`, `release`, `ci`
- [ ] CMake toolchain: C++20, warnings-as-errors, LTO for release
- [ ] `clang-format` config + CI format check
- [ ] `clang-tidy` config + CI lint check
- [ ] `core/` module:
  - [ ] `NodeKind` enum class
  - [ ] `EdgeKind` enum class
  - [ ] `SourceSpan` struct
  - [ ] `FileInfo` struct
  - [ ] `Config` struct (TOML via `tomlplusplus` or nlohmann/json for JSON config)
  - [ ] `Result<T, E>` template (simplified `std::expected`-like, or `tl::expected`)
  - [ ] `Error` enum hierarchy
- [ ] `discovery/` module:
  - [ ] File walker using `std::filesystem::recursive_directory_iterator`
  - [ ] `.gitignore` pattern parser (custom, ~200 lines)
  - [ ] Language classifier (extension → language map)
  - [ ] SHA-256 hashing (OpenSSL or custom)
- [ ] `storage/` module:
  - [ ] `Database` RAII class (sqlite3 wrapper)
  - [ ] Schema creation (files, nodes, edges, index_meta tables)
  - [ ] WAL mode configuration
  - [ ] `Transaction` RAII class
  - [ ] Data migration system (version-based)
  - [ ] Core CRUD: insert/get file, insert node/edge, delete file
  - [ ] Prepared statement cache
- [ ] `config/` — TOML config file parsing, `Config` merging (CLI overrides file)
- [ ] CI pipeline: cmake configure → build → ctest → clang-tidy → clang-format

**Deliverables**: Building project, passing tests, functioning CI, core types defined

### Phase 1.2: Parsing — TypeScript/JavaScript (Week 4-6)

**Objective**: Parse TS/JS files, extract symbols and references

- [ ] `parser/` module:
  - [ ] `Parser` RAII class wrapping `TSParser*`
  - [ ] Grammar loading from compiled tree-sitter grammars
  - [ ] CST traversal helpers (node text, child iter, named child access)
  - [ ] Error collection (parse errors don't stop indexing)
  - [ ] Parallel parsing via `tbb::parallel_for`
- [ ] `extractors/ts_extractor.cpp`:
  - [ ] Function declarations
  - [ ] Class declarations
  - [ ] Interface declarations
  - [ ] Enum declarations
  - [ ] Type alias declarations
  - [ ] Variable declarations (module-level const/let)
  - [ ] Import statements (import, require)
  - [ ] Export declarations
  - [ ] JSDoc comment extraction
- [ ] `extractors/js_extractor.cpp` (subset of TS)
- [ ] Test fixtures: small TS/JS snippets
- [ ] Golden file tests: parse → serialize to JSON → compare

**Deliverables**: Working TS/JS parser, test suite

### Phase 1.3: Graph Construction + Python (Week 7-9)

**Objective**: Build CPG from parsed data, add Python support

- [ ] `graph/` module:
  - [ ] Flat adjacency storage: `std::vector<Node>`, `std::vector<Edge>`
  - [ ] Per-node in/out edge index vectors
  - [ ] `GraphBuilder` class: create nodes, add edges
  - [ ] Deduplication (same symbol referenced multiple times)
  - [ ] Call graph construction (Calls edges → adjacency)
  - [ ] Dependency graph construction (DependsOn edges)
- [ ] Python grammar + extractor:
  - [ ] Function definitions
  - [ ] Class definitions
  - [ ] Import statements (import, from-import)
  - [ ] Module-level variable declarations
  - [ ] Decorator extraction
- [ ] `resolver/` module:
  - [ ] `ScopeTree` — lexical scope representation
  - [ ] `ImportResolver` — relative → absolute path resolution
  - [ ] TypeScript import resolution (tsconfig paths, node_modules)
  - [ ] Python import resolution (path-based, __init__.py)
  - [ ] Name binding: scope chain search
  - [ ] Fallback: unresolved references tracked, not guessed
- [ ] Storage queries:
  - [ ] `get_symbols_by_file(file_id)`
  - [ ] `get_edges_by_node(node_id, direction, kind)`
  - [ ] `get_symbol_detail(symbol_id)` with edge counts

**Deliverables**: Working CPG builder, Python support, basic resolver

### Phase 1.4: CLI + API + Web UI (Week 10-11)

**Objective**: Make it usable

- [ ] `cli/` binary (CLI11):
  - [ ] `astera init` — create .astera/ + config
  - [ ] `astera index` — full pipeline
  - [ ] `astera serve` — start Drogon server
  - [ ] `astera query symbols` — terminal query output
  - [ ] Output formatters: JSON (nlohmann/json), table (fmt)
- [ ] `api/` module (Drogon):
  - [ ] App setup: listener, CORS, static file serving
  - [ ] `RepoController`: CRUD for repos
  - [ ] `FileController`: list files, get file, get content
  - [ ] `SymbolController`: list/search, detail, references, callees, callers
  - [ ] `DependencyController`: dependency graph, circular deps
  - [ ] `SearchController`: FTS5 full-text search
  - [ ] Error handler middleware
  - [ ] Request logging
  - [ ] OpenAPI spec via Drogon's OpenAPI macros
- [ ] React frontend (MVP, same as Rust plan):
  - [ ] Vite + React + TypeScript + Tailwind scaffold
  - [ ] API client with React Query
  - [ ] Dashboard page (repo stats)
  - [ ] File Explorer (file tree + Monaco code view)
  - [ ] Symbol Explorer (search + list + detail)
  - [ ] Search page (full-text)
- [ ] Frontend serving: Drogon serves `apps/web/dist/` as static files
- [ ] Release build: CMake release preset, LTO, stripped binary

**Phase 1 Deliverables:**
- Single `astera` binary (Linux, macOS, Windows)
- TypeScript/JavaScript + Python indexing
- Symbol lookup, call graph, dependency graph, full-text search
- CLI and HTTP interface
- Minimal functional web UI

---

## Phase 2: Analysis Depth & Rich Visualization

**Duration**: 8 weeks (Weeks 12-19)  
**Goal**: Deep analysis, accurate graphs, rich web UI, file watching.  
**Languages**: Add Rust, Go

### Tasks

- [ ] **Rust grammar + extractor**
  - [ ] Functions, structs, enums, traits, impl blocks
  - [ ] Module system (mod, use, pub, self, super paths)
  - [ ] Doc comments (///, //!)
- [ ] **Go grammar + extractor**
  - [ ] Functions, structs, interfaces
  - [ ] Package imports
  - [ ] Method receivers
- [ ] **Reference resolution improvements**
  - [ ] Qualified name resolution
  - [ ] Cross-file resolution
  - [ ] Caching resolved references (hash map)
- [ ] **Inheritance hierarchy**
  - [ ] Class hierarchy tree
  - [ ] Interface implementation tracking
  - [ ] Method override detection
- [ ] **Metrics module**
  - [ ] Cyclomatic complexity (CFG traversal)
  - [ ] Cogitative complexity (nesting weighting)
  - [ ] Fan-in/fan-out coupling
  - [ ] Maintainability index
  - [ ] Doc coverage percentage
- [ ] **Impact module**
  - [ ] BFS transitive closure (depth-limited)
  - [ ] Cycle-aware traversal (detect + skip cycles)
  - [ ] Impact set computation
- [ ] **File watcher** (efsw):
  - [ ] Cross-platform event handling
  - [ ] Event debouncing (500ms via `std::chrono` + timer)
  - [ ] Incremental re-index: re-parse → diff → delete stale → insert new
  - [ ] WebSocket push of update events (Drogon WebSocket)
  - [ ] `astera watch` daemon mode
- [ ] **FTS5 full-text search**
  - [ ] Tokenized symbol names + doc comments
  - [ ] BM25 relevance ranking
  - [ ] Prefix matching for typeahead
  - [ ] Kind and file-scoped filtering
- [ ] **Web UI: rich visualizations** (same as Rust plan)
  - [ ] Call graph page (dagre layout, depth slider)
  - [ ] Dependency graph page (cose-bilkent, cluster view)
  - [ ] Impact analysis page (breadth-first rings)
  - [ ] Metrics dashboard (histogram, table, chart)
  - [ ] Search typeahead (+ kind badges, snippets)
  - [ ] WebSocket integration for re-index progress
- [ ] **Performance benchmarks**
  - [ ] Google Benchmark: parsing throughput, query latency
  - [ ] Memory profiling (Valgrind/Massif or heaptrack)
  - [ ] Scaling tests: index time vs repo size

**Phase 2 Deliverables:**
- 5 languages (TS/JS, Python, Rust, Go)
- Accurate call graphs for static languages
- Full interactive web UI
- File watching + incremental updates
- Code metrics
- Benchmark suite

---

## Phase 3: Advanced Features

**Duration**: 8 weeks (Weeks 20-27)  
**Goal**: Plugins, exports, CI integration, architecture rules.

### Tasks

- [ ] **WASM plugin system** (via `wasmtime` C API):
  - [ ] Plugin interface definition
  - [ ] Sandbox: memory limits, no filesystem access
  - [ ] Plugin lifecycle (load → init → analyze → destroy)
- [ ] **Export formats**
  - [ ] JSON (nlohmann/json serialization of whole graph)
  - [ ] GraphML (XML, for Gephi)
  - [ ] DOT (for Graphviz)
  - [ ] CSV (symbols table, edges table)
- [ ] **Multi-repo workspace**
  - [ ] Multiple repos served from one daemon
  - [ ] Cross-repo query parameter
- [ ] **Git-aware analysis**
  - [ ] Diff-based: index current state vs indexed commits
  - [ ] PR analysis: what changed, what's affected
- [ ] **Architecture rule validation**
  - [ ] Layer constraints configurable in `astera.toml`
  - [ ] `astera check` CLI command
  - [ ] Rich output: violations with file:line
- [ ] **GitHub Action** — reusable action for CI indexing
- [ ] **C/C++ grammar + extractor**
  - [ ] Functions, structs, unions, enums
  - [ ] Preprocessor (#include, #define basics)
  - [ ] Header resolution
- [ ] **Java grammar + extractor**
  - [ ] Classes, interfaces, enums, records
  - [ ] Package system
  - [ ] Method overloading

**Phase 3 Deliverables:**
- WASM plugin SDK
- 4 export formats
- GitHub Action
- Architecture rule engine
- 7+ languages
- Pre-commit hook

---

## Phase 4: Ecosystem & Scale

**Duration**: Ongoing (Weeks 28+)  
**Goal**: IDE integration, SDKs, community, performance at scale.

### Tasks

- [ ] **VS Code extension**
  - [ ] Symbol tree view
  - [ ] Hover provider
  - [ ] Find all references via Astera API
  - [ ] Call hierarchy view
- [ ] **Client libraries** (TypeScript, Python SDKs)
- [ ] **Plugin API stabilization (v1)**
- [ ] **Repository evolution analysis**
  - [ ] Cross-commit snapshots
  - [ ] Metric trending over time
  - [ ] Hotspot detection (complex + frequently changed)
- [ ] **Documentation site** (VitePress)
- [ ] **Additional languages** (community demand)
  - [ ] Ruby, PHP, Swift, Kotlin, Scala, C#, Elixir
- [ ] **Performance at scale**
  - [ ] LTO + PGO builds
  - [ ] Memory-mapped index for large repos
  - [ ] Lazy loading of graph regions
  - [ ] Query result caching

**Phase 4 Deliverables:**
- VS Code extension
- Client SDKs
- Stable plugin API
- 10+ languages
- Production-tested at 10M+ LOC scale
