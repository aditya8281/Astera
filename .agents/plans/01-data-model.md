# Astera — Data Model & Storage

## Core Model: Code Property Graph (CPG)

Astera models a codebase as a directed, labeled, property graph. This is the single source of truth for all analysis results.

### Node Types

| Kind | Description | Key Properties |
|---|---|---|
| `File` | Source file | path, language, hash |
| `Module` | Namespace/package/module boundary | qualified_name |
| `Function` | Function/method definition | return_type, complexity |
| `Class` | Class/struct/trait/interface | fields_count, methods_count |
| `Method` | Method within impl/class block | is_static, visibility |
| `Interface` | Interface/protocol/trait | methods_count |
| `Enum` | Enum type | variants_count |
| `Variable` | Module-level/global variable | type_name, is_mutable |
| `Field` | Struct/class field | type_name, visibility |
| `Parameter` | Function parameter | type_name, default_value |
| `TypeAlias` | Type alias | underlying_type |
| `Import` | Import statement | source_module, imported_names |
| `Macro` | Macro/annotation/decorator | expansion (if known) |
| `Anonymous` | Lambda/closure | complexity |

### Edge Types

| Kind | Direction | Meaning |
|---|---|---|
| `Contains` | parent → child | Containment (file→function, class→method) |
| `Calls` | caller → callee | Function/method call |
| `References` | referrer → referred | Any symbol reference (read/write) |
| `Defines` | container → defined | Declaration/definition |
| `Inherits` | class → parent | Class inheritance (extends) |
| `Implements` | class → interface | Interface implementation |
| `Overrides` | method → method | Method override |
| `Imports` | file → module/file | Import/include relationship |
| `Exports` | module → symbol | Export declaration |
| `DependsOn` | file → file | File-level dependency (has imports from) |
| `Declares` | scope → symbol | Scope declares symbol |

## Storage: SQLite3

### Why SQLite

- **Embedded** — No server, no Docker, no external process
- **Zero setup** — `astera init` creates the DB
- **Fast** — B-tree indexes, WAL mode, memory-mapped I/O
- **Full-text search** — FTS5 extension built-in
- **Recursive CTEs** — Graph traversal without external graph DB
- **Portable** — Single `.db` file per repo

### RAII Wrapper Pattern (C++)

```cpp
class Database {
    sqlite3* db_ = nullptr;
public:
    Database(const std::filesystem::path& path);
    ~Database();

    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;
    Database(Database&& other) noexcept : db_(std::exchange(other.db_, nullptr)) {}
    Database& operator=(Database&& other) noexcept {
        std::swap(db_, other.db_);
        return *this;
    }

    // Prepared statements cached by key
    Statement prepare(const char* sql);
    Transaction begin_transaction();

    // CRUD
    int64_t insert_file(const FileInfo& file);
    std::optional<FileInfo> get_file(const std::string& path);
    std::vector<int64_t> insert_nodes(std::span<const Node> nodes);
    std::vector<int64_t> insert_edges(std::span<const Edge> edges);
    void delete_file(int64_t file_id);

    // Queries
    std::vector<Node> get_symbols(const SymbolQuery& q);
    std::vector<Edge> get_edges(int64_t node_id, EdgeKind kind, Direction dir);
    std::vector<SearchResult> search(const std::string& query);

    // Schema
    void migrate();  // Version-based schema updates
};
```

### SQLite Configuration

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;         -- 64MB
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA mmap_size = 268435456;       -- 256MB mmap
```

### Schema

```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_root TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL,
    hash TEXT NOT NULL,
    size INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL
);
CREATE INDEX idx_files_language ON files(language);

CREATE TABLE nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    start_line INTEGER NOT NULL,
    start_col INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    end_col INTEGER NOT NULL,
    doc_comment TEXT,
    properties TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_nodes_kind ON nodes(kind);
CREATE INDEX idx_nodes_name ON nodes(name);
CREATE INDEX idx_nodes_file ON nodes(file_id);

CREATE TABLE edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    UNIQUE(source_node_id, target_node_id, kind)
);
CREATE INDEX idx_edges_source ON edges(source_node_id);
CREATE INDEX idx_edges_target ON edges(target_node_id);
CREATE INDEX idx_edges_kind ON edges(kind);

CREATE TABLE index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- FTS5 full-text search
CREATE VIRTUAL TABLE nodes_fts USING fts5(
    name, doc_comment, properties_tokenized,
    content='nodes',
    content_rowid='id'
);
```

FTS5 sync triggers same as Rust version — `AFTER INSERT`, `AFTER DELETE`, `AFTER UPDATE` on nodes table.

### Graph Queries Via CTEs

Transitive callers (unchanged — pure SQL):

```sql
WITH RECURSIVE callers_of(id, depth) AS (
    SELECT source_node_id, 1 FROM edges
    WHERE target_node_id = ? AND kind = 'Calls'
    UNION
    SELECT e.source_node_id, c.depth + 1
    FROM edges e JOIN callers_of c ON e.target_node_id = c.id
    WHERE e.kind = 'Calls' AND c.depth < ?
)
SELECT DISTINCT n.* FROM nodes n
JOIN callers_of co ON n.id = co.id
ORDER BY co.depth;
```

Impact analysis — same recursive CTE pattern.

## Disk Layout

```
/path/to/repo/
├── src/
└── .astera/
    ├── index.db            # SQLite database
    └── config.toml         # Generated/merged config
```

## Export Format (Phase 3)

Portable JSON format for CI→local transfer:

```json
{
  "version": 1,
  "indexed_at": "2026-06-26T12:00:00Z",
  "repo": {
    "root": ".",
    "files": 247,
    "languages": { "typescript": 120, "python": 80 }
  },
  "statistics": {
    "total_nodes": 3412,
    "total_edges": 8901,
    "avg_complexity": 4.2,
    "avg_coupling": 3.1
  }
}
```
