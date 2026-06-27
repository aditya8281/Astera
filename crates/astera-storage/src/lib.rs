use rusqlite::{params, Connection, Result as SqlResult};
use std::path::Path;

use astera_core::{Edge, EdgeKind, FileInfo, Node, NodeKind, SourceSpan};

/// Database for Astera index
pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create database at path
    pub fn open(path: &Path) -> SqlResult<Self> {
        let conn = Connection::open(path)?;

        // Enable WAL mode for concurrent reads
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;

        let db = Database { conn };
        db.initialize_schema()?;
        Ok(db)
    }

    /// Create in-memory database (for testing)
    pub fn in_memory() -> SqlResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;

        let db = Database { conn };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> SqlResult<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS files (
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

            CREATE TABLE IF NOT EXISTS nodes (
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

            CREATE TABLE IF NOT EXISTS edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                target_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                properties TEXT NOT NULL DEFAULT '{}',
                file_id INTEGER REFERENCES files(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);
            CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
            CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file_id);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
            CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);
            CREATE INDEX IF NOT EXISTS idx_edges_unique ON edges(source_node_id, target_node_id, kind);

            -- FTS5 full-text search (best-effort, may fail if sqlite lacks FTS5)
            ",
        )?;

        // Try to create FTS5 table
        let fts_result = self.conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
                name, doc_comment, properties,
                content='nodes',
                content_rowid='id'
            );",
        );

        match fts_result {
            Ok(_) => {
                // FTS5 available, set up triggers
                let _ = self.conn.execute_batch(
                    "CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
                        INSERT INTO nodes_fts(rowid, name, doc_comment, properties)
                        VALUES (new.id, new.name, new.doc_comment, new.properties);
                    END;

                    CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
                        INSERT INTO nodes_fts(nodes_fts, rowid, name, doc_comment, properties)
                        VALUES ('delete', old.id, old.name, old.doc_comment, old.properties);
                    END;

                    CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
                        INSERT INTO nodes_fts(nodes_fts, rowid, name, doc_comment, properties)
                        VALUES ('delete', old.id, old.name, old.doc_comment, old.properties);
                        INSERT INTO nodes_fts(rowid, name, doc_comment, properties)
                        VALUES (new.id, new.name, new.doc_comment, new.properties);
                    END;",
                );
            }
            Err(e) => {
                tracing::warn!("FTS5 not available (falling back to LIKE search): {}", e);
            }
        }

        Ok(())
    }

    // ─── File CRUD ───

    pub fn insert_file(&self, file: &FileInfo) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO files (repo_root, relative_path, language, hash, size, line_count, last_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                file.repo_root,
                file.relative_path,
                file.language,
                file.hash,
                file.size,
                file.line_count,
                file.last_modified,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn file_exists(&self, path: &str) -> SqlResult<Option<i64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id FROM files WHERE relative_path = ?1")?;
        let result = stmt.query_row(params![path], |row| row.get(0));
        match result {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn file_has_changed(&self, path: &str, hash: &str) -> SqlResult<bool> {
        let mut stmt = self
            .conn
            .prepare("SELECT hash FROM files WHERE relative_path = ?1")?;
        let result: Result<String, _> = stmt.query_row(params![path], |row| row.get(0));
        match result {
            Ok(existing_hash) => Ok(existing_hash != hash),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(true), // new file
            Err(e) => Err(e),
        }
    }

    pub fn delete_file(&self, file_id: i64) -> SqlResult<()> {
        // Edges reference nodes; nodes reference files — CASCADE handles it
        self.conn
            .execute("DELETE FROM files WHERE id = ?1", params![file_id])?;
        Ok(())
    }

    pub fn list_files(&self) -> SqlResult<Vec<FileInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, repo_root, relative_path, language, hash, size, line_count, indexed_at, last_modified
             FROM files ORDER BY relative_path",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(FileInfo {
                id: Some(row.get(0)?),
                repo_root: row.get(1)?,
                relative_path: row.get(2)?,
                language: row.get(3)?,
                hash: row.get(4)?,
                size: row.get(5)?,
                line_count: row.get(6)?,
                indexed_at: Some(row.get(7)?),
                last_modified: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn file_count(&self) -> SqlResult<u64> {
        let count: u64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))?;
        Ok(count)
    }

    // ─── Node CRUD ───

    pub fn insert_nodes(&self, nodes: &[Node]) -> SqlResult<Vec<i64>> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO nodes (kind, name, file_id, start_line, start_col, end_line, end_col, doc_comment, properties)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )?;

        let mut ids = Vec::with_capacity(nodes.len());
        for node in nodes {
            stmt.execute(params![
                node.kind.as_str(),
                node.name,
                node.file_id,
                node.span.start_line,
                node.span.start_col,
                node.span.end_line,
                node.span.end_col,
                node.doc_comment,
                node.properties.to_string(),
            ])?;
            ids.push(self.conn.last_insert_rowid());
        }
        Ok(ids)
    }

    pub fn get_node(&self, id: i64) -> SqlResult<Option<Node>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, file_id, start_line, start_col, end_line, end_col, doc_comment, properties
             FROM nodes WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], Self::map_node)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn query_nodes(
        &self,
        kind: Option<&str>,
        name: Option<&str>,
        file_id: Option<i64>,
    ) -> SqlResult<Vec<Node>> {
        self.query_nodes_limit(kind, name, file_id, 50_000)
    }

    pub fn query_nodes_limit(
        &self,
        kind: Option<&str>,
        name: Option<&str>,
        file_id: Option<i64>,
        limit: u32,
    ) -> SqlResult<Vec<Node>> {
        let mut sql = String::from(
            "SELECT id, kind, name, file_id, start_line, start_col, end_line, end_col, doc_comment, properties FROM nodes WHERE 1=1",
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(k) = kind {
            sql.push_str(" AND kind = ?");
            param_values.push(Box::new(k.to_string()));
        }
        if let Some(n) = name {
            sql.push_str(" AND name LIKE ?");
            param_values.push(Box::new(format!("%{}%", n)));
        }
        if let Some(fid) = file_id {
            sql.push_str(" AND file_id = ?");
            param_values.push(Box::new(fid));
        }

        sql.push_str(&format!(" ORDER BY name LIMIT {}", limit));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), Self::map_node)?;
        rows.collect()
    }

    pub fn search_nodes(&self, query: &str) -> SqlResult<Vec<Node>> {
        // Try FTS5 first, fall back to LIKE
        let fts_sql = "SELECT n.id, n.kind, n.name, n.file_id, n.start_line, n.start_col, n.end_line, n.end_col, n.doc_comment, n.properties
                       FROM nodes n
                       INNER JOIN nodes_fts ON nodes_fts.rowid = n.id
                       WHERE nodes_fts MATCH ?1
                       LIMIT 50";

        match self.conn.prepare(fts_sql) {
            Ok(mut stmt) => {
                let rows = stmt.query_map(params![query], Self::map_node)?;
                let results: SqlResult<Vec<Node>> = rows.collect();
                if let Ok(nodes) = results {
                    if !nodes.is_empty() {
                        return Ok(nodes);
                    }
                }
                // FTS5 returned empty, fall through to LIKE
            }
            Err(_) => {
                // FTS5 table doesn't exist, use LIKE
            }
        }

        // Fallback: LIKE search
        self.query_nodes(None, Some(query), None)
    }

    pub fn symbol_count(&self) -> SqlResult<u64> {
        let count: u64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))?;
        Ok(count)
    }

    // ─── Edge CRUD ───

    pub fn insert_edges(&self, edges: &[Edge]) -> SqlResult<Vec<i64>> {
        let mut stmt = self.conn.prepare(
            "INSERT OR IGNORE INTO edges (source_node_id, target_node_id, kind, properties, file_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;

        let mut ids = Vec::with_capacity(edges.len());
        for edge in edges {
            stmt.execute(params![
                edge.source_node_id,
                edge.target_node_id,
                edge.kind.as_str(),
                edge.properties.to_string(),
                edge.file_id,
            ])?;

            // INSERT OR IGNORE may not actually insert; check if row was inserted
            let changes = self.conn.changes();
            if changes > 0 {
                ids.push(self.conn.last_insert_rowid());
            }
        }
        Ok(ids)
    }

    pub fn get_edges(
        &self,
        kind: Option<&str>,
        source_id: Option<i64>,
        target_id: Option<i64>,
    ) -> SqlResult<Vec<Edge>> {
        let mut sql = String::from("SELECT id, source_node_id, target_node_id, kind, file_id, properties FROM edges WHERE 1=1");
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(k) = kind {
            sql.push_str(" AND kind = ?");
            param_values.push(Box::new(k.to_string()));
        }
        if let Some(sid) = source_id {
            sql.push_str(" AND source_node_id = ?");
            param_values.push(Box::new(sid));
        }
        if let Some(tid) = target_id {
            sql.push_str(" AND target_node_id = ?");
            param_values.push(Box::new(tid));
        }

        sql.push_str(" LIMIT 50000");

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            let props_str: String = row.get(5)?;
            Ok(Edge {
                id: Some(row.get(0)?),
                source_node_id: row.get(1)?,
                target_node_id: row.get(2)?,
                kind: EdgeKind::parse_from_str(&row.get::<_, String>(3)?)
                    .unwrap_or(EdgeKind::References),
                file_id: row.get(4)?,
                properties: serde_json::from_str(&props_str).unwrap_or_default(),
            })
        })?;
        rows.collect()
    }

    pub fn edge_count(&self) -> SqlResult<u64> {
        let count: u64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))?;
        Ok(count)
    }

    // ─── Migration helpers ───

    pub fn has_table(&self, name: &str) -> SqlResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
            params![name],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ─── Transaction support ───

    pub fn transaction<F, T>(&self, f: F) -> SqlResult<T>
    where
        F: FnOnce(&Connection) -> SqlResult<T>,
    {
        f(&self.conn)
    }

    fn map_node(row: &rusqlite::Row) -> rusqlite::Result<Node> {
        let props_str: String = row.get(9)?;
        Ok(Node {
            id: Some(row.get(0)?),
            kind: NodeKind::parse_from_str(&row.get::<_, String>(1)?)
                .unwrap_or(NodeKind::Anonymous),
            name: row.get(2)?,
            file_id: row.get(3)?,
            span: SourceSpan {
                start_line: row.get(4)?,
                start_col: row.get(5)?,
                end_line: row.get(6)?,
                end_col: row.get(7)?,
            },
            doc_comment: row.get(8)?,
            properties: serde_json::from_str(&props_str).unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use astera_core::{EdgeKind, NodeKind, SourceSpan};

    fn test_db() -> Database {
        Database::in_memory().expect("Failed to create in-memory DB")
    }

    fn test_file() -> FileInfo {
        FileInfo {
            id: None,
            repo_root: "/test".into(),
            relative_path: "src/main.ts".into(),
            language: "typescript".into(),
            hash: "abc123".into(),
            size: 100,
            line_count: 50,
            indexed_at: None,
            last_modified: "2024-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn test_insert_file() {
        let db = test_db();
        let id = db.insert_file(&test_file()).unwrap();
        assert!(id > 0);
    }

    #[test]
    fn test_file_exists() {
        let db = test_db();
        let file = test_file();
        let id = db.insert_file(&file).unwrap();
        let found = db.file_exists("src/main.ts").unwrap();
        assert_eq!(found, Some(id));
        assert_eq!(db.file_exists("nonexistent.ts").unwrap(), None);
    }

    #[test]
    fn test_file_has_changed() {
        let db = test_db();
        let file = test_file();
        db.insert_file(&file).unwrap();
        assert!(!db.file_has_changed("src/main.ts", "abc123").unwrap());
        assert!(db.file_has_changed("src/main.ts", "different").unwrap());
        assert!(db.file_has_changed("new.ts", "hash").unwrap());
    }

    #[test]
    fn test_insert_nodes() {
        let db = test_db();
        let fid = db.insert_file(&test_file()).unwrap();

        let nodes = vec![
            Node::new(
                NodeKind::Function,
                "hello",
                fid,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 5,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Class,
                "MyClass",
                fid,
                SourceSpan {
                    start_line: 10,
                    start_col: 1,
                    end_line: 20,
                    end_col: 1,
                },
            ),
        ];

        let ids = db.insert_nodes(&nodes).unwrap();
        assert_eq!(ids.len(), 2);
        assert!(ids[0] > 0);

        let q = db.query_nodes(Some("Function"), None, None).unwrap();
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].kind, NodeKind::Function);
    }

    #[test]
    fn test_insert_edges() {
        let db = test_db();
        let fid = db.insert_file(&test_file()).unwrap();
        let nodes = vec![
            Node::new(
                NodeKind::Function,
                "caller",
                fid,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 3,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Function,
                "callee",
                fid,
                SourceSpan {
                    start_line: 5,
                    start_col: 1,
                    end_line: 7,
                    end_col: 1,
                },
            ),
        ];
        let node_ids = db.insert_nodes(&nodes).unwrap();

        let edges = vec![Edge::new(node_ids[0], node_ids[1], EdgeKind::Calls)];
        let edge_ids = db.insert_edges(&edges).unwrap();
        assert_eq!(edge_ids.len(), 1);

        let found = db.get_edges(Some("Calls"), None, None).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].source_node_id, node_ids[0]);
        assert_eq!(found[0].target_node_id, node_ids[1]);
    }

    #[test]
    fn test_delete_cascade() {
        let db = test_db();
        let fid = db.insert_file(&test_file()).unwrap();
        let nodes = vec![Node::new(
            NodeKind::Function,
            "fn",
            fid,
            SourceSpan {
                start_line: 1,
                start_col: 1,
                end_line: 3,
                end_col: 1,
            },
        )];
        let _node_ids = db.insert_nodes(&nodes).unwrap();

        db.delete_file(fid).unwrap();
        let q = db.query_nodes(None, None, None).unwrap();
        assert_eq!(q.len(), 0); // CASCADE deleted nodes
    }

    #[test]
    fn test_search() {
        let db = test_db();
        let fid = db.insert_file(&test_file()).unwrap();
        let nodes = vec![
            Node::new(
                NodeKind::Function,
                "getUserById",
                fid,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 3,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Function,
                "deleteUser",
                fid,
                SourceSpan {
                    start_line: 5,
                    start_col: 1,
                    end_line: 7,
                    end_col: 1,
                },
            ),
        ];
        db.insert_nodes(&nodes).unwrap();

        let results = db.search_nodes("User").unwrap();
        assert_eq!(results.len(), 2); // LIKE fallback matches both getUserById + deleteUser
        assert_eq!(results[0].name, "deleteUser"); // alphabetical order
        assert_eq!(results[1].name, "getUserById");
    }

    #[test]
    fn test_list_files() {
        let db = test_db();
        db.insert_file(&test_file()).unwrap();
        let files = db.list_files().unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].relative_path, "src/main.ts");
    }

    #[test]
    fn test_stats() {
        let db = test_db();
        assert_eq!(db.file_count().unwrap(), 0);
        assert_eq!(db.symbol_count().unwrap(), 0);
        assert_eq!(db.edge_count().unwrap(), 0);

        let fid = db.insert_file(&test_file()).unwrap();
        db.insert_nodes(&[Node::new(
            NodeKind::Function,
            "fn",
            fid,
            SourceSpan {
                start_line: 1,
                start_col: 1,
                end_line: 3,
                end_col: 1,
            },
        )])
        .unwrap();

        assert_eq!(db.file_count().unwrap(), 1);
        assert_eq!(db.symbol_count().unwrap(), 1);
    }
}
