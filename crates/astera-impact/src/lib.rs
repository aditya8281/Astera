use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

use astera_core::{ArchitectureRule, Edge, Node};
#[cfg(test)]
use astera_core::{EdgeKind, NodeKind};

/// Result of an impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactResult {
    pub root: i64,
    pub root_name: String,
    pub affected: Vec<ImpactNode>,
    pub total_affected: u32,
    pub max_depth: u32,
    pub cycle_detected: bool,
}

/// A single node in the impact zone
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactNode {
    pub node_id: i64,
    pub name: String,
    pub kind: String,
    pub depth: u32,
    pub edge_path: Vec<String>,
}

/// BFS-based impact analyzer
pub struct ImpactAnalyzer {
    adjacency: HashMap<i64, Vec<(i64, String)>>,
    reverse_adjacency: HashMap<i64, Vec<(i64, String)>>,
    nodes: HashMap<i64, (String, String)>,
}

impl ImpactAnalyzer {
    pub fn new(nodes: &[Node], edges: &[Edge]) -> Self {
        let mut adjacency: HashMap<i64, Vec<(i64, String)>> = HashMap::new();
        let mut reverse_adjacency: HashMap<i64, Vec<(i64, String)>> = HashMap::new();
        let mut node_map: HashMap<i64, (String, String)> = HashMap::new();

        for node in nodes {
            if let Some(id) = node.id {
                node_map.insert(id, (node.name.clone(), node.kind.to_string()));
            }
        }

        for edge in edges {
            let kind_str = edge.kind.to_string();
            adjacency
                .entry(edge.source_node_id)
                .or_default()
                .push((edge.target_node_id, kind_str.clone()));
            reverse_adjacency
                .entry(edge.target_node_id)
                .or_default()
                .push((edge.source_node_id, kind_str));
        }

        ImpactAnalyzer {
            adjacency,
            reverse_adjacency,
            nodes: node_map,
        }
    }

    /// Forward impact: who does root_id affect?
    pub fn impact_analysis(&self, root_id: i64, max_depth: Option<u32>) -> ImpactResult {
        let max_d = max_depth.unwrap_or(10);
        let root_name = self
            .nodes
            .get(&root_id)
            .map(|(n, _)| n.clone())
            .unwrap_or_default();

        let mut visited: HashMap<i64, u32> = HashMap::new();
        let mut queue: VecDeque<(i64, u32, Vec<String>)> = VecDeque::new();
        let mut affected = Vec::new();
        let mut cycle_detected = false;

        visited.insert(root_id, 0);
        queue.push_back((root_id, 0, Vec::new()));

        while let Some((current, depth, path)) = queue.pop_front() {
            if depth >= max_d {
                continue;
            }

            if let Some(neighbors) = self.adjacency.get(&current) {
                for (next, edge_kind) in neighbors {
                    let mut new_path = path.clone();
                    new_path.push(edge_kind.clone());

                    if visited.contains_key(next) {
                        cycle_detected = true;
                        continue;
                    }

                    visited.insert(*next, depth + 1);
                    if let Some((name, kind)) = self.nodes.get(next) {
                        affected.push(ImpactNode {
                            node_id: *next,
                            name: name.clone(),
                            kind: kind.clone(),
                            depth: depth + 1,
                            edge_path: new_path.clone(),
                        });
                    }
                    queue.push_back((*next, depth + 1, new_path));
                }
            }
        }

        let max_depth_reached = affected.iter().map(|n| n.depth).max().unwrap_or(0);

        ImpactResult {
            root: root_id,
            root_name,
            total_affected: affected.len() as u32,
            max_depth: max_depth_reached,
            cycle_detected,
            affected,
        }
    }

