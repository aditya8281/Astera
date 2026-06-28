use axum::body::Body;
use axum::extract::State as AxumState;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use rust_embed::Embed;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use astera_storage::Database;

mod routes;
pub mod ws;

/// Event broadcast during re-index operations
#[derive(Debug, Clone, serde::Serialize)]
pub struct IndexEvent {
    pub event: String,
    pub files_changed: u64,
    pub nodes_added: u64,
    pub nodes_removed: u64,
    pub edges_added: u64,
    pub elapsed_ms: u64,
    pub message: String,
}

#[cfg(test)]
mod integration_test;

/// Embedded frontend — compiled into the binary at build time.
/// build.rs copies apps/web/dist/ to crates/astera-api/frontend/ before this compiles.
#[derive(Embed)]
#[folder = "frontend"]
struct FrontendAssets;

/// Cached importance scores to avoid recomputing on every request.
/// Invalidated on re-index via the event system.
#[derive(Clone, Default)]
pub struct ImportanceCache {
    pub scores: Arc<RwLock<HashMap<i64, f64>>>,
}

#[derive(Clone)]
pub struct AppState {
    pub db: std::sync::Arc<Mutex<Database>>,
    pub static_dir: Option<PathBuf>,
    pub use_embedded: bool,
    pub event_tx: broadcast::Sender<String>,
    pub importance_cache: ImportanceCache,
}

pub fn create_router(db: Database) -> Router {
    create_router_with_static(db, None)
}

pub fn create_router_with_static(db: Database, static_dir: Option<PathBuf>) -> Router {
    let has_embedded = FrontendAssets::get("index.html").is_some();
    let (event_tx, _) = broadcast::channel::<String>(64);
    build_router(db, static_dir, has_embedded, event_tx)
}

fn build_router(
    db: Database,
    static_dir: Option<PathBuf>,
    has_embedded: bool,
    event_tx: broadcast::Sender<String>,
) -> Router {
    let state = AppState {
        db: std::sync::Arc::new(Mutex::new(db)),
        static_dir,
        use_embedded: has_embedded,
        event_tx,
        importance_cache: ImportanceCache::default(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/stats", get(routes::stats))
        .route("/api/files", get(routes::list_files))
        .route("/api/symbols", get(routes::list_symbols))
        .route("/api/symbols/{id}", get(routes::get_symbol))
        .route("/api/edges", get(routes::list_edges))
        .route("/api/search", get(routes::search))
        .route("/api/graph/modules", get(routes::modules))
        .route("/api/graph/children/{id}", get(routes::children))
        .route("/api/graph/dependency", get(routes::dependency_graph))
        .route("/api/metrics", get(routes::metrics))
        .route("/api/impact", get(routes::impact))
        .route(
            "/api/snapshots",
            get(routes::list_snapshots).post(routes::save_snapshot),
        )
        .route("/api/snapshots/{id}", get(routes::get_snapshot))
        .route("/api/trend", get(routes::get_trend))
        .route("/api/events", get(ws::ws_handler))
        .fallback(fallback_handler)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Fallback: serve static files. Priority: explicit static_dir > embedded > 404
async fn fallback_handler(AxumState(state): AxumState<AppState>, uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // 1. Try explicit static directory (for development: --web-dir)
    if let Some(ref dir) = state.static_dir {
        let file_path = if path.is_empty() {
            dir.join("index.html")
        } else {
            let p = dir.join(path);
            if p.is_dir() {
                p.join("index.html")
            } else if p.exists() {
                p
            } else {
                dir.join("index.html") // SPA fallback
            }
        };

        if let Ok(content) = tokio::fs::read(&file_path).await {
            let mime = mime_guess::from_path(&file_path)
                .first_or_octet_stream()
                .to_string();
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(content))
                .unwrap();
        }
    }

    // 2. Try embedded frontend assets
    if state.use_embedded {
        let asset_path = if path.is_empty() {
            "index.html".to_string()
        } else {
            path.to_string()
        };

        if let Some(content) = FrontendAssets::get(&asset_path) {
            let mime_str = mime_guess::from_path(&asset_path)
                .first_or_octet_stream()
                .to_string();
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime_str.as_str())
                .body(Body::from(content.data.to_vec()))
                .unwrap();
        }

        // SPA fallback: serve index.html for client-side routing
        if let Some(content) = FrontendAssets::get("index.html") {
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/html")
                .body(Body::from(content.data.to_vec()))
                .unwrap();
        }
    }

    StatusCode::NOT_FOUND.into_response()
}

pub async fn serve(db_path: &Path, port: u16) -> anyhow::Result<()> {
    serve_with_static(db_path, port, None).await
}

pub async fn serve_with_static(
    db_path: &Path,
    port: u16,
    static_dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    let (_event_tx, _) = broadcast::channel::<String>(64);
    serve_with_broadcast(db_path, port, _event_tx, static_dir).await
}

/// Start API server with an external broadcast sender (for watcher integration).
pub async fn serve_with_broadcast(
    db_path: &Path,
    port: u16,
    event_tx: broadcast::Sender<String>,
    static_dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    let db = Database::open(db_path)?;
    let has_embedded = FrontendAssets::get("index.html").is_some();
    let state = AppState {
        db: std::sync::Arc::new(Mutex::new(db)),
        static_dir: static_dir.clone(),
        use_embedded: has_embedded,
        event_tx,
        importance_cache: ImportanceCache::default(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let router = Router::new()
        .route("/api/stats", get(routes::stats))
        .route("/api/files", get(routes::list_files))
        .route("/api/symbols", get(routes::list_symbols))
        .route("/api/symbols/{id}", get(routes::get_symbol))
        .route("/api/edges", get(routes::list_edges))
        .route("/api/search", get(routes::search))
        .route("/api/graph/modules", get(routes::modules))
        .route("/api/graph/children/{id}", get(routes::children))
        .route("/api/graph/dependency", get(routes::dependency_graph))
        .route("/api/metrics", get(routes::metrics))
        .route("/api/impact", get(routes::impact))
        .route(
            "/api/snapshots",
            get(routes::list_snapshots).post(routes::save_snapshot),
        )
        .route("/api/snapshots/{id}", get(routes::get_snapshot))
        .route("/api/trend", get(routes::get_trend))
        .route("/api/events", get(ws::ws_handler))
        .fallback(fallback_handler)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    if let Some(ref dir) = static_dir {
        println!("Web UI:  http://localhost:{}", port);
        println!("API:     http://localhost:{}/api/stats", port);
        println!("Static:  {}", dir.display());
    } else if has_embedded {
        println!("Astera:  http://localhost:{}", port);
        println!("API:     http://localhost:{}/api/stats", port);
        println!("(serving embedded frontend)");
    } else {
        println!("API server: http://localhost:{}/api/stats", port);
    }

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
