cmake_minimum_required(VERSION 3.28)
project(astera VERSION 0.1.0 LANGUAGES C CXX)

# C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Visibility
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

# Position independent code
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# ---- Options ----
option(ASTERA_BUILD_TESTS "Build tests" ON)
option(ASTERA_BUILD_BENCHMARKS "Build benchmarks" OFF)
option(ASTERA_EMBED_WEBUI "Embed web frontend" OFF)
option(ASTERA_ENABLE_ASAN "Enable address sanitizer" OFF)
option(ASTERA_ENABLE_UBSAN "Enable undefined behavior sanitizer" OFF)
option(ASTERA_ENABLE_TSAN "Enable thread sanitizer" OFF)

# ---- Dependencies ----
find_package(tree-sitter CONFIG QUIET)
if(NOT tree-sitter_FOUND)
    # vcpkg ships tree-sitter as unofficial-tree-sitter
    find_package(unofficial-tree-sitter CONFIG QUIET)
    if(unofficial-tree-sitter_FOUND)
        add_library(tree-sitter::tree-sitter ALIAS unofficial::tree-sitter::tree-sitter)
    else()
        # Fallback to pkg-config for system-installed tree-sitter
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(TREE_SITTER REQUIRED tree-sitter)
        add_library(tree-sitter::tree-sitter INTERFACE IMPORTED)
        target_include_directories(tree-sitter::tree-sitter INTERFACE ${TREE_SITTER_INCLUDE_DIRS})
        target_link_libraries(tree-sitter::tree-sitter INTERFACE ${TREE_SITTER_LIBRARIES})
    endif()
endif()

find_package(nlohmann_json CONFIG REQUIRED)
find_package(SQLite3 REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(CLI11 CONFIG REQUIRED)

# Fetch tree-sitter language grammars (TS, JS, Python)
include(cmake/FetchGrammars.cmake)

# Drogon (optional for Phase 1.4, but find early)
find_package(drogon CONFIG QUIET)
if(NOT drogon_FOUND)
    message(STATUS "Drogon not found — API server will not be built")
endif()

# TBB (optional for Phase 2 parallel parsing)
find_package(TBB CONFIG QUIET)

# ---- Subdirectories ----
add_subdirectory(src)

if(ASTERA_BUILD_TESTS)
    enable_testing()
    find_package(GTest CONFIG QUIET)
    if(NOT GTest_FOUND)
        find_package(PkgConfig QUIET)
        pkg_check_modules(GTEST IMPORTED_TARGET gtest_main)
    endif()
    add_subdirectory(tests)
endif()

add_subdirectory(apps/cli)
