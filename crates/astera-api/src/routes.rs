use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{AppState, ImportanceCache};
use astera_core::{Edge, EdgeKind, Node, NodeKind};
use astera_impact::ImpactAnalyzer;
use astera_metrics::{compute_importance, compute_metrics};

// ─── Response types ───

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub data: T,
    pub meta: ResponseMeta,
}

#[derive(Serialize)]
pub struct ResponseMeta {
    pub count: usize,
    pub elapsed_ms: u64,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub files: u64,
    pub symbols: u64,
    pub edges: u64,
}

#[derive(Serialize)]
pub struct FileResponse {
    pub id: i64,
    pub relative_path: String,
    pub language: String,
    pub hash: String,
    pub size: u64,
    pub line_count: u64,
}

#[derive(Deserialize)]
pub struct SymbolQuery {
    pub kind: Option<String>,
    pub name: Option<String>,
    pub file_id: Option<i64>,
}

#[derive(Deserialize)]
pub struct EdgeQuery {
    pub kind: Option<String>,
    pub source_node_id: Option<i64>,
    pub target_node_id: Option<i64>,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Serialize)]
pub struct GraphNode {
    pub id: i64,
    pub kind: String,
    pub name: String,
    pub file_id: i64,
    pub start_line: u32,
    pub end_line: u32,
    pub importance: f64,
}

#[derive(Serialize)]
pub struct GraphEdge {
    pub source: i64,
    pub target: i64,
    pub kind: String,
}

#[derive(Serialize)]
pub struct GraphResponse {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

// ─── Handlers ───

pub async fn stats(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<StatsResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let files = db.file_count().unwrap_or(0);
    let symbols = db.symbol_count().unwrap_or(0);
    let edges = db.edge_count().unwrap_or(0);

    Ok(Json(ApiResponse {
        data: StatsResponse {
            files,
            symbols,
            edges,
        },
        meta: ResponseMeta {
            count: 1,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

pub async fn list_files(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<FileResponse>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let files = db.list_files().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let response: Vec<FileResponse> = files
        .into_iter()
        .map(|f| FileResponse {
            id: f.id.unwrap_or(0),
            relative_path: f.relative_path,
            language: f.language,
            hash: f.hash,
            size: f.size,
            line_count: f.line_count,
        })
        .collect();

    let count = response.len();
    Ok(Json(ApiResponse {
        data: response,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

pub async fn list_symbols(
    State(state): State<AppState>,
    Query(query): Query<SymbolQuery>,
) -> Result<Json<ApiResponse<Vec<Node>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let symbols = db
        .query_nodes(query.kind.as_deref(), query.name.as_deref(), query.file_id)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Database error: {}", e),
                }),
            )
        })?;

    let count = symbols.len();
    Ok(Json(ApiResponse {
        data: symbols,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

pub async fn get_symbol(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<Node>, (StatusCode, Json<ErrorResponse>)> {
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    match db.get_node(id) {
        Ok(Some(node)) => Ok(Json(node)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Symbol {} not found", id),
            }),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )),
    }
}

pub async fn list_edges(
    State(state): State<AppState>,
    Query(query): Query<EdgeQuery>,
) -> Result<Json<ApiResponse<Vec<Edge>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let edges = db
        .get_edges(
            query.kind.as_deref(),
            query.source_node_id,
            query.target_node_id,
        )
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Database error: {}", e),
                }),
            )
        })?;

