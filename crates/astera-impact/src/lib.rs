use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

use astera_core::{Edge, Node};
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
        let root_name = self.nodes.get(&root_id)
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
        let root_name = self.nodes.get(&root_id)
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
            span: SourceSpan { start_line: 1, start_col: 1, end_line: 10, end_col: 1 },
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
        let nodes: Vec<Node> = (1..=5).map(|i| make_node(i, NodeKind::Function, &format!("F{}", i))).collect();
        let edges: Vec<Edge> = (1..5).map(|i| make_edge(i, i + 1, EdgeKind::Calls)).collect();
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
}
