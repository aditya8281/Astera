use std::path::{Path, PathBuf};
use std::time::Instant;

use clap::{Parser, Subcommand};

use astera_core::{IndexReport, RepoConfig, WorkspaceConfig};
use astera_discovery::FileWalker;
use astera_parser::{parse, Extractor, ParseOutput};
use astera_storage::Database;

mod benchmarks;

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
    /// Show index statistics (file, symbol, edge counts)
    Stats,
    /// Benchmark regression tracking
    Bench {
        #[command(subcommand)]
        bench: BenchCommands,
    },
    /// Manage workspace (multi-repo)
    Workspace {
        #[command(subcommand)]
        workspace: WorkspaceCommands,
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

#[derive(Subcommand)]
enum WorkspaceCommands {
    /// Initialize a workspace at current directory
    Init {
        /// Workspace name
        #[arg(short, long)]
        name: String,
    },
    /// Add a repository to the workspace
    Add {
        /// Repository path
        path: String,
        /// Name for the repository
        #[arg(short, long)]
        name: Option<String>,
    },
    /// Remove a repository from the workspace
    Remove {
        /// Repository name or path
        target: String,
    },
    /// List repositories in the workspace
    List,
    /// Index all repositories in the workspace
    Index,
    /// Show aggregate statistics across all repos
    Stats,
}

fn workspace_config_path(workspace_dir: &Path) -> PathBuf {
    workspace_dir.join(".astera").join("workspace.toml")
}

fn load_workspace_config(workspace_dir: &Path) -> Result<WorkspaceConfig, anyhow::Error> {
    let config_path = workspace_config_path(workspace_dir);
    if !config_path.exists() {
        anyhow::bail!("No workspace found. Run 'astera workspace init' first.");
    }
    let content = std::fs::read_to_string(&config_path)?;
    let config: WorkspaceConfig = toml::from_str(&content)?;
    Ok(config)
}

fn save_workspace_config(
    workspace_dir: &Path,
    config: &WorkspaceConfig,
) -> Result<(), anyhow::Error> {
    let config_path = workspace_config_path(workspace_dir);
    let content = toml::to_string_pretty(config)?;
    std::fs::write(&config_path, content)?;
    Ok(())
}

fn workspace_init(name: &str) -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let astera_dir = root.join(".astera");

    if astera_dir.join("workspace.toml").exists() {
        println!("Workspace already exists at: {}", astera_dir.display());
        return Ok(());
    }

    std::fs::create_dir_all(&astera_dir)?;

    // Also create single-repo index for the workspace root itself
    let db_path = astera_dir.join("index.db");
    if !db_path.exists() {
        let _ = Database::open(&db_path);
    }

    let config = WorkspaceConfig::new(name);
    save_workspace_config(&root, &config)?;

    println!(
        "Initialized workspace '{}' at: {}",
        name,
        astera_dir.display()
    );
    Ok(())
}

fn workspace_add(path: &str, name: Option<String>) -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let mut config = load_workspace_config(&root)?;

    let repo_path = std::fs::canonicalize(path)?;
    let repo_name = name.unwrap_or_else(|| {
        repo_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });

    // Ensure the repo has an .astera directory
    let astera_dir = repo_path.join(".astera");
    if !astera_dir.exists() {
        std::fs::create_dir_all(&astera_dir)?;
    }

    // Create DB for the repo
    let db_path = astera_dir.join("index.db");
    let _ = Database::open(&db_path);

    config.add_repo(RepoConfig {
        name: repo_name.clone(),
        path: repo_path.to_string_lossy().to_string(),
        exclude_patterns: vec![],
        languages: vec![],
    });

    save_workspace_config(&root, &config)?;
    println!("Added repo '{}' ({})", repo_name, repo_path.display());
    Ok(())
}

fn workspace_remove(target: &str) -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let mut config = load_workspace_config(&root)?;

    // Try matching by name first, then by path
    let removed = config.remove_repo(target);
    if !removed {
        // Try canonicalized path
        if let Ok(abs) = std::fs::canonicalize(target) {
            let removed = config.remove_repo(&abs.to_string_lossy());
            if !removed {
                anyhow::bail!("Repository '{}' not found in workspace", target);
            }
        } else {
            anyhow::bail!("Repository '{}' not found in workspace", target);
        }
    }

    save_workspace_config(&root, &config)?;
    println!("Removed repository '{}'", target);
    Ok(())
}

