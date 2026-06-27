use axum::body::Body;
use axum::extract::State as AxumState;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use astera_storage::Database;

mod routes;

#[cfg(test)]
mod integration_test;

#[derive(Clone)]
pub struct AppState {
    pub db: std::sync::Arc<Mutex<Database>>,
    pub static_dir: Option<PathBuf>,
}

pub fn create_router(db: Database) -> Router {
    create_router_with_static(db, None)
}

pub fn create_router_with_static(db: Database, static_dir: Option<PathBuf>) -> Router {
    let state = AppState {
        db: std::sync::Arc::new(Mutex::new(db)),
        static_dir,
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
        .route("/api/graph/dependency", get(routes::dependency_graph))
        .route("/api/metrics", get(routes::metrics))
        .route("/api/impact", get(routes::impact))
        .fallback(fallback_handler)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Fallback: serve static files if static_dir is set, otherwise 404
async fn fallback_handler(AxumState(state): AxumState<AppState>, uri: Uri) -> Response {
    let dir = match &state.static_dir {
        Some(d) => d,
        None => return StatusCode::NOT_FOUND.into_response(),
    };

    let path = uri.path().trim_start_matches('/');

    // Try to serve the requested file
    let file_path = if path.is_empty() {
        dir.join("index.html")
    } else {
        let p = dir.join(path);
        if p.is_dir() {
            p.join("index.html")
        } else if p.exists() {
            p
        } else {
            // SPA fallback: try index.html for client-side routing
            dir.join("index.html")
        }
    };

    match tokio::fs::read(&file_path).await {
        Ok(content) => {
            let mime = mime_guess::from_path(&file_path)
                .first_or_octet_stream()
                .to_string();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(content))
                .unwrap()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn serve(db_path: &Path, port: u16) -> anyhow::Result<()> {
    serve_with_static(db_path, port, None).await
}

pub async fn serve_with_static(
    db_path: &Path,
    port: u16,
    static_dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    let db = Database::open(db_path)?;
    let router = create_router_with_static(db, static_dir.clone());
    let addr = format!("0.0.0.0:{}", port);

    if let Some(ref dir) = static_dir {
        println!("Web UI:  http://localhost:{}", port);
        println!("API:     http://localhost:{}/api/stats", port);
        println!("Static:  {}", dir.display());
    } else {
        println!("API server: http://localhost:{}/api/stats", port);
        println!();
        println!("Tip: Build the frontend for a web UI:");
        println!("  cd apps/web && npm install && npm run build");
        println!("  astera serve --web-dir apps/web/dist");
    }

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
