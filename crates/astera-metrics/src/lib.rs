use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use astera_core::{Edge, EdgeKind, Node, NodeKind};

/// Function-level complexity metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionMetrics {
    pub node_id: i64,
    pub name: String,
    pub file_id: i64,
    pub start_line: u32,
    pub end_line: u32,
    pub line_count: u32,
    pub cyclomatic_complexity: u32,
    pub cognitive_complexity: u32,
    pub parameter_count: u32,
}

/// Module/class-level coupling metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleMetrics {
    pub node_id: i64,
    pub name: String,
    pub file_id: i64,
    pub fan_in: u32,
    pub fan_out: u32,
    pub afferent: u32,
    pub efferent: u32,
    pub instability: f64,
    pub num_methods: u32,
    pub num_fields: u32,
}

/// Aggregate metrics for the whole index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateMetrics {
    pub total_nodes: u64,
    pub total_edges: u64,
    pub total_files: u64,
    pub functions: Vec<FunctionMetrics>,
    pub modules: Vec<ModuleMetrics>,
    pub avg_complexity: f64,
    pub max_complexity: u32,
    pub circular_dependencies: Vec<(String, String)>,
}

/// Compute all metrics from a set of nodes and edges
pub fn compute_metrics(nodes: &[Node], edges: &[Edge]) -> AggregateMetrics {
    let function_nodes: Vec<&Node> = nodes.iter()
        .filter(|n| matches!(n.kind, NodeKind::Function | NodeKind::Method))
        .collect();

    let module_nodes: Vec<&Node> = nodes.iter()
        .filter(|n| matches!(n.kind, NodeKind::Class | NodeKind::Interface | NodeKind::Module))
        .collect();

    // Build adjacency for calls
    let mut calls_out: HashMap<i64, u32> = HashMap::new();
    let mut calls_in: HashMap<i64, u32> = HashMap::new();
    // Build adjacency for depends_on
    let mut deps_out: HashMap<i64, u32> = HashMap::new();
    let mut deps_in: HashMap<i64, u32> = HashMap::new();
    // Children count per node (for complexity estimation)
    let mut children_count: HashMap<i64, u32> = HashMap::new();

    for edge in edges {
        match edge.kind {
            EdgeKind::Calls => {
                *calls_out.entry(edge.source_node_id).or_insert(0) += 1;
                *calls_in.entry(edge.target_node_id).or_insert(0) += 1;
            }
            EdgeKind::DependsOn => {
                *deps_out.entry(edge.source_node_id).or_insert(0) += 1;
                *deps_in.entry(edge.target_node_id).or_insert(0) += 1;
            }
            EdgeKind::Contains => {
                *children_count.entry(edge.source_node_id).or_insert(0) += 1;
            }
            _ => {}
        }
    }

    // Compute function metrics
    let func_metrics: Vec<FunctionMetrics> = function_nodes.iter().map(|f| {
        let line_count = f.span.end_line.saturating_sub(f.span.start_line) + 1;
        // Rough cyclomatic: base 1 + branching children (Contains to if/for/while/etc)
        let child_count = children_count.get(&f.id.unwrap_or(0)).copied().unwrap_or(0);
        let cyclomatic = std::cmp::max(1, 1 + child_count);
        // Cognitive: nesting-aware approximation
        let cognitive = std::cmp::max(1, child_count + line_count / 10);
        // Parameter count from properties
        let param_count = f.properties.get("parameters")
            .and_then(|v| v.as_array())
            .map(|a| a.len() as u32)
            .unwrap_or(0);

        FunctionMetrics {
            node_id: f.id.unwrap_or(0),
            name: f.name.clone(),
            file_id: f.file_id,
            start_line: f.span.start_line,
            end_line: f.span.end_line,
            line_count,
            cyclomatic_complexity: cyclomatic,
            cognitive_complexity: cognitive,
            parameter_count: param_count,
        }
    }).collect();

    // Compute module metrics
    let mod_metrics: Vec<ModuleMetrics> = module_nodes.iter().map(|m| {
        let nid = m.id.unwrap_or(0);
        let fan_in = calls_in.get(&nid).copied().unwrap_or(0);
        let fan_out = calls_out.get(&nid).copied().unwrap_or(0);
        let afferent = deps_in.get(&nid).copied().unwrap_or(0);
        let efferent = deps_out.get(&nid).copied().unwrap_or(0);
        let total = afferent + efferent;
        let instability = if total > 0 { efferent as f64 / total as f64 } else { 0.0 };

        // Count methods and fields that are children of this module
        let num_methods = edges.iter()
            .filter(|e| e.kind == EdgeKind::Contains && e.source_node_id == nid)
            .filter(|e| nodes.iter().any(|n| n.id == Some(e.target_node_id) && n.kind == NodeKind::Method))
            .count() as u32;
        let num_fields = edges.iter()
            .filter(|e| e.kind == EdgeKind::Contains && e.source_node_id == nid)
            .filter(|e| nodes.iter().any(|n| n.id == Some(e.target_node_id) && n.kind == NodeKind::Field))
            .count() as u32;

        ModuleMetrics {
            node_id: nid,
            name: m.name.clone(),
            file_id: m.file_id,
            fan_in,
            fan_out,
            afferent,
            efferent,
            instability,
            num_methods,
            num_fields,
        }
    }).collect();

    // Averages
    let total_complexity: u32 = func_metrics.iter().map(|f| f.cyclomatic_complexity).sum();
    let avg_complexity = if func_metrics.is_empty() { 0.0 } else { total_complexity as f64 / func_metrics.len() as f64 };
    let max_complexity = func_metrics.iter().map(|f| f.cyclomatic_complexity).max().unwrap_or(0);

    // Circular dependencies via Tarjan's SCC
    let circular = detect_circular_deps(edges, nodes);

    let total_files = nodes.iter().filter(|n| n.kind == NodeKind::File).count() as u64;

    AggregateMetrics {
        total_nodes: nodes.len() as u64,
        total_edges: edges.len() as u64,
        total_files,
        functions: func_metrics,
        modules: mod_metrics,
        avg_complexity,
        max_complexity,
        circular_dependencies: circular,
    }
}