fn workspace_list() -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let config = load_workspace_config(&root)?;

    println!("Workspace: {}", config.name);
    println!();

    if config.repos.is_empty() {
        println!("No repositories. Add one with: astera workspace add <path>");
        return Ok(());
    }

    println!("{:<20} {:<60} Languages", "Name", "Path");
    println!("{}", "-".repeat(100));

    for repo in &config.repos {
        let langs = if repo.languages.is_empty() {
            "(all)".to_string()
        } else {
            repo.languages.join(", ")
        };

        // Check if repo has been indexed
        let indexed = Path::new(&repo.path)
            .join(".astera")
            .join("index.db")
            .exists();

        let status = if indexed { "✓" } else { "—" };
        println!("{:<20} {:<60} {} {}", repo.name, repo.path, langs, status);
    }

    if !config.rules.is_empty() {
        println!();
        println!("Architecture rules: {}", config.rules.len());
    }

    Ok(())
}

fn workspace_index() -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let config = load_workspace_config(&root)?;

    if config.repos.is_empty() {
        println!("No repositories in workspace. Add one with: astera workspace add <path>");
        return Ok(());
    }

    println!(
        "Indexing workspace '{}' ({} repos)",
        config.name,
        config.repos.len()
    );
    println!();

    let mut total_files = 0u64;
    let mut total_symbols = 0u64;
    let mut total_edges = 0u64;
    let start = Instant::now();

    for repo in &config.repos {
        let repo_path = Path::new(&repo.path);
        if !repo_path.exists() {
            println!("⚠  {} — path not found, skipping", repo.name);
            continue;
        }

        let astera_dir = repo_path.join(".astera");
        if !astera_dir.exists() {
            std::fs::create_dir_all(&astera_dir)?;
        }
        let db_path = astera_dir.join("index.db");
        let db = Database::open(&db_path)?;

        print!("Indexing '{}' ... ", repo.name);

        let walker = FileWalker::new(repo_path.to_str().unwrap());
        let files = walker.discover_with_content();
        let file_count = files.len() as u64;

        // Phase 1: insert files
        let mut parse_tasks = Vec::with_capacity(file_count as usize);
        for (rel_path, language, content, hash) in &files {
            let needs_index = match db.file_has_changed(rel_path, hash) {
                Ok(true) | Err(_) => true,
                Ok(false) => false,
            };
            if !needs_index {
                continue;
            }

            let file_info = astera_core::FileInfo {
                id: None,
                repo_root: repo.path.clone(),
                relative_path: rel_path.clone(),
                language: language.clone(),
                hash: hash.clone(),
                size: content.len() as u64,
                line_count: content.iter().filter(|&&b| b == b'\n').count() as u64,
                indexed_at: None,
                last_modified: String::new(),
            };

            let file_id = db.insert_file(&file_info)?;
            parse_tasks.push((rel_path.clone(), language.clone(), file_id, content.clone()));
        }

        // Phase 2: parse & extract
        use rayon::prelude::*;
        let parse_results: Vec<Option<(String, i64, ParseOutput)>> = parse_tasks
            .par_iter()
            .map(|(rel_path, language, file_id, content)| {
                let mut parsed = match parse(content, language) {
                    Ok(p) => p,
                    Err(_) => return None,
                };
                parsed.file_id = *file_id;
                let output = Extractor::extract(&parsed);
                if output.nodes.is_empty() && output.edges.is_empty() {
                    return None;
                }
                Some((rel_path.clone(), *file_id, output))
            })
            .collect();

        // Phase 3: store
        let mut repo_symbols = 0u64;
        let mut repo_edges = 0u64;

        for result in parse_results.iter().flatten() {
            let (_, file_id, output) = result;
            let node_ids = match db.insert_nodes(&output.nodes) {
                Ok(ids) => ids,
                Err(_) => continue,
            };

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
                if let Ok(ids) = db.insert_edges(&mapped_edges) {
                    repo_edges += ids.len() as u64;
                }
            }
            repo_symbols += output.nodes.len() as u64;
        }

        total_files += file_count;
        total_symbols += repo_symbols;
        total_edges += repo_edges;

        println!(
            "{} files, {} symbols, {} edges",
            file_count, repo_symbols, repo_edges
        );
    }

    let elapsed = start.elapsed();
    println!();
    println!("Workspace index complete:");
    println!("  Files:   {}", total_files);
    println!("  Symbols: {}", total_symbols);
    println!("  Edges:   {}", total_edges);
    println!("  Time:    {}ms", elapsed.as_millis());

    Ok(())
}

