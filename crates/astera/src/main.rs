use std::path::Path;
use std::time::Instant;

use clap::{Parser, Subcommand};

use astera_core::IndexReport;
use astera_discovery::FileWalker;
use astera_parser::{parse, Extractor, ParseOutput};
use astera_storage::Database;

#[derive(Parser)]
#[command(name = "astera", version, about = "Local-first static analysis engine")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize Astera index at repo root
    Init {
        /// Path to repository root
        #[arg(default_value = ".")]
        path: String,
    },
    /// Index a repository (build full CPG)
    Index {
        /// Path to repository root
        #[arg(default_value = ".")]
        path: String,
    },
    /// Query indexed data
    Query {
        #[command(subcommand)]
        query: QueryCommands,
    },
    /// Start the API server
    Serve {
        /// Port to listen on
        #[arg(short, long, default_value = "8080")]
        port: u16,
        /// Path to web UI build directory (auto-detected if not specified)
        #[arg(long)]
        web_dir: Option<String>,
    },
    /// Watch for file changes and re-index automatically
    Watch {
        /// Path to repository root
        #[arg(default_value = ".")]
        path: String,
        /// Port for API server (serves while watching)
        #[arg(short, long, default_value = "8080")]
        port: u16,
    },
    /// Export graph to a file (JSON, CSV, or DOT)
    Export {
        /// Output file path (extension determines format: .json, .csv, .dot)
        #[arg(short, long)]
        output: String,
    },
}

#[derive(Subcommand)]
enum QueryCommands {
    /// List indexed symbols
    Symbols {
        /// Filter by kind (Function, Class, etc.)
        #[arg(short, long)]
        kind: Option<String>,
        /// Search by name
        #[arg(short, long)]
        name: Option<String>,
    },
    /// List indexed edges
    Edges {
        /// Filter by kind (Contains, Calls, etc.)
        #[arg(short, long)]
        kind: Option<String>,
    },
    /// List indexed files
    Files {
        /// Filter by language (rust, python, typescript, etc.)
        #[arg(short, long)]
        language: Option<String>,
    },
    /// Full-text search across all symbols
    Search {
        /// Search query
        query: String,
    },
}

fn find_astera_root(start: &Path) -> Option<std::path::PathBuf> {
    let mut current = Some(start.to_path_buf());
    while let Some(dir) = current {
        if dir.join(".astera").is_dir() {
            return Some(dir);
        }
        current = dir.parent().map(|p| p.to_path_buf());
    }
    None
}

fn init_command(path: &str) -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(path)?;
    let astera_dir = root.join(".astera");

    if astera_dir.exists() {
        println!("Astera index already exists at: {}", astera_dir.display());
        return Ok(());
    }

    std::fs::create_dir_all(&astera_dir)?;
    println!("Initialized Astera index at: {}", astera_dir.display());
    Ok(())
}

