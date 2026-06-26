# Astera — Analysis Pipeline

## Overview

The analysis pipeline transforms raw source files into a structured Code Property Graph. It runs in 8 sequential stages, with stages 2-3 parallelized per file.

```
Source Files
    │
    ▼
[1. Discovery]  ─── Walk filesystem, classify, filter
    │
    ▼
[2. Parsing]  ─── Tree-sitter CST (TBB parallel_for)
    │
    ▼
[3. Extraction]  ─── Symbol + reference extraction (parallel per file)
    │
    ▼
[4. Import Resolution]  ─── Resolve imports to file paths
    │
    ▼
[5. Reference Resolution]  ─── Heuristic name resolution
    │
    ▼
[6. Relationship Extraction]  ─── Calls, inherits, contains, depends
    │
    ▼
[7. Analysis]  ─── Metrics, complexity, coupling, cycles
    │
    ▼
[8. Storage]  ─── SQLite persistent store
    │
    ▼
Code Property Graph (queryable)
```

## Stage Details

### Stage 1: Discovery

**Input**: Filesystem root path  
**Output**: `std::vector<FileInfo>`  
**Module**: `discovery`

```
1. Walk path recursively with std::filesystem::recursive_directory_iterator
2. Custom .gitignore parser (pattern file with glob rules):
   - Lines starting with # are comments
   - Lines starting with ! are negations
   - ** double-star glob patterns
   - Trailing / matches directories only
3. For each file:
   a. Determine language from extension (.ts/tsx → TypeScript, .py → Python, etc.)
   b. Compute SHA-256 hash of content (for change detection)
   c. Record size, modification time
   d. Skip if hash matches existing index entry (fast path)
4. Filter: skip binaries, node_modules, __pycache__, .git, .astera
5. Use .asteraignore for additional exclusions
6. Return sorted vector of FileInfo
```

Language detection:

| Extension | Language |
|---|---|
| .ts, .tsx | TypeScript |
| .js, .jsx, .mjs, .cjs | JavaScript |
| .py | Python |
| .rs | Rust (Phase 2) |
| .go | Go (Phase 2) |
| .c, .h | C (Phase 3) |
| .cpp, .hpp, .cc | C++ (Phase 3) |
| .java | Java (Phase 3) |

### Stage 2: Parsing

**Input**: `std::vector<FileInfo>`  
**Output**: `std::vector<ParseResult>`  
**Module**: `parser`

Tree-sitter C API called directly — no bindings layer:

```cpp
struct Parser {
    Parser() : parser_(ts_parser_new()) {}
    ~Parser() { ts_parser_delete(parser_); }

    // Non-copyable, movable
    Parser(Parser&& other) noexcept : parser_(std::exchange(other.parser_, nullptr)) {}

    std::optional<CSTResult> parse(const std::string& source,
                                    const std::string& language) {
        TSLanguage* lang = get_language(language);
        if (!lang) return std::nullopt;

        ts_parser_set_language(parser_, lang);
        TSTree* tree = ts_parser_parse_string(
            parser_, nullptr, source.data(), source.size());

        if (!tree) return std::nullopt;

        CSTResult result;
        result.root = ts_tree_root_node(tree);
        result.tree = tree;  // Owned, deleted in destructor
        return result;
    }

private:
    TSParser* parser_;
};
```

Parsing runs in parallel via oneTBB:

```cpp
tbb::parallel_for(size_t(0), files.size(), [&](size_t i) {
    auto content = read_file(files[i].path);
    auto cst = parser.parse(content, files[i].language);
    if (cst) {
        results[i] = extractor.extract(*cst, content, files[i]);
    }
});
```

### Stage 3: Symbol & Reference Extraction

**Input**: `std::vector<CSTResult>`  
**Output**: `std::vector<FileAnalysis>`  
**Module**: `parser` — language-specific extractors

```cpp
struct Extractor {
    virtual ~Extractor() = default;
    virtual std::string language() const = 0;
    virtual std::vector<Symbol> extract_symbols(TSNode root,
                                                  const std::string& source) = 0;
    virtual std::vector<Reference> extract_references(TSNode root,
                                                        const std::string& source) = 0;
    virtual std::vector<Import> extract_imports(TSNode root,
                                                  const std::string& source) = 0;
};

// One impl per language
class TypeScriptExtractor : public Extractor { ... };
class PythonExtractor : public Extractor { ... };
```

CST walking uses tree-sitter query API for pattern matching:

```cpp
std::vector<Symbol> TypeScriptExtractor::extract_symbols(
    TSNode root, const std::string& source) {

    // Use tree-sitter query for pattern matching
    uint32_t error_offset;
    TSQueryError error_type;
    TSQuery* query = ts_query_new(
        tree_sitter_typescript(),
        "(function_declaration name: (identifier) @name) @func",
        strlen("..."),
        &error_offset, &error_type);

    TSQueryCursor* cursor = ts_query_cursor_new();
    ts_query_cursor_exec(cursor, query, root);

    std::vector<Symbol> symbols;
    TSQueryMatch match;
    while (ts_query_cursor_next_match(cursor, &match)) {
        // Extract symbol from captured nodes
        Symbol sym;
        sym.name = node_text(match.captures[0].node, source);
        sym.kind = NodeKind::Function;
        // ... fill span, etc.
        symbols.push_back(std::move(sym));
    }

    ts_query_cursor_delete(cursor);
    ts_query_delete(query);
    return symbols;
}
```