    /// Reverse impact: what affects root_id?
    pub fn reverse_impact(&self, root_id: i64, max_depth: Option<u32>) -> ImpactResult {
        let max_d = max_depth.unwrap_or(10);
        let root_name = self
            .nodes
            .get(&root_id)
            .map(|(n, _)| n.clone())
            .unwrap_or_default();

        let mut visited: HashMap<i64, u32> = HashMap::new();
        let mut queue: VecDeque<(i64, u32, Vec<String>)> = VecDeque::new();
        let mut affected = Vec::new();
        let mut cycle_detected = false;

        visited.insert(root_id, 0);
        queue.push_back((root_id, 0, Vec::new()));

        while let Some((current, depth, path)) = queue.pop_front() {
            if depth >= max_d {
                continue;
            }

            if let Some(neighbors) = self.reverse_adjacency.get(&current) {
                for (next, edge_kind) in neighbors {
                    let mut new_path = path.clone();
                    new_path.push(edge_kind.clone());

                    if visited.contains_key(next) {
                        cycle_detected = true;
                        continue;
                    }

                    visited.insert(*next, depth + 1);
                    if let Some((name, kind)) = self.nodes.get(next) {
                        affected.push(ImpactNode {
                            node_id: *next,
                            name: name.clone(),
                            kind: kind.clone(),
                            depth: depth + 1,
                            edge_path: new_path.clone(),
                        });
                    }
                    queue.push_back((*next, depth + 1, new_path));
                }
            }
        }

        let max_depth_reached = affected.iter().map(|n| n.depth).max().unwrap_or(0);

        ImpactResult {
            root: root_id,
            root_name,
            total_affected: affected.len() as u32,
            max_depth: max_depth_reached,
            cycle_detected,
            affected,
        }
    }

    /// Shortest path from source to target via BFS
    pub fn critical_path(&self, source: i64, target: i64) -> Option<Vec<ImpactNode>> {
        if source == target {
            return Some(Vec::new());
        }

        let mut visited: HashMap<i64, Vec<String>> = HashMap::new();
        let mut queue: VecDeque<(i64, Vec<String>)> = VecDeque::new();

        visited.insert(source, Vec::new());
        queue.push_back((source, Vec::new()));

        while let Some((current, path)) = queue.pop_front() {
            if let Some(neighbors) = self.adjacency.get(&current) {
                for (next, edge_kind) in neighbors {
                    if visited.contains_key(next) {
                        continue;
                    }

                    let mut new_path = path.clone();
                    new_path.push(edge_kind.clone());

                    if *next == target {
                        // Build path nodes
                        let mut result = Vec::new();
                        let mut node_path = vec![source];
                        let mut cur = source;
                        // Reconstruct node sequence from edge path
                        for ek in &new_path {
                            if let Some(neighbors2) = self.adjacency.get(&cur) {
                                if let Some((next2, _)) = neighbors2.iter().find(|(_, k)| k == ek) {
                                    node_path.push(*next2);
                                    cur = *next2;
                                }
                            }
                        }

                        for (i, &nid) in node_path.iter().enumerate() {
                            if let Some((name, kind)) = self.nodes.get(&nid) {
                                result.push(ImpactNode {
                                    node_id: nid,
                                    name: name.clone(),
                                    kind: kind.clone(),
                                    depth: i as u32,
                                    edge_path: new_path[..i].to_vec(),
                                });
                            }
                        }
                        return Some(result);
                    }

                    visited.insert(*next, new_path.clone());
                    queue.push_back((*next, new_path));
                }
            }
        }

        None
    }

    /// Extract unique file IDs from impacted nodes
    pub fn affected_files(&self, result: &ImpactResult) -> Vec<i64> {
        result.affected.iter().map(|n| n.node_id).collect()
    }
}

// ─── Architecture Rule Validation ───

/// A violation of an architecture rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureViolation {
    pub rule_name: String,
    pub source_layer: String,
    pub target_layer: String,
    pub source_file: String,
    pub target_file: String,
    pub edge_kind: String,
}

/// Result of architecture rule validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureValidation {
    pub total_rules_checked: u32,
    pub total_violations: u32,
    pub violations: Vec<ArchitectureViolation>,
}

