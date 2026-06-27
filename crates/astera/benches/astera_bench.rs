use criterion::{criterion_group, criterion_main, Criterion};
use astera_core::{Node, NodeKind, SourceSpan, FileInfo};
use astera_parser::{parse, Extractor};

fn bench_parse_typescript(c: &mut Criterion) {
    let source = r#"
import { Router, Request, Response } from 'express';
import { UserService } from './userService';
import { Logger } from '../utils/logger';

interface Config {
    port: number;
    host: string;
    dbUrl: string;
}

interface Middleware {
    name: string;
    handler: (req: Request, res: Response, next: () => void) => void;
}

class UserController {
    private userService: UserService;
    private logger: Logger;

    constructor(userService: UserService, logger: Logger) {
        this.userService = userService;
        this.logger = logger;
    }

    async getUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        this.logger.info(`Fetching user ${id}`);
        const user = await this.userService.findById(id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }

    async createUser(req: Request, res: Response): Promise<void> {
        const { name, email } = req.body;
        const user = await this.userService.create({ name, email });
        this.logger.info(`Created user ${user.id}`);
        res.status(201).json(user);
    }

    async deleteUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        await this.userService.delete(id);
        res.status(204).send();
    }
}

class UserService {
    private db: Database;
    private cache: Map<string, User>;

    constructor(db: Database) {
        this.db = db;
        this.cache = new Map();
    }

    async findById(id: string): Promise<User | null> {
        if (this.cache.has(id)) return this.cache.get(id)!;
        const user = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (user) this.cache.set(id, user);
        return user;
    }

    async create(data: CreateUserDto): Promise<User> {
        const user = await this.db.insert('users', data);
        this.cache.set(user.id, user);
        return user;
    }

    async delete(id: string): Promise<void> {
        await this.db.delete('users', id);
        this.cache.delete(id);
    }
}

export function createApp(config: Config): Router {
    const db = new Database(config.dbUrl);
    const logger = new Logger('app');
    const userService = new UserService(db);
    const controller = new UserController(userService, logger);

    const router = Router();
    router.get('/users/:id', (req, res) => controller.getUser(req, res));
    router.post('/users', (req, res) => controller.createUser(req, res));
    router.delete('/users/:id', (req, res) => controller.deleteUser(req, res));

    logger.info(`Server starting on ${config.host}:${config.port}`);
    return router;
}

export default createApp;
"#;

    c.bench_function("parse_typescript", |b| {
        b.iter(|| {
            parse(source.as_bytes(), "typescript").unwrap()
        })
    });
}

fn bench_parse_python(c: &mut Criterion) {
    let source = r#"
import os
import sys
from typing import List, Optional, Dict
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Config:
    port: int = 8080
    host: str = "localhost"
    debug: bool = False
    db_url: str = ""

@dataclass
class User:
    id: int
    name: str
    email: str
    role: str = "user"

class UserService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.cache: Dict[int, User] = {}

    def find_by_id(self, user_id: int) -> Optional[User]:
        if user_id in self.cache:
            return self.cache[user_id]
        user = self._query_db(user_id)
        if user:
            self.cache[user_id] = user
        return user

    def create(self, name: str, email: str, role: str = "user") -> User:
        user = User(id=self._next_id(), name=name, email=email, role=role)
        self._insert_db(user)
        self.cache[user.id] = user
        return user

    def delete(self, user_id: int) -> bool:
        if user_id in self.cache:
            del self.cache[user_id]
        return self._delete_db(user_id)

    def list_all(self) -> List[User]:
        return list(self.cache.values())

    def _query_db(self, user_id: int) -> Optional[User]:
        pass

    def _insert_db(self, user: User) -> None:
        pass

    def _delete_db(self, user_id: int) -> bool:
        pass

    def _next_id(self) -> int:
        return max(self.cache.keys(), default=0) + 1

class Logger:
    def __init__(self, name: str):
        self.name = name

    def info(self, message: str) -> None:
        print(f"[INFO] {self.name}: {message}")

    def error(self, message: str) -> None:
        print(f"[ERROR] {self.name}: {message}", file=sys.stderr)

def create_app(config: Config) -> None:
    logger = Logger("app")
    service = UserService(config.db_url)
    logger.info(f"Starting server on {config.host}:{config.port}")
"#;

    c.bench_function("parse_python", |b| {
        b.iter(|| {
            parse(source.as_bytes(), "python").unwrap()
        })
    });
}

