#ifndef ASTERA_PARSER_PARSER_H
#define ASTERA_PARSER_PARSER_H

#include <memory>
#include <string>
#include <vector>
#include <string_view>
#include "astera/core/types.h"
#include "astera/core/error.h"

// Forward declare tree-sitter types
struct TSParser;
struct TSTree;

namespace astera::parser {

// RAII wrapper around a tree-sitter parser.
// Holds a parser and maintains grammar references.
class ASTERA_EXPORT Parser {
public:
    Parser();
    ~Parser();

    Parser(const Parser&) = delete;
    Parser& operator=(const Parser&) = delete;
    Parser(Parser&& other) noexcept;
    Parser& operator=(Parser&& other) noexcept;

    // Set the language for the next parse.
    // Returns false if the language grammar isn't loaded.
    bool set_language(std::string_view language);

    // Parse a string of source code.
    // Returns nullptr on parse error (caller should check).
    TSTree* parse_string(const std::string& source, const std::string& language);

    // Get the parse tree. The caller takes ownership.
    TSTree* get_tree() { return tree_; }

private:
    TSParser* parser_{};
    TSTree* tree_{};
};

// Result of parsing a single file.
struct ASTERA_EXPORT ParseResult {
    core::FileInfo file;
    TSTree* tree = nullptr;
    std::string source;
    std::vector<core::Symbol> symbols;
};

// Parse a batch of files in parallel (Phase 2: TBB parallel_for).
// For now, sequential implementation.
class ASTERA_EXPORT BatchParser {
public:
    core::Result<std::vector<ParseResult>> parse_all(
        const std::vector<core::FileInfo>& files);
};

} // namespace astera::parser

#endif // ASTERA_PARSER_PARSER_H