/// Validate architecture rules against the dependency graph.
///
/// Each rule defines a layer with glob patterns for which files belong to it,
/// and which other layers it is allowed to depend on.
pub fn validate_architecture(
    rules: &[ArchitectureRule],
    file_nodes: &[(i64, String, String)], // (id, name, path)
    dep_edges: &[(i64, i64, String)],     // (source_file_id, target_file_id, edge_kind)
) -> ArchitectureValidation {
    // Map each file to its layer(s) based on glob patterns
    let mut file_layers: HashMap<i64, Vec<String>> = HashMap::new();

    for &(id, _, ref path) in file_nodes {
        let mut layers = Vec::new();
        for rule in rules {
            for pattern in &rule.patterns {
                if glob_matches(path, pattern) {
                    layers.push(rule.layer.clone());
                    break;
                }
            }
        }
        file_layers.insert(id, layers);
    }

    // Build layer allow-list lookup
    let layer_rules: HashMap<String, Vec<String>> = rules
        .iter()
        .map(|r| (r.layer.clone(), r.allowed_dependencies.clone()))
        .collect();

    let mut violations = Vec::new();

    for &(src_id, tgt_id, ref edge_kind) in dep_edges {
        let src_layers = file_layers.get(&src_id).cloned().unwrap_or_default();
        let tgt_layers = file_layers.get(&tgt_id).cloned().unwrap_or_default();

        for src_layer in &src_layers {
            for tgt_layer in &tgt_layers {
                if src_layer == tgt_layer {
                    continue; // same layer is always allowed
                }
                if let Some(allowed) = layer_rules.get(src_layer) {
                    if !allowed.contains(tgt_layer) {
                        let src_file = file_nodes
                            .iter()
                            .find(|(id, _, _)| *id == src_id)
                            .map(|(_, name, _)| name.clone())
                            .unwrap_or_default();
                        let tgt_file = file_nodes
                            .iter()
                            .find(|(id, _, _)| *id == tgt_id)
                            .map(|(_, name, _)| name.clone())
                            .unwrap_or_default();
                        let rule_name = rules
                            .iter()
                            .find(|r| r.layer == *src_layer)
                            .map(|r| r.name.clone())
                            .unwrap_or_else(|| src_layer.clone());

                        // Avoid duplicate violations
                        let is_dup = violations.iter().any(|v: &ArchitectureViolation| {
                            v.rule_name == rule_name
                                && v.source_file == src_file
                                && v.target_file == tgt_file
                        });
                        if !is_dup {
                            violations.push(ArchitectureViolation {
                                rule_name,
                                source_layer: src_layer.clone(),
                                target_layer: tgt_layer.clone(),
                                source_file: src_file,
                                target_file: tgt_file,
                                edge_kind: edge_kind.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    let total = rules.len() as u32;
    ArchitectureValidation {
        total_rules_checked: total,
        total_violations: violations.len() as u32,
        violations,
    }
}

/// Simple glob matching: supports `*` (any chars in single segment) and `**` (any chars including /)
fn glob_matches(path: &str, pattern: &str) -> bool {
    glob_match_inner(path.as_bytes(), pattern.as_bytes())
}

fn glob_match_inner(path: &[u8], pattern: &[u8]) -> bool {
    if pattern.is_empty() {
        return path.is_empty();
    }

    if pattern.len() >= 2 && pattern[0] == b'*' && pattern[1] == b'*' {
        // ** matches everything (including /)
        let rest = &pattern[2..];
        // skip optional /
        let rest = if rest.first() == Some(&b'/') {
            &rest[1..]
        } else {
            rest
        };
        // try matching rest of pattern at every position in path
        for i in 0..=path.len() {
            if glob_match_inner(&path[i..], rest) {
                return true;
            }
        }
        return false;
    }

    if pattern.first() == Some(&b'*') {
        // * matches any non-/ characters
        let rest = &pattern[1..];
        for i in 0..=path.len() {
            if i > 0 && path[i - 1] == b'/' {
                break;
            }
            if glob_match_inner(&path[i..], rest) {
                return true;
            }
        }
        return false;
    }

    if pattern.first() == Some(&b'?') {
        return !path.is_empty() && glob_match_inner(&path[1..], &pattern[1..]);
    }

    if path.first() == pattern.first() {
        return glob_match_inner(&path[1..], &pattern[1..]);
    }

    false
}

#[cfg(test)]
mod glob_tests {
    use super::*;

    #[test]
    fn test_glob_simple() {
        assert!(glob_matches("src/ui/app.ts", "src/ui/app.ts"));
        assert!(!glob_matches("src/ui/app.ts", "src/lib/app.ts"));
    }

    #[test]
    fn test_glob_star() {
        assert!(glob_matches("src/ui/app.ts", "src/**/*.ts"));
        assert!(glob_matches("src/ui/deep/app.ts", "src/**/*.ts"));
        assert!(glob_matches("src/app.ts", "src/*.ts"));
        assert!(!glob_matches("src/ui/app.ts", "src/*.ts"));
    }

    #[test]
    fn test_glob_doublestar() {
        assert!(glob_matches("src/ui/app.ts", "src/**/app.ts"));
        assert!(glob_matches("src/app.ts", "src/**/app.ts"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use astera_core::SourceSpan;

    fn make_node(id: i64, kind: NodeKind, name: &str) -> Node {
        Node {
            id: Some(id),
            kind,
            name: name.to_string(),
            file_id: 1,
            span: SourceSpan {
                start_line: 1,
                start_col: 1,
                end_line: 10,
                end_col: 1,
            },
            doc_comment: None,
            properties: serde_json::json!({}),
        }
    }

    fn make_edge(src: i64, tgt: i64, kind: EdgeKind) -> Edge {
        Edge::new(src, tgt, kind)
    }

    #[test]
    fn test_linear_chain() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
            make_node(3, NodeKind::Function, "C"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Calls),
            make_edge(2, 3, EdgeKind::Calls),
        ];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let result = analyzer.impact_analysis(1, None);
        assert_eq!(result.total_affected, 2);
        assert_eq!(result.max_depth, 2);
    }

    #[test]
    fn test_diamond() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
            make_node(3, NodeKind::Function, "C"),
            make_node(4, NodeKind::Function, "D"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Calls),
            make_edge(1, 3, EdgeKind::Calls),
            make_edge(2, 4, EdgeKind::Calls),
            make_edge(3, 4, EdgeKind::Calls),
        ];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let result = analyzer.impact_analysis(1, None);
        assert_eq!(result.total_affected, 3);
    }

    #[test]
    fn test_cycle_detection() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
            make_node(3, NodeKind::Function, "C"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Calls),
            make_edge(2, 3, EdgeKind::Calls),
            make_edge(3, 1, EdgeKind::Calls),
        ];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let result = analyzer.impact_analysis(1, None);
        assert!(result.cycle_detected);
    }

    #[test]
    fn test_max_depth() {
        let nodes: Vec<Node> = (1..=5)
            .map(|i| make_node(i, NodeKind::Function, &format!("F{}", i)))
            .collect();
        let edges: Vec<Edge> = (1..5)
            .map(|i| make_edge(i, i + 1, EdgeKind::Calls))
            .collect();
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let result = analyzer.impact_analysis(1, Some(2));
        assert!(result.affected.iter().all(|n| n.depth <= 2));
    }

    #[test]
    fn test_reverse_impact() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
            make_node(3, NodeKind::Function, "C"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Calls),
            make_edge(2, 3, EdgeKind::Calls),
        ];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let result = analyzer.reverse_impact(3, None);
        assert_eq!(result.total_affected, 2);
    }

    #[test]
    fn test_critical_path() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
            make_node(3, NodeKind::Function, "C"),
            make_node(4, NodeKind::Function, "D"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Calls),
            make_edge(1, 3, EdgeKind::Calls),
            make_edge(2, 4, EdgeKind::Calls),
            make_edge(3, 4, EdgeKind::Calls),
        ];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let path = analyzer.critical_path(1, 4);
        assert!(path.is_some());
        let path = path.unwrap();
        assert_eq!(path.len(), 3); // A -> B -> D or A -> C -> D
    }

    #[test]
    fn test_no_path() {
        let nodes = vec![
            make_node(1, NodeKind::Function, "A"),
            make_node(2, NodeKind::Function, "B"),
        ];
        let edges = vec![];
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);
        let path = analyzer.critical_path(1, 2);
        assert!(path.is_none());
    }

    // ─── Architecture Rule Validation Tests ───

    #[test]
    fn test_architecture_no_violations() {
        use astera_core::ArchitectureRule;

        let rules = vec![
            ArchitectureRule {
                name: "ui_can_depend_on_service".into(),
                description: "UI layer can import service".into(),
                layer: "ui".into(),
                allowed_dependencies: vec!["service".into()],
                patterns: vec!["src/ui/**".into()],
            },
            ArchitectureRule {
                name: "service_can_depend_on_storage".into(),
                description: "Service layer can import storage".into(),
                layer: "service".into(),
                allowed_dependencies: vec!["storage".into()],
                patterns: vec!["src/service/**".into()],
            },
        ];
        let file_nodes = vec![
            (1, "app.ts".into(), "src/ui/app.ts".into()),
            (2, "service.ts".into(), "src/service/service.ts".into()),
            (3, "db.ts".into(), "src/storage/db.ts".into()),
        ];
        // ui → service (allowed), service → storage (allowed)
        let dep_edges = vec![(1, 2, "DependsOn".into()), (2, 3, "DependsOn".into())];
        let result = validate_architecture(&rules, &file_nodes, &dep_edges);
        assert_eq!(result.total_violations, 0);
    }

    #[test]
    fn test_architecture_violation() {
        use astera_core::ArchitectureRule;

        let rules = vec![
            ArchitectureRule {
                name: "ui_cannot_depend_on_storage".into(),
                description: "UI layer must not import storage".into(),
                layer: "ui".into(),
                allowed_dependencies: vec!["service".into()],
                patterns: vec!["src/ui/**".into()],
            },
            ArchitectureRule {
                name: "storage_exists".into(),
                description: "Storage layer files".into(),
                layer: "storage".into(),
                allowed_dependencies: vec![],
                patterns: vec!["src/storage/**".into()],
            },
        ];
        let file_nodes = vec![
            (1, "app.ts".into(), "src/ui/app.ts".into()),
            (3, "db.ts".into(), "src/storage/db.ts".into()),
        ];
        // ui → storage (VIOLATION)
        let dep_edges = vec![(1, 3, "DependsOn".into())];
        let result = validate_architecture(&rules, &file_nodes, &dep_edges);
        assert_eq!(result.total_violations, 1);
        assert_eq!(result.violations[0].source_layer, "ui");
        assert_eq!(result.violations[0].target_layer, "storage");
    }

    #[test]
    fn test_architecture_same_layer_allowed() {
        use astera_core::ArchitectureRule;

        let rules = vec![ArchitectureRule {
            name: "ui_internal".into(),
            description: "UI layer internal deps".into(),
            layer: "ui".into(),
            allowed_dependencies: vec!["service".into()],
            patterns: vec!["src/ui/**".into()],
        }];
        let file_nodes = vec![
            (1, "a.ts".into(), "src/ui/a.ts".into()),
            (2, "b.ts".into(), "src/ui/b.ts".into()),
        ];
        let dep_edges = vec![(1, 2, "DependsOn".into())];
        let result = validate_architecture(&rules, &file_nodes, &dep_edges);
        assert_eq!(
            result.total_violations, 0,
            "Same layer deps should be allowed"
        );
    }
}