fn bench_parse_rust(c: &mut Criterion) {
    let source = r#"
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct Config {
    pub port: u16,
    pub host: String,
    pub db_url: String,
    pub debug: bool,
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: String,
    pub role: String,
}

pub trait UserRepository: Send + Sync {
    fn find_by_id(&self, id: u64) -> Result<Option<User>, Box<dyn std::error::Error>>;
    fn insert(&self, user: &User) -> Result<(), Box<dyn std::error::Error>>;
    fn delete(&self, id: u64) -> Result<bool, Box<dyn std::error::Error>>;
    fn list_all(&self) -> Result<Vec<User>, Box<dyn std::error::Error>>;
}

pub struct UserService {
    repo: Arc<dyn UserRepository>,
    cache: Mutex<HashMap<u64, User>>,
}

impl UserService {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self {
            repo,
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn find_by_id(&self, id: u64) -> Result<Option<User>, Box<dyn std::error::Error>> {
        {
            let cache = self.cache.lock().unwrap();
            if let Some(user) = cache.get(&id) {
                return Ok(Some(user.clone()));
            }
        }
        let user = self.repo.find_by_id(id)?;
        if let Some(ref u) = user {
            let mut cache = self.cache.lock().unwrap();
            cache.insert(u.id, u.clone());
        }
        Ok(user)
    }

    pub fn create(&self, name: &str, email: &str) -> Result<User, Box<dyn std::error::Error>> {
        let user = User {
            id: self.next_id(),
            name: name.to_string(),
            email: email.to_string(),
            role: "user".to_string(),
        };
        self.repo.insert(&user)?;
        let mut cache = self.cache.lock().unwrap();
        cache.insert(user.id, user.clone());
        Ok(user)
    }

    pub fn delete(&self, id: u64) -> Result<bool, Box<dyn std::error::Error>> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.remove(&id);
        }
        self.repo.delete(id)
    }

    fn next_id(&self) -> u64 {
        let cache = self.cache.lock().unwrap();
        cache.keys().max().copied().unwrap_or(0) + 1
    }
}

pub fn run_server(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting server on {}:{}", config.host, config.port);
    Ok(())
}
"#;

    c.bench_function("parse_rust", |b| {
        b.iter(|| {
            parse(source.as_bytes(), "rust").unwrap()
        })
    });
}

fn bench_parse_go(c: &mut Criterion) {
    let source = r#"
package main

import (
    "fmt"
    "net/http"
    "sync"
)

type Config struct {
    Port  int
    Host  string
    DBURL string
    Debug bool
}

type User struct {
    ID    int64
    Name  string
    Email string
    Role  string
}

type UserService struct {
    mu    sync.RWMutex
    cache map[int64]*User
    repo  UserRepository
}

type UserRepository interface {
    FindByID(id int64) (*User, error)
    Insert(user *User) error
    Delete(id int64) error
    ListAll() ([]*User, error)
}

func NewUserService(repo UserRepository) *UserService {
    return &UserService{
        cache: make(map[int64]*User),
        repo:  repo,
    }
}

func (s *UserService) FindByID(id int64) (*User, error) {
    s.mu.RLock()
    if user, ok := s.cache[id]; ok {
        s.mu.RUnlock()
        return user, nil
    }
    s.mu.RUnlock()

    user, err := s.repo.FindByID(id)
    if err != nil {
        return nil, err
    }
    if user != nil {
        s.mu.Lock()
        s.cache[id] = user
        s.mu.Unlock()
    }
    return user, nil
}

func (s *UserService) Create(name, email string) (*User, error) {
    user := &User{
        ID:    s.nextID(),
        Name:  name,
        Email: email,
        Role:  "user",
    }
    if err := s.repo.Insert(user); err != nil {
        return nil, err
    }
    s.mu.Lock()
    s.cache[user.ID] = user
    s.mu.Unlock()
    return user, nil
}

func (s *UserService) Delete(id int64) error {
    s.mu.Lock()
    delete(s.cache, id)
    s.mu.Unlock()
    return s.repo.Delete(id)
}

func (s *UserService) nextID() int64 {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var maxID int64
    for id := range s.cache {
        if id > maxID {
            maxID = id
        }
    }
    return maxID + 1
}

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")
}

func main() {
    http.HandleFunc("/", handler)
    fmt.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
"#;

    c.bench_function("parse_go", |b| {
        b.iter(|| {
            parse(source.as_bytes(), "go").unwrap()
        })
    });
}

fn bench_extract_typescript(c: &mut Criterion) {
    let source = r#"
import { Router } from 'express';
interface Config { port: number; }
class Server {
    start() { console.log('started'); }
}
export function createApp(config: Config): Router { return new Router(); }
export default createApp;
"#;

    let parsed = parse(source.as_bytes(), "typescript").unwrap();

    c.bench_function("extract_typescript", |b| {
        b.iter(|| {
            Extractor::extract(&parsed)
        })
    });
}

fn bench_insert_nodes(c: &mut Criterion) {
    use astera_storage::Database;

    let nodes: Vec<Node> = (0..1000)
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

    c.bench_function("insert_1000_nodes", |b| {
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
                db.insert_nodes(&nodes).unwrap();
            },
            criterion::BatchSize::SmallInput,
        )
    });
}

fn bench_query_symbols(c: &mut Criterion) {
    use astera_storage::Database;

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
            let kind = match i % 5 {
                0 => NodeKind::Function,
                1 => NodeKind::Class,
                2 => NodeKind::Variable,
                3 => NodeKind::Import,
                _ => NodeKind::Method,
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

    c.bench_function("query_all_symbols_500", |b| {
        b.iter(|| {
            db.query_nodes(None, None, None).unwrap();
        })
    });

    c.bench_function("query_symbols_by_kind", |b| {
        b.iter(|| {
            db.query_nodes(Some("Function"), None, None).unwrap();
        })
    });
}

criterion_group!(
    benches,
    bench_parse_typescript,
    bench_parse_python,
    bench_parse_rust,
    bench_parse_go,
    bench_extract_typescript,
    bench_insert_nodes,
    bench_query_symbols,
);
criterion_main!(benches);