fn workspace_stats() -> Result<(), anyhow::Error> {
    let root = std::fs::canonicalize(".")?;
    let config = load_workspace_config(&root)?;

    if config.repos.is_empty() {
        println!("No repositories in workspace.");
        return Ok(());
    }

    println!("Workspace: {}", config.name);
    println!();

    let mut total_files = 0u64;
    let mut total_symbols = 0u64;
    let mut total_edges = 0u64;

    println!(
        "{:<20} {:>8} {:>10} {:>8} {:>10}",
        "Repo", "Files", "Symbols", "Edges", "Languages"
    );
    println!("{}", "-".repeat(60));

    for repo in &config.repos {
        let db_path = Path::new(&repo.path).join(".astera").join("index.db");
        if !db_path.exists() {
            println!(
                "{:<20} {:>8} {:>10} {:>8} {:>10}",
                repo.name, "—", "—", "—", "not indexed"
            );
            continue;
        }

        match Database::open(&db_path) {
            Ok(db) => {
                let files = db.file_count().unwrap_or(0);
                let symbols = db.symbol_count().unwrap_or(0);
                let edges = db.edge_count().unwrap_or(0);

                // Get language breakdown
                let all_files = db.list_files().unwrap_or_default();
                let mut langs: Vec<String> = all_files
                    .iter()
                    .map(|f| f.language.clone())
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .collect();
                langs.sort();

                total_files += files;
                total_symbols += symbols;
                total_edges += edges;

                println!(
                    "{:<20} {:>8} {:>10} {:>8} {:>10}",
                    repo.name,
                    files,
                    symbols,
                    edges,
                    langs.join(", ")
                );
            }
            Err(_) => {
                println!(
                    "{:<20} {:>8} {:>10} {:>8} {:>10}",
                    repo.name, "—", "—", "—", "db error"
                );
            }
        }
    }

    println!("{}", "-".repeat(60));
    println!(
        "{:<20} {:>8} {:>10} {:>8}",
        "TOTAL", total_files, total_symbols, total_edges
    );

    Ok(())
}

#[derive(Subcommand)]
enum BenchCommands {
    /// Save current benchmark results as the baseline
    Save {
        /// Path to criterion output directory
        #[arg(long, default_value = "target/criterion")]
        criterion_dir: String,
    },
    /// Compare current results against the saved baseline
    Check {
        /// Regression threshold percentage (default: 10%)
        #[arg(long, default_value_t = 10.0)]
        threshold: f64,
        /// Path to criterion output directory
        #[arg(long, default_value = "target/criterion")]
        criterion_dir: String,
    },
    /// Show saved baseline
    Show,
}

fn bench_save(criterion_dir: &str) -> Result<(), anyhow::Error> {
    let root =
        find_astera_root(Path::new(".")).unwrap_or_else(|| std::env::current_dir().expect("cwd"));

    let criterion_path = Path::new(criterion_dir);
    if !criterion_path.exists() {
        println!("Criterion output not found at: {}", criterion_dir);
        println!("Run `cargo bench` first to generate benchmark data.");
        return Ok(());
    }

    // Parse criterion JSON output files
    let results = benchmarks::parse_criterion_json(criterion_path)?;

    if results.is_empty() {
        println!("No benchmark results found in {}", criterion_dir);
        println!("Ensure criterion is configured to output JSON.");
        return Ok(());
    }

    benchmarks::save_baseline(&root, results.clone())?;
    println!(
        "Saved baseline with {} benchmarks to .astera/bench-baseline.json",
        results.len()
    );
    println!(
        "Commit: {}",
        benchmarks::get_git_commit().unwrap_or_else(|| "unknown".into())
    );

    Ok(())
}

fn bench_check(threshold: f64, criterion_dir: &str) -> Result<(), anyhow::Error> {
    let root =
        find_astera_root(Path::new(".")).unwrap_or_else(|| std::env::current_dir().expect("cwd"));

    let baseline = benchmarks::load_baseline(&root)?;

    let criterion_path = Path::new(criterion_dir);
    if !criterion_path.exists() {
        println!("Criterion output not found at: {}", criterion_dir);
        println!("Run `cargo bench` first to generate benchmark data.");
        return Ok(());
    }

    let current = benchmarks::parse_criterion_json(criterion_path)?;
    if current.is_empty() {
        println!("No current benchmark results found.");
        return Ok(());
    }

    let regressions = benchmarks::detect_regressions(&baseline, &current, threshold);
    benchmarks::print_regression_report(&baseline, &regressions);

    // Exit with error code if critical regressions found
    let has_critical = regressions
        .iter()
        .any(|r| r.severity == benchmarks::RegressionSeverity::Critical);
    let has_significant = regressions
        .iter()
        .any(|r| r.severity == benchmarks::RegressionSeverity::Significant);

    if has_critical {
        std::process::exit(2);
    } else if has_significant {
        std::process::exit(1);
    }

    Ok(())
}

