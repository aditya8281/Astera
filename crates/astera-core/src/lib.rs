use serde::{Deserialize, Serialize};
use std::fmt;

/// Span of source code (1-indexed lines and columns)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SourceSpan {
    pub start_line: u32,
    pub start_col: u32,
    pub end_line: u32,
    pub end_col: u32,
}

impl SourceSpan {
    pub fn contains(&self, line: u32, col: u32) -> bool {
        // Zero-length span (empty range) contains nothing
        if self.start_line == self.end_line && self.start_col == self.end_col {
            return false;
        }
        (line > self.start_line || (line == self.start_line && col >= self.start_col))
            && (line < self.end_line || (line == self.end_line && col <= self.end_col))
    }
}

/// File information discovered during walk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub id: Option<i64>,
    pub repo_root: String,
    pub relative_path: String,
    pub language: String,
    pub hash: String,
    pub size: u64,
    pub line_count: u64,
    pub indexed_at: Option<String>,
    pub last_modified: String,
}

/// Node kind in the Code Property Graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum NodeKind {
    File,
    Module,
    Function,
    Class,
    Method,
    Interface,
    Enum,
    Variable,
    Field,
    Parameter,
    TypeAlias,
    Import,
    Macro,
    Anonymous,
}

impl NodeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            NodeKind::File => "File",
            NodeKind::Module => "Module",
            NodeKind::Function => "Function",
            NodeKind::Class => "Class",
            NodeKind::Method => "Method",
            NodeKind::Interface => "Interface",
            NodeKind::Enum => "Enum",
            NodeKind::Variable => "Variable",
            NodeKind::Field => "Field",
            NodeKind::Parameter => "Parameter",
            NodeKind::TypeAlias => "TypeAlias",
            NodeKind::Import => "Import",
            NodeKind::Macro => "Macro",
            NodeKind::Anonymous => "Anonymous",
        }
    }

    pub fn parse_from_str(s: &str) -> Option<Self> {
        match s {
            "File" => Some(NodeKind::File),
            "Module" => Some(NodeKind::Module),
            "Function" => Some(NodeKind::Function),
            "Class" => Some(NodeKind::Class),
            "Method" => Some(NodeKind::Method),
            "Interface" => Some(NodeKind::Interface),
            "Enum" => Some(NodeKind::Enum),
            "Variable" => Some(NodeKind::Variable),
            "Field" => Some(NodeKind::Field),
            "Parameter" => Some(NodeKind::Parameter),
            "TypeAlias" => Some(NodeKind::TypeAlias),
            "Import" => Some(NodeKind::Import),
            "Macro" => Some(NodeKind::Macro),
            "Anonymous" => Some(NodeKind::Anonymous),
            _ => None,
        }
    }
}

impl fmt::Display for NodeKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Edge kind in the Code Property Graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EdgeKind {
    Contains,
    Calls,
    References,
    Defines,
    Inherits,
    Implements,
    Overrides,
    Imports,
    Exports,
    DependsOn,
    Declares,
    Next,
}

impl EdgeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            EdgeKind::Contains => "Contains",
            EdgeKind::Calls => "Calls",
            EdgeKind::References => "References",
            EdgeKind::Defines => "Defines",
            EdgeKind::Inherits => "Inherits",
            EdgeKind::Implements => "Implements",
            EdgeKind::Overrides => "Overrides",
            EdgeKind::Imports => "Imports",
            EdgeKind::Exports => "Exports",
            EdgeKind::DependsOn => "DependsOn",
            EdgeKind::Declares => "Declares",
            EdgeKind::Next => "Next",
        }
    }

    pub fn parse_from_str(s: &str) -> Option<Self> {
        match s {
            "Contains" => Some(EdgeKind::Contains),
            "Calls" => Some(EdgeKind::Calls),
            "References" => Some(EdgeKind::References),
            "Defines" => Some(EdgeKind::Defines),
            "Inherits" => Some(EdgeKind::Inherits),
            "Implements" => Some(EdgeKind::Implements),
            "Overrides" => Some(EdgeKind::Overrides),
            "Imports" => Some(EdgeKind::Imports),
            "Exports" => Some(EdgeKind::Exports),
            "DependsOn" => Some(EdgeKind::DependsOn),
            "Declares" => Some(EdgeKind::Declares),
            "Next" => Some(EdgeKind::Next),
            _ => None,
        }
    }
}

impl fmt::Display for EdgeKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// A symbol node in the CPG
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: Option<i64>,
    pub kind: NodeKind,
    pub name: String,
    pub file_id: i64,
    pub span: SourceSpan,
    pub doc_comment: Option<String>,
    pub properties: serde_json::Value,
}

impl Node {
    pub fn new(kind: NodeKind, name: &str, file_id: i64, span: SourceSpan) -> Self {
        Node {
            id: None,
            kind,
            name: name.to_string(),
            file_id,
            span,
            doc_comment: None,
            properties: serde_json::Value::Object(Default::default()),
        }
    }