fn index_command(path: &str) -> Result<(), anyhow::Error> {
    let start = Instant::now();
    let root = std::fs::canonicalize(path)?;
    let astera_dir = root.join(".astera");

    if !astera_dir.exists() {
        println!("No .astera directory found. Run 'astera init' first.");
        return Ok(());
    }

    let db_path = astera_dir.join("index.db");
    let db = Database::open(&db_path)?;

    println!("Indexing repository: {}", root.display());

    let walker = FileWalker::new(root.to_str().unwrap());
    let files = walker.discover_with_content();

    let total_files = files.len();
    println!("Found {} parseable files", total_files);

    if total_files == 0 {
        println!("No parseable files found to index.");
        return Ok(());
    }

    // Phase 1: Insert files into DB and build file_id map
    let mut file_ids = Vec::with_capacity(total_files);
    let mut parse_tasks = Vec::with_capacity(total_files);

    for (rel_path, language, content, hash) in &files {
        // Check if file has changed
        let needs_index = match db.file_has_changed(rel_path, hash) {
            Ok(true) | Err(_) => true,
            Ok(false) => false,
        };

        if !needs_index {
            continue;
        }

        let file_info = astera_core::FileInfo {
            id: None,
            repo_root: root.to_string_lossy().to_string(),
            relative_path: rel_path.clone(),
            language: language.clone(),
            hash: hash.clone(),
            size: content.len() as u64,
            line_count: content.iter().filter(|&&b| b == b'\n').count() as u64,
            indexed_at: None,
            last_modified: String::new(),
        };

        let file_id = db.insert_file(&file_info)?;
        file_ids.push((rel_path.clone(), language.clone(), file_id, content.clone()));
        parse_tasks.push((rel_path.clone(), language.clone(), file_id, content.clone()));
    }

    let to_index = parse_tasks.len();
    println!(
        "Indexing {} files ({} unchanged, skipped)",
        to_index,
        total_files - to_index
    );

    // Phase 2: Parse each file and extract symbols
    use rayon::prelude::*;

    let parse_results: Vec<Option<(String, i64, ParseOutput)>> = parse_tasks
        .par_iter()
        .map(|(rel_path, language, file_id, content)| {
            let mut parsed = match parse(content, language) {
                Ok(p) => p,
                Err(e) => {
                    tracing::warn!("Parse failed for {}: {}", rel_path, e);
                    return None;
                }
            };
            parsed.file_id = *file_id;

            let output = Extractor::extract(&parsed);
            if output.nodes.is_empty() && output.edges.is_empty() {
                return None;
            }
            Some((rel_path.clone(), *file_id, output))
        })
        .collect();

    // Phase 3: Store nodes and edges in DB
    let mut total_symbols = 0u64;
    let mut total_edges = 0u64;
    let mut indexed_files = 0u64;

    for result in parse_results.iter().flatten() {
        let (_, file_id, output) = result;

        // Assign file_id to nodes
        for node in &output.nodes {
            let _ = &node.file_id; // already set during extraction
        }

        // Insert nodes and get their DB IDs
        let node_ids = match db.insert_nodes(&output.nodes) {
            Ok(ids) => ids,
            Err(e) => {
                tracing::warn!("Failed to insert nodes: {}", e);
                continue;
            }
        };

        // Map edge source/target from vec index → DB ID
        let mapped_edges: Vec<astera_core::Edge> = output
            .edges
            .iter()
            .filter_map(|e| {
                let src = e.source_node_id as usize;
                let tgt = e.target_node_id as usize;
                if src < node_ids.len() && tgt < node_ids.len() {
                    let mut edge =
                        astera_core::Edge::new(node_ids[src], node_ids[tgt], e.kind.clone());
                    edge.file_id = Some(*file_id);
                    Some(edge)
                } else {
                    None
                }
            })
            .collect();
        if !mapped_edges.is_empty() {
            match db.insert_edges(&mapped_edges) {
                Ok(ids) => {
                    total_edges += ids.len() as u64;
                }
                Err(e) => {
                    tracing::warn!("Failed to insert edges: {}", e);
                }
            }
        }

        total_symbols += output.nodes.len() as u64;
        indexed_files += 1;
    }

    let elapsed = start.elapsed();
    let report = IndexReport {
        repo_root: root.to_string_lossy().to_string(),
        total_files: total_files as u64,
        known_language_files: total_files as u64,
        indexed_files,
        total_symbols,
        total_edges,
        elapsed_ms: elapsed.as_millis() as u64,
    };

    println!();
    println!("Index complete:");
    let skipped = (total_files as u64).saturating_sub(indexed_files);
    println!(
        "  Files:        {} ({} indexed, {} skipped)",
        total_files, indexed_files, skipped
    );
    println!("  Symbols:      {}", report.total_symbols);
    println!("  Edges:        {}", report.total_edges);
    println!("  Time:         {}ms", report.elapsed_ms);

    Ok(())
}