fn bench_show() -> Result<(), anyhow::Error> {
    let root =
        find_astera_root(Path::new(".")).unwrap_or_else(|| std::env::current_dir().expect("cwd"));

    let baseline = benchmarks::load_baseline(&root)?;

    println!("Benchmark Baseline");
    println!("═══════════════════════════════════════════════════════════════");
    println!("Version:   {}", baseline.version);
    println!("Commit:    {}", baseline.commit);
    println!("Timestamp: {}", baseline.timestamp);
    println!("Benchmarks: {}", baseline.results.len());
    println!();

    let mut results: Vec<_> = baseline.results.values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));

    println!("{:<55} {:>12} {:>8}", "Benchmark", "Mean", "Iters");
    println!("{}", "─".repeat(78));

    for r in results {
        let mean_str = benchmarks::format_ns(r.mean_ns);
        println!("{:<55} {:>12} {:>8}", r.name, mean_str, r.iterations);
    }

    Ok(())
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

    // Auto-save snapshot for evolution tracking
    if indexed_files > 0 {
        use astera_metrics::compute_metrics;
        if let Ok((nodes, edges)) = db.get_all_graph() {
            let agg = compute_metrics(&nodes, &edges);
            let _ = db.save_snapshot(
                None,
                agg.total_files,
                agg.total_nodes,
                agg.total_edges,
                agg.avg_complexity,
                agg.max_complexity,
                agg.circular_dependencies.len() as u32,
            );
        }
    }

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
        "{:<8} {:<20} {:<12} {:<40} Line",
        "ID", "Name", "Kind", "File"
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

    // Build node_id → name map
    let all_nodes = db.query_nodes(None, None, None)?;
    let node_map: std::collections::HashMap<i64, (String, String)> = all_nodes
        .iter()
        .filter_map(|n| n.id.map(|id| (id, (n.name.clone(), n.kind.to_string()))))
        .collect();

    let edges = db.get_edges(kind.as_deref(), None, None)?;

    if edges.is_empty() {
        println!("No edges found.");
        return Ok(());
    }

    println!("Edges ({}):", edges.len());
    println!("{:<30} {:<8} {:<30} Kind", "Source", "", "Target");
    println!("{}", "-".repeat(80));

    for edge in &edges {
        let src = node_map
            .get(&edge.source_node_id)
            .map(|(n, k)| format!("{} [{}]", n, k))
            .unwrap_or_else(|| format!("id:{}", edge.source_node_id));
        let tgt = node_map
            .get(&edge.target_node_id)
            .map(|(n, k)| format!("{} [{}]", n, k))
            .unwrap_or_else(|| format!("id:{}", edge.target_node_id));
        println!("{:<30} -> {:<30} {}", src, tgt, edge.kind);
    }

    Ok(())
}

fn stats_command() -> Result<(), anyhow::Error> {
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

    let db = Database::open(&db_path)?;

    let files = db.file_count()?;
    let symbols = db.symbol_count()?;
    let edges = db.edge_count()?;

    // Breakdown by kind
    let func_count = db.query_nodes(Some("Function"), None, None)?.len() as u64;
    let class_count = db.query_nodes(Some("Class"), None, None)?.len() as u64;
    let import_count = db.query_nodes(Some("Import"), None, None)?.len() as u64;

    // Language breakdown
    let all_files = db.list_files()?;
    let mut lang_counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for f in &all_files {
        *lang_counts.entry(f.language.clone()).or_insert(0) += 1;
    }

    println!("Index: {}", root.join(".astera").display());
    println!();
    println!("  Files:    {}", files);
    println!("  Symbols:  {}", symbols);
    println!("  Edges:    {}", edges);
    println!();
    println!("  Breakdown:");
    println!("    Functions:  {}", func_count);
    println!("    Classes:    {}", class_count);
    println!("    Imports:    {}", import_count);
    if !lang_counts.is_empty() {
        println!();
        println!("  Languages:");
        let mut langs: Vec<_> = lang_counts.into_iter().collect();
        langs.sort_by_key(|b| std::cmp::Reverse(b.1));
        for (lang, count) in &langs {
            println!("    {:<15} {}", lang, count);
        }
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
        "{:<8} {:<20} {:<12} {:<40} Line",
        "ID", "Name", "Kind", "File"
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
        Commands::Stats => {
            stats_command()?;
        }
        Commands::Bench { bench } => match bench {
            BenchCommands::Save { criterion_dir } => {
                bench_save(&criterion_dir)?;
            }
            BenchCommands::Check {
                threshold,
                criterion_dir,
            } => {
                bench_check(threshold, &criterion_dir)?;
            }
            BenchCommands::Show => {
                bench_show()?;
            }
        },
        Commands::Workspace { workspace } => match workspace {
            WorkspaceCommands::Init { name } => {
                workspace_init(&name)?;
            }
            WorkspaceCommands::Add { path, name } => {
                workspace_add(&path, name)?;
            }
            WorkspaceCommands::Remove { target } => {
                workspace_remove(&target)?;
            }
            WorkspaceCommands::List => {
                workspace_list()?;
            }
            WorkspaceCommands::Index => {
                workspace_index()?;
            }
            WorkspaceCommands::Stats => {
                workspace_stats()?;
            }
        },
    }

    Ok(())
}
