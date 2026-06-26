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

## Storage: SQLite via rusqlite

### Why SQLite

- **Embedded** — No server, no Docker, no external process
- **Zero setup** — `astera init` creates the DB
- **Fast** — B-tree indexes, WAL mode, memory-mapped I/O
- **Full-text search** — FTS5 extension built-in (bundled in rusqlite)
- **Recursive CTEs** — Graph traversal without external graph DB
- **Portable** — Single `.db` file per repo

### Rust Pattern

```rust
use rusqlite::{Connection, params};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
        let db = Database { conn };
        db.initialize_schema()?;
        Ok(db)
    }

    pub fn insert_file(&self, file: &FileInfo) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO files (repo_root, relative_path, language, hash, size, line_count, last_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![file.repo_root, file.relative_path, ...],
        )?;
        Ok(self.conn.last_insert_rowid())
    }
}
```

## SQLite Schema

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

CREATE TABLE edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    UNIQUE(source_node_id, target_node_id, kind)
);

-- FTS5 for full-text search (auto-synced via triggers)
CREATE VIRTUAL TABLE nodes_fts USING fts5(
    name, doc_comment, properties,
    content='nodes',
    content_rowid='id'
);
```

## Storage Layout

```
.astera/
  index.db       — SQLite database (files, nodes, edges, FTS5)
```

The `.astera/` directory lives at the repository root, gitignored by default.

## Graph Query Patterns (Recursive CTEs)

```sql
-- Full path from symbol to all transitive callers
WITH RECURSIVE callers_of(id, depth) AS (
    SELECT ?1, 0
    UNION ALL
    SELECT e.source_node_id, c.depth + 1
    FROM edges e
    JOIN callers_of c ON e.target_node_id = c.id
    WHERE e.kind = 'Calls' AND c.depth < 10
)
SELECT DISTINCT n.id, n.name, n.kind
FROM callers_of c
JOIN nodes n ON n.id = c.id
WHERE c.depth > 0
ORDER BY c.depth;
```
