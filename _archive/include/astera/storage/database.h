#ifndef ASTERA_STORAGE_DATABASE_H
#define ASTERA_STORAGE_DATABASE_H

#include <string>
#include <filesystem>
#include <vector>
#include <optional>
#include <span>
#include "astera/core/types.h"
#include "astera/core/error.h"

struct sqlite3;
struct sqlite3_stmt;

namespace astera::storage {

// RAII wrapper around a prepared SQLite statement.
class Statement {
public:
    Statement() = default;
    explicit Statement(sqlite3* db, const std::string& sql);
    ~Statement();

    Statement(Statement&& other) noexcept;
    Statement& operator=(Statement&& other) noexcept;

    // Non-copyable
    Statement(const Statement&) = delete;
    Statement& operator=(const Statement&) = delete;

    // Bind parameters
    void bind(int index, int64_t value);
    void bind(int index, const std::string& value);
    void bind(int index, std::string_view value);
    void bind_null(int index);

    // Step
    bool step(); // returns true if there is a row
    void reset();

    // Column access
    int64_t column_int64(int index);
    double column_double(int index);
    std::string column_string(int index);

private:
    sqlite3_stmt* stmt_ = nullptr;
};

// RAII transaction
class Transaction {
public:
    Transaction(sqlite3* db, const std::string& name = "tx");
    ~Transaction();

    Transaction(const Transaction&) = delete;
    Transaction& operator=(const Transaction&) = delete;
    Transaction(Transaction&& other) noexcept;
    Transaction& operator=(Transaction&& other) noexcept;

    void commit();
    void rollback() noexcept;

private:
    sqlite3* db_ = nullptr;
    bool committed_ = false;
    std::string name_;
};

// Main database class wrapping SQLite3.
class ASTERA_EXPORT Database {
public:
    Database();
    ~Database();

    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;
    Database(Database&& other) noexcept;
    Database& operator=(Database&& other) noexcept;

    // Open or create a database at the given path.
    core::Result<void> open(const std::filesystem::path& path);

    // Run schema migrations to bring the database up to date.
    core::Result<void> migrate();

    // Close the database.
    void close();

    // Begin a transaction.
    Transaction begin_transaction(const std::string& name = "tx");

    // ---- CRUD ----

    // Insert a file record. Returns the new row ID.
    core::Result<int64_t> insert_file(const core::FileInfo& file);

    // Get a file by its relative path.
    core::Result<std::optional<core::FileInfo>> get_file(const std::string& relative_path);

    // Insert a batch of nodes. Returns their IDs.
    core::Result<std::vector<int64_t>> insert_nodes(std::span<const core::Symbol> nodes);

    // Insert a batch of edges.
    core::Result<void> insert_edges(std::span<const core::Edge> edges);

    // Delete all data for a file (cascade via FK).
    core::Result<void> delete_file(int64_t file_id);

    // ---- Queries ----

    // Search symbols by name prefix, kind, and file.
    struct SymbolQuery {
        std::string name_prefix;
        std::optional<core::NodeKind> kind;
        std::optional<int64_t> file_id;
        int limit = 50;
        int offset = 0;
    };
    core::Result<std::vector<core::Symbol>> query_symbols(const SymbolQuery& q);

    // Get a single symbol by ID.
    core::Result<std::optional<core::Symbol>> get_symbol(int64_t id);

    // Get edges for a node (inbound or outbound, filtered by kind).
    core::Result<std::vector<core::Edge>> get_edges(
        int64_t node_id,
        std::optional<core::EdgeKind> kind,
        bool inbound);

    // Full-text search across symbols.
    struct SearchResult {
        core::Symbol symbol;
        double rank;
    };
    core::Result<std::vector<SearchResult>> search(const std::string& query, int limit = 20);

private:
    sqlite3* db_ = nullptr;
    int schema_version_ = 0;

    // Create tables
    core::Result<void> create_schema();
    core::Result<void> create_fts5();
    bool has_table(const std::string& name);
};

} // namespace astera::storage

#endif // ASTERA_STORAGE_DATABASE_H
