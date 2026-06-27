use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::AppState;
use astera_core::{Edge, Node};
use astera_metrics::compute_metrics;
use astera_impact::ImpactAnalyzer;

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
        data: StatsResponse { files, symbols, edges },
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
        .query_nodes(
            query.kind.as_deref(),
            query.name.as_deref(),
            query.file_id,
        )
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

    // All nodes
    let nodes = db.query_nodes(None, None, None).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    // All Contains + Imports + DependsOn edges for the dependency graph
    let edges = db.get_edges(None, None, None).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let graph_nodes: Vec<GraphNode> = nodes
        .into_iter()
        .map(|n| GraphNode {
            id: n.id.unwrap_or(0),
            kind: n.kind.to_string(),
            name: n.name,
            file_id: n.file_id,
            start_line: n.span.start_line,
            end_line: n.span.end_line,
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

    let nodes = db.query_nodes(None, None, None).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let edges = db.get_edges(None, None, None).map_err(|e| {
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

    let nodes = db.query_nodes(None, None, None).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        )
    })?;

    let edges = db.get_edges(None, None, None).map_err(|e| {
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