fn query_symbols(kind: Option<String>, name: Option<String>) -> Result<(), anyhow::Error> {
    let root = find_astera_root(Path::new("."));
    let root = match root {
        Some(r) => r,
        None => {
            println!("No .astera directory found in current or parent directories.");
            return Ok(());
        }
    };

    let db_path = root.join(".astera").join("index.db");
    if !db_path.exists() {
        println!("No index database found at: {}", db_path.display());
        return Ok(());
    }

    let db = Database::open(&db_path)?;

    // Build file_id → relative_path map
    let files = db.list_files()?;
    let file_map: std::collections::HashMap<i64, String> = files
        .into_iter()
        .filter_map(|f| f.id.map(|id| (id, f.relative_path)))
        .collect();

    let symbols = db.query_nodes(kind.as_deref(), name.as_deref(), None)?;

    if symbols.is_empty() {
        println!("No symbols found.");
        return Ok(());
    }

    println!("Symbols ({}):", symbols.len());
    println!(
        "{:<8} {:<20} {:<12} {:<40} {}",
        "ID", "Name", "Kind", "File", "Line"
    );
    println!("{}", "-".repeat(95));

    for sym in &symbols {
        let file = file_map
            .get(&sym.file_id)
            .map(|s| s.as_str())
            .unwrap_or("?");
        println!(
            "{:<8} {:<20} {:<12} {:<40} {}",
            sym.id.unwrap_or(0),
            sym.name,
            sym.kind.to_string(),
            file,
            sym.span.start_line,
        );
    }

    Ok(())
}

fn query_edges(kind: Option<String>) -> Result<(), anyhow::Error> {
    let root = find_astera_root(Path::new("."));
    let root = match root {
        Some(r) => r,
        None => {
            println!("No .astera directory found in current or parent directories.");
            return Ok(());
        }
    };

    let db_path = root.join(".astera").join("index.db");
    if !db_path.exists() {
        println!("No index database found at: {}", db_path.display());
        return Ok(());
    }

    let db = Database::open(&db_path)?;
    let edges = db.get_edges(kind.as_deref(), None, None)?;

    if edges.is_empty() {
        println!("No edges found.");
        return Ok(());
    }

    println!("Edges ({}):", edges.len());
    for edge in &edges {
        println!(
            "  {} -> {} [{}]",
            edge.source_node_id, edge.target_node_id, edge.kind
        );
    }

    Ok(())
}

fn query_files(language: Option<String>) -> Result<(), anyhow::Error> {
    let root = find_astera_root(Path::new("."));
    let root = match root {
        Some(r) => r,
        None => {
            println!("No .astera directory found in current or parent directories.");
            return Ok(());
        }
    };

    let db_path = root.join(".astera").join("index.db");
    if !db_path.exists() {
        println!("No index database found at: {}", db_path.display());
        return Ok(());
    }

    let db = Database::open(&db_path)?;
    let files = db.list_files()?;

    let filtered: Vec<_> = match &language {
        Some(lang) => files.into_iter().filter(|f| f.language == *lang).collect(),
        None => files,
    };

    if filtered.is_empty() {
        println!("No files found.");
        return Ok(());
    }

    println!("Files ({}):", filtered.len());
    println!(
        "{:<6} {:<45} {:<15} {:>10} {:>8}",
        "ID", "Path", "Language", "Size", "Lines"
    );
    println!("{}", "-".repeat(90));

    for f in &filtered {
        println!(
            "{:<6} {:<45} {:<15} {:>10} {:>8}",
            f.id.unwrap_or(0),
            f.relative_path,
            f.language,
            f.size,
            f.line_count,
        );
    }

    Ok(())
}

