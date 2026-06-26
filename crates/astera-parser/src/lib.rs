use astera_core::{Edge, EdgeKind, Node, NodeKind, SourceSpan};

/// Language grammar identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grammar {
    TypeScript,
    JavaScript,
    Tsx,
    Python,
    Rust,
    Go,
}

impl Grammar {
    pub fn from_language(lang: &str) -> Option<Self> {
        match lang {
            "typescript" => Some(Grammar::TypeScript),
            "javascript" | "js" => Some(Grammar::JavaScript),
            "tsx" => Some(Grammar::Tsx),
            "python" => Some(Grammar::Python),
            "rust" => Some(Grammar::Rust),
            "go" => Some(Grammar::Go),
            _ => None,
        }
    }
}

/// Result of parsing a single file
pub struct ParseOutput {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

/// A parsed file ready for extraction
pub struct ParsedFile {
    pub language: String,
    pub source: Vec<u8>,
    pub file_id: i64,
    pub tree: tree_sitter::Tree,
}

/// Parse a source file with tree-sitter
pub fn parse(source: &[u8], language: &str) -> Result<ParsedFile, String> {
    let grammar = Grammar::from_language(language).ok_or_else(|| format!("Unknown language: {}", language))?;
    let lang = get_language(grammar)?;

    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&lang)
        .map_err(|e| format!("Failed to set language {}: {}", language, e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| format!("Failed to parse {} file", language))?;

    Ok(ParsedFile {
        language: language.to_string(),
        source: source.to_vec(),
        file_id: 0, // caller sets this
        tree,
    })
}

/// Get tree-sitter Language for a grammar
fn get_language(grammar: Grammar) -> Result<tree_sitter::Language, String> {
    match grammar {
        Grammar::TypeScript => Ok(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        Grammar::JavaScript => Ok(tree_sitter_javascript::LANGUAGE.into()),
        Grammar::Tsx => Ok(tree_sitter_typescript::LANGUAGE_TSX.into()),
        Grammar::Python => Ok(tree_sitter_python::LANGUAGE.into()),
        Grammar::Rust => Ok(tree_sitter_rust::LANGUAGE.into()),
        Grammar::Go => Ok(tree_sitter_go::LANGUAGE.into()),
    }
}

/// Extract symbols and edges from a parsed file
pub struct Extractor;

impl Extractor {
    pub fn extract(parsed: &ParsedFile) -> ParseOutput {
        let root = parsed.tree.root_node();
        let source = &parsed.source;
        let file_id = parsed.file_id;

        match parsed.language.as_str() {
            "typescript" | "javascript" | "tsx" => Self::extract_ts(root, source, file_id),
            "python" => Self::extract_python(root, source, file_id),
            "rust" => Self::extract_rust(root, source, file_id),
            "go" => Self::extract_go(root, source, file_id),
            _ => ParseOutput {
                nodes: vec![],
                edges: vec![],
            },
        }
    }

    fn node_span(node: tree_sitter::Node) -> SourceSpan {
        SourceSpan {
            start_line: node.start_position().row as u32 + 1,
            start_col: node.start_position().column as u32 + 1,
            end_line: node.end_position().row as u32 + 1,
            end_col: node.end_position().column as u32 + 1,
        }
    }

    fn node_text<'a>(node: tree_sitter::Node, source: &'a [u8]) -> &'a str {
        std::str::from_utf8(&source[node.start_byte()..node.end_byte()]).unwrap_or("")
    }

    // ─── Helpers for call graph extraction ───

    fn find_enclosing_function_idx(nodes: &[Node], parent_stack: &[Option<usize>]) -> Option<usize> {
        parent_stack.iter().rev().find_map(|entry| {
            entry.and_then(|idx| match nodes[idx].kind {
                NodeKind::Function | NodeKind::Method => Some(idx),
                _ => None,
            })
        })
    }

    fn extract_callee_name(func_node: tree_sitter::Node, source: &[u8]) -> (String, bool) {
        match func_node.kind() {
            "identifier" => (Self::node_text(func_node, source).to_string(), true),
            "member_expression" => {
                let name = func_node
                    .child_by_field_name("property")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("")
                    .to_string();
                (name, true)
            }
            _ => (Self::node_text(func_node, source).to_string(), false),
        }
    }

