# Contributing to Astera

Thanks for your interest in contributing! This guide covers how to get started.

## Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.80+ | `rustup install stable` |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| clang/LLVM | Any recent | `apt install clang` / `brew install llvm` |

### Getting Started

```bash
# Clone the repo
git clone https://github.com/user/astera.git
cd astera

# Build the backend
cargo build

# Run all tests
cargo test

# Build the frontend
cd apps/web
npm install
npm run dev
```

## Project Structure

```
astera/
├── crates/           # Rust backend (workspace crates)
│   ├── astera-core/        # Shared types and config (NodeKind, EdgeKind, UnresolvedRef)
│   ├── astera-discovery/   # Filesystem walking, gitignore, language classification
│   ├── astera-parser/      # Tree-sitter 0.25 parsing (8 languages)
│   ├── astera-resolver/    # Reference resolution, broken reference detection
│   ├── astera-storage/     # SQLite + FTS5 + broken_refs table
│   ├── astera-metrics/     # Complexity, coupling, Tarjan's SCC
│   ├── astera-impact/      # BFS impact analysis + architecture rule validation
│   ├── astera-api/         # 17 REST endpoints + WebSocket + embedded frontend
│   ├── astera-plugins/     # Plugin trait, registry, native loading
│   ├── astera-export/      # JSON/CSV/DOT export + git diff analysis
│   ├── astera-watcher/     # File watching with deletion detection
│   └── astera/             # CLI binary entry point + benchmarks
└── apps/web/        # React + TypeScript + Tailwind + Canvas 2D frontend
```

## Development Workflow

### Branch Strategy

- `main` — production-ready, always green
- `feat/*` — feature branches, merged via `--no-ff`
- `fix/*` — bug fix branches

### Making Changes

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Run the full check suite:

```bash
cargo fmt
cargo clippy --workspace -- -D warnings
cargo test --workspace
```

4. Commit with a conventional commit message:

```
feat: add Java language support
fix: resolve crash on empty file parsing
docs: update API reference
chore: bump tree-sitter dependency
```

5. Merge to main: `git checkout main && git merge feat/your-feature --no-ff`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — maintenance, deps, CI
- `refactor:` — code restructuring without behavior change
- `test:` — adding or fixing tests

### Rust Code Style

- Edition 2021
- `anyhow::Result` for fallible functions
- `#[derive(Debug, Clone, Serialize, Deserialize)]` on data types
- Snake_case for functions/variables, PascalCase for types
- `#[cfg(test)] mod tests` in every source file
- No `unsafe` in application code

### Adding a New Language

1. Add the tree-sitter grammar crate to `crates/astera-parser/Cargo.toml`
2. Add extraction logic in `crates/astera-parser/src/lib.rs` (`extract_*` and `walk_*` functions)
3. Add the language to the `Language` enum and `classify_language` in `crates/astera-discovery/src/lib.rs`
4. Add tests with fixture files
5. Update README supported languages table

### Adding a New Plugin

1. Implement the `Plugin` trait in `crates/astera-plugins/src/lib.rs`
2. Return `PluginMeta` from `meta()` and `PluginOutput` from `run()`
3. Register in `PluginRegistry` (built-in) or load via native shared library
4. Add tests with sample `PluginInput`

## Running Tests

```bash
# All tests (154 total)
cargo test

# Specific crate
cargo test -p astera-parser
cargo test -p astera-plugins
cargo test -p astera-impact

# Specific test
cargo test -p astera-parser -- test_ts_extraction

# With output
cargo test -- --nocapture
```

## Running Benchmarks

```bash
# Full benchmark suite
cargo bench

# Benchmark regression tracking
astera bench save              # Save baseline
astera bench check             # Compare against baseline
astera bench show              # Display saved baseline

# HTML reports generated in target/criterion/
```

## Building for Release

```bash
cargo build --release
# Binary at: target/release/astera
```

## Questions?

Open an issue or start a discussion on GitHub.