fn query_search(query: &str) -> Result<(), anyhow::Error> {
    let root = find_astera_root(Path::new("."));
    let root = match root {
        Some(r) => r,
        None => {
            println!("No .astera directory found in current or parent directories.");
            return Ok(());
        }
    };

    let db_path = root.join(".astera").join("index.db");
    if !db_path.exists() {
        println!("No index database found at: {}", db_path.display());
        return Ok(());
    }

    let db = Database::open(&db_path)?;

    // Build file_id → path map
    let files = db.list_files()?;
    let file_map: std::collections::HashMap<i64, String> = files
        .into_iter()
        .filter_map(|f| f.id.map(|id| (id, f.relative_path)))
        .collect();

    let results = db.search_nodes(query)?;

    if results.is_empty() {
        println!("No results for '{}'.", query);
        return Ok(());
    }

    println!("Search results for '{}' ({}):", query, results.len());
    println!(
        "{:<8} {:<20} {:<12} {:<40} {}",
        "ID", "Name", "Kind", "File", "Line"
    );
    println!("{}", "-".repeat(95));

    for sym in &results {
        let file = file_map
            .get(&sym.file_id)
            .map(|s| s.as_str())
            .unwrap_or("?");
        println!(
            "{:<8} {:<20} {:<12} {:<40} {}",
            sym.id.unwrap_or(0),
            sym.name,
            sym.kind.to_string(),
            file,
            sym.span.start_line,
        );
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Init { path } => {
            init_command(&path)?;
        }
        Commands::Index { path } => {
            index_command(&path)?;
        }
        Commands::Query { query } => match query {
            QueryCommands::Symbols { kind, name } => {
                query_symbols(kind, name)?;
            }
            QueryCommands::Edges { kind } => {
                query_edges(kind)?;
            }
            QueryCommands::Files { language } => {
                query_files(language)?;
            }
            QueryCommands::Search { query } => {
                query_search(&query)?;
            }
        },
        Commands::Serve { port, web_dir } => {
            let root = find_astera_root(Path::new("."));
            let root = match root {
                Some(r) => r,
                None => {
                    println!("No .astera directory found in current or parent directories.");
                    return Ok(());
                }
            };
            let db_path = root.join(".astera").join("index.db");
            if !db_path.exists() {
                println!("No index database found at: {}", db_path.display());
                println!("Run 'astera index' first.");
                return Ok(());
            }

            // Find the web UI build directory
            let static_dir = web_dir.map(std::path::PathBuf::from).or_else(|| {
                // Auto-detect: check common locations
                let candidates = [
                    root.join("apps/web/dist"),
                    root.join("web/dist"),
                    root.join("dist"),
                ];
                for path in &candidates {
                    if path.join("index.html").exists() {
                        return Some(path.clone());
                    }
                }
                None
            });

            astera_api::serve_with_static(&db_path, port, static_dir).await?;
        }
        Commands::Export { output } => {
            let root = find_astera_root(Path::new("."));
            let root = match root {
                Some(r) => r,
                None => {
                    println!("No .astera directory found in current or parent directories.");
                    return Ok(());
                }
            };
            let db_path = root.join(".astera").join("index.db");
            if !db_path.exists() {
                println!("No index database found at: {}", db_path.display());
                println!("Run 'astera index' first.");
                return Ok(());
            }

            let out_path = std::path::PathBuf::from(&output);
            let format = match out_path.extension().and_then(|e| e.to_str()) {
                Some(ext) => match astera_export::ExportFormat::from_extension(ext) {
                    Some(f) => f,
                    None => {
                        println!("Unknown format '{}'. Use .json, .csv, or .dot", ext);
                        return Ok(());
                    }
                },
                None => {
                    println!("No file extension. Use .json, .csv, or .dot");
                    return Ok(());
                }
            };

            let db = Database::open(&db_path)?;
            astera_export::export_all(&db, &out_path, format)?;
            println!("Exported graph to {}", out_path.display());
        }
        Commands::Watch { path, port } => {
            let root = std::fs::canonicalize(path)?;
            let db_path = root.join(".astera").join("index.db");
            if !db_path.exists() {
                println!("No .astera directory found. Run 'astera init' first.");
                return Ok(());
            }

            println!("Starting watcher on: {}", root.display());
            println!("API server on port {}", port);

            let (update_tx, update_rx) = std::sync::mpsc::channel::<astera_watcher::UpdateResult>();

            // Start watcher in a background thread
            let watcher_root = root.clone();
            let watcher_db = db_path.clone();
            let watcher_handle = std::thread::spawn(move || {
                let watcher = astera_watcher::FileWatcher::new(watcher_root, watcher_db);
                if let Err(e) = watcher.watch(update_tx) {
                    eprintln!("Watcher error: {}", e);
                }
            });

            // Start API server on the main thread
            let api_db_path = db_path.clone();
            let api_handle = tokio::spawn(async move {
                if let Err(e) = astera_api::serve(&api_db_path, port).await {
                    eprintln!("API server error: {}", e);
                }
            });

            // Print updates as they come in
            while let Ok(result) = update_rx.recv() {
                println!(
                    "Re-indexed: {} files changed, +{} nodes, -{} nodes, +{} edges ({}ms)",
                    result.files_changed,
                    result.nodes_added,
                    result.nodes_removed,
                    result.edges_added,
                    result.elapsed_ms
                );
            }

            watcher_handle.join().unwrap();
            api_handle.abort();
        }
    }

    Ok(())
}
