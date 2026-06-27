use anyhow::Result;
use astera_core::{Edge, EdgeKind, Node, NodeKind};
use astera_storage::Database;
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// Export format options
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Csv,
    Dot,
}

impl ExportFormat {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "json" => Some(Self::Json),
            "csv" => Some(Self::Csv),
            "dot" | "gv" => Some(Self::Dot),
            _ => None,
        }
    }
}

/// Export the full graph to a file
pub fn export_all(db: &Database, path: &Path, format: ExportFormat) -> Result<()> {
    let nodes = db.query_nodes(None, None, None)?;
    let edges = db.get_edges(None, None, None)?;

    let mut file = File::create(path)?;

    match format {
        ExportFormat::Json => export_json(&nodes, &edges, &mut file)?,
        ExportFormat::Csv => export_csv(&nodes, &edges, &mut file)?,
        ExportFormat::Dot => export_dot(&nodes, &edges, &mut file)?,
    }

    Ok(())
}

/// Export as JSON (full graph dump)
fn export_json(nodes: &[Node], edges: &[Edge], file: &mut File) -> Result<()> {
    #[derive(serde::Serialize)]
    struct JsonNode {
        id: i64,
        kind: String,
        name: String,
        file_id: i64,
        start_line: u32,
        start_col: u32,
        end_line: u32,
        end_col: u32,
    }

    #[derive(serde::Serialize)]
    struct JsonEdge {
        id: i64,
        source: i64,
        target: i64,
        kind: String,
    }

    #[derive(serde::Serialize)]
    struct JsonGraph {
        nodes: Vec<JsonNode>,
        edges: Vec<JsonEdge>,
    }

    let graph = JsonGraph {
        nodes: nodes
            .iter()
            .map(|n| JsonNode {
                id: n.id.unwrap_or(0),
                kind: n.kind.to_string(),
                name: n.name.clone(),
                file_id: n.file_id,
                start_line: n.span.start_line,
                start_col: n.span.start_col,
                end_line: n.span.end_line,
                end_col: n.span.end_col,
            })
            .collect(),
        edges: edges
            .iter()
            .map(|e| JsonEdge {
                id: e.id.unwrap_or(0),
                source: e.source_node_id,
                target: e.target_node_id,
                kind: e.kind.to_string(),
            })
            .collect(),
    };

    serde_json::to_writer_pretty(file, &graph)?;
    Ok(())
}

