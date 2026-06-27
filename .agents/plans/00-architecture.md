# Astera — Architecture (Rust + 3D Frontend)

## High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       CLI (astera)                            │
│   index | serve | watch | query | config | export | import    │
└──────┬──────────────────────────────┬─────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────────┐  ┌──────────────────────────┐
│   Indexer Pipeline    │  │  HTTP Server (Axum)       │
│                       │  │                           │
│  Discover → Parse →   │  │  REST → JSON              │
│  Extract → Resolve →  │  │  WebSocket → Events       │
│  Store                │  │  utoipa / OpenAPI          │
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
│   (notify crate)       │
│   Debounced batches    │
│   Incremental re-index │
└───────────────────────┘
```

## Subsystems

| # | Crate | Responsibility | Crates | Phase |
|---|---|---|---|---|
| 1 | `astera-core` | Types (NodeKind, EdgeKind), config, error types | — | 1 |
| 2 | `astera-discovery` | Filesystem walking, gitignore, language classification | `walkdir`, `ignore`, `sha2` | 1 |
| 3 | `astera-parser` | Tree-sitter integration, CST → symbol extraction | `tree-sitter` + language grammars | 1 |
| 4 | `astera-resolver` | Reference resolution, scoping, import resolution | — | 1 |
| 5 | `astera-graph` | CPG builder, graph algorithms | — | 1 |
| 6 | `astera-storage` | SQLite CRUD, schema, FTS5 | `rusqlite` | 1 |
| 7 | `astera-metrics` | Complexity, coupling, cohesion, maintainability | — | 2 |
| 8 | `astera-impact` | Change impact analysis, transitive closure | — | 2 |
| 9 | `astera-api` | REST API server, middleware | `axum`, `tower-http`, `utoipa` | 1 |
| 10 | `astera` | CLI entry point, output formatting | `clap` | 1 |
| 11 | `astera-watcher` | File watching, incremental updates | `notify` | 2 |
| 12 | `astera-export` | Export formats (JSON, GraphML, DOT, CSV) | `serde` | 3 |

## Module Dependency Graph

```
astera (binary)
  ├── astera-discovery
  ├── astera-parser (→ astera-core)
  ├── astera-resolver (→ astera-core)
  ├── astera-storage (→ astera-core)
  ├── astera-metrics (→ astera-core)
  ├── astera-impact (→ astera-core)
  ├── astera-api (→ astera-core, astera-storage, astera-metrics, astera-impact)
  ├── astera-watcher (→ astera-core, astera-storage, astera-parser, astera-discovery)
  └── astera-export (→ astera-core, astera-storage)
```

`astera-core` is the foundational crate — all others depend on it. Contains only enums, structs, and traits.

## Data Flow (Index Command)

```
1. CLI receives `astera index /path/to/repo`
   ↓
2. discovery walks filesystem
   → Returns Vec<FileInfo> (path, language, size, hash)
   ↓
3. parser parses each file (rayon parallel iterator)
   → Returns Vec<ParseResult> (symbols, references, imports)
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
| **Language** | Rust (MSRV 1.80+) | Memory safety, zero-cost abstractions, cargo ecosystem |
| **Build** | Cargo + workspace | First-class monorepo support, deterministic |
| **Package mgr** | crates.io | Rust's native package registry |
| **HTTP/WS** | Axum + tokio-tungstenite | Async, tower middleware, typed extractors, WebSocket |
| **Parsing** | tree-sitter crate | 100+ languages, incremental, error-tolerant, Rust bindings |
| **Storage** | rusqlite (bundled) | Embedded SQLite, safe Rust API, type-safe queries |
| **Graph queries** | Recursive SQL CTEs | Avoids external graph DB, good enough for millions of nodes |
| **JSON** | serde / serde_json | De facto Rust standard, derive macros |
| **CLI** | clap (derive) | Modern, fast, subcommand support, completions |
| **Logging** | tracing / tracing-subscriber | Structured, async-aware, fmt/otel backends |
| **Parallelism** | rayon | Work-stealing thread pool, parallel iterators |
| **Testing** | built-in `#[test]` + `criterion` for benchmarks | Zero-config, property testing via `proptest` |
| **Linting** | clippy + rustfmt | Official, comprehensive, stable |
| **Frontend** | React + TypeScript + Vite | Fast dev cycle, excellent tooling, r3f ecosystem |
| **3D rendering** | React Three Fiber + Three.js | Declarative 3D, WebGL, great graph layout ecosystem |
| **Code display** | Monaco Editor | Industry standard code viewer |
| **Styling** | Tailwind CSS v4 | Utility-first, fast iteration |

## Memory Management Strategy

Rust's ownership system eliminates the C++ flat-array approach. Graph data is stored directly:

```rust
// Nodes owned by Vec, referenced by index
struct Node {
    kind: NodeKind,
    name: String,
    file_id: i64,
    span: SourceSpan,
    doc_comment: Option<String>,
    properties: serde_json::Value,
}

// Graph = flat Vecs with index-based references
struct Graph {
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    // Adjacencies stored as index vectors
    out_edges: Vec<Vec<usize>>,  // per-node
    in_edges: Vec<Vec<usize>>,   // per-node
}
```

Tree-sitter parsing is scoped — AST trees are freed after symbol extraction via Rust's Drop:

```rust
fn parse_file(path: &Path) -> Result<ParseResult> {
    let mut parser = Parser::new();
    parser.set_language(&LANGUAGE.into())?;
    let tree = parser.parse(&source, None)?;
    let result = extract_symbols(tree.root_node(), &source);
    // tree is dropped here, freeing the CST
    Ok(result)
}
```
