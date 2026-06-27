use astera_core::{Edge, Node};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMeta {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub kind: PluginKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PluginKind {
    /// Native Rust plugin (loaded via libloading)
    Native,
    /// WebAssembly plugin (loaded via wasmtime)
    Wasm,
    /// Built-in plugin (compiled into the binary)
    BuiltIn,
}

/// Input context provided to a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInput {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub file_count: u64,
    pub symbol_count: u64,
    pub repo_root: String,
}

/// Output produced by a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginOutput {
    /// Plugin name that produced this output
    pub plugin: String,
    /// Custom findings or metrics
    pub findings: Vec<PluginFinding>,
    /// Any additional nodes/edges to add to the graph
    pub additional_nodes: Vec<Node>,
    pub additional_edges: Vec<Edge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginFinding {
    pub severity: FindingSeverity,
    pub message: String,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub symbol: Option<String>,
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FindingSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Trait that all plugins must implement
pub trait Plugin: Send + Sync {
    fn meta(&self) -> PluginMeta;
    fn run(&self, input: &PluginInput) -> anyhow::Result<PluginOutput>;
}

/// Registry that manages loaded plugins
pub struct PluginRegistry {
    plugins: Vec<Box<dyn Plugin>>,
    plugin_dirs: Vec<PathBuf>,
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginRegistry {
    pub fn new() -> Self {
        PluginRegistry {
            plugins: Vec::new(),
            plugin_dirs: Vec::new(),
        }
    }

    pub fn with_plugin_dir(mut self, dir: PathBuf) -> Self {
        self.plugin_dirs.push(dir);
        self
    }

    /// Register a built-in plugin
    pub fn register(&mut self, plugin: Box<dyn Plugin>) {
        let meta = plugin.meta();
        tracing::info!("Registered plugin: {} v{}", meta.name, meta.version);
        self.plugins.push(plugin);
    }

    /// Load native plugins from a directory (.so/.dylib/.dll)
    pub fn load_native_plugins(&mut self, dir: &Path) -> anyhow::Result<()> {
        if !dir.exists() {
            return Ok(());
        }

        let lib_ext = if cfg!(target_os = "macos") {
            "dylib"
        } else if cfg!(target_os = "windows") {
            "dll"
        } else {
            "so"
        };

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().is_some_and(|e| e == lib_ext) {
                match self.load_native_plugin(&path) {
                    Ok(()) => {
                        tracing::info!("Loaded native plugin: {}", path.display());
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load plugin {}: {}", path.display(), e);
                    }
                }
            }
        }

        Ok(())
    }

    /// Load a single native plugin from a shared library
    fn load_native_plugin(&mut self, path: &Path) -> anyhow::Result<()> {
        unsafe {
            let lib = libloading::Library::new(path)?;

            // Look for the plugin registration function
            type RegisterFn = unsafe fn() -> *mut dyn Plugin;
            let register: libloading::Symbol<RegisterFn> = lib.get(b"astera_register_plugin")?;
            let plugin_box = Box::from_raw(register());
            let meta = plugin_box.meta();
            tracing::info!("Loaded native plugin: {} v{}", meta.name, meta.version);
            self.plugins.push(plugin_box);
            // Leak the library handle — the plugin needs to stay loaded
            std::mem::forget(lib);
        }

        Ok(())
    }

    /// Run all registered plugins on the given input
    pub fn run_all(&self, input: &PluginInput) -> Vec<anyhow::Result<PluginOutput>> {
        self.plugins
            .iter()
            .map(|p| {
                tracing::info!("Running plugin: {}", p.meta().name);
                p.run(input)
            })
            .collect()
    }

    /// Get metadata for all registered plugins
    pub fn list_plugins(&self) -> Vec<PluginMeta> {
        self.plugins.iter().map(|p| p.meta()).collect()
    }

    pub fn plugin_count(&self) -> usize {
        self.plugins.len()
    }
}

/// Simple regex-based code pattern checker plugin (built-in)
pub struct PatternCheckerPlugin {
    patterns: Vec<PatternRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternRule {
    pub name: String,
    pub pattern: String,
    pub severity: FindingSeverity,
    pub message: String,
}

impl PatternCheckerPlugin {
    pub fn new(rules: Vec<PatternRule>) -> Self {
        PatternCheckerPlugin { patterns: rules }
    }

    pub fn default_rules() -> Self {
        Self::new(vec![
            PatternRule {
                name: "todo_fixme".into(),
                pattern: "TODO|FIXME|HACK|XXX".into(),
                severity: FindingSeverity::Warning,
                message: "Found TODO/FIXME comment".into(),
            },
            PatternRule {
                name: "console_log".into(),
                pattern: "console.log".into(),
                severity: FindingSeverity::Info,
                message: "console.log found in source".into(),
            },
            PatternRule {
                name: "unwrap_call".into(),
                pattern: ".unwrap()".into(),
                severity: FindingSeverity::Warning,
                message: "Rust unwrap() call — may panic".into(),
            },
            PatternRule {
                name: "unsafe_block".into(),
                pattern: "unsafe".into(),
                severity: FindingSeverity::Warning,
                message: "Rust unsafe block".into(),
            },
            PatternRule {
                name: "empty_catch".into(),
                pattern: "catch".into(),
                severity: FindingSeverity::Error,
                message: "Empty catch block".into(),
            },
        ])
    }
}

impl Plugin for PatternCheckerPlugin {
    fn meta(&self) -> PluginMeta {
        PluginMeta {
            name: "pattern-checker".into(),
            version: "1.0.0".into(),
            description: "Built-in pattern checker for code quality rules".into(),
            author: "Astera".into(),
            kind: PluginKind::BuiltIn,
        }
    }

    fn run(&self, input: &PluginInput) -> anyhow::Result<PluginOutput> {
        let mut findings = Vec::new();

        for rule in &self.patterns {
            // Support pipe-separated alternatives: "TODO|FIXME|HACK|XXX"
            let alternatives: Vec<&str> = rule.pattern.split('|').collect();

            for node in &input.nodes {
                let matched = alternatives.iter().any(|alt| node.name.contains(*alt));
                if matched {
                    findings.push(PluginFinding {
                        severity: rule.severity.clone(),
                        message: format!("{}: {}", rule.message, node.name),
                        file: None,
                        line: Some(node.span.start_line),
                        symbol: Some(node.name.clone()),
                        rule: rule.name.clone(),
                    });
                }
            }
        }

        Ok(PluginOutput {
            plugin: "pattern-checker".into(),
            findings,
            additional_nodes: vec![],
            additional_edges: vec![],
        })
    }
}

/// Metrics summary plugin (built-in) — computes aggregate statistics
pub struct MetricsSummaryPlugin;

impl Plugin for MetricsSummaryPlugin {
    fn meta(&self) -> PluginMeta {
        PluginMeta {
            name: "metrics-summary".into(),
            version: "1.0.0".into(),
            description: "Built-in plugin that computes aggregate code metrics".into(),
            author: "Astera".into(),
            kind: PluginKind::BuiltIn,
        }
    }

    fn run(&self, input: &PluginInput) -> anyhow::Result<PluginOutput> {
        let mut findings = Vec::new();

        // Count by kind
        let mut kind_counts: HashMap<String, u64> = HashMap::new();
        for node in &input.nodes {
            *kind_counts.entry(node.kind.to_string()).or_insert(0) += 1;
        }

        // Compute basic metrics
        let _total_nodes = input.nodes.len() as u64;
        let total_edges = input.edges.len() as u64;
        let files = input.file_count;
        let symbols = input.symbol_count;

        let avg_symbols_per_file = if files > 0 {
            symbols as f64 / files as f64
        } else {
            0.0
        };

        findings.push(PluginFinding {
            severity: FindingSeverity::Info,
            message: format!(
                "Repository summary: {} files, {} symbols, {} edges (avg {:.1} symbols/file)",
                files, symbols, total_edges, avg_symbols_per_file
            ),
            file: None,
            line: None,
            symbol: None,
            rule: "summary".into(),
        });

        // Warn if very high symbol count
        if symbols > 50_000 {
            findings.push(PluginFinding {
                severity: FindingSeverity::Warning,
                message: format!(
                    "High symbol count ({}) — consider splitting large modules",
                    symbols
                ),
                file: None,
                line: None,
                symbol: None,
                rule: "large_codebase".into(),
            });
        }

        // Count function vs method ratio
        let func_count = kind_counts.get("Function").unwrap_or(&0);
        let method_count = kind_counts.get("Method").unwrap_or(&0);
        if *func_count + *method_count > 0 {
            let method_ratio = *method_count as f64 / (*func_count + *method_count) as f64;
            if method_ratio > 0.8 {
                findings.push(PluginFinding {
                    severity: FindingSeverity::Info,
                    message: format!(
                        "High method ratio ({:.0}%) — strongly object-oriented codebase",
                        method_ratio * 100.0
                    ),
                    file: None,
                    line: None,
                    symbol: None,
                    rule: "oop_ratio".into(),
                });
            }
        }

        Ok(PluginOutput {
            plugin: "metrics-summary".into(),
            findings,
            additional_nodes: vec![],
            additional_edges: vec![],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use astera_core::{EdgeKind, NodeKind, SourceSpan};

    fn test_input() -> PluginInput {
        let nodes = vec![
            Node::new(
                NodeKind::Function,
                "hello",
                1,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 5,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Function,
                "TODO_fixme_bar",
                1,
                SourceSpan {
                    start_line: 7,
                    start_col: 1,
                    end_line: 10,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Class,
                "MyClass",
                1,
                SourceSpan {
                    start_line: 12,
                    start_col: 1,
                    end_line: 20,
                    end_col: 1,
                },
            ),
        ];

        let edges = vec![Edge::new(1, 2, EdgeKind::Calls)];

        PluginInput {
            nodes,
            edges,
            file_count: 1,
            symbol_count: 3,
            repo_root: "/test".into(),
        }
    }

    #[test]
    fn test_plugin_registry() {
        let mut registry = PluginRegistry::new();
        assert_eq!(registry.plugin_count(), 0);

        registry.register(Box::new(PatternCheckerPlugin::default_rules()));
        registry.register(Box::new(MetricsSummaryPlugin));

        assert_eq!(registry.plugin_count(), 2);

        let metas = registry.list_plugins();
        assert_eq!(metas.len(), 2);
        assert_eq!(metas[0].name, "pattern-checker");
        assert_eq!(metas[1].name, "metrics-summary");
    }

    #[test]
    fn test_pattern_checker_finds_todo() {
        let plugin = PatternCheckerPlugin::default_rules();
        let input = test_input();
        let output = plugin.run(&input).unwrap();

        // Should find the TODO/FIXME in "TODO_fixme_bar"
        assert!(!output.findings.is_empty());
        assert!(output.findings.iter().any(|f| f.rule == "todo_fixme"));
    }

    #[test]
    fn test_pattern_checker_clean_input() {
        let plugin = PatternCheckerPlugin::default_rules();
        let input = PluginInput {
            nodes: vec![Node::new(
                NodeKind::Function,
                "clean_function",
                1,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 3,
                    end_col: 1,
                },
            )],
            edges: vec![],
            file_count: 1,
            symbol_count: 1,
            repo_root: "/test".into(),
        };

        let output = plugin.run(&input).unwrap();
        assert!(output.findings.is_empty());
    }

    #[test]
    fn test_metrics_summary() {
        let plugin = MetricsSummaryPlugin;
        let input = test_input();
        let output = plugin.run(&input).unwrap();

        assert!(!output.findings.is_empty());
        assert!(output.findings.iter().any(|f| f.rule == "summary"));
    }

    #[test]
    fn test_metrics_summary_high_symbol_count() {
        let plugin = MetricsSummaryPlugin;
        let input = PluginInput {
            nodes: vec![],
            edges: vec![],
            file_count: 100,
            symbol_count: 60_000,
            repo_root: "/test".into(),
        };

        let output = plugin.run(&input).unwrap();
        assert!(output.findings.iter().any(|f| f.rule == "large_codebase"));
    }

    #[test]
    fn test_plugin_output_serialization() {
        let plugin = PatternCheckerPlugin::default_rules();
        let input = test_input();
        let output = plugin.run(&input).unwrap();

        // Verify it serializes/deserializes correctly
        let json = serde_json::to_string(&output).unwrap();
        let deserialized: PluginOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.plugin, output.plugin);
        assert_eq!(deserialized.findings.len(), output.findings.len());
    }

    #[test]
    fn test_metrics_summary_oop_ratio() {
        let plugin = MetricsSummaryPlugin;
        let nodes = vec![
            Node::new(
                NodeKind::Method,
                "m1",
                1,
                SourceSpan {
                    start_line: 1,
                    start_col: 1,
                    end_line: 2,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Method,
                "m2",
                1,
                SourceSpan {
                    start_line: 3,
                    start_col: 1,
                    end_line: 4,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Method,
                "m3",
                1,
                SourceSpan {
                    start_line: 5,
                    start_col: 1,
                    end_line: 6,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Method,
                "m4",
                1,
                SourceSpan {
                    start_line: 7,
                    start_col: 1,
                    end_line: 8,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Method,
                "m5",
                1,
                SourceSpan {
                    start_line: 9,
                    start_col: 1,
                    end_line: 10,
                    end_col: 1,
                },
            ),
            Node::new(
                NodeKind::Function,
                "f1",
                1,
                SourceSpan {
                    start_line: 11,
                    start_col: 1,
                    end_line: 12,
                    end_col: 1,
                },
            ),
        ];

        let input = PluginInput {
            nodes,
            edges: vec![],
            file_count: 1,
            symbol_count: 6,
            repo_root: "/test".into(),
        };

        let output = plugin.run(&input).unwrap();
        assert!(output.findings.iter().any(|f| f.rule == "oop_ratio"));
    }
}
