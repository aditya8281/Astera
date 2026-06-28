use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use anyhow::Result;
use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use tracing::{info, warn};

use astera_core::{Edge, FileInfo};
use astera_discovery::FileWalker;
use astera_parser::{parse, Extractor};
use astera_storage::Database;

/// Event emitted when an incremental update completes
#[derive(Debug, Clone)]
pub struct UpdateResult {
    pub files_changed: usize,
    pub nodes_added: usize,
    pub edges_added: usize,
    pub nodes_removed: usize,
    pub elapsed_ms: u64,
}

/// File watcher that triggers incremental re-indexing on changes
pub struct FileWatcher {
    root: PathBuf,
    db_path: PathBuf,
    debounce_ms: u64,
}

impl FileWatcher {
    pub fn new(root: PathBuf, db_path: PathBuf) -> Self {
        FileWatcher {
            root,
            db_path,
            debounce_ms: 500,
        }
    }

    pub fn with_debounce(mut self, ms: u64) -> Self {
        self.debounce_ms = ms;
        self
    }

    /// Start watching and re-index on changes. Blocks until the sender is dropped.
    pub fn watch(&self, update_tx: mpsc::Sender<UpdateResult>) -> Result<()> {
        let root = self.root.clone();
        let debounce_ms = self.debounce_ms;

        let (tx, rx) = mpsc::channel::<Vec<PathBuf>>();

        let mut debouncer = new_debouncer(
            Duration::from_millis(debounce_ms),
            move |res: std::result::Result<
                Vec<notify_debouncer_mini::DebouncedEvent>,
                notify::Error,
            >| {
                if let Ok(events) = res {
                    let paths: Vec<PathBuf> = events
                        .into_iter()
                        .map(|e| e.path)
                        .filter(|p| is_watchable(p))
                        .collect();
                    if !paths.is_empty() {
                        let _ = tx.send(paths);
                    }
                }
            },
        )?;

        debouncer.watcher().watch(&root, RecursiveMode::Recursive)?;

        info!(
            "Watching {} for changes (debounce: {}ms)",
            root.display(),
            debounce_ms
        );

        loop {
            match rx.recv() {
                Ok(changed) => {
                    info!("Detected {} changed files, re-indexing...", changed.len());
                    let result = self.reindex_changed(&changed)?;
                    if result.files_changed > 0 {
                        let _ = update_tx.send(result);
                    }
                }
                Err(e) => {
                    warn!("Channel closed: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    /// Re-index only the changed files, and detect deletions
    fn reindex_changed(&self, changed: &[PathBuf]) -> Result<UpdateResult> {
        let start = Instant::now();
        let db = Database::open(&self.db_path)?;

        let walker = FileWalker::new(self.root.to_str().unwrap());
        let all_files = walker.discover_with_content();

        // Build set of currently-existing relative paths
        let existing_paths: std::collections::HashSet<String> = all_files
            .iter()
            .map(|(rel_path, _, _, _)| rel_path.clone())
            .collect();

        // --- DETECT DELETED FILES ---
        // Any file in DB but NOT on disk was deleted
        let mut total_nodes_removed = 0;
        let db_files = db.list_files().unwrap_or_default();
        for db_file in &db_files {
            if !existing_paths.contains(&db_file.relative_path) {
                // This file was deleted from disk
                if let Some(fid) = db_file.id {
                    let old_nodes = db.query_nodes(None, None, Some(fid)).unwrap_or_default();
                    total_nodes_removed += old_nodes.len();
                    if let Err(e) = db.delete_file(fid) {
                        warn!("Failed to delete file {}: {}", db_file.relative_path, e);
                    } else {
                        info!("Removed deleted file from index: {}", db_file.relative_path);
                    }
                }
            }
        }

        // --- RE-INDEX CHANGED FILES ---
        let changed_set: std::collections::HashSet<PathBuf> = changed.iter().cloned().collect();
        let relevant: Vec<(String, String, Vec<u8>, String)> = all_files
            .into_iter()
            .filter(|(rel_path, _, _, _)| {
                let abs = self.root.join(rel_path);
                changed_set.contains(&abs)
            })
            .collect();

        let mut files_changed = 0;
        let mut total_nodes_added = 0;
        let mut total_edges_added = 0;

        for (rel_path, language, content, hash) in &relevant {
            // Check if hash changed
            let needs_update = match db.file_has_changed(&rel_path, hash) {
                Ok(true) | Err(_) => true,
                Ok(false) => false,
            };

            if !needs_update {
                continue;
            }

            // Delete old data for this file (CASCADE handles nodes/edges)
            if let Ok(Some(old_fid)) = db.file_exists(&rel_path) {
                let old_nodes = db
                    .query_nodes(None, None, Some(old_fid))
                    .unwrap_or_default();
                total_nodes_removed += old_nodes.len();
                let _ = db.delete_file(old_fid);
            }

            // Re-insert file
            let file_info = FileInfo {
                id: None,
                repo_root: self.root.to_string_lossy().to_string(),
                relative_path: rel_path.clone(),
                language: language.clone(),
                hash: hash.clone(),
                size: content.len() as u64,
                line_count: content.iter().filter(|&&b| b == b'\n').count() as u64,
                indexed_at: None,
                last_modified: String::new(),
            };

            let file_id = db.insert_file(&file_info)?;

            // Parse and extract
            let output = match parse(&content, &language) {
                Ok(parsed) => Extractor::extract(&parsed),
                Err(e) => {
                    warn!("Parse failed for {}: {}", rel_path, e);
                    continue;
                }
            };

            if output.nodes.is_empty() && output.edges.is_empty() {
                continue;
            }

            // Insert nodes
            let node_ids = match db.insert_nodes(&output.nodes) {
                Ok(ids) => ids,
                Err(e) => {
                    warn!("Failed to insert nodes: {}", e);
                    continue;
                }
            };

            // Map and insert edges
            let mapped_edges: Vec<Edge> = output
                .edges
                .iter()
                .filter_map(|e| {
                    let src = e.source_node_id as usize;
                    let tgt = e.target_node_id as usize;
                    if src < node_ids.len() && tgt < node_ids.len() {
                        let mut edge = Edge::new(node_ids[src], node_ids[tgt], e.kind.clone());
                        edge.file_id = Some(file_id);
                        Some(edge)
                    } else {
                        None
                    }
                })
                .collect();

            if !mapped_edges.is_empty() {
                match db.insert_edges(&mapped_edges) {
                    Ok(ids) => {
                        total_edges_added += ids.len();
                    }
                    Err(e) => {
                        warn!("Failed to insert edges: {}", e);
                    }
                }
            }

            total_nodes_added += output.nodes.len();
            files_changed += 1;
        }

        let elapsed = start.elapsed();
        let total_changes = files_changed + if total_nodes_removed > 0 { 1 } else { 0 };
        info!(
            "Re-index complete: {} files changed, +{} nodes, -{} nodes, +{} edges in {}ms",
            files_changed,
            total_nodes_added,
            total_nodes_removed,
            total_edges_added,
            elapsed.as_millis()
        );

        Ok(UpdateResult {
            files_changed: total_changes,
            nodes_added: total_nodes_added,
            edges_added: total_edges_added,
            nodes_removed: total_nodes_removed,
            elapsed_ms: elapsed.as_millis() as u64,
        })
    }
}

/// Check if a file path should trigger re-indexing
fn is_watchable(path: &Path) -> bool {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Skip hidden files, temp files, build artifacts
    if name.starts_with('.') || name.ends_with('~') || name.ends_with(".swp") {
        return false;
    }

    // Skip common non-source directories
    if let Some(dir_name) = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
    {
        if matches!(
            dir_name,
            "node_modules" | "target" | "build" | "dist" | ".git" | "__pycache__"
        ) {
            return false;
        }
    }

    // Only watch known language extensions
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("ts" | "tsx" | "js" | "jsx" | "py" | "rs" | "go" | "toml" | "json")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_watchable() {
        assert!(is_watchable(Path::new("src/main.rs")));
        assert!(is_watchable(Path::new("lib/utils.ts")));
        assert!(is_watchable(Path::new("app.py")));
        assert!(!is_watchable(Path::new("node_modules/foo.js")));
        assert!(!is_watchable(Path::new("target/debug/astera")));
        assert!(!is_watchable(Path::new(".git/config")));
        assert!(!is_watchable(Path::new("file~")));
        assert!(!is_watchable(Path::new("readme.md")));
    }
}
