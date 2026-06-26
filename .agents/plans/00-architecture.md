# Astera — Architecture (C++)

## High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       CLI (astera)                            │
│   index | serve | watch | query | config | export | import    │
└──────┬──────────────────────────────┬─────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────────┐  ┌──────────────────────────┐
│   Indexer Pipeline    │  │    HTTP Server (Drogon)   │
│                       │  │                           │
│  Discover → Parse →   │  │  REST → JSON              │
│  Extract → Resolve →  │  │  WebSocket → Events       │
│  Store                │  │  OpenAPI / Swagger         │
└──────────┬────────────┘  └───────────┬───────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Storage Layer                             │
│  SQLite DB (nodes, edges, files, FTS5 index)                 │
│  + Graph Query Engine (recursive CTEs + adjacency cache)      │
└──────────────────────────────────────────────────────────────┘
           ▲
           │
┌──────────┴────────────┐
│   File Watcher         │
│   (efsw / inotify)     │
│   Debounced batches    │
│   Incremental re-index │
└───────────────────────┘
```

## Subsystems

| # | Module | Responsibility | Libraries | Phase |
|---|---|---|---|---|
| 1 | `core` | Enums (NodeKind, EdgeKind), config, error types | — | 1 |
| 2 | `discovery` | Filesystem walking, gitignore, language classification | `std::filesystem`, custom gitignore | 1 |
| 3 | `parser` | Tree-sitter integration, CST → symbol extraction | `tree-sitter` | 1 |
| 4 | `resolver` | Reference resolution, scoping, import resolution | — | 1 |
| 5 | `graph` | CPG builder, graph algorithms | — | 1 |
| 6 | `storage` | SQLite CRUD, schema, FTS5 | `sqlite3` | 1 |
| 7 | `metrics` | Complexity, coupling, cohesion, maintainability | — | 2 |
| 8 | `impact` | Change impact analysis, transitive closure | — | 2 |
| 9 | `api` | REST API server, middleware | `drogon` | 1 |
| 10 | `cli` | CLI interface, output formatting | `CLI11`, `fmt` | 1 |
| 11 | `watcher` | File watching, incremental updates | `efsw` / platform API | 2 |
| 12 | `export` | Export formats (JSON, GraphML, DOT, CSV) | `nlohmann/json` | 3 |

## Module Dependency Graph

```
cli
  ├── discovery
  ├── parser (→ core)
  ├── resolver (→ core)
  ├── graph (→ core)
  ├── metrics (→ core)
  ├── impact (→ graph)
  ├── storage (→ core)
  ├── api (→ core, storage)
  ├── watcher (→ core)
  └── export (→ core, storage)
```

`core` is the foundational module — all others depend on it. Contains only enums, structs, and interfaces.

## Data Flow (Index Command)

```
1. CLI receives `astera index /path/to/repo`
   ↓
2. discovery walks filesystem
   → Returns std::vector<FileInfo> (path, language, size, hash)
   ↓
3. parser parses each file (TBB parallel_for)
   → Returns std::vector<ParseResult> (symbols, references, imports)
   ↓
4. resolver resolves imports → file dependencies
   → Resolves references → connects uses to definitions
   ↓
5. graph builds CPG from ParseResult + ResolvedRefs
   → Creates nodes, edges, containment hierarchy
   ↓
6. metrics computes per-function/per-module metrics
   ↓
7. storage persists everything in SQLite transaction
   → Writes files, nodes, edges to DB; FTS5 auto-populated
   ↓
8. CLI prints summary: "Indexed 247 files, 3,412 symbols, 8,901 edges"
```

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | C++20 | Performance, tree-sitter C API is native, full control |
| **Build** | CMake 3.28+ | Industry standard, presets, toolchain files |
| **Package mgr** | vcpkg (manifest) | Deterministic builds, large library catalog |
| **HTTP/WS** | Drogon | Async, high-perf, JSON built-in, WebSocket, controller-based routing |
| **Parsing** | Tree-sitter (C API) | 100+ languages, incremental, error-tolerant, direct call |
| **Storage** | SQLite3 C API + RAII | Embedded, zero-setup, full control |
| **Graph queries** | Recursive SQL CTEs | Avoids external graph DB, good enough for millions of nodes |
| **JSON** | nlohmann/json | Header-only, easy, well-known, ecosystem standard |
| **CLI** | CLI11 | Header-only, modern, subcommand support, completions |
| **Formatting** | fmt / std::format | Type-safe, fast, required for this project |
| **Logging** | spdlog | Header-only option, fmt-based, fast, sinks for file/console |
| **Parallelism** | oneTBB | Work-stealing thread pool, parallel_for, concurrent containers |
| **Testing** | Google Test + Benchmark | Standard, mocking, property testing via custom macros |
| **Linting** | clang-tidy | Modern C++ linting, automated fix suggestions |
| **Frontend** | React + TypeScript + Vite | Fast dev cycle, excellent tooling |
| **Graph vis** | Cytoscape.js | Layout algorithms, large graph perf, extensible |
| **Code display** | Monaco Editor | Industry standard code viewer |
| **Styling** | Tailwind CSS | Utility-first, fast iteration |

## Memory Management Strategy

Graph data uses **flat arrays + integer IDs** — no pointer-based structures for the CPG:

```cpp
// Nodes owned by vector, referenced by index
struct Node {
    NodeKind kind;
    std::string name;
    int64_t file_id;
    SourceSpan span;
    std::optional<std::string> doc_comment;
    nlohmann::json properties;
};

// Graph = flat arrays
struct Graph {
    std::vector<Node> nodes;
    std::vector<Edge> edges;
    // Adjacencies stored as index vectors
    std::vector<std::vector<int64_t>> out_edges;  // per-node
    std::vector<std::vector<int64_t>> in_edges;   // per-node
};
```

This avoids pointer ownership issues entirely. Nodes are stable indices (never invalidated by reallocation — reserved capacity). No `unique_ptr`/`shared_ptr` overhead for the hot path.

For tree-sitter parsing, each parse is scoped to a function — AST trees are freed after symbol extraction:
```cpp
auto result = parse_file(path);
// result holds extracted data, tree is freed
```
