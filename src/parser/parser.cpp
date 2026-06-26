#include "astera/parser/parser.h"
#include "astera/parser/extractor.h"
#include <tree_sitter/api.h>
#include <cstring>
#include <fstream>
#include <utility>

// External tree-sitter grammar declarations
extern "C" {
    const TSLanguage* tree_sitter_typescript();
    const TSLanguage* tree_sitter_javascript();
    const TSLanguage* tree_sitter_python();
}

namespace astera::parser {

Parser::Parser() {
    parser_ = ts_parser_new();
}

Parser::~Parser() {
    if (tree_) ts_tree_delete(tree_);
    if (parser_) ts_parser_delete(parser_);
}

Parser::Parser(Parser&& other) noexcept
    : parser_(std::exchange(other.parser_, nullptr))
    , tree_(std::exchange(other.tree_, nullptr))
{}

Parser& Parser::operator=(Parser&& other) noexcept {
    if (this != &other) {
        if (tree_) ts_tree_delete(tree_);
        if (parser_) ts_parser_delete(parser_);
        parser_ = std::exchange(other.parser_, nullptr);
        tree_ = std::exchange(other.tree_, nullptr);
    }
    return *this;
}

bool Parser::set_language(std::string_view language) {
    const TSLanguage* lang = nullptr;
    if (language == "typescript") lang = tree_sitter_typescript();
    else if (language == "javascript") lang = tree_sitter_javascript();
    else if (language == "python") lang = tree_sitter_python();
    else return false;

    ts_parser_set_language(parser_, lang);
    return true;
}

TSTree* Parser::parse_string(const std::string& source, const std::string& language) {
    if (!set_language(language)) return nullptr;

    // Free previous tree if any
    if (tree_) {
        ts_tree_delete(tree_);
        tree_ = nullptr;
    }

    tree_ = ts_parser_parse_string(
        parser_, nullptr,
        source.data(),
        static_cast<uint32_t>(source.size()));

    return tree_;
}

core::Result<std::vector<ParseResult>> BatchParser::parse_all(
    const std::vector<core::FileInfo>& files)
{
    std::vector<ParseResult> results;
    Parser parser;

    for (const auto& file : files) {
        // Read file
        std::ifstream ifs(file.relative_path);
        if (!ifs) continue;

        std::string source((std::istreambuf_iterator<char>(ifs)),
                            std::istreambuf_iterator<char>());

        auto tree = parser.parse_string(source, file.language);
        if (!tree) continue;

        ParseResult pr;
        pr.file = file;
        // Run symbol extraction (before moving source)
        auto extractor = Extractor::for_language(file.language);
        if (extractor) {
            pr.symbols = extractor->extract(tree, source, file.id);
        }

        pr.tree = tree;
        pr.source = std::move(source);

        results.push_back(std::move(pr));
    }

    return results;
}

} // namespace astera::parser
