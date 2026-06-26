#include <gtest/gtest.h>
#include <filesystem>
#include <cstdlib>

#include "astera/storage/database.h"
#include "astera/core/types.h"

using namespace astera::storage;
using namespace astera::core;

class DatabaseTest : public ::testing::Test {
protected:
    void SetUp() override {
        path_ = std::filesystem::temp_directory_path() / "astera-test-db-XXXXXX";
        auto s = path_.string();
        if (mkdtemp(s.data())) {
            path_ = s;
        }
        db_path_ = path_ / "test.db";
    }

    void TearDown() override {
        if (db_) db_->close();
        std::filesystem::remove_all(path_);
    }

    Database* create_db() {
        db_ = std::make_unique<Database>();
        auto result = db_->open(db_path_);
        EXPECT_TRUE(result.has_value());
        auto migrate = db_->migrate();
        EXPECT_TRUE(migrate.has_value());
        return db_.get();
    }

    std::filesystem::path path_;
    std::filesystem::path db_path_;
    std::unique_ptr<Database> db_;
};

TEST_F(DatabaseTest, OpenAndMigrate) {
    auto db = create_db();
    EXPECT_NE(db, nullptr);
}

TEST_F(DatabaseTest, InsertAndGetFile) {
    auto db = create_db();

    FileInfo f;
    f.repo_root = "/test";
    f.relative_path = "src/main.ts";
    f.language = "typescript";
    f.hash = "abc123";
    f.size = 100;
    f.line_count = 50;

    auto id_result = db->insert_file(f);
    EXPECT_TRUE(id_result.has_value());
    EXPECT_GT(id_result.value(), 0);

    auto get_result = db->get_file("src/main.ts");
    EXPECT_TRUE(get_result.has_value());
    EXPECT_TRUE(get_result.value().has_value());
    EXPECT_EQ(get_result.value()->relative_path, "src/main.ts");
}

TEST_F(DatabaseTest, InsertAndQuerySymbols) {
    auto db = create_db();

    // Insert a file first
    FileInfo f;
    f.repo_root = "/test";
    f.relative_path = "src/app.ts";
    f.language = "typescript";
    auto file_id = db->insert_file(f);
    ASSERT_TRUE(file_id.has_value());

    // Insert nodes
    std::vector<Symbol> symbols = {
        Symbol{0, NodeKind::Function, "handleRequest", file_id.value(),
               SourceSpan{10, 1, 30, 2}, std::nullopt, "{}"},
        Symbol{0, NodeKind::Class, "UserService", file_id.value(),
               SourceSpan{1, 1, 50, 2}, std::nullopt, "{}"},
    };

    auto ids = db->insert_nodes(symbols);
    EXPECT_TRUE(ids.has_value());
    EXPECT_EQ(ids.value().size(), 2);

    // Query
    Database::SymbolQuery q;
    q.name_prefix = "handle";
    auto results = db->query_symbols(q);
    EXPECT_TRUE(results.has_value());
    EXPECT_EQ(results.value().size(), 1);
    EXPECT_EQ(results.value()[0].name, "handleRequest");
}

TEST_F(DatabaseTest, SearchSymbols) {
    auto db = create_db();

    FileInfo f;
    f.repo_root = "/test";
    f.relative_path = "src/lib.ts";
    f.language = "typescript";
    auto file_id = db->insert_file(f);
    ASSERT_TRUE(file_id.has_value());

    std::vector<Symbol> symbols = {
        Symbol{0, NodeKind::Function, "parseData", file_id.value(), {}, std::nullopt, "{}"},
        Symbol{0, NodeKind::Function, "transformData", file_id.value(), {}, std::nullopt, "{}"},
    };
    db->insert_nodes(symbols);

    auto results = db->search("parse");
    EXPECT_TRUE(results.has_value());
    EXPECT_EQ(results.value().size(), 1);
    EXPECT_EQ(results.value()[0].symbol.name, "parseData");
}
