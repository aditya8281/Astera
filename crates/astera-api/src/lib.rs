use axum::{routing::get, Router};
use std::path::Path;
use std::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use astera_storage::Database;

mod routes;

#[cfg(test)]
mod integration_test;

#[derive(Clone)]
pub struct AppState {
    pub db: std::sync::Arc<Mutex<Database>>,
}

pub fn create_router(db: Database) -> Router {
    let state = AppState {
        db: std::sync::Arc::new(Mutex::new(db)),
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
        .route("/api/graph/dependency", get(routes::dependency_graph))
        .route("/api/metrics", get(routes::metrics))
        .route("/api/impact", get(routes::impact))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub async fn serve(db_path: &Path, port: u16) -> anyhow::Result<()> {
    let db = Database::open(db_path)?;
    let router = create_router(db);
    let addr = format!("0.0.0.0:{}", port);
    info!("Astera API server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
