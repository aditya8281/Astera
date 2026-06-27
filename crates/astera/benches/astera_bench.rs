use astera_core::{Edge, EdgeKind, FileInfo, Node, NodeKind, SourceSpan};
use astera_parser::{parse, Extractor};
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};

// ═══════════════════════════════════════════════════════════════
// Fixture generators — realistic code at varying scales
// ═══════════════════════════════════════════════════════════════

/// Small TypeScript file (~100 LOC)
fn ts_small() -> &'static [u8] {
    br#"
import { Router, Request, Response } from 'express';

interface Config {
    port: number;
    host: string;
    dbUrl: string;
}

class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    async getUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const user = await this.userService.findById(id);
        if (!user) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(user);
    }

    async createUser(req: Request, res: Response): Promise<void> {
        const { name, email } = req.body;
        const user = await this.userService.create({ name, email });
        res.status(201).json(user);
    }
}

function createApp(config: Config): Router {
    const router = Router();
    router.get('/users/:id', (req, res) => controller.getUser(req, res));
    router.post('/users', (req, res) => controller.createUser(req, res));
    return router;
}

export default createApp;
"#
}

/// Medium TypeScript file (~1K LOC) — generated dynamically
fn ts_medium() -> String {
    let mut code = String::from(
        "import { Router, Request, Response } from 'express';\n\
         import { Database } from './db';\n\
         import { Logger } from './logger';\n\n\
         interface User { id: number; name: string; email: string; }\n\
         interface CreateUserDto { name: string; email: string; }\n\n",
    );

    for i in 0..50 {
        code.push_str(&format!(
            "export class Service{i} {{\n\
             private db: Database;\n\
             private logger: Logger;\n\
             constructor(db: Database) {{ this.db = db; this.logger = new Logger('svc{i}'); }}\n\
             async findById(id: number): Promise<User | null> {{\n\
                 const q = this.db.prepare('SELECT * FROM users WHERE id = ?');\n\
                 const r = q.get(id);\n\
                 if (!r) {{ this.logger.warn('not found'); return null; }}\n\
                 return r as User;\n\
             }}\n\
             async create(dto: CreateUserDto): Promise<User> {{\n\
                 const u = this.db.prepare('INSERT INTO users').run(dto.name, dto.email);\n\
                 this.logger.info('created');\n\
                 return {{ id: u.lastID as number, ...dto }};\n\
             }}\n\
             async delete(id: number): Promise<void> {{\n\
                 this.db.prepare('DELETE FROM users WHERE id = ?').run(id);\n\
                 this.logger.info('deleted');\n\
             }}\n\
             async listAll(): Promise<User[]> {{\n\
                 return this.db.prepare('SELECT * FROM users').all() as User[];\n\
             }}\n\
             private validateEmail(email: string): boolean {{\n\
                 return /^[^@]+@[^@]+$/.test(email);\n\
             }}\n\
         }}\n\n",
        ));
    }
    code
}

/// Large TypeScript file (~10K LOC) — generated dynamically
fn ts_large() -> String {
    let mut code = String::with_capacity(300_000);
    code.push_str("import { Router } from 'express';\n\n");

    for i in 0..500 {
        code.push_str(&format!(
            "export class Module{i} {{\n\
             private value: number = {i};\n\
             private name: string = 'module{i}';\n\
             private items: string[] = [];\n\
             private cache: Map<string, any> = new Map();\n\n\
             constructor(initial: number) {{ this.value = initial; }}\n\
             process(input: number): number {{\n\
                 if (input > this.value) {{\n\
                     for (let j = 0; j < input; j++) {{\n\
                         this.items.push(String(j));\n\
                     }}\n\
                 }} else {{\n\
                     while (this.items.length > input) {{ this.items.pop(); }}\n\
                 }}\n\
                 return this.value + input;\n\
             }}\n\
             transform(data: any[]): any[] {{\n\
                 return data.filter((d) => d !== null).map((d) => ({{ ...d, module: this.name }}));\n\
             }}\n\
             async fetch(key: string): Promise<any> {{\n\
                 if (this.cache.has(key)) return this.cache.get(key);\n\
                 const result = {{ key, value: this.value }};\n\
                 this.cache.set(key, result);\n\
                 return result;\n\
             }}\n\
             static create(id: number): Module{i} {{ return new Module{i}(id * 10); }}\n\
             private helper1(a: number, b: number): number {{ return a + b; }}\n\
             private helper2(a: number, b: number): number {{ return a * b; }}\n\
             private helper3(x: number): number {{ return x > 0 ? this.helper1(x, 1) : this.helper2(x, -1); }}\n\
         }}\n\n",
            i = i
        ));
    }
    code
}

