#include <gtest/gtest.h>
#include <filesystem>
#include <fstream>

#include "astera/parser/parser.h"
#include "astera/parser/extractor.h"
#include "astera/core/types.h"

using namespace astera::parser;
using namespace astera::core;

static std::string read_fixture(const std::string& name) {
    auto path = std::filesystem::path(TEST_SOURCE_DIR) / "tests/fixtures" / name;
    std::ifstream ifs(path);
    if (!ifs) return {};
    return std::string((std::istreambuf_iterator<char>(ifs)),
                        std::istreambuf_iterator<char>());
}

TEST(ParserTest, TypeScriptParseAndExtract) {
    auto source = read_fixture("sample.ts");
    ASSERT_FALSE(source.empty()) << "Cannot read sample.ts fixture";

    Parser parser;
    auto tree = parser.parse_string(source, "typescript");
    ASSERT_NE(tree, nullptr) << "Tree-sitter failed to parse TypeScript";

    TypeScriptExtractor extractor;
    auto symbols = extractor.extract(tree, source, 1);

    // Should find at least: greet (func), UserService (class), User (interface),
    // Status (enum), Callback (type alias), imports
    EXPECT_GE(symbols.size(), 6);

    // Check specific symbols
    bool found_greet = false, found_class = false, found_interface = false;
    bool found_enum = false, found_typealias = false, found_import = false;

    for (const auto& s : symbols) {
        if (s.name == "greet" && s.kind == NodeKind::Function) found_greet = true;
        if (s.name == "UserService" && s.kind == NodeKind::Class) found_class = true;
        if (s.name == "User" && s.kind == NodeKind::Interface) found_interface = true;
        if (s.name == "Status" && s.kind == NodeKind::Enum) found_enum = true;
        if (s.name == "Callback" && s.kind == NodeKind::TypeAlias) found_typealias = true;
        if (s.kind == NodeKind::Import) found_import = true;
    }

    EXPECT_TRUE(found_greet) << "Function 'greet' not extracted";
    EXPECT_TRUE(found_class) << "Class 'UserService' not extracted";
    EXPECT_TRUE(found_interface) << "Interface 'User' not extracted";
    EXPECT_TRUE(found_enum) << "Enum 'Status' not extracted";
    EXPECT_TRUE(found_typealias) << "Type alias 'Callback' not extracted";
    EXPECT_TRUE(found_import) << "No import statements extracted";

    // Check that symbols have valid spans (multi-line or same-line)
    for (const auto& s : symbols) {
        EXPECT_GE(s.span.end_line, s.span.start_line);
    }
}

TEST(ParserTest, PythonParseAndExtract) {
    auto source = read_fixture("sample.py");
    ASSERT_FALSE(source.empty()) << "Cannot read sample.py fixture";

    Parser parser;
    auto tree = parser.parse_string(source, "python");
    ASSERT_NE(tree, nullptr) << "Tree-sitter failed to parse Python";

    PythonExtractor extractor;
    auto symbols = extractor.extract(tree, source, 1);

    EXPECT_GE(symbols.size(), 3);

    bool found_greet = false, found_class = false, found_import = false;
    for (const auto& s : symbols) {
        if (s.name == "greet" && s.kind == NodeKind::Function) found_greet = true;
        if (s.name == "UserService" && s.kind == NodeKind::Class) found_class = true;
        if (s.kind == NodeKind::Import) found_import = true;
    }

    EXPECT_TRUE(found_greet) << "Function 'greet' not extracted";
    EXPECT_TRUE(found_class) << "Class 'UserService' not extracted";
    EXPECT_TRUE(found_import) << "No import statements extracted";
}

TEST(ParserTest, BatchParserExtractsSymbols) {
    FileInfo f;
    f.relative_path = std::string(TEST_SOURCE_DIR) + "/tests/fixtures/sample.ts";
    f.language = "typescript";
    f.id = 1;

    BatchParser batch;
    auto result = batch.parse_all({f});
    ASSERT_TRUE(result.has_value());
    ASSERT_EQ(result.value().size(), 1);

    const auto& pr = result.value()[0];
    EXPECT_GE(pr.symbols.size(), 6);
    EXPECT_NE(pr.tree, nullptr);
    EXPECT_FALSE(pr.source.empty());
}

TEST(ParserTest, EmptyStringParses) {
    Parser parser;
    auto tree = parser.parse_string("", "typescript");
    EXPECT_NE(tree, nullptr);
}
