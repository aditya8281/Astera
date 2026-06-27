#[cfg(test)]
mod tests {
    use astera_core::{Edge, EdgeKind, FileInfo, Node, NodeKind, SourceSpan};
    use astera_storage::Database;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn setup_db() -> Database {
        let db = Database::in_memory().unwrap();
        let file = FileInfo {
            id: None,
            repo_root: ".".into(),
            relative_path: "src/main.rs".into(),
            language: "rust".into(),
            hash: "abc123".into(),
            size: 1024,
            line_count: 50,
            indexed_at: None,
            last_modified: "2025-01-01T00:00:00Z".into(),
        };
        let fid = db.insert_file(&file).unwrap();

        let nodes = vec![
            Node::new(
                NodeKind::Function,
                "main",
                fid,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 5,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Function,
                "helper",
                fid,
                SourceSpan {
                    start_line: 7,
                    start_col: 1,
                    end_line: 10,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Class,
                "Config",
                fid,
                SourceSpan {
                    start_line: 12,
                    start_col: 1,
                    end_line: 20,
                    end_col: 1,
                },
            ),
        ];
        let node_ids = db.insert_nodes(&nodes).unwrap();

        let edges = vec![
            Edge::new(node_ids[0], node_ids[1], EdgeKind::Calls),
            Edge::new(node_ids[2], node_ids[0], EdgeKind::Contains),
        ];
        db.insert_edges(&edges).unwrap();

        db
    }

    #[tokio::test]
    async fn test_stats_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/stats")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["data"]["files"], 1);
        assert_eq!(json["data"]["symbols"], 3);
        assert_eq!(json["data"]["edges"], 2);
    }

    #[tokio::test]
    async fn test_list_files_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/files")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["data"][0]["relative_path"], "src/main.rs");
        assert_eq!(json["meta"]["count"], 1);
    }

    #[tokio::test]
    async fn test_list_symbols_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/symbols")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["meta"]["count"], 3);

        // Filter by kind
        let app = super::super::create_router(setup_db());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/symbols?kind=Function")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["meta"]["count"], 2);
    }

    #[tokio::test]
    async fn test_search_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/search?q=helper")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["meta"]["count"], 1);
        assert_eq!(json["data"][0]["name"], "helper");
    }

    #[tokio::test]
    async fn test_list_edges_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/edges")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["meta"]["count"], 2);

        // Filter by kind
        let app = super::super::create_router(setup_db());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/edges?kind=Calls")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["meta"]["count"], 1);
    }

    #[tokio::test]
    async fn test_dependency_graph_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/graph/dependency")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["nodes"].as_array().unwrap().len(), 3);
        assert_eq!(json["edges"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_get_symbol_not_found() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/symbols/999")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_metrics_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["data"]["total_nodes"], 3);
        assert_eq!(json["data"]["total_edges"], 2);
        assert_eq!(json["data"]["function_count"], 2);
        assert_eq!(json["data"]["module_count"], 1);
    }

    #[tokio::test]
    async fn test_modules_endpoint() {
        let app = super::super::create_router(setup_db());

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/graph/modules")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // Should include the Class node (Config) — Functions are filtered out
        assert!(json["meta"]["count"].as_u64().unwrap() >= 1);
        // The Config class should have 1 child (Contains edge)
        let modules = json["data"].as_array().unwrap();
        let config = modules.iter().find(|m| m["name"] == "Config");
        assert!(config.is_some(), "Config module should be in response");
        assert_eq!(config.unwrap()["child_count"], 1);
        assert!(config.unwrap()["importance"].as_f64().unwrap() > 0.0);
    }

    #[tokio::test]
    async fn test_impact_endpoint() {
        let app = super::super::create_router(setup_db());

        // Impact analysis from node 1 (main function)
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/impact?root_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // main calls helper, so helper should be affected
        assert_eq!(json["data"]["total_affected"], 1);
    }

    #[tokio::test]
    async fn test_children_endpoint() {
        let app = super::super::create_router(setup_db());

        // Config class is node 3, has 1 child (Contains edge to main function)
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/graph/children/3")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // Parent node + 1 child = 2 nodes
        assert_eq!(json["nodes"].as_array().unwrap().len(), 2);
        // Parent should be first
        assert_eq!(json["nodes"][0]["name"], "Config");
        assert_eq!(json["nodes"][0]["kind"], "Class");
        // Child should be main function
        assert_eq!(json["nodes"][1]["name"], "main");
        assert_eq!(json["nodes"][1]["kind"], "Function");
        // Edge connecting parent to child
        assert!(!json["edges"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_children_endpoint_leaf() {
        let app = super::super::create_router(setup_db());

        // main function (node 1) has no children
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/graph/children/1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // Just the parent node, no children
        assert_eq!(json["nodes"].as_array().unwrap().len(), 1);
        assert_eq!(json["edges"].as_array().unwrap().len(), 0);
    }
}