/// Small Python file (~100 LOC)
fn python_small() -> &'static [u8] {
    br#"
import os
import sys
from typing import List, Optional

class UserService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.cache = {}

    def find_by_id(self, user_id: int) -> Optional[dict]:
        if user_id in self.cache:
            return self.cache[user_id]
        return None

    def create(self, name: str, email: str) -> dict:
        user = {"id": len(self.cache) + 1, "name": name, "email": email}
        self.cache[user["id"]] = user
        return user

    def delete(self, user_id: int) -> bool:
        if user_id in self.cache:
            del self.cache[user_id]
            return True
        return False

def main():
    service = UserService("sqlite://test.db")
    user = service.create("Alice", "alice@example.com")
    print(f"Created user: {user['name']}")

if __name__ == "__main__":
    main()
"#
}

/// Medium Python file (~1K LOC)
fn python_medium() -> String {
    let mut code = String::from(
        "import os\n\
         import sys\n\
         from typing import List, Optional, Dict\n\
         from dataclasses import dataclass\n\n",
    );

    for i in 0..40 {
        code.push_str(&format!(
            "@dataclass\n\
             class Model{i}:\n\
                 id: int\n\
                 name: str\n\
                 value: float\n\
                 active: bool = True\n\n\
             class Service{i}:\n\
                 def __init__(self, db_url: str):\n\
                     self.db_url = db_url\n\
                     self.cache: Dict[int, Model{i}] = {{}}\n\
                     self._counter = 0\n\n\
                 def find_by_id(self, item_id: int) -> Optional[Model{i}]:\n\
                     if item_id in self.cache:\n\
                         return self.cache[item_id]\n\
                     return None\n\n\
                 def create(self, name: str, value: float) -> Model{i}:\n\
                     self._counter += 1\n\
                     model = Model{i}(id=self._counter, name=name, value=value)\n\
                     self.cache[model.id] = model\n\
                     return model\n\n\
                 def delete(self, item_id: int) -> bool:\n\
                     if item_id in self.cache:\n\
                         del self.cache[item_id]\n\
                         return True\n\
                     return False\n\n\
                 def list_all(self) -> List[Model{i}]:\n\
                     return list(self.cache.values())\n\n\
                 def filter_by_active(self) -> List[Model{i}]:\n\
                     return [m for m in self.cache.values() if m.active]\n\n",
            i = i
        ));
    }
    code
}

/// Medium Rust file (~1K LOC)
fn rust_medium() -> String {
    let mut code = String::from(
        "use std::collections::HashMap;\n\
         use std::sync::{Arc, Mutex};\n\n",
    );

    for i in 0..40 {
        code.push_str(&format!(
            "#[derive(Debug, Clone)]\n\
             pub struct Struct{i} {{\n\
                 pub id: u64,\n\
                 pub name: String,\n\
                 pub value: f64,\n\
             }}\n\n\
             pub trait Trait{i} {{\n\
                 fn process(&self, input: &str) -> Result<String, Box<dyn std::error::Error>>;\n\
                 fn validate(&self) -> bool;\n\
             }}\n\n\
             impl Trait{i} for Struct{i} {{\n\
                 fn process(&self, input: &str) -> Result<String, Box<dyn std::error::Error>> {{\n\
                     if input.is_empty() {{ return Err(\"empty input\".into()); }}\n\
                     Ok(format!(\"{{}}:{{}}\", self.name, input))\n\
                 }}\n\
                 fn validate(&self) -> bool {{ !self.name.is_empty() }}\n\
             }}\n\n\
             impl Struct{i} {{\n\
                 pub fn new(id: u64, name: &str) -> Self {{\n\
                     Self {{ id, name: name.to_string(), value: 0.0 }}\n\
                 }}\n\
                 pub fn update_value(&mut self, v: f64) {{ self.value = v; }}\n\
                 pub fn compute(&self) -> f64 {{ self.value * (self.id as f64 + 1.0) }}\n\
             }}\n\n",
            i = i
        ));
    }
    code
}