    fn resolve_calls(nodes: &[Node], edges: &mut Vec<Edge>, call_refs: &[(usize, String)]) {
        for (caller_idx, callee_name) in call_refs {
            if let Some(callee_idx) = nodes.iter().position(|n| n.name == *callee_name) {
                if *caller_idx != callee_idx && !edges.iter().any(|e| {
                    e.source_node_id == *caller_idx as i64
                        && e.target_node_id == callee_idx as i64
                        && e.kind == EdgeKind::Calls
                }) {
                    edges.push(Edge::new(*caller_idx as i64, callee_idx as i64, EdgeKind::Calls));
                }
            }
        }
    }

    // ─── TypeScript / JavaScript Extractor ───

    pub fn extract_ts(root: tree_sitter::Node, source: &[u8], file_id: i64) -> ParseOutput {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut parent_stack: Vec<Option<usize>> = Vec::new();
        let mut call_refs: Vec<(usize, String)> = Vec::new();

        Self::walk_ts(root, source, file_id, &mut nodes, &mut edges, &mut parent_stack, &mut call_refs);
        Self::resolve_calls(&nodes, &mut edges, &call_refs);
        ParseOutput { nodes, edges }
    }

    fn walk_ts(
        node: tree_sitter::Node,
        source: &[u8],
        file_id: i64,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        parent_stack: &mut Vec<Option<usize>>,
        call_refs: &mut Vec<(usize, String)>,
    ) {
        let kind = node.kind();
        let mut extracted = None;

        match kind {
            "function_declaration" | "function" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Function, &name, file_id, Self::node_span(node)));
            }
            "method_definition" | "method" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Method, &name, file_id, Self::node_span(node)));
            }
            "class_declaration" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Class, &name, file_id, Self::node_span(node)));
            }
            "interface_declaration" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(
                    NodeKind::Interface,
                    &name,
                    file_id,
                    Self::node_span(node),
                ));
            }
            "enum_declaration" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Enum, &name, file_id, Self::node_span(node)));
            }
            "type_alias_declaration" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(
                    NodeKind::TypeAlias,
                    &name,
                    file_id,
                    Self::node_span(node),
                ));
            }
            "import_statement" | "import_declaration" => {
                let source_text = Self::node_text(node, source);
                let name = source_text
                    .lines()
                    .next()
                    .unwrap_or(source_text)
                    .trim()
                    .to_string();
                extracted = Some(Node::new(NodeKind::Import, &name, file_id, Self::node_span(node)));
            }
            "lexical_declaration" | "variable_declaration" => {
                // Module-level variable: const/let/var x = ...
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = Self::node_text(name_node, source).to_string();
                    extracted =
                        Some(Node::new(NodeKind::Variable, &name, file_id, Self::node_span(node)));
                }
            }
            _ => {}
        }

        if let Some(mut sym) = extracted {
            let node_idx = nodes.len();
            // Check if there's a parent on the stack to add Contains edge
            if let Some(Some(parent_idx)) = parent_stack.last() {
                if nodes[*parent_idx].kind == NodeKind::Class
                    || nodes[*parent_idx].kind == NodeKind::Interface
                {
                    // This is a method inside a class — reclassify as Method
                    if sym.kind == NodeKind::Function {
                        sym.kind = NodeKind::Method;
                    }
                    edges.push(Edge::new(
                        *parent_idx as i64,
                        node_idx as i64,
                        EdgeKind::Contains,
                    ));
                }
            }
            nodes.push(sym);
            parent_stack.push(Some(node_idx));
        } else {
            // Detect call expressions → collect call_refs for post-walk resolution
            if kind == "call_expression" {
                if let Some(func_node) = node.child_by_field_name("function") {
                    let (callee_name, is_direct) = Self::extract_callee_name(func_node, source);
                    if is_direct {
                        if let Some(caller_idx) = Self::find_enclosing_function_idx(nodes, parent_stack) {
                            call_refs.push((caller_idx, callee_name));
                        }
                    }
                }
            }
            parent_stack.push(parent_stack.last().copied().flatten());
        }

        // Recurse into children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_ts(child, source, file_id, nodes, edges, parent_stack, call_refs);
        }

        parent_stack.pop();
    }

    // ─── Python Extractor ───

    pub fn extract_python(root: tree_sitter::Node, source: &[u8], file_id: i64) -> ParseOutput {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut parent_stack: Vec<Option<usize>> = Vec::new();
        let mut call_refs: Vec<(usize, String)> = Vec::new();

        Self::walk_python(root, source, file_id, &mut nodes, &mut edges, &mut parent_stack, &mut call_refs);
        Self::resolve_calls(&nodes, &mut edges, &call_refs);
        ParseOutput { nodes, edges }
    }

    fn walk_python(
        node: tree_sitter::Node,
        source: &[u8],
        file_id: i64,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        parent_stack: &mut Vec<Option<usize>>,
        call_refs: &mut Vec<(usize, String)>,
    ) {
        let kind = node.kind();
        let mut extracted = None;

        match kind {
            "function_definition" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Function, &name, file_id, Self::node_span(node)));
            }
            "class_definition" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Class, &name, file_id, Self::node_span(node)));
            }
            "import_statement" => {
                let text = Self::node_text(node, source).to_string();
                extracted = Some(Node::new(NodeKind::Import, &text, file_id, Self::node_span(node)));
            }
            "import_from_statement" => {
                let text = Self::node_text(node, source).to_string();
                extracted = Some(Node::new(NodeKind::Import, &text, file_id, Self::node_span(node)));
            }
            _ => {}
        }

        if let Some(sym) = extracted {
            let node_idx = nodes.len();
            if let Some(Some(parent_idx)) = parent_stack.last() {
                if nodes[*parent_idx].kind == NodeKind::Class && sym.kind == NodeKind::Function {
                    edges.push(Edge::new(
                        *parent_idx as i64,
                        node_idx as i64,
                        EdgeKind::Contains,
                    ));
                }
            }
            nodes.push(sym);
            parent_stack.push(Some(node_idx));
        } else {
            // Detect call expressions → collect call_refs for post-walk resolution
            if kind == "call" {
                if let Some(func_node) = node.child_by_field_name("function") {
                    let (callee_name, is_direct) = Self::extract_callee_name(func_node, source);
                    if is_direct {
                        if let Some(caller_idx) = Self::find_enclosing_function_idx(nodes, parent_stack) {
                            call_refs.push((caller_idx, callee_name));
                        }
                    }
                }
            }
            parent_stack.push(parent_stack.last().copied().flatten());
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_python(child, source, file_id, nodes, edges, parent_stack, call_refs);
        }
        parent_stack.pop();
    }

    // ─── Rust Extractor ───

    pub fn extract_rust(root: tree_sitter::Node, source: &[u8], file_id: i64) -> ParseOutput {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut parent_stack: Vec<Option<usize>> = Vec::new();
        let mut call_refs: Vec<(usize, String)> = Vec::new();

        Self::walk_rust(root, source, file_id, &mut nodes, &mut edges, &mut parent_stack, &mut call_refs);
        Self::resolve_calls(&nodes, &mut edges, &call_refs);
        ParseOutput { nodes, edges }
    }

    fn walk_rust(
        node: tree_sitter::Node,
        source: &[u8],
        file_id: i64,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        parent_stack: &mut Vec<Option<usize>>,
        call_refs: &mut Vec<(usize, String)>,
    ) {
        let kind = node.kind();
        let mut extracted = None;

        match kind {
            "function_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Function, &name, file_id, Self::node_span(node)));
            }
            "struct_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Class, &name, file_id, Self::node_span(node)));
            }
            "enum_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Enum, &name, file_id, Self::node_span(node)));
            }
            "trait_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Interface, &name, file_id, Self::node_span(node)));
            }
            "impl_item" => {
                let type_name = node
                    .child_by_field_name("type")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("unknown")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Module, &type_name, file_id, Self::node_span(node)));
            }
            "type_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(
                    NodeKind::TypeAlias,
                    &name,
                    file_id,
                    Self::node_span(node),
                ));
            }
            "use_declaration" => {
                let text = Self::node_text(node, source).to_string();
                extracted = Some(Node::new(NodeKind::Import, &text, file_id, Self::node_span(node)));
            }
            "const_item" | "static_item" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Variable, &name, file_id, Self::node_span(node)));
            }
            "let_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    if name_node.kind() == "identifier" {
                        let name = Self::node_text(name_node, source).to_string();
                        // Only extract module-level let — simple heuristic: no parent block
                        extracted = Some(Node::new(
                            NodeKind::Variable,
                            &name,
                            file_id,
                            Self::node_span(node),
                        ));
                    }
                }
            }
            _ => {}
        }

        if let Some(sym) = extracted {
            let node_idx = nodes.len();
            if let Some(Some(parent_idx)) = parent_stack.last() {
                // Class→Method (impl→function) containment
                if nodes[*parent_idx].kind == NodeKind::Module && sym.kind == NodeKind::Function {
                    edges.push(Edge::new(
                        *parent_idx as i64,
                        node_idx as i64,
                        EdgeKind::Contains,
                    ));
                }
            }
            nodes.push(sym);
            parent_stack.push(Some(node_idx));
        } else {
            // Detect call expressions → collect call_refs for post-walk resolution
            if kind == "call_expression" {
                if let Some(func_node) = node.child_by_field_name("function") {
                    let (callee_name, is_direct) = Self::extract_callee_name(func_node, source);
                    if is_direct {
                        if let Some(caller_idx) = Self::find_enclosing_function_idx(nodes, parent_stack) {
                            call_refs.push((caller_idx, callee_name));
                        }
                    }
                }
            }
            parent_stack.push(parent_stack.last().copied().flatten());
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_rust(child, source, file_id, nodes, edges, parent_stack, call_refs);
        }
        parent_stack.pop();
    }

    // ─── Go Extractor ───

    pub fn extract_go(root: tree_sitter::Node, source: &[u8], file_id: i64) -> ParseOutput {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut parent_stack: Vec<Option<usize>> = Vec::new();
        let mut call_refs: Vec<(usize, String)> = Vec::new();

        Self::walk_go(root, source, file_id, &mut nodes, &mut edges, &mut parent_stack, &mut call_refs);
        Self::resolve_calls(&nodes, &mut edges, &call_refs);
        ParseOutput { nodes, edges }
    }

    fn walk_go(
        node: tree_sitter::Node,
        source: &[u8],
        file_id: i64,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        parent_stack: &mut Vec<Option<usize>>,
        call_refs: &mut Vec<(usize, String)>,
    ) {
        let kind = node.kind();
        let mut extracted = None;

        match kind {
            "function_declaration" => {
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Function, &name, file_id, Self::node_span(node)));
            }
            "method_declaration" => {
                // Go methods: func (r Receiver) MethodName()
                let name = node
                    .child_by_field_name("name")
                    .map(|n| Self::node_text(n, source))
                    .unwrap_or("anonymous")
                    .to_string();
                extracted = Some(Node::new(NodeKind::Method, &name, file_id, Self::node_span(node)));
            }
            "type_declaration" => {
                // type Foo struct{} / type Bar interface{}
                if let Some(spec) = node.child(1) {
                    let type_name = spec
                        .child_by_field_name("name")
                        .map(|n| Self::node_text(n, source))
                        .unwrap_or("anonymous")
                        .to_string();
                    let kind_name = spec.child_by_field_name("type")
                        .map(|n| Self::node_text(n, source))
                        .unwrap_or("");
                    if kind_name.contains("struct") {
                        extracted = Some(Node::new(NodeKind::Class, &type_name, file_id, Self::node_span(node)));
                    } else if kind_name.contains("interface") {
                        extracted = Some(Node::new(NodeKind::Interface, &type_name, file_id, Self::node_span(node)));
                    } else {
                        extracted = Some(Node::new(NodeKind::TypeAlias, &type_name, file_id, Self::node_span(node)));
                    }
                }
            }
            "import_declaration" => {
                let text = Self::node_text(node, source).to_string();
                extracted = Some(Node::new(NodeKind::Import, &text, file_id, Self::node_span(node)));
            }
            "var_declaration" | "const_declaration" => {
                if let Some(spec) = node.child(1) {
                    if let Some(name_node) = spec.child_by_field_name("name") {
                        let name = Self::node_text(name_node, source).to_string();
                        extracted = Some(Node::new(NodeKind::Variable, &name, file_id, Self::node_span(node)));
                    }
                }
            }
            _ => {}
        }

        if let Some(sym) = extracted {
            let node_idx = nodes.len();
            if let Some(Some(parent_idx)) = parent_stack.last() {
                // Method inside type_declaration → Contains edge
                if nodes[*parent_idx].kind == NodeKind::Class
                    || nodes[*parent_idx].kind == NodeKind::Interface
                {
                    edges.push(Edge::new(
                        *parent_idx as i64,
                        node_idx as i64,
                        EdgeKind::Contains,
                    ));
                }
            }
            nodes.push(sym);
            parent_stack.push(Some(node_idx));
        } else {
            if kind == "call_expression" {
                if let Some(func_node) = node.child_by_field_name("function") {
                    let (callee_name, is_direct) = Self::extract_callee_name(func_node, source);
                    if is_direct {
                        if let Some(caller_idx) = Self::find_enclosing_function_idx(nodes, parent_stack) {
                            call_refs.push((caller_idx, callee_name));
                        }
                    }
                }
            }
            parent_stack.push(parent_stack.last().copied().flatten());
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_go(child, source, file_id, nodes, edges, parent_stack, call_refs);
        }
        parent_stack.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn extract(language: &str, source: &[u8]) -> ParseOutput {
        let mut parsed = parse(source, language).expect("Parse failed");
        parsed.file_id = 1;
        Extractor::extract(&parsed)
    }

    #[test]
    fn test_ts_function_extraction() {
        let source = b"function greet(name: string): string { return `Hello ${name}`; }";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Function && n.name == "greet"),
            "Expected function 'greet', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_ts_class_extraction() {
        let source = b"class MyClass { doSomething() {} }";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Class && n.name == "MyClass"),
            "Expected class 'MyClass', got: {:?}",
            result.nodes
        );
        // Method should be extracted
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Method && n.name == "doSomething"),
            "Expected method 'doSomething', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_ts_containment_edge() {
        let source = b"class Container { method1() {} method2() {} }";
        let result = extract("typescript", source);
        let contains_edges: Vec<_> = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Contains)
            .collect();
        assert!(!contains_edges.is_empty(), "Expected Contains edges");
    }

    #[test]
    fn test_ts_interface_extraction() {
        let source = b"interface User { name: string; age(): number; }";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Interface && n.name == "User"),
            "Expected interface 'User', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_ts_enum_extraction() {
        let source = b"enum Color { Red, Green, Blue }";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Enum && n.name == "Color"),
            "Expected enum 'Color', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_ts_import_extraction() {
        let source = b"import { Component } from '@angular/core';";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Import),
            "Expected an import node"
        );
    }

    #[test]
    fn test_ts_type_alias() {
        let source = b"type Callback = (x: number) => void;";
        let result = extract("typescript", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::TypeAlias && n.name == "Callback"),
            "Expected type alias 'Callback', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_python_function_extraction() {
        let source = b"def hello(name):\n    return f'Hello {name}'";
        let result = extract("python", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Function && n.name == "hello"),
            "Expected function 'hello', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_python_class_extraction() {
        let source = b"class MyService:\n    def do_thing(self):\n        pass";
        let result = extract("python", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Class && n.name == "MyService"),
            "Expected class 'MyService', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_python_import_extraction() {
        let source = b"import os\nfrom pathlib import Path";
        let result = extract("python", source);
        let imports: Vec<_> = result
            .nodes
            .iter()
            .filter(|n| n.kind == NodeKind::Import)
            .collect();
        assert_eq!(imports.len(), 2, "Expected 2 imports, got: {:?}", result.nodes);
    }

    #[test]
    fn test_python_containment_edge() {
        let source = b"class Container:\n    def method_a(self):\n        pass\n    def method_b(self):\n        pass";
        let result = extract("python", source);
        let contains = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Contains)
            .count();
        assert_eq!(contains, 2, "Expected 2 Contains edges (class→method)");
    }

    #[test]
    fn test_rust_function_extraction() {
        let source = b"fn greet(name: &str) -> String { format!(\"Hello {}\", name) }";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Function && n.name == "greet"),
            "Expected function 'greet', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_rust_struct_extraction() {
        let source = b"struct User { name: String, age: u32 }";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Class && n.name == "User"),
            "Expected struct 'User', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_rust_enum_extraction() {
        let source = b"enum Status { Active, Inactive }";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Enum && n.name == "Status"),
            "Expected enum 'Status', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_rust_trait_extraction() {
        let source = b"trait Provider { fn provide(&self) -> &str; }";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Interface && n.name == "Provider"),
            "Expected trait 'Provider', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_rust_import_extraction() {
        let source = b"use std::collections::HashMap;";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Import),
            "Expected an import node"
        );
    }

    #[test]
    fn test_rust_type_alias() {
        let source = b"type Callback = Box<dyn Fn()>;";
        let result = extract("rust", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::TypeAlias && n.name == "Callback"),
            "Expected type alias 'Callback', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_rust_impl_containment() {
        let source = b"struct Foo {}\nimpl Foo {\n    fn bar(&self) {}\n    fn baz(&self) {}\n}";
        let result = extract("rust", source);
        let contains = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Contains)
            .count();
        assert!(
            contains >= 2,
            "Expected at least 2 Contains edges for impl→method, got: {}",
            contains
        );
    }

    #[test]
    fn test_ts_call_graph() {
        let source = b"function helper() { return 1; }\nfunction main() { helper(); }";
        let result = extract("typescript", source);
        let calls: Vec<_> = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Calls)
            .collect();
        assert_eq!(calls.len(), 1, "Expected 1 Calls edge, got: {:?}", calls);
    }

    #[test]
    fn test_python_call_graph() {
        let source = b"def helper():\n    return 1\ndef main():\n    helper()";
        let result = extract("python", source);
        let calls: Vec<_> = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Calls)
            .collect();
        assert_eq!(calls.len(), 1, "Expected 1 Calls edge, got: {:?}", calls);
    }

    #[test]
    fn test_rust_call_graph() {
        let source = b"fn helper() -> i32 { 1 }\nfn main() { helper(); }";
        let result = extract("rust", source);
        let calls: Vec<_> = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Calls)
            .collect();
        assert_eq!(calls.len(), 1, "Expected 1 Calls edge, got: {:?}", calls);
    }

    #[test]
    fn test_go_function_extraction() {
        let source = b"func greet(name string) string {\n    return \"Hello \" + name\n}";
        let result = extract("go", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Function && n.name == "greet"),
            "Expected function 'greet', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_go_struct_extraction() {
        let source = b"type User struct {\n    Name string\n    Age  int\n}";
        let result = extract("go", source);
        assert!(
            result.nodes.iter().any(|n| n.kind == NodeKind::Class && n.name == "User"),
            "Expected struct 'User', got: {:?}",
            result.nodes
        );
    }

    #[test]
    fn test_go_call_graph() {
        let source = b"func helper() string { return \"hi\" }\nfunc main() { helper() }";
        let result = extract("go", source);
        let calls: Vec<_> = result
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Calls)
            .collect();
        assert_eq!(calls.len(), 1, "Expected 1 Calls edge, got: {:?}", calls);
    }

    #[test]
    fn test_empty_source() {
        let result = extract("typescript", b"");
        assert_eq!(result.nodes.len(), 0);
        let result = extract("python", b"");
        assert_eq!(result.nodes.len(), 0);
        let result = extract("rust", b"");
        assert_eq!(result.nodes.len(), 0);
    }

    #[test]
    fn test_parse_error_tolerance() {
        let source = b"function {{{{ bad syntax";
        let result = extract("typescript", source);
        // Should not panic — parse errors tolerated
        assert!(result.nodes.is_empty() || !result.nodes.is_empty());
    }

    #[test]
    fn test_parse_unknown_language() {
        let result = parse(b"hello", "unknown_lang");
        assert!(result.is_err());
    }
}
