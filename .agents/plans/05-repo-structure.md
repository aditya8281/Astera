# Astera — Repository Structure (C++)

## Top-Level Layout

```
astera/
├── CMakeLists.txt             # Root CMake — defines project, options
├── CMakePresets.json          # Build presets (debug, release, ci, asan, ubsan)
├── vcpkg.json                 # vcpkg manifest mode dependencies
├── vcpkg-configuration.json   # vcpkg registries, overlay ports
├── README.md
├── LICENSE                    # Apache 2.0 or MIT
├── .gitignore
├── .clang-format              # Formatting rules
├── .clang-tidy                # Lint checks
├── .github/                   # CI/CD workflows
├── cmake/                     # Custom CMake modules
│   ├── CompilerWarnings.cmake # Warning-as-errors configuration
│   ├── Sanitizers.cmake       # ASan, UBSan, MSan helpers
│   ├── StaticAnalysis.cmake   # clang-tidy integration targets
│   └── EmbedWebUI.cmake       # Embed frontend dist into binary
│
├── include/
│   └── astera/                # Public headers
│       ├── core/
│       │   ├── types.h        # NodeKind, EdgeKind, SourceSpan
│       │   ├── config.h       # AsteraConfig struct
│       │   ├── error.h        # Error types, Result<T>
│       │   └── export.h       # Export/import visibility macros
│       ├── discovery/
│       │   ├── walker.h       # File walker
│       │   └── classifier.h   # Language classification
│       ├── parser/
│       │   ├── parser.h       # Tree-sitter RAII wrapper
│       │   ├── extractor.h    # Extractor interface
│       │   ├── extractors/    # Language implementations
│       │   │   ├── ts_extractor.h
│       │   │   └── py_extractor.h
│       ├── resolver/
│       │   ├── scope.h        # Lexical scope tree
│       │   ├── imports.h      # Import resolution
│       │   └── resolver.h     # Reference resolver
│       ├── graph/
│       │   ├── types.h        # Node, Edge, Graph structs
│       │   ├── builder.h      # CPG builder
│       │   └── algorithms.h   # BFS, DFS, SCC, topsort
│       ├── storage/
│       │   ├── database.h     # Database RAII class
│       │   └── queries.h      # Query parameter types
│       ├── metrics/
│       │   └── metrics.h      # Metrics computation
│       ├── impact/
│       │   └── impact.h       # Impact analysis
│       ├── api/
│       │   ├── server.h       # Drogon app setup
│       │   ├── controllers/   # Request handlers
│       │   │   ├── RepoController.h
│       │   │   ├── FileController.h
│       │   │   ├── SymbolController.h
│       │   │   └── SearchController.h
│       │   └── middleware/    # CORS, logging, error handling
│       ├── watcher/
│       │   └── watcher.h      # File system watcher (Phase 2)
│       └── export/
│           └── export.h       # Export formats (Phase 3)
│
├── src/                       # Implementation files
│   ├── CMakeLists.txt         # Compiles into libastera static library
│   ├── core/
│   │   ├── config.cpp
│   │   └── error.cpp
│   ├── discovery/
│   │   ├── walker.cpp
│   │   └── classifier.cpp
│   ├── parser/
│   │   ├── parser.cpp
│   │   ├── extractors/
│   │   │   ├── ts_extractor.cpp
│   │   │   └── py_extractor.cpp
│   │   └── extractor_registry.cpp  # Language → extractor map
│   ├── resolver/
│   │   ├── scope.cpp
│   │   ├── imports.cpp
│   │   └── resolver.cpp
│   ├── graph/
│   │   ├── builder.cpp
│   │   └── algorithms.cpp
│   ├── storage/
│   │   ├── database.cpp
│   │   └── queries.cpp
│   ├── metrics/
│   │   └── metrics.cpp        # Phase 2
│   ├── impact/
│   │   └── impact.cpp         # Phase 2
│   ├── api/                   # Phase 1
│   │   ├── server.cpp
│   │   ├── controllers/
│   │   │   ├── RepoController.cpp
│   │   │   ├── FileController.cpp
│   │   │   ├── SymbolController.cpp
│   │   │   └── SearchController.cpp
│   │   └── middleware/
│   ├── watcher/
│   │   └── watcher.cpp        # Phase 2
│   └── export/
│       └── export.cpp         # Phase 3
│
├── apps/
│   ├── cli/                   # CLI binary
│   │   ├── CMakeLists.txt
│   │   └── main.cpp
│   └── web/                   # React frontend (same layout)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/           # React Query hooks
│           ├── pages/
│           ├── components/
│           │   ├── common/
│           │   ├── graph/     # Cytoscape wrappers
│           │   └── layout/
│           ├── hooks/
│           ├── stores/        # Zustand
│           ├── types/
│           └── utils/
│
├── tests/                     # Unit + integration tests
│   ├── CMakeLists.txt
│   ├── test_types.cpp
│   ├── test_parser.cpp
│   ├── test_resolver.cpp
│   ├── test_graph.cpp
│   ├── test_storage.cpp
│   ├── test_metrics.cpp       # Phase 2
│   ├── test_impact.cpp        # Phase 2
│   ├── fixtures/              # Test repos
│   │   ├── ts-project/
│   │   ├── python-project/
│   │   └── mixed-project/
│   └── benchmarks/
│       ├── CMakeLists.txt
│       ├── parse_benchmark.cpp
│       └── query_benchmark.cpp
│
└── docs/
    ├── README.md
    ├── getting-started.md
    ├── architecture.md
    ├── api-reference.md
    ├── configuration.md
    ├── development.md
    ├── cli-reference.md
    ├── language-support.md
    ├── faq.md
    └── guides/
```