### Stage 4: Import Resolution

**Input**: `std::vector<FileAnalysis>`  
**Output**: `std::vector<ResolvedImport>`  
**Module**: `resolver`

Language-specific import resolution — same strategies as Rust version:

| Language | Resolution |
|---|---|
| TypeScript | Node.js resolution: tsconfig paths, node_modules, relative |
| JavaScript | Node.js resolution: package.json exports, relative |
| Python | sys.path-like: relative, module path, __init__.py |
| Rust (P2) | mod.rs/lib.rs, Cargo.toml |
| Go (P2) | GOPATH, module path |

### Stage 5: Reference Resolution

**Input**: `FileAnalysis` + `ResolvedImport`  
**Output**: `std::vector<ResolvedRef>`  
**Module**: `resolver`

Heuristic scope chain resolution:

1. **Lexical scoping** — walk up scope tree (innermost → function → module → global)
2. **Module scope** — search symbols in the file/namespace
3. **Import scope** — search symbols reachable via imports
4. **Fallback** — mark as unresolved (better than guessing)

### Stage 6: Relationship Extraction

**Input**: `FileAnalysis` + `ResolvedImport` + `ResolvedRef`  
**Output**: `GraphFragment` (nodes + edges)  
**Module**: `graph` — `builder.cpp`

Graph built using flat arrays:

```cpp
struct Graph {
    std::vector<Node> nodes;
    std::vector<Edge> edges;
    std::vector<std::vector<size_t>> adjacency_out;
    std::vector<std::vector<size_t>> adjacency_in;
};

GraphFragment build_graph(const FileAnalysis& analysis,
                          const std::vector<ResolvedRef>& refs) {
    GraphFragment g;
    for (const auto& sym : analysis.symbols) {
        g.nodes.push_back(Node{...});
    }
    for (const auto& ref : refs) {
        if (ref.resolved) {
            g.edges.push_back(Edge{ref.source_id, ref.target_id, EdgeKind::References});
        }
    }
    return g;
}
```

### Stage 7: Analysis

**Input**: `GraphFragment`  
**Output**: `Metrics`  
**Module**: `metrics`

| Metric | Scope | Formula |
|---|---|---|
| Cyclomatic complexity | Function | M = E - N + 2P |
| Lines of code | Function/File | Non-comment, non-blank |
| Fan-in coupling | Module | Number of importing modules |
| Fan-out coupling | Module | Number of imported modules |
| Maintainability index | File | 171 - 5.2·ln(HV) - 0.23·CC - 16.2·ln(LOC) |
| Doc coverage | File | % of public symbols with docs |

### Stage 8: Storage

**Input**: Graph + metrics from prior stages  
**Output**: Persisted SQLite  
**Module**: `storage`

```cpp
void Database::store_index(const std::vector<FileInfo>& files,
                            const Graph& graph,
                            const Metrics& metrics,
                            const std::string& repo_root) {
    auto tx = begin_transaction();

    for (const auto& f : files) {
        insert_file(f);
    }
    // Batch inserts with prepared statements
    for (const auto& node : graph.nodes) {
        insert_node(node);
    }
    for (const auto& edge : graph.edges) {
        insert_edge(edge);
    }
    store_metrics(metrics);

    tx.commit();
}
```

Transactions are atomic. WAL mode allows concurrent reads during indexing.

## Incremental Updates (Phase 2)

Notifications via efsw (cross-platform file watcher):

```
FileSystemEvent (create, modify, delete)
    │
    ▼
Debounce (500ms) — coalesce batch edits
    │
    ▼
For each changed file:
    1. Re-compute SHA-256 hash, compare with stored
    2. If unchanged: skip
    3. If changed:
       a. Re-parse, extract new symbols
       b. Diff against old symbol set
       c. DELETE FROM edges WHERE file_id = ?
       d. DELETE FROM nodes WHERE file_id = ?
       e. INSERT new nodes + edges
       f. Re-resolve cross-file references
       g. Recompute affected metrics
    4. If deleted:
       a. DELETE FROM files WHERE relative_path = ?
       b. (Cascade deletes nodes and edges)
    │
    ▼
Notify WebSocket clients of delta
```

Phase 1 simplification: full re-index on change. Incremental in Phase 2.

## Performance Targets

| Metric | Target |
|---|---|
| Parsing throughput | ≥100K LOC/second (single-threaded equivalent) |
| Import resolution | <1s for 1000 files |
| Reference resolution | <5s for 10K symbols |
| Full index (100K LOC repo) | <5 seconds |
| Full index (1M LOC repo) | <60 seconds |
| Incremental update (single file) | <100ms |
