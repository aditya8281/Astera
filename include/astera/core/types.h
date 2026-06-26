#ifndef ASTERA_CORE_TYPES_H
#define ASTERA_CORE_TYPES_H

#include <cstdint>
#include <string>
#include <optional>
#include <vector>
#include <string_view>
#include "export.h"

namespace astera::core {

enum class ASTERA_EXPORT NodeKind : uint8_t {
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
    Anonymous
};

enum class ASTERA_EXPORT EdgeKind : uint8_t {
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
    Declares
};

struct ASTERA_EXPORT SourceSpan {
    uint32_t start_line{};
    uint32_t start_col{};
    uint32_t end_line{};
    uint32_t end_col{};

    bool contains(uint32_t line, uint32_t col) const noexcept {
        // All-zero span is empty — cannot contain any position
        if (start_line == 0 && start_col == 0 && end_line == 0 && end_col == 0)
            return false;
        if (line < start_line || line > end_line) return false;
        if (line == start_line && col < start_col) return false;
        if (line == end_line && col > end_col) return false;
        return true;
    }
};

struct ASTERA_EXPORT FileInfo {
    int64_t id{};
    std::string repo_root;
    std::string relative_path;
    std::string language;
    std::string hash;
    int64_t size{};
    int64_t line_count{};
    std::string indexed_at;
    std::string last_modified;
};

struct ASTERA_EXPORT Symbol {
    int64_t id{};
    NodeKind kind{};
    std::string name;
    int64_t file_id{};
    SourceSpan span;
    std::optional<std::string> doc_comment;
    std::string properties; // JSON blob
};

struct ASTERA_EXPORT Edge {
    int64_t id{};
    int64_t source_node_id{};
    int64_t target_node_id{};
    EdgeKind kind{};
    std::string properties; // JSON blob
    int64_t file_id{}; // call site / reference site file
};

struct ASTERA_EXPORT ParseResult {
    std::vector<Symbol> symbols;
};

struct ASTERA_EXPORT IndexReport {
    int64_t total_files{};
    int64_t total_symbols{};
    int64_t total_edges{};
    double elapsed_seconds{};
};

// Language to string conversions
ASTERA_EXPORT std::string_view to_string(NodeKind kind) noexcept;
ASTERA_EXPORT std::string_view to_string(EdgeKind kind) noexcept;

// Parse string to enum (returns std::nullopt on mismatch)
ASTERA_EXPORT std::optional<NodeKind> node_kind_from_string(std::string_view s) noexcept;
ASTERA_EXPORT std::optional<EdgeKind> edge_kind_from_string(std::string_view s) noexcept;

} // namespace astera::core

#endif // ASTERA_CORE_TYPES_H