## CMake Design

### vcpkg.json

```json
{
  "name": "astera",
  "version": "0.1.0",
  "dependencies": [
    "tree-sitter",
    "drogon",
    "sqlite3",
    "nlohmann-json",
    "cli11",
    "fmt",
    "spdlog",
    "gtest",
    "google-benchmark",
    "tbb",
    "efsw"
  ]
}
```

### CMakeLists.txt (root)

```cmake
cmake_minimum_required(VERSION 3.28)
project(astera VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)

# Options
option(ASTERA_BUILD_TESTS "Build tests" ON)
option(ASTERA_BUILD_BENCHMARKS "Build benchmarks" OFF)
option(ASTERA_EMBED_WEBUI "Embed web frontend" OFF)
option(ASTERA_ENABLE_ASAN "Enable address sanitizer" OFF)

# Find dependencies
find_package(tree-sitter CONFIG REQUIRED)
find_package(drogon CONFIG REQUIRED)
find_package(SQLite3 REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(CLI11 CONFIG REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(TBB REQUIRED)

add_subdirectory(src)
add_subdirectory(apps/cli)
if(ASTERA_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
```

## Conventions

### C++
- **C++20** — use `std::format`, `std::span`, concepts (sparingly)
- **No exceptions in hot path** — parser and graph builder use `Result<T, E>` or `std::optional`. Exceptions OK for infrastructure (DB, config, HTTP).
- **No raw `new`/`delete`** — `std::unique_ptr`, `std::shared_ptr`, or arena allocators
- **Headers**: `.h` for C++ headers (not `.hpp`)
- **One class per header file** (or closely related group)
- **Forward declare** in headers where possible
- **Include order**: own header → standard → external → internal
- **Namespaces**: `astera::core`, `astera::parser`, `astera::graph`, etc.
- **`clang-format`** with LLVM style, 100 column limit
- **`clang-tidy`** with modernize-*, performance-*, readability-*, bugprone-*

### TypeScript / Frontend
- Same as Rust plan — strict TypeScript, PascalCase components, React Query for API

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`
- Branch from `main`, squash-merge to main
- `.astera/` in `.gitignore`

### Testing
- Google Test for all unit tests
- Google Benchmark for performance
- GCC/Clang sanitizers in CI: ASan, UBSan (MSan optional)
- Golden file tests compare extracted JSON vs stored snapshots
- Integration tests run against test fixtures in `tests/fixtures/`