/// Export as CSV (two tables: nodes.csv and edges.csv combined)
fn export_csv(nodes: &[Node], edges: &[Edge], file: &mut File) -> Result<()> {
    // Nodes section
    writeln!(file, "# Nodes")?;
    writeln!(
        file,
        "id,kind,name,file_id,start_line,start_col,end_line,end_col"
    )?;
    for n in nodes {
        writeln!(
            file,
            "{},{},{},{},{},{},{},{}",
            n.id.unwrap_or(0),
            n.kind,
            csv_escape(&n.name),
            n.file_id,
            n.span.start_line,
            n.span.start_col,
            n.span.end_line,
            n.span.end_col,
        )?;
    }

    writeln!(file)?;

    // Edges section
    writeln!(file, "# Edges")?;
    writeln!(file, "id,source,target,kind")?;
    for e in edges {
        writeln!(
            file,
            "{},{},{},{}",
            e.id.unwrap_or(0),
            e.source_node_id,
            e.target_node_id,
            e.kind,
        )?;
    }

    Ok(())
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// Export as DOT (Graphviz format)
fn export_dot(nodes: &[Node], edges: &[Edge], file: &mut File) -> Result<()> {
    writeln!(file, "digraph astera {{")?;
    writeln!(file, "  rankdir=LR;")?;
    writeln!(
        file,
        "  node [shape=box, style=filled, fontname=\"monospace\"];"
    )?;
    writeln!(file)?;

    // Node color map
    let kind_color = |kind: &NodeKind| -> &str {
        match kind {
            NodeKind::Function => "#4fc3f7",
            NodeKind::Method => "#29b6f6",
            NodeKind::Class => "#ab47bc",
            NodeKind::Interface => "#ce93d8",
            NodeKind::Enum => "#ffa726",
            NodeKind::Module => "#66bb6a",
            NodeKind::Variable => "#ef5350",
            NodeKind::Import => "#78909c",
            NodeKind::File => "#546e7a",
            _ => "#90a4ae",
        }
    };

    // Nodes
    for n in nodes {
        let id = n.id.unwrap_or(0);
        let color = kind_color(&n.kind);
        let label = n.name.replace('"', "\\\"");
        let short_kind = format!("{:?}", n.kind);
        writeln!(
            file,
            "  n{} [label=\"{}\\n{}\", fillcolor=\"{}\"];",
            id, label, short_kind, color
        )?;
    }

    writeln!(file)?;

    // Edge color map
    let edge_color = |kind: &EdgeKind| -> &str {
        match kind {
            EdgeKind::Calls => "#e53935",
            EdgeKind::Contains => "#43a047",
            EdgeKind::References => "#1e88e5",
            EdgeKind::Imports => "#8e24aa",
            EdgeKind::DependsOn => "#f4511e",
            EdgeKind::Inherits => "#ffb300",
            _ => "#757575",
        }
    };

    let edge_style = |kind: &EdgeKind| -> &str {
        match kind {
            EdgeKind::Calls => "bold",
            EdgeKind::Contains => "dashed",
            EdgeKind::References => "dotted",
            _ => "solid",
        }
    };

    // Edges
    for e in edges {
        let color = edge_color(&e.kind);
        let style = edge_style(&e.kind);
        writeln!(
            file,
            "  n{} -> n{} [color=\"{}\", style={}, label=\"{}\"];",
            e.source_node_id, e.target_node_id, color, style, e.kind
        )?;
    }

    writeln!(file, "}}")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use astera_core::{EdgeKind, NodeKind, SourceSpan};
    use astera_storage::Database;

    fn test_db() -> (Database, i64) {
        let db = Database::in_memory().unwrap();
        let file = astera_core::FileInfo {
            id: None,
            repo_root: ".".into(),
            relative_path: "src/main.rs".into(),
            language: "rust".into(),
            hash: "abc123".into(),
            size: 1024,
            line_count: 50,
            indexed_at: None,
            last_modified: "2024-01-01T00:00:00Z".into(),
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

        (db, fid)
    }

    #[test]
    fn test_export_json() {
        let (db, _) = test_db();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("graph.json");

        export_all(&db, &path, ExportFormat::Json).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["nodes"].as_array().unwrap().len(), 3);
        assert_eq!(json["edges"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_export_csv() {
        let (db, _) = test_db();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("graph.csv");

        export_all(&db, &path, ExportFormat::Csv).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("# Nodes"));
        assert!(content.contains("# Edges"));
        assert!(content.contains("main"));
        assert!(content.contains("helper"));
        assert!(content.contains("Calls"));
    }

    #[test]
    fn test_export_dot() {
        let (db, _) = test_db();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("graph.dot");

        export_all(&db, &path, ExportFormat::Dot).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("digraph astera"));
        assert!(content.contains("n")); // node IDs
        assert!(content.contains("->")); // edges
    }

    #[test]
    fn test_format_from_extension() {
        assert_eq!(
            ExportFormat::from_extension("json"),
            Some(ExportFormat::Json)
        );
        assert_eq!(ExportFormat::from_extension("csv"), Some(ExportFormat::Csv));
        assert_eq!(ExportFormat::from_extension("dot"), Some(ExportFormat::Dot));
        assert_eq!(ExportFormat::from_extension("gv"), Some(ExportFormat::Dot));
        assert_eq!(ExportFormat::from_extension("txt"), None);
    }

    #[test]
    fn test_csv_escape() {
        assert_eq!(csv_escape("hello"), "hello");
        assert_eq!(csv_escape("has,comma"), "\"has,comma\"");
        assert_eq!(csv_escape("has\"quote"), "\"has\"\"quote\"");
    }
}