/// Medium Go file (~1K LOC)
fn go_medium() -> String {
    let mut code = String::from(
        "package main\n\n\
         import (\n\
         \t\"fmt\"\n\
         \t\"sync\"\n\
         \t\"net/http\"\n\
         )\n\n",
    );

    for i in 0..40 {
        code.push_str(&format!(
            "type Struct{i} struct {{\n\
             \tID    int64\n\
             \tName  string\n\
             \tValue float64\n\
             }}\n\n\
             type Interface{i} interface {{\n\
             \tProcess(input string) (string, error)\n\
             \tValidate() bool\n\
             }}\n\n\
             func NewStruct{i}(id int64, name string) *Struct{i} {{\n\
             \treturn &Struct{i}{{ID: id, Name: name, Value: 0.0}}\n\
             }}\n\n\
             func (s *Struct{i}) Process(input string) (string, error) {{\n\
             \tif input == \"\" {{\n\
             \t\treturn \"\", fmt.Errorf(\"empty input\")\n\
             \t}}\n\
             \treturn fmt.Sprintf(\"%s:%s\", s.Name, input), nil\n\
             }}\n\n\
             func (s *Struct{i}) Validate() bool {{\n\
             \treturn s.Name != \"\"\n\
             }}\n\n",
            i = i
        ));
    }
    code
}

// ═══════════════════════════════════════════════════════════════
// Helper: build a synthetic graph for metrics/impact benchmarks
// ═══════════════════════════════════════════════════════════════

