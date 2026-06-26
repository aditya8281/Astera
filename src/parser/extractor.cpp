#include "astera/parser/extractor.h"
#include <cstring>
#include <memory>
#include <cstdint>

namespace astera::parser {

// ============================================================
// Helpers
// ============================================================

std::string TypeScriptExtractor::node_text(TSNode node, std::string_view source) {
    uint32_t start = ts_node_start_byte(node);
    uint32_t end = ts_node_end_byte(node);
    if (start >= source.size()) return {};
    if (end > source.size()) end = static_cast<uint32_t>(source.size());
    return std::string(source.substr(start, end - start));
}

std::string PythonExtractor::node_text(TSNode node, std::string_view source) {
    uint32_t start = ts_node_start_byte(node);
    uint32_t end = ts_node_end_byte(node);
    if (start >= source.size()) return {};
    if (end > source.size()) end = static_cast<uint32_t>(source.size());
    return std::string(source.substr(start, end - start));
}

// ============================================================
// TypeScript / JavaScript Extractor
// ============================================================

std::vector<core::Symbol> TypeScriptExtractor::extract(
    TSTree* tree, std::string_view source, int64_t file_id,
    std::vector<core::Edge>* out_edges) const
{
    std::vector<core::Symbol> symbols;
    if (!tree) return symbols;
    TSNode root = ts_tree_root_node(tree);
    extract_node(root, source, file_id, symbols, out_edges, SIZE_MAX);
    return symbols;
}

void TypeScriptExtractor::extract_node(
    TSNode node, std::string_view source, int64_t file_id,
    std::vector<core::Symbol>& out,
    std::vector<core::Edge>* out_edges,
    size_t parent_idx) const
{
    // Try to extract a symbol at this node
    auto sym = try_extract(node, source, file_id);
    size_t my_idx = SIZE_MAX;
    if (sym) {
        my_idx = out.size();
        out.push_back(std::move(*sym));

        // If we have a parent and both are container+child, emit Contains edge
        if (out_edges && parent_idx < my_idx) {
            auto parent_kind = out[parent_idx].kind;
            auto child_kind = out[my_idx].kind;
            bool is_containment = false;
            if (parent_kind == core::NodeKind::Class &&
                child_kind == core::NodeKind::Method) {
                is_containment = true;
            } else if (parent_kind == core::NodeKind::Function &&
                       child_kind == core::NodeKind::Function) {
                is_containment = true;
            }
            if (is_containment) {
                core::Edge e;
                e.source_node_id = static_cast<int64_t>(parent_idx);
                e.target_node_id = static_cast<int64_t>(my_idx);
                e.kind = core::EdgeKind::Contains;
                e.file_id = file_id;
                out_edges->push_back(std::move(e));
            }
        }
    }

    // Recurse into children (pass self as parent if we extracted a symbol)
    size_t next_parent = (my_idx < SIZE_MAX) ? my_idx : parent_idx;
    uint32_t count = ts_node_named_child_count(node);
    for (uint32_t i = 0; i < count; ++i) {
        TSNode child = ts_node_named_child(node, i);
        if (ts_node_is_null(child)) continue;
        extract_node(child, source, file_id, out, out_edges, next_parent);
    }
}

std::optional<core::Symbol> TypeScriptExtractor::try_extract(
    TSNode node, std::string_view source, int64_t file_id) const
{
    const char* type = ts_node_type(node);
    if (!type) return std::nullopt;

    using core::NodeKind;
    using core::Symbol;
    using core::SourceSpan;

    NodeKind kind;
    bool has_name = true;

    if (std::strcmp(type, "function_declaration") == 0) {
        kind = NodeKind::Function;
    } else if (std::strcmp(type, "method_definition") == 0) {
        kind = NodeKind::Method;
    } else if (std::strcmp(type, "class_declaration") == 0) {
        kind = NodeKind::Class;
    } else if (std::strcmp(type, "interface_declaration") == 0) {
        kind = NodeKind::Interface;
    } else if (std::strcmp(type, "enum_declaration") == 0) {
        kind = NodeKind::Enum;
    } else if (std::strcmp(type, "type_alias_declaration") == 0) {
        kind = NodeKind::TypeAlias;
    } else if (std::strcmp(type, "import_statement") == 0) {
        kind = NodeKind::Import;
        has_name = false;
    } else if (std::strcmp(type, "variable_declaration") == 0 ||
               std::strcmp(type, "lexical_declaration") == 0) {
        kind = NodeKind::Variable;
        // Walk variable_declarator children for names
        uint32_t count = ts_node_named_child_count(node);
        std::vector<Symbol> vars;
        for (uint32_t i = 0; i < count; ++i) {
            TSNode child = ts_node_named_child(node, i);
            if (ts_node_is_null(child)) continue;
            const char* child_type = ts_node_type(child);
            if (child_type && std::strcmp(child_type, "variable_declarator") == 0) {
                TSNode name_node = ts_node_child_by_field_name(child, "name", 4);
                if (ts_node_is_null(name_node)) continue;
                auto ntext = node_text(name_node, source);
                if (ntext.empty()) continue;
                TSPoint s = ts_node_start_point(name_node);
                TSPoint e = ts_node_end_point(name_node);
                Symbol svar;
                svar.id = 0;
                svar.kind = kind;
                svar.name = std::move(ntext);
                svar.file_id = file_id;
                svar.span = SourceSpan{
                    static_cast<uint32_t>(s.row),
                    static_cast<uint32_t>(s.column),
                    static_cast<uint32_t>(e.row),
                    static_cast<uint32_t>(e.column)
                };
                svar.properties = "{}";
                vars.push_back(std::move(svar));
            }
        }
        if (vars.empty()) return std::nullopt;
        // For multi-declarations, return first
        return std::move(vars[0]);
    } else {
        return std::nullopt;
    }

    // Get name child for named declarations
    std::string name;
    if (has_name) {
        TSNode name_node = ts_node_child_by_field_name(node, "name", 4);
        if (!ts_node_is_null(name_node)) {
            name = node_text(name_node, source);
        }
    }

    // For imports, capture the module source
    if (kind == NodeKind::Import) {
        TSNode src = ts_node_child_by_field_name(node, "source", 6);
        if (!ts_node_is_null(src)) {
            name = node_text(src, source);
        }
    }

    TSPoint start = ts_node_start_point(node);
    TSPoint end = ts_node_end_point(node);

    Symbol sym;
    sym.id = 0;
    sym.kind = kind;
    sym.name = std::move(name);
    sym.file_id = file_id;
    sym.span = SourceSpan{
        static_cast<uint32_t>(start.row),
        static_cast<uint32_t>(start.column),
        static_cast<uint32_t>(end.row),
        static_cast<uint32_t>(end.column)
    };
    sym.properties = "{}";
    return sym;
}

// ============================================================
// Python Extractor
// ============================================================

std::vector<core::Symbol> PythonExtractor::extract(
    TSTree* tree, std::string_view source, int64_t file_id,
    std::vector<core::Edge>* out_edges) const
{
    std::vector<core::Symbol> symbols;
    if (!tree) return symbols;
    TSNode root = ts_tree_root_node(tree);
    extract_node(root, source, file_id, symbols, out_edges, SIZE_MAX);
    return symbols;
}

void PythonExtractor::extract_node(
    TSNode node, std::string_view source, int64_t file_id,
    std::vector<core::Symbol>& out,
    std::vector<core::Edge>* out_edges,
    size_t parent_idx) const
{
    auto sym = try_extract(node, source, file_id);
    size_t my_idx = SIZE_MAX;
    if (sym) {
        my_idx = out.size();
        out.push_back(std::move(*sym));

        if (out_edges && parent_idx < my_idx) {
            auto parent_kind = out[parent_idx].kind;
            auto child_kind = out[my_idx].kind;
            bool is_containment = false;
            if (parent_kind == core::NodeKind::Class &&
                child_kind == core::NodeKind::Function) {
                // Python class methods are Function nodes, not Method
                is_containment = true;
            } else if (parent_kind == core::NodeKind::Function &&
                       child_kind == core::NodeKind::Function) {
                // Nested functions (def inside def)
                is_containment = true;
            } else if (parent_kind == core::NodeKind::Class &&
                       child_kind == core::NodeKind::Class) {
                // Nested class
                is_containment = true;
            }
            if (is_containment) {
                core::Edge e;
                e.source_node_id = static_cast<int64_t>(parent_idx);
                e.target_node_id = static_cast<int64_t>(my_idx);
                e.kind = core::EdgeKind::Contains;
                e.file_id = file_id;
                out_edges->push_back(std::move(e));
            }
        }
    }

    size_t next_parent = (my_idx < SIZE_MAX) ? my_idx : parent_idx;
    uint32_t count = ts_node_named_child_count(node);
    for (uint32_t i = 0; i < count; ++i) {
        TSNode child = ts_node_named_child(node, i);
        if (ts_node_is_null(child)) continue;
        extract_node(child, source, file_id, out, out_edges, next_parent);
    }
}

std::optional<core::Symbol> PythonExtractor::try_extract(
    TSNode node, std::string_view source, int64_t file_id) const
{
    const char* type = ts_node_type(node);
    if (!type) return std::nullopt;

    using core::NodeKind;
    using core::Symbol;
    using core::SourceSpan;

    NodeKind kind;
    bool has_name = true;

    if (std::strcmp(type, "function_definition") == 0) {
        kind = NodeKind::Function;
    } else if (std::strcmp(type, "class_definition") == 0) {
        kind = NodeKind::Class;
    } else if (std::strcmp(type, "import_statement") == 0 ||
               std::strcmp(type, "import_from_statement") == 0) {
        kind = NodeKind::Import;
        has_name = false;
    } else {
        return std::nullopt;
    }

    std::string name;
    if (has_name) {
        TSNode name_node = ts_node_child_by_field_name(node, "name", 4);
        if (!ts_node_is_null(name_node)) {
            name = node_text(name_node, source);
        }
    }

    // For imports, capture what's imported
    if (kind == NodeKind::Import && !has_name) {
        uint32_t count = ts_node_named_child_count(node);
        for (uint32_t i = 0; i < count; ++i) {
            TSNode child = ts_node_named_child(node, i);
            if (ts_node_is_null(child)) continue;
            const char* ct = ts_node_type(child);
            if (ct && (std::strcmp(ct, "dotted_name") == 0 ||
                       std::strcmp(ct, "aliased_import") == 0)) {
                auto ctext = node_text(child, source);
                if (!ctext.empty()) {
                    if (!name.empty()) name += ", ";
                    name += std::move(ctext);
                }
            }
        }
    }

    TSPoint start = ts_node_start_point(node);
    TSPoint end = ts_node_end_point(node);

    Symbol sym;
    sym.id = 0;
    sym.kind = kind;
    sym.name = std::move(name);
    sym.file_id = file_id;
    sym.span = SourceSpan{
        static_cast<uint32_t>(start.row),
        static_cast<uint32_t>(start.column),
        static_cast<uint32_t>(end.row),
        static_cast<uint32_t>(end.column)
    };
    sym.properties = "{}";
    return sym;
}

// ============================================================
// Factory
// ============================================================

std::unique_ptr<Extractor> Extractor::for_language(std::string_view language) {
    if (language == "typescript" || language == "javascript" || language == "tsx") {
        return std::make_unique<TypeScriptExtractor>();
    }
    if (language == "python") {
        return std::make_unique<PythonExtractor>();
    }
    return nullptr;
}

} // namespace astera::parser
