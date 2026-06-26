# Astera — Analysis Pipeline (Rust)

## Overview

The analysis pipeline transforms raw source files into a structured Code Property Graph. It runs in 8 sequential stages, with stages 2-3 parallelized per file via rayon.

```
Source Files
    │
    ▼
[1. Discovery]  ─── Walk filesystem, classify, filter (ignore crate)
    │
    ▼
[2. Parsing]  ─── Tree-sitter CST (rayon parallel iter)
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
[7. Analysis]  ─── Metrics, complexity, coupling, cycles (Phase 2)
    │
    ▼
[8. Storage]  ─── SQLite persistent store via rusqlite
    │
    ▼
Code Property Graph (queryable)
```

## Stage Details

### Stage 1: Discovery

**Input**: Filesystem root path  
**Output**: `Vec<DiscoveredFile>`  
**Crate**: `astera-discovery`

```
1. Walk path with `ignore::WalkBuilder` (ripgrep's .gitignore engine)
2. Respects .gitignore, .asteraignore, custom exclude patterns
3. For each file:
   a. Determine language from extension (.ts → TypeScript, .py → Python, etc.)
   b. Compute SHA-256 hash of content (for change detection)
   c. Record size, modification time
   d. Skip if hash matches existing index entry (fast path)
4. Filter: skip hidden files, node_modules, target, .git, .astera
5. Return sorted Vec<DiscoveredFile>
```

Language detection:

| Extension | Language | Phase |
|---|---|---|
| .ts, .tsx | TypeScript | 1 |
| .js, .jsx, .mjs, .cjs | JavaScript | 1 |
| .py | Python | 1 |
| .rs | Rust | 1 |
| .go | Go | 2 |
| .c, .h | C | 3 |
| .cpp, .hpp, .cc | C++ | 3 |
| .java | Java | 3 |

### Stage 2: Parsing

**Input**: `Vec<DiscoveredFile>`  
**Output**: `Vec<ParsedFile>`  
**Crate**: `astera-parser`

Tree-sitter via Rust crate — no C API wrappers needed:

```rust
fn parse_file(source: &[u8], language: &str) -> Result<CSTResult> {
    let mut parser = Parser::new();
    let lang = get_language(language)?;
    parser.set_language(&lang)?;
    let tree = parser.parse(source, None)
        .ok_or(anyhow!("Parse failed"))?;
    Ok(CSTResult {
        root: tree.root_node(),
        tree,   // owned, dropped when done
    })
}
```

Parsing runs in parallel via rayon:

```rust
files.par_iter().map(|file| {
    let cst = parse_file(&file.bytes, &file.language)?;
    let (symbols, edges) = extractor.extract(cst.root, &file.bytes, file.file_id);
    Ok(ParsedFile { file, symbols, edges })
}).collect::<Result<Vec<_>>>()
```

### Stage 3: Symbol & Reference Extraction

**Input**: `Vec<CSTResult>`  
**Output**: `Vec<(Symbol, Edge)>` per file  
**Crate**: `astera-parser` — language-specific extractors

```rust
pub trait Extract: Send + Sync {
    fn extract(&self, root: Node, source: &[u8], file_id: i64)
        -> (Vec<Node>, Vec<Edge>);
}
```

CST walking uses tree-sitter's node type + named child iteration:

```rust
impl TypeScriptExtractor {
    fn extract_functions(&self, root: Node, source: &[u8], file_id: i64) -> Vec<Node> {
        let mut symbols = Vec::new();
        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            if child.kind() == "function_declaration" {
                let name_node = child.child_by_field_name("name");
                let name = name_node.and_then(|n| n.utf8_text(source).ok())
                    .unwrap_or("anonymous");
                symbols.push(Node::new(
                    NodeKind::Function, name, file_id,
                    SourceSpan {
                        start_line: child.start_position().row as u32 + 1,
                        start_col: child.start_position().column as u32 + 1,
                        end_line: child.end_position().row as u32 + 1,
                        end_col: child.end_position().column as u32 + 1,
                    },
                ));
            }
        }
        symbols
    }
}
```

### Stage 4: Import Resolution

**Input**: `Vec<ParsedFile>`  
**Output**: `Vec<ResolvedImport>`  
**Crate**: `astera-resolver`

Language-specific import resolution:

| Language | Resolution |
|---|---|
| TypeScript | Node.js resolution: tsconfig paths, node_modules, relative |
| JavaScript | Node.js resolution: package.json exports, relative |
| Python | sys.path-like: relative, module path, __init__.py |
| Rust | mod.rs/lib.rs, Cargo.toml externs |
| Go | GOPATH, module path |

### Stage 5: Reference Resolution

**Input**: `ParsedFile` + `ResolvedImport`  
**Output**: `Vec<ResolvedRef>`  
**Crate**: `astera-resolver`

Heuristic scope chain resolution:
1. **Lexical scoping** — walk up scope tree (innermost → function → module → global)
2. **Module scope** — search symbols in the file/namespace
3. **Import scope** — search symbols reachable via imports
4. **Fallback** — mark as unresolved (better than guessing)

### Stage 6: Relationship Extraction

**Input**: `ParsedFile` + `ResolvedImport` + `ResolvedRef`  
**Output**: `GraphFragment` (nodes + edges)  
**Crate**: `astera-graph`

```rust
pub struct GraphBuilder {
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    file_map: HashMap<String, usize>,
}
```

### Stage 7: Analysis (Phase 2)

| Metric | Scope | Formula |
|---|---|---|
| Cyclomatic complexity | Function | M = E - N + 2P |
| Lines of code | Function/File | Non-comment, non-blank |
| Fan-in coupling | Module | Number of importing modules |
| Fan-out coupling | Module | Number of imported modules |
| Maintainability index | File | 171 - 5.2·ln(HV) - 0.23·CC - 16.2·ln(LOC) |
| Doc coverage | File | % of public symbols with docs |

### Stage 8: Storage

**Input**: Graph + extracted data  
**Output**: Persisted SQLite  
**Crate**: `astera-storage`

```rust
fn store_index(db: &Database, files: &[FileInfo], nodes: &[Node], edges: &[Edge]) -> Result<()> {
    let tx = db.transaction()?;
    for file in files { tx.insert_file(file)?; }
    for node in nodes { tx.insert_node(node)?; }
    for edge in edges { tx.insert_edge(edge)?; }
    tx.commit()?;
    Ok(())
}
```

## Incremental Updates (Phase 2)

```
File change → notify crate
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
       b. DELETE old edges/nodes for file_id
       c. INSERT new nodes + edges
       d. Re-resolve cross-file references
       e. Recompute affected metrics
    4. If deleted: DELETE FROM files WHERE relative_path = ? (cascade)
    │
    ▼
Notify WebSocket clients of delta
```

Phase 1: full re-index on change. Incremental in Phase 2.

## Performance Targets

| Metric | Target |
|---|---|
| Parsing throughput | ≥100K LOC/second |
| Import resolution | <1s for 1000 files |
| Reference resolution | <5s for 10K symbols |
| Full index (100K LOC repo) | <5 seconds |
| Full index (1M LOC repo) | <60 seconds |
| Incremental update (single file) | <100ms |
