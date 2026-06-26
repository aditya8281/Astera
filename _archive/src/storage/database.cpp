#include "astera/storage/database.h"
#include <sqlite3.h>
#include <sstream>
#include <cstring>
#include <utility>

namespace astera::storage {

// ---- Statement ----

Statement::Statement(sqlite3* db, const std::string& sql) {
    sqlite3_prepare_v2(db, sql.c_str(), static_cast<int>(sql.size()), &stmt_, nullptr);
}

Statement::~Statement() {
    if (stmt_) sqlite3_finalize(stmt_);
}

Statement::Statement(Statement&& other) noexcept
    : stmt_(std::exchange(other.stmt_, nullptr)) {}

Statement& Statement::operator=(Statement&& other) noexcept {
    if (stmt_) sqlite3_finalize(stmt_);
    stmt_ = std::exchange(other.stmt_, nullptr);
    return *this;
}

void Statement::bind(int index, int64_t value) {
    sqlite3_bind_int64(stmt_, index, value);
}

void Statement::bind(int index, const std::string& value) {
    sqlite3_bind_text(stmt_, index, value.c_str(),
                      static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void Statement::bind(int index, std::string_view value) {
    sqlite3_bind_text(stmt_, index, value.data(),
                      static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void Statement::bind_null(int index) {
    sqlite3_bind_null(stmt_, index);
}

bool Statement::step() {
    return sqlite3_step(stmt_) == SQLITE_ROW;
}

void Statement::reset() {
    sqlite3_reset(stmt_);
}

int64_t Statement::column_int64(int index) {
    return sqlite3_column_int64(stmt_, index);
}

double Statement::column_double(int index) {
    return sqlite3_column_double(stmt_, index);
}

std::string Statement::column_string(int index) {
    auto text = sqlite3_column_text(stmt_, index);
    if (!text) return {};
    return reinterpret_cast<const char*>(text);
}

// ---- Transaction ----

Transaction::Transaction(sqlite3* db, const std::string& name)
    : db_(db), name_(name)
{
    std::string sql = "BEGIN TRANSACTION";
    if (!name.empty()) sql += " " + name;
    sqlite3_exec(db_, sql.c_str(), nullptr, nullptr, nullptr);
}

Transaction::~Transaction() {
    if (!committed_) {
        rollback();
    }
}

Transaction::Transaction(Transaction&& other) noexcept
    : db_(std::exchange(other.db_, nullptr))
    , committed_(other.committed_)
    , name_(std::move(other.name_))
{
    other.committed_ = true; // prevent double-rollback
}

Transaction& Transaction::operator=(Transaction&& other) noexcept {
    if (!committed_) rollback();
    db_ = std::exchange(other.db_, nullptr);
    committed_ = other.committed_;
    name_ = std::move(other.name_);
    other.committed_ = true;
    return *this;
}

void Transaction::commit() {
    if (!committed_) {
        sqlite3_exec(db_, "COMMIT", nullptr, nullptr, nullptr);
        committed_ = true;
    }
}

void Transaction::rollback() noexcept {
    if (!committed_) {
        sqlite3_exec(db_, "ROLLBACK", nullptr, nullptr, nullptr);
        committed_ = true;
    }
}

// ---- Database ----

Database::Database() = default;

Database::~Database() {
    close();
}

Database::Database(Database&& other) noexcept
    : db_(std::exchange(other.db_, nullptr))
    , schema_version_(other.schema_version_)
{}

Database& Database::operator=(Database&& other) noexcept {
    if (this != &other) {
        close();
        db_ = std::exchange(other.db_, nullptr);
        schema_version_ = other.schema_version_;
    }
    return *this;
}

core::Result<void> Database::open(const std::filesystem::path& path) {
    if (db_) close();

    int rc = sqlite3_open_v2(
        path.string().c_str(), &db_,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
        nullptr);

    if (rc != SQLITE_OK) {
        auto msg = std::string(sqlite3_errmsg(db_));
        sqlite3_close(db_);
        db_ = nullptr;
        // We'll return a generic failure since we can't use error categories yet
        return core::Errc::DatabaseError;
    }

    // Configure pragmas
    sqlite3_exec(db_, "PRAGMA journal_mode=WAL", nullptr, nullptr, nullptr);
    sqlite3_exec(db_, "PRAGMA synchronous=NORMAL", nullptr, nullptr, nullptr);
    sqlite3_exec(db_, "PRAGMA cache_size=-64000", nullptr, nullptr, nullptr);
    sqlite3_exec(db_, "PRAGMA foreign_keys=ON", nullptr, nullptr, nullptr);
    sqlite3_exec(db_, "PRAGMA busy_timeout=5000", nullptr, nullptr, nullptr);

    return {};
}

core::Result<void> Database::create_schema() {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_root TEXT NOT NULL,
            relative_path TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL,
            hash TEXT,
            size INTEGER NOT NULL DEFAULT 0,
            line_count INTEGER NOT NULL DEFAULT 0,
            indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_modified TEXT
        );

        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            start_line INTEGER NOT NULL DEFAULT 0,
            start_col INTEGER NOT NULL DEFAULT 0,
            end_line INTEGER NOT NULL DEFAULT 0,
            end_col INTEGER NOT NULL DEFAULT 0,
            doc_comment TEXT,
            properties TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            target_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            properties TEXT NOT NULL DEFAULT '{}',
            file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
            UNIQUE(source_node_id, target_node_id, kind)
        );

        CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);
        CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
        CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file_id);
        CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
        CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);
    )";

    char* err = nullptr;
    if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string msg = err ? err : "unknown error";
        sqlite3_free(err);
        return core::Errc::DatabaseError;
    }
    return {};
}