    pub fn with_properties(mut self, props: serde_json::Value) -> Self {
        self.properties = props;
        self
    }

    pub fn with_doc_comment(mut self, doc: Option<String>) -> Self {
        self.doc_comment = doc;
        self
    }
}

/// An edge in the CPG
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub id: Option<i64>,
    pub source_node_id: i64,
    pub target_node_id: i64,
    pub kind: EdgeKind,
    pub file_id: Option<i64>,
    pub properties: serde_json::Value,
}

impl Edge {
    pub fn new(source: i64, target: i64, kind: EdgeKind) -> Self {
        Edge {
            id: None,
            source_node_id: source,
            target_node_id: target,
            kind,
            file_id: None,
            properties: serde_json::Value::Object(Default::default()),
        }
    }
}

/// Result of parsing a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub file_id: i64,
    pub file_path: String,
    pub language: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

/// Kind of broken reference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BrokenRefKind {
    /// Function/method called but never defined in the codebase
    UnresolvedCall,
    /// Import referencing a file or symbol that doesn't exist
    DeadImport,
    /// Variable/identifier referenced but no definition found
    UnresolvedRef,
}

impl BrokenRefKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            BrokenRefKind::UnresolvedCall => "UnresolvedCall",
            BrokenRefKind::DeadImport => "DeadImport",
            BrokenRefKind::UnresolvedRef => "UnresolvedRef",
        }
    }
}

impl fmt::Display for BrokenRefKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// A broken/unresolved reference detected during analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnresolvedRef {
    pub id: Option<i64>,
    /// Node ID of the reference site (the caller/importer)
    pub source_node_id: i64,
    /// Name that was referenced but not resolved
    pub ref_name: String,
    /// File where the broken reference lives
    pub file_id: i64,
    /// Line number of the reference
    pub line: u32,
    /// Kind of broken reference
    pub kind: BrokenRefKind,
    /// Optional: the target name from the import/call (may differ from ref_name)
    pub target_name: Option<String>,
}

/// Report from a successful index operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexReport {
    pub repo_root: String,
    pub total_files: u64,
    pub known_language_files: u64,
    pub indexed_files: u64,
    pub total_symbols: u64,
    pub total_edges: u64,
    pub elapsed_ms: u64,
}