    let count = edges.len();
    Ok(Json(ApiResponse {
        data: edges,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<ApiResponse<Vec<Node>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let results = db.search_nodes(&query.q).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let count = results.len();
    Ok(Json(ApiResponse {
        data: results,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

// ─── Importance cache helper ───

/// Get importance scores from cache, or compute and store if missing.
fn get_or_compute_importance(
    cache: &ImportanceCache,
    nodes: &[Node],
    edges: &[Edge],
) -> std::collections::HashMap<i64, f64> {
    // Try read lock first (fast path — no recomputation)
    if let Ok(scores) = cache.scores.read() {
        if !scores.is_empty() {
            return scores.clone();
        }
    }
    // Compute and write to cache
    let scores = compute_importance(nodes, edges);
    if let Ok(mut writer) = cache.scores.write() {
        *writer = scores.clone();
    }
    scores
}

/// Invalidate importance cache (called after re-index)
#[allow(dead_code)]
pub fn invalidate_importance(cache: &ImportanceCache) {
    if let Ok(mut writer) = cache.scores.write() {
        writer.clear();
    }
}

// ─── Modules endpoint (for progressive loading) ───

#[derive(Serialize)]
pub struct ModuleSummary {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub file_id: i64,
    pub start_line: u32,
    pub end_line: u32,
    pub child_count: u32,
    pub importance: f64,
}

pub async fn modules(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ModuleSummary>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database lock: {}", e),
            }),
        )
    })?;

    let (nodes, edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    // Use cached importance instead of recomputing
    let importance = get_or_compute_importance(&state.importance_cache, &nodes, &edges);

    // Count children per node (Contains edges)
    let mut child_counts: HashMap<i64, u32> = HashMap::new();
    for edge in &edges {
        if edge.kind == EdgeKind::Contains {
            *child_counts.entry(edge.source_node_id).or_insert(0) += 1;
        }
    }

    // Filter to container types: Module, Class, Interface, Enum, File
    let modules: Vec<ModuleSummary> = nodes
        .iter()
        .filter(|n| {
            matches!(
                n.kind,
                NodeKind::Module
                    | NodeKind::Class
                    | NodeKind::Interface
                    | NodeKind::Enum
                    | NodeKind::File
            )
        })
        .map(|n| {
            let nid = n.id.unwrap_or(0);
            ModuleSummary {
                id: nid,
                name: n.name.clone(),
                kind: n.kind.to_string(),
                file_id: n.file_id,
                start_line: n.span.start_line,
                end_line: n.span.end_line,
                child_count: child_counts.get(&nid).copied().unwrap_or(0),
                importance: importance.get(&nid).copied().unwrap_or(0.3),
            }
        })
        .collect();

    let count = modules.len();
    Ok(Json(ApiResponse {
        data: modules,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

pub async fn dependency_graph(
    State(state): State<AppState>,
) -> Result<Json<GraphResponse>, (StatusCode, Json<ErrorResponse>)> {
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let (nodes, edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let importance = get_or_compute_importance(&state.importance_cache, &nodes, &edges);

    let graph_nodes: Vec<GraphNode> = nodes
        .into_iter()
        .map(|n| {
            let nid = n.id.unwrap_or(0);
            GraphNode {
                id: nid,
                kind: n.kind.to_string(),
                name: n.name,
                file_id: n.file_id,
                start_line: n.span.start_line,
                end_line: n.span.end_line,
                importance: importance.get(&nid).copied().unwrap_or(0.3),
            }
        })
        .collect();

    let graph_edges: Vec<GraphEdge> = edges
        .into_iter()
        .map(|e| GraphEdge {
            source: e.source_node_id,
            target: e.target_node_id,
            kind: e.kind.to_string(),
        })
        .collect();

    Ok(Json(GraphResponse {
        nodes: graph_nodes,
        edges: graph_edges,
    }))
}

// ─── Metrics endpoint ───

#[derive(Serialize)]
pub struct MetricsResponse {
    pub total_nodes: u64,
    pub total_edges: u64,
    pub total_files: u64,
    pub avg_complexity: f64,
    pub max_complexity: u32,
    pub function_count: usize,
    pub module_count: usize,
    pub circular_dependencies: Vec<(String, String)>,
}

pub async fn metrics(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<MetricsResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let (nodes, edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let agg = compute_metrics(&nodes, &edges);

    Ok(Json(ApiResponse {
        data: MetricsResponse {
            total_nodes: agg.total_nodes,
            total_edges: agg.total_edges,
            total_files: agg.total_files,
            avg_complexity: agg.avg_complexity,
            max_complexity: agg.max_complexity,
            function_count: agg.functions.len(),
            module_count: agg.modules.len(),
            circular_dependencies: agg.circular_dependencies,
        },
        meta: ResponseMeta {
            count: 1,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

// ─── Impact analysis endpoint ───

#[derive(Deserialize)]
pub struct ImpactQuery {
    pub root_id: i64,
    pub max_depth: Option<u32>,
    pub direction: Option<String>, // "forward" or "reverse"
}

#[derive(Serialize)]
pub struct ImpactResponse {
    pub root: i64,
    pub root_name: String,
    pub total_affected: u32,
    pub max_depth: u32,
    pub cycle_detected: bool,
    pub affected: Vec<astera_impact::ImpactNode>,
}

pub async fn impact(
    State(state): State<AppState>,
    Query(query): Query<ImpactQuery>,
) -> Result<Json<ApiResponse<ImpactResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let (nodes, edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let analyzer = ImpactAnalyzer::new(&nodes, &edges);

    let result = if query.direction.as_deref() == Some("reverse") {
        analyzer.reverse_impact(query.root_id, query.max_depth)
    } else {
        analyzer.impact_analysis(query.root_id, query.max_depth)
    };

    Ok(Json(ApiResponse {
        data: ImpactResponse {
            root: result.root,
            root_name: result.root_name,
            total_affected: result.total_affected,
            max_depth: result.max_depth,
            cycle_detected: result.cycle_detected,
            affected: result.affected,
        },
        meta: ResponseMeta {
            count: 1,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

// ─── Children endpoint (progressive drill-down) ───

pub async fn children(
    State(state): State<AppState>,
    axum::extract::Path(node_id): axum::extract::Path<i64>,
) -> Result<Json<GraphResponse>, (StatusCode, Json<ErrorResponse>)> {
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    // Fetch children from storage
    let (child_nodes, child_edges) = db.get_children_of(node_id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    // Use cached importance instead of recomputing from full graph
    let importance = {
        if let Ok(scores) = state.importance_cache.scores.read() {
            if !scores.is_empty() {
                scores.clone()
            } else {
                compute_importance(&child_nodes, &child_edges)
            }
        } else {
            compute_importance(&child_nodes, &child_edges)
        }
    };

    // Include the parent node itself
    let parent = db.get_node(node_id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let mut graph_nodes: Vec<GraphNode> = Vec::with_capacity(child_nodes.len() + 1);
    if let Some(p) = parent {
        let pid = p.id.unwrap_or(0);
        graph_nodes.push(GraphNode {
            id: pid,
            kind: p.kind.to_string(),
            name: p.name,
            file_id: p.file_id,
            start_line: p.span.start_line,
            end_line: p.span.end_line,
            importance: importance.get(&pid).copied().unwrap_or(0.3),
        });
    }
    for n in child_nodes {
        let nid = n.id.unwrap_or(0);
        graph_nodes.push(GraphNode {
            id: nid,
            kind: n.kind.to_string(),
            name: n.name,
            file_id: n.file_id,
            start_line: n.span.start_line,
            end_line: n.span.end_line,
            importance: importance.get(&nid).copied().unwrap_or(0.3),
        });
    }

    let graph_edges: Vec<GraphEdge> = child_edges
        .into_iter()
        .map(|e| GraphEdge {
            source: e.source_node_id,
            target: e.target_node_id,
            kind: e.kind.to_string(),
        })
        .collect();

    Ok(Json(GraphResponse {
        nodes: graph_nodes,
        edges: graph_edges,
    }))
}

// ─── Dependency subtree endpoint (BFS through all edge kinds) ───

#[derive(Deserialize)]
pub struct SubtreeQuery {
    pub max_depth: Option<u32>,
    #[serde(default = "default_true")]
    pub include_callers: bool,
    #[serde(default = "default_true")]
    pub include_callees: bool,
}

fn default_true() -> bool {
    true
}

pub async fn dependency_subtree(
    State(state): State<AppState>,
    axum::extract::Path(node_id): axum::extract::Path<i64>,
    Query(query): Query<SubtreeQuery>,
) -> Result<Json<GraphResponse>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let (all_nodes, all_edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let max_depth = query.max_depth.unwrap_or(5).min(20);

    // Build adjacency maps for efficient traversal
    use std::collections::{HashMap, VecDeque};

    // outgoing: node_id → [(target_id, edge_kind)]
    let mut outgoing: HashMap<i64, Vec<(i64, String)>> = HashMap::new();
    // incoming: node_id → [(source_id, edge_kind)]
    let mut incoming: HashMap<i64, Vec<(i64, String)>> = HashMap::new();

    for edge in &all_edges {
        if query.include_callees {
            outgoing
                .entry(edge.source_node_id)
                .or_default()
                .push((edge.target_node_id, edge.kind.to_string()));
        }
        if query.include_callers {
            incoming
                .entry(edge.target_node_id)
                .or_default()
                .push((edge.source_node_id, edge.kind.to_string()));
        }
    }

    // BFS from root node in both directions
    let mut visited: HashMap<i64, u32> = HashMap::new(); // node_id → depth
    let mut queue: VecDeque<(i64, u32)> = VecDeque::new();
    let mut result_edges: Vec<(i64, i64, String)> = Vec::new();

    visited.insert(node_id, 0);
    queue.push_back((node_id, 0));

    while let Some((current, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }

        // Follow outgoing edges (callee direction)
        if let Some(targets) = outgoing.get(&current) {
            for &(target, ref kind) in targets {
                if let std::collections::hash_map::Entry::Vacant(e) = visited.entry(target) {
                    e.insert(depth + 1);
                    queue.push_back((target, depth + 1));
                }
                result_edges.push((current, target, kind.clone()));
            }
        }

        // Follow incoming edges (caller direction)
        if let Some(sources) = incoming.get(&current) {
            for &(source, ref kind) in sources {
                if let std::collections::hash_map::Entry::Vacant(e) = visited.entry(source) {
                    e.insert(depth + 1);
                    queue.push_back((source, depth + 1));
                }
                result_edges.push((source, current, kind.clone()));
            }
        }
    }

    // Deduplicate edges
    result_edges.sort();
    result_edges.dedup();

    // Collect node data for visited nodes
    let node_ids_set: std::collections::HashSet<i64> = visited.keys().copied().collect();

    let importance = {
        if let Ok(scores) = state.importance_cache.scores.read() {
            if !scores.is_empty() {
                scores.clone()
            } else {
                astera_metrics::compute_importance(&all_nodes, &all_edges)
            }
        } else {
            astera_metrics::compute_importance(&all_nodes, &all_edges)
        }
    };

    let graph_nodes: Vec<GraphNode> = all_nodes
        .iter()
        .filter(|n| node_ids_set.contains(&n.id.unwrap_or(0)))
        .map(|n| {
            let nid = n.id.unwrap_or(0);
            GraphNode {
                id: nid,
                kind: n.kind.to_string(),
                name: n.name.clone(),
                file_id: n.file_id,
                start_line: n.span.start_line,
                end_line: n.span.end_line,
                importance: importance.get(&nid).copied().unwrap_or(0.3),
            }
        })
        .collect();

    let graph_edges: Vec<GraphEdge> = result_edges
        .into_iter()
        .map(|(s, t, k)| GraphEdge {
            source: s,
            target: t,
            kind: k,
        })
        .collect();

    let _ = start.elapsed(); // keep for future logging
    Ok(Json(GraphResponse {
        nodes: graph_nodes,
        edges: graph_edges,
    }))
}

// ─── Snapshots (Repository Evolution) ───

#[derive(Deserialize)]
pub struct TrendQuery {
    pub q: String,
}

/// Save a snapshot of the current index state with aggregate metrics.
pub async fn save_snapshot(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<astera_storage::SnapshotRow>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let (nodes, edges) = db.get_all_graph().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let agg = compute_metrics(&nodes, &edges);

    let snapshot = db
        .save_snapshot(
            None, // commit_hash — could be filled by git integration later
            agg.total_files,
            agg.total_nodes,
            agg.total_edges,
            agg.avg_complexity,
            agg.max_complexity,
            agg.circular_dependencies.len() as u32,
        )
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Database error: {}", e),
                }),
            )
        })?;

    // Record key metrics for trending
    let _ = db.record_metric(snapshot, "total_nodes", agg.total_nodes as f64);
    let _ = db.record_metric(snapshot, "total_edges", agg.total_edges as f64);
    let _ = db.record_metric(snapshot, "total_files", agg.total_files as f64);
    let _ = db.record_metric(snapshot, "avg_complexity", agg.avg_complexity);
    let _ = db.record_metric(snapshot, "max_complexity", agg.max_complexity as f64);
    let _ = db.record_metric(
        snapshot,
        "circular_deps",
        agg.circular_dependencies.len() as f64,
    );

    // Return the saved snapshot
    let row = db.get_snapshot(snapshot).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    match row {
        Some(s) => Ok(Json(ApiResponse {
            data: s,
            meta: ResponseMeta {
                count: 1,
                elapsed_ms: start.elapsed().as_millis() as u64,
            },
        })),
        None => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to retrieve saved snapshot".into(),
            }),
        )),
    }
}

/// Get a single snapshot by ID.
pub async fn get_snapshot(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<astera_storage::SnapshotRow>, (StatusCode, Json<ErrorResponse>)> {
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    match db.get_snapshot(id) {
        Ok(Some(s)) => Ok(Json(s)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Snapshot {} not found", id),
            }),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )),
    }
}

/// List all stored metric snapshots.
pub async fn list_snapshots(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<astera_storage::SnapshotRow>>>, (StatusCode, Json<ErrorResponse>)>
{
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let snapshots = db.list_snapshots().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let count = snapshots.len();
    Ok(Json(ApiResponse {
        data: snapshots,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

/// Get trend data for a specific metric across snapshots.
pub async fn get_trend(
    State(state): State<AppState>,
    Query(query): Query<TrendQuery>,
) -> Result<Json<ApiResponse<Vec<astera_storage::TrendPoint>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let points = db.get_trend(&query.q).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let count = points.len();
    Ok(Json(ApiResponse {
        data: points,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}

// ─── Broken references endpoint ───

#[derive(Deserialize)]
pub struct BrokenRefQuery {
    pub kind: Option<String>,
}

#[derive(Serialize)]
pub struct BrokenRefResponse {
    pub id: Option<i64>,
    pub source_node_id: i64,
    pub ref_name: String,
    pub file_id: i64,
    pub line: u32,
    pub kind: String,
    pub target_name: Option<String>,
}

pub async fn broken_refs(
    State(state): State<AppState>,
    Query(query): Query<BrokenRefQuery>,
) -> Result<Json<ApiResponse<Vec<BrokenRefResponse>>>, (StatusCode, Json<ErrorResponse>)> {
    let start = std::time::Instant::now();
    let db = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database lock poisoned".into(),
            }),
        )
    })?;

    let refs = db.query_broken_refs(query.kind.as_deref()).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let response: Vec<BrokenRefResponse> = refs
        .into_iter()
        .map(|r| BrokenRefResponse {
            id: r.id,
            source_node_id: r.source_node_id,
            ref_name: r.ref_name,
            file_id: r.file_id,
            line: r.line,
            kind: r.kind.to_string(),
            target_name: r.target_name,
        })
        .collect();

    let count = response.len();
    Ok(Json(ApiResponse {
        data: response,
        meta: ResponseMeta {
            count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    }))
}