/// Tarjan's SCC to detect circular dependencies between files
fn detect_circular_deps(edges: &[Edge], nodes: &[Node]) -> Vec<(String, String)> {
    // Build file dependency graph (DependsOn edges)
    let mut adj: HashMap<i64, Vec<i64>> = HashMap::new();
    for edge in edges {
        if edge.kind == EdgeKind::DependsOn {
            adj.entry(edge.source_node_id)
                .or_default()
                .push(edge.target_node_id);
        }
    }

    // Only look at File nodes for dependency cycles
    let file_nodes: HashMap<i64, &Node> = nodes.iter()
        .filter(|n| n.kind == NodeKind::File && n.id.is_some())
        .map(|n| (n.id.unwrap(), n))
        .collect();

    if file_nodes.is_empty() {
        return Vec::new();
    }

    let file_ids: Vec<i64> = file_nodes.keys().copied().collect();

    struct TarjanState {
        index_counter: i32,
        indices: HashMap<i64, i32>,
        low_links: HashMap<i64, i32>,
        on_stack: HashMap<i64, bool>,
        stack: Vec<i64>,
        sccs: Vec<Vec<i64>>,
    }

    fn strongconnect(
        node: i64,
        adj: &HashMap<i64, Vec<i64>>,
        all_nodes: &[i64],
        state: &mut TarjanState,
    ) {
        state.indices.insert(node, state.index_counter);
        state.low_links.insert(node, state.index_counter);
        state.index_counter += 1;
        state.stack.push(node);
        state.on_stack.insert(node, true);

        if let Some(neighbors) = adj.get(&node) {
            for &neighbor in neighbors {
                if !all_nodes.contains(&neighbor) {
                    continue;
                }
                if !state.indices.contains_key(&neighbor) {
                    strongconnect(neighbor, adj, all_nodes, state);
                    let ll = *state.low_links.get(&node).unwrap_or(&0);
                    let nl = *state.low_links.get(&neighbor).unwrap_or(&0);
                    state.low_links.insert(node, ll.min(nl));
                } else if *state.on_stack.get(&neighbor).unwrap_or(&false) {
                    let ll = *state.low_links.get(&node).unwrap_or(&0);
                    let ni = *state.indices.get(&neighbor).unwrap_or(&0);
                    state.low_links.insert(node, ll.min(ni));
                }
            }
        }

        if *state.low_links.get(&node).unwrap_or(&0) == *state.indices.get(&node).unwrap_or(&0) {
            let mut scc = Vec::new();
            loop {
                let w = state.stack.pop().unwrap();
                state.on_stack.insert(w, false);
                scc.push(w);
                if w == node {
                    break;
                }
            }
            if scc.len() > 1 {
                state.sccs.push(scc);
            }
        }
    }

    let mut state = TarjanState {
        index_counter: 0,
        indices: HashMap::new(),
        low_links: HashMap::new(),
        on_stack: HashMap::new(),
        stack: Vec::new(),
        sccs: Vec::new(),
    };

    for &fid in &file_ids {
        if !state.index_counter.to_string().is_empty() && state.indices.contains_key(&fid) {
            continue;
        }
        if !state.indices.contains_key(&fid) {
            strongconnect(fid, &adj, &file_ids, &mut state);
        }
    }

    // Convert SCCs to name pairs
    let mut result = Vec::new();
    for scc in state.sccs {
        for window in scc.windows(2) {
            if let (Some(a), Some(b)) = (file_nodes.get(&window[0]), file_nodes.get(&window[1])) {
                result.push((a.name.clone(), b.name.clone()));
            }
        }
    }
    result
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
    fn test_empty_graph() {
        let metrics = compute_metrics(&[], &[]);
        assert_eq!(metrics.total_nodes, 0);
        assert!(metrics.functions.is_empty());
        assert!(metrics.circular_dependencies.is_empty());
    }

    #[test]
    fn test_function_complexity() {
        let nodes = vec![
            make_node(1, NodeKind::File, "test.ts"),
            make_node(2, NodeKind::Function, "main"),
            make_node(3, NodeKind::Function, "helper"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Contains),
            make_edge(1, 3, EdgeKind::Contains),
            make_edge(2, 3, EdgeKind::Calls),
        ];
        let metrics = compute_metrics(&nodes, &edges);
        assert_eq!(metrics.functions.len(), 2);
        assert!(metrics.avg_complexity >= 1.0);
    }

    #[test]
    fn test_module_coupling() {
        let nodes = vec![
            make_node(1, NodeKind::File, "a.ts"),
            make_node(2, NodeKind::Class, "Foo"),
            make_node(3, NodeKind::Class, "Bar"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::Contains),
            make_edge(2, 3, EdgeKind::DependsOn),
        ];
        let metrics = compute_metrics(&nodes, &edges);
        assert_eq!(metrics.modules.len(), 2);
        // Bar has afferent=1 (depends on by Foo)
        let bar = metrics.modules.iter().find(|m| m.name == "Bar").unwrap();
        assert_eq!(bar.afferent, 1);
    }

    #[test]
    fn test_circular_detection() {
        let nodes = vec![
            make_node(1, NodeKind::File, "a.ts"),
            make_node(2, NodeKind::File, "b.ts"),
        ];
        let edges = vec![
            make_edge(1, 2, EdgeKind::DependsOn),
            make_edge(2, 1, EdgeKind::DependsOn),
        ];
        let metrics = compute_metrics(&nodes, &edges);
        assert!(!metrics.circular_dependencies.is_empty());
    }
}