core::Result<void> Database::migrate() {
    // Version 1: core schema
    if (!has_table("nodes")) {
        auto r = create_schema();
        if (!r) return r;
    }

    // Version 2: FTS5 full-text search (optional — may not be compiled in)
    if (!has_table("nodes_fts")) {
        auto r = create_fts5();
        if (!r) {
            // FTS5 not available — continue with LIKE search
        }
    }

    return {};
}

void Database::close() {
    if (db_) {
        sqlite3_close(db_);
        db_ = nullptr;
    }
}

bool Database::has_table(const std::string& name) {
    Statement stmt(db_, "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1");
    stmt.bind(1, name);
    return stmt.step();
}

core::Result<void> Database::create_fts5() {
    const char* sql = R"(
        CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
            name, doc_comment, properties,
            content='nodes',
            content_rowid='id',
            tokenize='porter unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
            INSERT INTO nodes_fts(rowid, name, doc_comment, properties)
            VALUES (new.id, new.name, new.doc_comment, new.properties);
        END;

        CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
            INSERT INTO nodes_fts(nodes_fts, rowid, name, doc_comment, properties)
            VALUES ('delete', old.id, old.name, old.doc_comment, old.properties);
        END;

        CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
            INSERT INTO nodes_fts(nodes_fts, rowid, name, doc_comment, properties)
            VALUES ('delete', old.id, old.name, old.doc_comment, old.properties);
            INSERT INTO nodes_fts(rowid, name, doc_comment, properties)
            VALUES (new.id, new.name, new.doc_comment, new.properties);
        END;
    )";

    char* err = nullptr;
    if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string msg = err ? err : "unknown error";
        sqlite3_free(err);
        return core::Errc::DatabaseError;
    }

    return {};
}

Transaction Database::begin_transaction(const std::string& name) {
    return Transaction(db_, name);
}