fn build_graph(node_count: usize, edges_per_node: usize) -> (Vec<Node>, Vec<Edge>) {
    let nodes: Vec<Node> = (0..node_count)
        .map(|i| {
            let kind = match i % 6 {
                0 => NodeKind::Module,
                1 => NodeKind::Class,
                2 => NodeKind::Function,
                3 => NodeKind::Method,
                4 => NodeKind::Interface,
                _ => NodeKind::Variable,
            };
            Node {
                id: Some(i as i64 + 1),
                kind,
                name: format!("node_{}", i),
                file_id: (i % 5) as i64 + 1,
                span: SourceSpan {
                    start_line: (i * 10) as u32 + 1,
                    start_col: 1,
                    end_line: (i * 10 + 8) as u32,
                    end_col: 1,
                },
                doc_comment: None,
                properties: serde_json::json!({}),
            }
        })
        .collect();

    let mut edges = Vec::new();
    let mut edge_id = 0i64;
    for i in 0..node_count {
        let source = (i as i64) + 1;
        for j in 1..=edges_per_node {
            let target = ((i + j) % node_count) as i64 + 1;
            if source != target {
                let kind = match edge_id % 4 {
                    0 => EdgeKind::Calls,
                    1 => EdgeKind::Contains,
                    2 => EdgeKind::DependsOn,
                    _ => EdgeKind::References,
                };
                edges.push(Edge::new(source, target, kind));
                edge_id += 1;
            }
        }
    }
    (nodes, edges)
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Parsing throughput (per language)
// ═══════════════════════════════════════════════════════════════

fn bench_parse_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse_throughput");

    // TypeScript scales
    let ts_sm = ts_small();
    group.throughput(Throughput::Bytes(ts_sm.len() as u64));
    group.bench_function("typescript_small", |b| {
        b.iter(|| parse(black_box(ts_sm), "typescript").unwrap())
    });

    let ts_md = ts_medium();
    group.throughput(Throughput::Bytes(ts_md.len() as u64));
    group.bench_function("typescript_medium", |b| {
        b.iter(|| parse(black_box(ts_md.as_bytes()), "typescript").unwrap())
    });

    let ts_lg = ts_large();
    group.throughput(Throughput::Bytes(ts_lg.len() as u64));
    group.bench_function("typescript_large", |b| {
        b.iter(|| parse(black_box(ts_lg.as_bytes()), "typescript").unwrap())
    });

    // Python scales
    let py_sm = python_small();
    group.throughput(Throughput::Bytes(py_sm.len() as u64));
    group.bench_function("python_small", |b| {
        b.iter(|| parse(black_box(py_sm), "python").unwrap())
    });

    let py_md = python_medium();
    group.throughput(Throughput::Bytes(py_md.len() as u64));
    group.bench_function("python_medium", |b| {
        b.iter(|| parse(black_box(py_md.as_bytes()), "python").unwrap())
    });

    // Rust
    let rs_md = rust_medium();
    group.throughput(Throughput::Bytes(rs_md.len() as u64));
    group.bench_function("rust_medium", |b| {
        b.iter(|| parse(black_box(rs_md.as_bytes()), "rust").unwrap())
    });

    // Go
    let go_md = go_medium();
    group.throughput(Throughput::Bytes(go_md.len() as u64));
    group.bench_function("go_medium", |b| {
        b.iter(|| parse(black_box(go_md.as_bytes()), "go").unwrap())
    });

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Extraction (parse + extract symbols)
// ═══════════════════════════════════════════════════════════════

fn bench_extraction(c: &mut Criterion) {
    let mut group = c.benchmark_group("extraction");

    let lang_sizes = [
        ("typescript", ts_medium() as String),
        ("python", python_medium()),
        ("rust", rust_medium()),
        ("go", go_medium()),
    ];

    for (lang, code) in &lang_sizes {
        let mut parsed = parse(code.as_bytes(), lang).unwrap();
        parsed.file_id = 1;
        group.throughput(Throughput::Bytes(code.len() as u64));
        group.bench_with_input(BenchmarkId::new("extract", lang), &parsed, |b, p| {
            b.iter(|| Extractor::extract(black_box(p)))
        });
    }

    // Full pipeline: parse + extract
    for (lang, code) in &lang_sizes {
        group.bench_with_input(
            BenchmarkId::new("full_pipeline", lang),
            &code.as_bytes(),
            |b, src| {
                b.iter(|| {
                    let mut parsed = parse(black_box(src), lang).unwrap();
                    parsed.file_id = 1;
                    Extractor::extract(&parsed)
                })
            },
        );
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Storage — insert, query, search
// ═══════════════════════════════════════════════════════════════

fn bench_storage(c: &mut Criterion) {
    use astera_storage::Database;

    let mut group = c.benchmark_group("storage");

    // ── Insert benchmarks at various scales ──
    for count in [100, 500, 1000, 5000] {
        let nodes: Vec<Node> = (0..count)
            .map(|i| {
                Node::new(
                    NodeKind::Function,
                    &format!("function_{}", i),
                    1,
                    SourceSpan {
                        start_line: i as u32,
                        start_col: 0,
                        end_line: i as u32 + 10,
                        end_col: 0,
                    },
                )
            })
            .collect();

        group.throughput(Throughput::Elements(count as u64));
        group.bench_with_input(
            BenchmarkId::new("insert_nodes", count),
            &nodes,
            |b, nodes| {
                b.iter_batched(
                    || {
                        let db = Database::in_memory().unwrap();
                        let file = FileInfo {
                            id: None,
                            repo_root: ".".into(),
                            relative_path: "test.rs".into(),
                            language: "rust".into(),
                            hash: "abc".into(),
                            size: 100,
                            line_count: 10,
                            indexed_at: None,
                            last_modified: "".into(),
                        };
                        let _fid = db.insert_file(&file).unwrap();
                        db
                    },
                    |db| {
                        db.insert_nodes(nodes).unwrap();
                    },
                    criterion::BatchSize::SmallInput,
                )
            },
        );
    }

    // ── Edge insert benchmark ──
    {
        let edges: Vec<Edge> = (0..2000)
            .map(|i| {
                Edge::new(
                    (i % 500) as i64 + 1,
                    ((i + 1) % 500) as i64 + 1,
                    EdgeKind::Calls,
                )
            })
            .collect();

        group.bench_function("insert_2000_edges", |b| {
            b.iter_batched(
                || {
                    let db = Database::in_memory().unwrap();
                    let file = FileInfo {
                        id: None,
                        repo_root: ".".into(),
                        relative_path: "test.rs".into(),
                        language: "rust".into(),
                        hash: "abc".into(),
                        size: 100,
                        line_count: 10,
                        indexed_at: None,
                        last_modified: "".into(),
                    };
                    let fid = db.insert_file(&file).unwrap();
                    let nodes: Vec<Node> = (0..500)
                        .map(|i| {
                            Node::new(
                                NodeKind::Function,
                                &format!("fn_{}", i),
                                fid,
                                SourceSpan {
                                    start_line: i as u32,
                                    start_col: 0,
                                    end_line: i as u32 + 5,
                                    end_col: 0,
                                },
                            )
                        })
                        .collect();
                    db.insert_nodes(&nodes).unwrap();
                    db
                },
                |db| {
                    db.insert_edges(&edges).unwrap();
                },
                criterion::BatchSize::SmallInput,
            )
        });
    }

    // ── Query benchmarks ──
    {
        let db = Database::in_memory().unwrap();
        let file = FileInfo {
            id: None,
            repo_root: ".".into(),
            relative_path: "test.rs".into(),
            language: "rust".into(),
            hash: "abc".into(),
            size: 100,
            line_count: 10,
            indexed_at: None,
            last_modified: "".into(),
        };
        let fid = db.insert_file(&file).unwrap();

        let nodes: Vec<Node> = (0..2000)
            .map(|i| {
                let kind = match i % 6 {
                    0 => NodeKind::Function,
                    1 => NodeKind::Class,
                    2 => NodeKind::Variable,
                    3 => NodeKind::Import,
                    4 => NodeKind::Method,
                    _ => NodeKind::Interface,
                };
                Node::new(
                    kind,
                    &format!("symbol_{}", i),
                    fid,
                    SourceSpan {
                        start_line: i as u32,
                        start_col: 0,
                        end_line: i as u32 + 5,
                        end_col: 0,
                    },
                )
            })
            .collect();
        db.insert_nodes(&nodes).unwrap();

        // Query all
        group.bench_function("query_all_2000", |b| {
            b.iter(|| db.query_nodes(None, None, None).unwrap())
        });

        // Query by kind
        group.bench_function("query_by_kind_function", |b| {
            b.iter(|| db.query_nodes(Some("Function"), None, None).unwrap())
        });

        // Search FTS5
        group.bench_function("search_fts5_symbol_42", |b| {
            b.iter(|| db.search_nodes("symbol_42").unwrap())
        });

        // Symbol count
        group.bench_function("symbol_count", |b| b.iter(|| db.symbol_count().unwrap()));

        // Edge count
        group.bench_function("edge_count", |b| b.iter(|| db.edge_count().unwrap()));

        // Get children of
        group.bench_function("get_children_of", |b| {
            b.iter(|| db.get_children_of(1).unwrap())
        });

        // List files
        group.bench_function("list_files", |b| b.iter(|| db.list_files().unwrap()));
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Metrics computation
// ═══════════════════════════════════════════════════════════════

fn bench_metrics(c: &mut Criterion) {
    use astera_metrics::{compute_importance, compute_metrics};

    let mut group = c.benchmark_group("metrics");

    for size in [100, 500, 1000, 5000] {
        let (nodes, edges) = build_graph(size, 3);

        group.throughput(Throughput::Elements(size as u64));
        group.bench_with_input(
            BenchmarkId::new("compute_metrics", size),
            &(&nodes, &edges),
            |b, (n, e)| b.iter(|| compute_metrics(black_box(n), black_box(e))),
        );

        group.bench_with_input(
            BenchmarkId::new("compute_importance", size),
            &(&nodes, &edges),
            |b, (n, e)| b.iter(|| compute_importance(black_box(n), black_box(e))),
        );
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Impact analysis (BFS transitive closure)
// ═══════════════════════════════════════════════════════════════

fn bench_impact(c: &mut Criterion) {
    use astera_impact::ImpactAnalyzer;

    let mut group = c.benchmark_group("impact_analysis");

    for size in [100, 500, 1000, 5000] {
        let (nodes, edges) = build_graph(size, 3);
        let analyzer = ImpactAnalyzer::new(&nodes, &edges);

        group.throughput(Throughput::Elements(size as u64));

        // Forward impact
        group.bench_with_input(
            BenchmarkId::new("forward_impact", size),
            &analyzer,
            |b, a| b.iter(|| a.impact_analysis(black_box(1), None)),
        );

        // Reverse impact
        group.bench_with_input(
            BenchmarkId::new("reverse_impact", size),
            &analyzer,
            |b, a| b.iter(|| a.reverse_impact(black_box(1), None)),
        );

        // Impact with depth limit
        group.bench_with_input(
            BenchmarkId::new("impact_depth_3", size),
            &analyzer,
            |b, a| b.iter(|| a.impact_analysis(black_box(1), Some(3))),
        );

        // Critical path
        if size >= 4 {
            group.bench_with_input(
                BenchmarkId::new("critical_path", size),
                &analyzer,
                |b, a| b.iter(|| a.critical_path(black_box(1), black_box(size as i64))),
            );
        }
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Discovery utilities
// ═══════════════════════════════════════════════════════════════

fn bench_discovery(c: &mut Criterion) {
    use astera_discovery::{classify_language, compute_hash, count_lines};
    use std::path::Path;

    let mut group = c.benchmark_group("discovery");

    // Hash computation at various sizes
    for (label, size) in [("1KB", 1024), ("64KB", 65536), ("1MB", 1048576)] {
        let data: Vec<u8> = (0..size).map(|i| (i % 256) as u8).collect();
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::new("sha256_hash", label), &data, |b, d| {
            b.iter(|| compute_hash(black_box(d)))
        });
    }

    // Line counting
    {
        let line_data: Vec<u8> = "fn main() {}\n".repeat(10000).into_bytes();
        group.throughput(Throughput::Bytes(line_data.len() as u64));
        group.bench_function("count_lines_10k", |b| {
            b.iter(|| count_lines(black_box(&line_data)))
        });
    }

    // Language classification
    let test_paths = [
        ("typescript", "src/main.ts"),
        ("python", "lib/utils.py"),
        ("rust", "src/lib.rs"),
        ("go", "cmd/server.go"),
        ("javascript", "web/app.js"),
        ("tsx", "components/App.tsx"),
        ("unknown", "README.md"),
    ];

    for (expected, path) in &test_paths {
        group.bench_with_input(
            BenchmarkId::new("classify_language", expected),
            &path,
            |b, p| b.iter(|| classify_language(black_box(Path::new(p)))),
        );
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: End-to-end pipeline (parse → extract → store)
// ═══════════════════════════════════════════════════════════════

fn bench_end_to_end(c: &mut Criterion) {
    use astera_storage::Database;

    let mut group = c.benchmark_group("end_to_end");

    // Full pipeline at medium scale
    let lang_code = [
        ("typescript", ts_medium() as String),
        ("python", python_medium()),
        ("rust", rust_medium()),
        ("go", go_medium()),
    ];

    for (lang, code) in &lang_code {
        group.throughput(Throughput::Bytes(code.len() as u64));
        group.bench_with_input(
            BenchmarkId::new("parse_extract_store", lang),
            &code.as_bytes(),
            |b, src| {
                b.iter_batched(
                    || Database::in_memory().unwrap(),
                    |db| {
                        // Store a file
                        let file = FileInfo {
                            id: None,
                            repo_root: ".".into(),
                            relative_path: format!("test.{}", lang),
                            language: lang.to_string(),
                            hash: "bench".into(),
                            size: src.len() as u64,
                            line_count: src.iter().filter(|&&b| b == b'\n').count() as u64,
                            indexed_at: None,
                            last_modified: "".into(),
                        };
                        let fid = db.insert_file(&file).unwrap();

                        // Parse + extract
                        let mut parsed = parse(src, lang).unwrap();
                        parsed.file_id = fid;
                        let output = Extractor::extract(&parsed);

                        // Store nodes + edges
                        if !output.nodes.is_empty() {
                            db.insert_nodes(&output.nodes).unwrap();
                        }
                        if !output.edges.is_empty() {
                            db.insert_edges(&output.edges).unwrap();
                        }
                    },
                    criterion::BatchSize::SmallInput,
                )
            },
        );
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Scalability curve (varying graph sizes)
// ═══════════════════════════════════════════════════════════════

fn bench_scalability(c: &mut Criterion) {
    use astera_impact::ImpactAnalyzer;
    use astera_metrics::{compute_importance, compute_metrics};

    let mut group = c.benchmark_group("scalability");

    for size in [50, 200, 1000, 5000, 10000] {
        let (nodes, edges) = build_graph(size, 2);
        group.throughput(Throughput::Elements(size as u64));

        // Impact at scale
        {
            let analyzer = ImpactAnalyzer::new(&nodes, &edges);
            group.bench_with_input(
                BenchmarkId::new("impact_forward", size),
                &analyzer,
                |b, a| b.iter(|| a.impact_analysis(black_box(1), None)),
            );
        }

        // Metrics at scale
        group.bench_with_input(
            BenchmarkId::new("metrics_full", size),
            &(&nodes, &edges),
            |b, (n, e)| b.iter(|| compute_metrics(black_box(n), black_box(e))),
        );

        // Importance at scale
        group.bench_with_input(
            BenchmarkId::new("importance", size),
            &(&nodes, &edges),
            |b, (n, e)| b.iter(|| compute_importance(black_box(n), black_box(e))),
        );
    }

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Parsing edge cases
// ═══════════════════════════════════════════════════════════════

fn bench_parse_edge_cases(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse_edge_cases");

    // Empty file
    group.bench_function("empty_file", |b| {
        b.iter(|| parse(black_box(b""), "typescript").unwrap())
    });

    // Minimal valid file
    group.bench_function("minimal_ts", |b| {
        b.iter(|| parse(black_box(b"export {};"), "typescript").unwrap())
    });

    // Malformed source (error tolerance)
    group.bench_function("malformed_ts", |b| {
        let src = b"function {{{{ bad syntax if else while for return";
        b.iter(|| parse(black_box(src), "typescript").unwrap())
    });

    // Deeply nested code
    let deeply_nested = "if (a) {\n".repeat(200) + &"}\n".repeat(200);
    group.throughput(Throughput::Bytes(deeply_nested.len() as u64));
    group.bench_function("deeply_nested", |b| {
        b.iter(|| parse(black_box(deeply_nested.as_bytes()), "typescript").unwrap())
    });

    // Very long single line
    let long_line = "const x = ".to_owned() + &"+ ".repeat(10000) + "1;\n";
    group.throughput(Throughput::Bytes(long_line.len() as u64));
    group.bench_function("very_long_line", |b| {
        b.iter(|| parse(black_box(long_line.as_bytes()), "typescript").unwrap())
    });

    // Unicode-heavy source
    let unicode_src =
        "// 日本語コメント\nfunction 名前(パラメータ: string): string { return 'テスト'; }\n";
    group.bench_function("unicode_source", |b| {
        b.iter(|| parse(black_box(unicode_src.as_bytes()), "typescript").unwrap())
    });

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: Storage — concurrent reads simulation
// ═══════════════════════════════════════════════════════════════

fn bench_concurrent_storage(c: &mut Criterion) {
    use astera_storage::Database;

    let mut group = c.benchmark_group("concurrent_storage");

    // Pre-populated database with 5000 nodes
    let db = Database::in_memory().unwrap();
    let file = FileInfo {
        id: None,
        repo_root: ".".into(),
        relative_path: "test.rs".into(),
        language: "rust".into(),
        hash: "abc".into(),
        size: 100,
        line_count: 10,
        indexed_at: None,
        last_modified: "".into(),
    };
    let fid = db.insert_file(&file).unwrap();
    let nodes: Vec<Node> = (0..5000)
        .map(|i| {
            Node::new(
                NodeKind::Function,
                &format!("func_{}", i),
                fid,
                SourceSpan {
                    start_line: i as u32,
                    start_col: 0,
                    end_line: i as u32 + 5,
                    end_col: 0,
                },
            )
        })
        .collect();
    db.insert_nodes(&nodes).unwrap();

    // Sequential reads (baseline)
    group.bench_function("sequential_reads_50", |b| {
        b.iter(|| {
            for i in 0..50 {
                black_box(db.query_nodes(None, None, Some(i)).unwrap());
            }
        })
    });

    // Multiple queries in sequence
    group.bench_function("mixed_queries_10", |b| {
        b.iter(|| {
            black_box(db.query_nodes(None, None, None).unwrap());
            black_box(db.query_nodes(Some("Function"), None, None).unwrap());
            black_box(db.symbol_count().unwrap());
            black_box(db.search_nodes("func_100").unwrap());
            black_box(db.list_files().unwrap());
        })
    });

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK GROUP: API response simulation
// ═══════════════════════════════════════════════════════════════

fn bench_api_simulation(c: &mut Criterion) {
    use astera_storage::Database;

    let mut group = c.benchmark_group("api_simulation");

    // Simulate the cost of building API responses (DB query + JSON serialization)
    let db = Database::in_memory().unwrap();
    let file = FileInfo {
        id: None,
        repo_root: ".".into(),
        relative_path: "test.rs".into(),
        language: "rust".into(),
        hash: "abc".into(),
        size: 100,
        line_count: 10,
        indexed_at: None,
        last_modified: "".into(),
    };
    let fid = db.insert_file(&file).unwrap();

    let nodes: Vec<Node> = (0..3000)
        .map(|i| {
            let kind = match i % 6 {
                0 => NodeKind::Function,
                1 => NodeKind::Class,
                2 => NodeKind::Variable,
                3 => NodeKind::Import,
                4 => NodeKind::Method,
                _ => NodeKind::Interface,
            };
            Node::new(
                kind,
                &format!("sym_{}", i),
                fid,
                SourceSpan {
                    start_line: i as u32,
                    start_col: 0,
                    end_line: i as u32 + 5,
                    end_col: 0,
                },
            )
        })
        .collect();
    db.insert_nodes(&nodes).unwrap();

    // Simulate /api/symbols endpoint
    group.bench_function("api_symbols_json", |b| {
        b.iter(|| {
            let nodes = db.query_nodes(None, None, None).unwrap();
            let json = serde_json::to_string(&nodes).unwrap();
            black_box(json);
        })
    });

    // Simulate /api/symbols?q=search endpoint
    group.bench_function("api_search_json", |b| {
        b.iter(|| {
            let results = db.search_nodes("sym_1").unwrap();
            let json = serde_json::to_string(&results).unwrap();
            black_box(json);
        })
    });

    // Simulate /api/stats endpoint
    group.bench_function("api_stats", |b| {
        b.iter(|| {
            black_box(db.file_count().unwrap());
            black_box(db.symbol_count().unwrap());
            black_box(db.edge_count().unwrap());
        })
    });

    group.finish();
}

// ═══════════════════════════════════════════════════════════════
// Criterion group registration
// ═══════════════════════════════════════════════════════════════

criterion_group!(
    benches,
    bench_parse_throughput,
    bench_extraction,
    bench_storage,
    bench_metrics,
    bench_impact,
    bench_discovery,
    bench_end_to_end,
    bench_scalability,
    bench_parse_edge_cases,
    bench_concurrent_storage,
    bench_api_simulation,
);

criterion_main!(benches);
