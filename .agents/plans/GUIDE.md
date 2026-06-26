# Astera — Project Guide

## What Is Astera?

Astera is a **local-first static analysis engine** that builds and maintains a persistent, queryable structural model of a software repository.

Unlike traditional static analysis tools that generate isolated reports, or AI coding assistants that repeatedly scan repositories, Astera maintains a persistent knowledge graph of the codebase that can be queried instantly.

### What Astera Is Not

- **Not** a "Software Intelligence Platform" (marketing fluff)
- **Not** an AI assistant or code generator
- **Not** an IDE plugin (Phase 4+ goal)
- **Not** a CI/CD platform

### What Astera Actually Is

A **developer tool** like `ripgrep`, `jq`, or `cloc` — small, fast, composable, CLI-friendly — with a web frontend for rich exploration.

## Core Philosophy

A repository should not be treated as a collection of files. It should be understood as a connected software system composed of:

- **Symbols** — functions, classes, variables, types, interfaces
- **Relationships** — calls, references, inherits, contains, imports
- **Execution paths** — control flow, call chains
- **Modules** — namespaces, packages, layered subsystems
- **Dependencies** — internal and external dependency graphs
- **Architecture** — module boundaries, layering, design patterns

Astera's job is to continuously understand all of the above and expose it through a high-performance API and rich visualizations.

## Target Audience

| User | Use Case |
|---|---|
| **Individual developers** | Understand unfamiliar repos, find code, navigate architecture |
| **Engineering teams** | Impact analysis, dependency management, code review support |
| **Open-source contributors** | Onboarding to new projects, finding entry points |
| **AI coding agents** | Instant structural queries instead of scanning files repeatedly |
| **CI/CD pipelines** | Enforce architecture rules, measure complexity trends |
| **IDE extensions** | Embed Astera queries in editor context (Phase 4) |

## Key Design Principles

1. **Deterministic** — Answers come from program analysis, not LLM reasoning. Always correct for the data available.
2. **Local-first** — Zero external services. Single binary. Index lives at repo root.
3. **API-first** — The API is the primary interface. CLI and Web UI are consumers of the same API.
4. **Incremental** — Index once, update on change. No full re-scans for small edits.
5. **Language-agnostic core, language-specific extractors** — Shared CPG model, per-language parsing and resolution.
6. **Correct over complete** — Better to say "unknown" than give wrong results. Reference resolution is heuristic but honest.

## Success Criteria (Measurable)

| Metric | Target |
|---|---|
| Index speed | ≥100K LOC/second (single-threaded equivalent) |
| Memory usage | <2GB RAM for 1M LOC repos |
| Query latency | <50ms symbol lookup, <500ms impact analysis |
| Storage overhead | <5× source size on disk |
| Call graph accuracy | >90% precision/recall for statically-typed languages |
| Language coverage | 4 in Phase 1, 6 in Phase 2, 10+ in Phase 3 |