core::Result<int64_t> Database::insert_file(const core::FileInfo& file) {
    auto tx = begin_transaction();

    Statement stmt(db_,
        "INSERT INTO files (repo_root, relative_path, language, hash, size, line_count, last_modified) "
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");

    stmt.bind(1, file.repo_root);
    stmt.bind(2, file.relative_path);
    stmt.bind(3, file.language);
    stmt.bind(4, file.hash);
    stmt.bind(5, file.size);
    stmt.bind(6, file.line_count);
    stmt.bind(7, file.last_modified);

    if (!stmt.step()) {
        // No row returned for INSERT — check if it succeeded via error
        // Actually INSERT doesn't return rows. Let's use sqlite3_last_insert_rowid
    }

    int64_t id = sqlite3_last_insert_rowid(db_);
    tx.commit();
    return id;
}

core::Result<std::optional<core::FileInfo>> Database::get_file(
    const std::string& relative_path)
{
    Statement stmt(db_,
        "SELECT id, repo_root, relative_path, language, hash, size, line_count, "
        "       indexed_at, last_modified "
        "FROM files WHERE relative_path = ?1");
    stmt.bind(1, relative_path);

    if (!stmt.step()) return std::optional<core::FileInfo>();

    core::FileInfo f;
    f.id = stmt.column_int64(0);
    f.relative_path = stmt.column_string(2);
    f.language = stmt.column_string(3);
    f.hash = stmt.column_string(4);
    f.size = stmt.column_int64(5);
    f.line_count = stmt.column_int64(6);
    return std::optional<core::FileInfo>(std::move(f));
}

core::Result<std::vector<int64_t>> Database::insert_nodes(
    std::span<const core::Symbol> nodes)
{
    std::vector<int64_t> ids;
    auto tx = begin_transaction();

    Statement stmt(db_,
        "INSERT INTO nodes (kind, name, file_id, start_line, start_col, end_line, end_col, doc_comment, properties) "
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)");

    for (const auto& node : nodes) {
        stmt.bind(1, std::string(core::to_string(node.kind)));
        stmt.bind(2, node.name);
        stmt.bind(3, node.file_id);
        stmt.bind(4, static_cast<int64_t>(node.span.start_line));
        stmt.bind(5, static_cast<int64_t>(node.span.start_col));
        stmt.bind(6, static_cast<int64_t>(node.span.end_line));
        stmt.bind(7, static_cast<int64_t>(node.span.end_col));
        if (node.doc_comment) {
            stmt.bind(8, *node.doc_comment);
        } else {
            stmt.bind_null(8);
        }
        stmt.bind(9, node.properties);

        stmt.step();
        stmt.reset();

        ids.push_back(sqlite3_last_insert_rowid(db_));
    }

    tx.commit();
    return ids;
}

core::Result<void> Database::insert_edges(std::span<const core::Edge> edges) {
    auto tx = begin_transaction();

    Statement stmt(db_,
        "INSERT OR IGNORE INTO edges (source_node_id, target_node_id, kind, properties, file_id) "
        "VALUES (?1, ?2, ?3, ?4, ?5)");

    for (const auto& edge : edges) {
        stmt.bind(1, edge.source_node_id);
        stmt.bind(2, edge.target_node_id);
        stmt.bind(3, std::string(core::to_string(edge.kind)));
        stmt.bind(4, edge.properties);
        stmt.bind(5, edge.file_id);
        stmt.step();
        stmt.reset();
    }

    tx.commit();
    return {};
}

core::Result<void> Database::delete_file(int64_t file_id) {
    Statement stmt(db_, "DELETE FROM files WHERE id = ?1");
    stmt.bind(1, file_id);
    stmt.step();
    return {};
}

core::Result<std::vector<core::Symbol>> Database::query_symbols(const SymbolQuery& q) {
    std::vector<core::Symbol> symbols;

    std::string sql = "SELECT id, kind, name, file_id, start_line, start_col, end_line, end_col, "
                      "       doc_comment, properties "
                      "FROM nodes WHERE 1=1";

    if (!q.name_prefix.empty()) sql += " AND name LIKE ?";
    if (q.kind)                  sql += " AND kind = ?";
    if (q.file_id)               sql += " AND file_id = ?";
    sql += " LIMIT ? OFFSET ?";

    Statement stmt(db_, sql);
    int param = 1;

    if (!q.name_prefix.empty()) {
        stmt.bind(param++, q.name_prefix + "%");
    }
    if (q.kind) {
        stmt.bind(param++, std::string(core::to_string(*q.kind)));
    }
    if (q.file_id) {
        stmt.bind(param++, *q.file_id);
    }
    stmt.bind(param++, q.limit);
    stmt.bind(param++, q.offset);

    while (stmt.step()) {
        core::Symbol sym;
        sym.id = stmt.column_int64(0);
        sym.name = stmt.column_string(2);
        sym.file_id = stmt.column_int64(3);
        sym.span.start_line = static_cast<uint32_t>(stmt.column_int64(4));
        sym.span.start_col = static_cast<uint32_t>(stmt.column_int64(5));
        sym.span.end_line = static_cast<uint32_t>(stmt.column_int64(6));
        sym.span.end_col = static_cast<uint32_t>(stmt.column_int64(7));
        auto comment = stmt.column_string(8);
        if (!comment.empty()) sym.doc_comment = comment;
        sym.properties = stmt.column_string(9);
        // Parse kind from string
        auto kind_str = stmt.column_string(1);
        auto parsed = core::node_kind_from_string(kind_str);
        if (parsed) sym.kind = *parsed;
        symbols.push_back(std::move(sym));
    }

    return symbols;
}

core::Result<std::optional<core::Symbol>> Database::get_symbol(int64_t id) {
    Statement stmt(db_,
        "SELECT id, kind, name, file_id, start_line, start_col, end_line, end_col, "
        "       doc_comment, properties "
        "FROM nodes WHERE id = ?1");
    stmt.bind(1, id);

    if (!stmt.step()) return std::optional<core::Symbol>();

    core::Symbol sym;
    sym.id = stmt.column_int64(0);
    sym.name = stmt.column_string(2);
    sym.file_id = stmt.column_int64(3);
    sym.span.start_line = static_cast<uint32_t>(stmt.column_int64(4));
    sym.span.start_col = static_cast<uint32_t>(stmt.column_int64(5));
    sym.span.end_line = static_cast<uint32_t>(stmt.column_int64(6));
    sym.span.end_col = static_cast<uint32_t>(stmt.column_int64(7));
    auto comment = stmt.column_string(8);
    if (!comment.empty()) sym.doc_comment = comment;
    sym.properties = stmt.column_string(9);
    // Parse kind from string
    auto kind_str = stmt.column_string(1);
    auto parsed = core::node_kind_from_string(kind_str);
    if (parsed) sym.kind = *parsed;
    return std::optional<core::Symbol>(std::move(sym));
}

core::Result<std::vector<core::Edge>> Database::get_edges(
    int64_t node_id, std::optional<core::EdgeKind> kind, bool inbound)
{
    std::vector<core::Edge> edges;

    std::ostringstream sql;
    if (inbound) {
        sql << "SELECT id, source_node_id, target_node_id, kind, properties, file_id "
            << "FROM edges WHERE target_node_id = ?1";
    } else {
        sql << "SELECT id, source_node_id, target_node_id, kind, properties, file_id "
            << "FROM edges WHERE source_node_id = ?1";
    }
    if (kind) {
        sql << " AND kind = ?2";
    }

    Statement stmt(db_, sql.str());
    stmt.bind(1, node_id);
    if (kind) {
        stmt.bind(2, std::string(core::to_string(*kind)));
    }

    while (stmt.step()) {
        core::Edge e;
        e.id = stmt.column_int64(0);
        e.source_node_id = stmt.column_int64(1);
        e.target_node_id = stmt.column_int64(2);
        e.file_id = stmt.column_int64(5);
        e.properties = stmt.column_string(4);
        auto kind_str = stmt.column_string(3);
        auto parsed = core::edge_kind_from_string(kind_str);
        if (parsed) e.kind = *parsed;
        edges.push_back(std::move(e));
    }

    return edges;
}

core::Result<std::vector<Database::SearchResult>> Database::search(
    const std::string& query, int limit)
{
    std::vector<SearchResult> results;

    // Try FTS5 search if available
    if (has_table("nodes_fts") && !query.empty()) {
        Statement stmt(db_,
            "SELECT n.id, n.kind, n.name, n.file_id, n.start_line, n.start_col, "
            "       n.end_line, n.end_col, n.doc_comment, n.properties, "
            "       rank "
            "FROM nodes_fts "
            "JOIN nodes n ON n.id = nodes_fts.rowid "
            "WHERE nodes_fts MATCH ?1 "
            "ORDER BY rank "
            "LIMIT ?2");

        // Use FTS5 prefix match: append * for simple queries
        std::string fts_query = query;
        bool needs_star = true;
        for (char c : fts_query) {
            if (c == '*' || c == '"' || c == '(' || c == ')' || c == ' ') {
                needs_star = false;
                break;
            }
        }
        if (needs_star) fts_query += "*";

        stmt.bind(1, fts_query);
        stmt.bind(2, limit);

        while (stmt.step()) {
            SearchResult sr;
            sr.symbol.id = stmt.column_int64(0);
            sr.symbol.name = stmt.column_string(2);
            sr.symbol.file_id = stmt.column_int64(3);
            sr.symbol.span.start_line = static_cast<uint32_t>(stmt.column_int64(4));
            sr.symbol.span.start_col = static_cast<uint32_t>(stmt.column_int64(5));
            sr.symbol.span.end_line = static_cast<uint32_t>(stmt.column_int64(6));
            sr.symbol.span.end_col = static_cast<uint32_t>(stmt.column_int64(7));
            auto comment = stmt.column_string(8);
            if (!comment.empty()) sr.symbol.doc_comment = comment;
            sr.symbol.properties = stmt.column_string(9);
            auto kind_str = stmt.column_string(1);
            auto parsed = core::node_kind_from_string(kind_str);
            if (parsed) sr.symbol.kind = *parsed;
            sr.rank = stmt.column_double(10);
            results.push_back(std::move(sr));
        }

        if (!results.empty()) return results;
    }

    // Fallback: LIKE-based search
    Statement stmt(db_,
        "SELECT id, kind, name, file_id, start_line, start_col, end_line, end_col, "
        "       doc_comment, properties "
        "FROM nodes WHERE name LIKE ?1 OR doc_comment LIKE ?1 "
        "LIMIT ?2");
    stmt.bind(1, "%" + query + "%");
    stmt.bind(2, limit);

    while (stmt.step()) {
        SearchResult sr;
        sr.symbol.id = stmt.column_int64(0);
        sr.symbol.name = stmt.column_string(2);
        sr.symbol.file_id = stmt.column_int64(3);
        sr.symbol.span.start_line = static_cast<uint32_t>(stmt.column_int64(4));
        sr.symbol.span.start_col = static_cast<uint32_t>(stmt.column_int64(5));
        sr.symbol.span.end_line = static_cast<uint32_t>(stmt.column_int64(6));
        sr.symbol.span.end_col = static_cast<uint32_t>(stmt.column_int64(7));
        auto comment = stmt.column_string(8);
        if (!comment.empty()) sr.symbol.doc_comment = comment;
        sr.symbol.properties = stmt.column_string(9);
        auto kind_str = stmt.column_string(1);
        auto parsed = core::node_kind_from_string(kind_str);
        if (parsed) sr.symbol.kind = *parsed;
        sr.rank = 1.0;
        results.push_back(std::move(sr));
    }

    return results;
}

} // namespace astera::storage