/// Config for Astera
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsteraConfig {
    pub repo_root: String,
    pub exclude_patterns: Vec<String>,
    pub languages: Vec<String>,
    pub db_path: Option<String>,
    /// Multiple repos for workspace mode
    #[serde(default)]
    pub repos: Vec<RepoConfig>,
    /// Architecture rules for validation
    #[serde(default)]
    pub rules: Vec<ArchitectureRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoConfig {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
    #[serde(default)]
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureRule {
    /// Unique rule name
    pub name: String,
    /// Human-readable description
    #[serde(default)]
    pub description: String,
    /// Layer name (e.g., "ui", "service", "storage")
    pub layer: String,
    /// Layers this layer is allowed to depend on
    pub allowed_dependencies: Vec<String>,
    /// Glob patterns matching files in this layer (e.g., "src/ui/**")
    pub patterns: Vec<String>,
}

/// Workspace configuration for multi-repo support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    /// Workspace name
    pub name: String,
    /// Repositories in this workspace
    pub repos: Vec<RepoConfig>,
    /// Shared architecture rules
    #[serde(default)]
    pub rules: Vec<ArchitectureRule>,
}

impl WorkspaceConfig {
    pub fn new(name: &str) -> Self {
        WorkspaceConfig {
            name: name.to_string(),
            repos: vec![],
            rules: vec![],
        }
    }

    pub fn add_repo(&mut self, repo: RepoConfig) {
        if !self.repos.iter().any(|r| r.path == repo.path) {
            self.repos.push(repo);
        }
    }

    pub fn remove_repo(&mut self, path: &str) -> bool {
        let len_before = self.repos.len();
        self.repos.retain(|r| r.path != path);
        self.repos.len() < len_before
    }

    pub fn find_repo(&self, name: &str) -> Option<&RepoConfig> {
        self.repos.iter().find(|r| r.name == name)
    }
}

impl Default for AsteraConfig {
    fn default() -> Self {
        AsteraConfig {
            repo_root: ".".to_string(),
            exclude_patterns: vec![
                ".git".into(),
                "node_modules".into(),
                "target".into(),
                "build".into(),
                "dist".into(),
                ".astera".into(),
            ],
            languages: vec![
                "typescript".into(),
                "javascript".into(),
                "python".into(),
                "rust".into(),
                "go".into(),
                "c".into(),
                "cpp".into(),
                "java".into(),
            ],
            db_path: None,
            repos: vec![],
            rules: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_kind_roundtrip() {
        for kind in &[
            NodeKind::File,
            NodeKind::Function,
            NodeKind::Class,
            NodeKind::Method,
            NodeKind::Interface,
            NodeKind::Enum,
            NodeKind::Variable,
            NodeKind::Import,
        ] {
            assert_eq!(NodeKind::parse_from_str(kind.as_str()), Some(kind.clone()));
        }
    }

    #[test]
    fn test_edge_kind_roundtrip() {
        for kind in &[
            EdgeKind::Contains,
            EdgeKind::Calls,
            EdgeKind::References,
            EdgeKind::Defines,
            EdgeKind::Imports,
            EdgeKind::DependsOn,
        ] {
            assert_eq!(EdgeKind::parse_from_str(kind.as_str()), Some(kind.clone()));
        }
    }

    #[test]
    fn test_span_contains() {
        let span = SourceSpan {
            start_line: 1,
            start_col: 1,
            end_line: 10,
            end_col: 1,
        };
        assert!(span.contains(5, 10));
        assert!(!span.contains(11, 1));
        assert!(!span.contains(0, 1));
    }

    #[test]
    fn test_span_zero_guard() {
        let span = SourceSpan {
            start_line: 5,
            start_col: 3,
            end_line: 5,
            end_col: 3,
        };
        assert!(!span.contains(5, 3)); // zero-length span contains nothing
    }

    #[test]
    fn test_node_builder() {
        let span = SourceSpan {
            start_line: 1,
            start_col: 1,
            end_line: 5,
            end_col: 1,
        };
        let node = Node::new(NodeKind::Function, "hello", 1, span)
            .with_properties(serde_json::json!({"return_type": "void"}));
        assert_eq!(node.name, "hello");
        assert_eq!(node.kind, NodeKind::Function);
        assert_eq!(node.file_id, 1);
        assert_eq!(node.properties["return_type"], "void");
    }

    #[test]
    fn test_default_config() {
        let config = AsteraConfig::default();
        assert!(config.exclude_patterns.contains(&".git".to_string()));
        assert!(config.languages.contains(&"typescript".to_string()));
    }

    #[test]
    fn test_workspace_add_repo() {
        let mut ws = WorkspaceConfig::new("test");
        assert!(ws.repos.is_empty());

        ws.add_repo(RepoConfig {
            name: "frontend".into(),
            path: "/app/frontend".into(),
            exclude_patterns: vec![],
            languages: vec!["typescript".into()],
        });

        assert_eq!(ws.repos.len(), 1);
        assert_eq!(ws.repos[0].name, "frontend");

        // Duplicate path should not be added
        ws.add_repo(RepoConfig {
            name: "frontend2".into(),
            path: "/app/frontend".into(),
            exclude_patterns: vec![],
            languages: vec![],
        });
        assert_eq!(ws.repos.len(), 1);
    }

    #[test]
    fn test_workspace_remove_repo() {
        let mut ws = WorkspaceConfig::new("test");
        ws.add_repo(RepoConfig {
            name: "a".into(),
            path: "/a".into(),
            exclude_patterns: vec![],
            languages: vec![],
        });
        ws.add_repo(RepoConfig {
            name: "b".into(),
            path: "/b".into(),
            exclude_patterns: vec![],
            languages: vec![],
        });

        assert!(ws.remove_repo("/a"));
        assert_eq!(ws.repos.len(), 1);
        assert_eq!(ws.repos[0].name, "b");

        assert!(!ws.remove_repo("/nonexistent"));
        assert_eq!(ws.repos.len(), 1);
    }

    #[test]
    fn test_workspace_find_repo() {
        let mut ws = WorkspaceConfig::new("test");
        ws.add_repo(RepoConfig {
            name: "frontend".into(),
            path: "/app/frontend".into(),
            exclude_patterns: vec![],
            languages: vec![],
        });

        assert!(ws.find_repo("frontend").is_some());
        assert!(ws.find_repo("backend").is_none());
    }

    #[test]
    fn test_workspace_serialization() {
        let mut ws = WorkspaceConfig::new("my-workspace");
        ws.add_repo(RepoConfig {
            name: "frontend".into(),
            path: "/app/frontend".into(),
            exclude_patterns: vec![],
            languages: vec!["typescript".into()],
        });
        ws.rules.push(ArchitectureRule {
            name: "layering".into(),
            description: "UI must not depend on storage".into(),
            layer: "ui".into(),
            allowed_dependencies: vec!["service".into()],
            patterns: vec!["src/ui/**".into()],
        });

        let toml_str = toml::to_string_pretty(&ws).unwrap();
        assert!(toml_str.contains("my-workspace"));
        assert!(toml_str.contains("frontend"));

        let deserialized: WorkspaceConfig = toml::from_str(&toml_str).unwrap();
        assert_eq!(deserialized.name, "my-workspace");
        assert_eq!(deserialized.repos.len(), 1);
        assert_eq!(deserialized.rules.len(), 1);
    }
}
