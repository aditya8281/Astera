#ifndef ASTERA_PARSER_EXTRACTOR_H
#define ASTERA_PARSER_EXTRACTOR_H

#include <memory>
#include <vector>
#include <string_view>
#include "astera/core/types.h"
#include <tree_sitter/api.h>

namespace astera::parser {

/// Language-specific symbol extractor.
/// Walks a parsed tree-sitter CST and produces Symbol objects.
class Extractor {
public:
    virtual ~Extractor() = default;

    /// Extract symbols from a parsed tree.
    /// @param tree  The parsed tree-sitter tree (must not be null)
    /// @param source  The source code (needed to extract node text)
    /// @param file_id  Database file_id to assign to all symbols
    /// @param out_edges  Optional output for edges (symbol vector indices as IDs)
    /// @return Vector of extracted symbols
    virtual std::vector<core::Symbol> extract(
        TSTree* tree, std::string_view source, int64_t file_id,
        std::vector<core::Edge>* out_edges = nullptr) const = 0;

    /// Factory: create the appropriate extractor for a language.
    static std::unique_ptr<Extractor> for_language(std::string_view language);
};

/// TypeScript / JavaScript extractor
class TypeScriptExtractor : public Extractor {
public:
    std::vector<core::Symbol> extract(
        TSTree* tree, std::string_view source, int64_t file_id,
        std::vector<core::Edge>* out_edges = nullptr) const override;

private:
    void extract_node(TSNode node, std::string_view source, int64_t file_id,
                      std::vector<core::Symbol>& out,
                      std::vector<core::Edge>* out_edges,
                      size_t parent_idx) const;
    std::optional<core::Symbol> try_extract(
        TSNode node, std::string_view source, int64_t file_id) const;

    /// Extract text of a node from source bytes
    static std::string node_text(TSNode node, std::string_view source);
};

/// Python extractor
class PythonExtractor : public Extractor {
public:
    std::vector<core::Symbol> extract(
        TSTree* tree, std::string_view source, int64_t file_id,
        std::vector<core::Edge>* out_edges = nullptr) const override;

private:
    void extract_node(TSNode node, std::string_view source, int64_t file_id,
                      std::vector<core::Symbol>& out,
                      std::vector<core::Edge>* out_edges,
                      size_t parent_idx) const;
    std::optional<core::Symbol> try_extract(
        TSNode node, std::string_view source, int64_t file_id) const;

    static std::string node_text(TSNode node, std::string_view source);
};

} // namespace astera::parser

#endif // ASTERA_PARSER_EXTRACTOR_H
