#include <iostream>
#include <cstdlib>
#include <filesystem>
#include <vector>

#include <fmt/format.h>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <CLI/CLI.hpp>

#include "astera/core/types.h"
#include "astera/core/config.h"
#include "astera/core/error.h"
#include "astera/discovery/walker.h"
#include "astera/discovery/classifier.h"
#include "astera/storage/database.h"

namespace fs = std::filesystem;
using namespace astera::core;
using namespace astera::discovery;
using namespace astera::storage;

int cmd_init(const fs::path& path) {
    auto astera_dir = path / ".astera";
    if (fs::exists(astera_dir)) {
        fmt::print("Astera already initialized at {}\n", astera_dir.string());
        return 0;
    }

    fs::create_directories(astera_dir);
    create_default_config(astera_dir / "config.toml");

    fmt::print("Initialized Astera index at {}\n", astera_dir.string());
    return 0;
}

int cmd_index(const fs::path& path) {
    fmt::print("Indexing repository: {}\n", path.string());

    // Discovery
    DiscoveryConfig disc_config;
    FileWalker walker(disc_config);
    auto files_result = walker.walk(path);

    if (!files_result) {
        fmt::print(stderr, "Error walking filesystem: {}\n",
                   files_result.error().message());
        return 1;
    }

    auto files = files_result.value();
    fmt::print("Found {} files\n", files.size());

    // For each file, classify language
    LanguageClassifier classifier;
    for (auto& f : files) {
        f.repo_root = path.string();
        f.language = classifier.classify_file(f.relative_path);
        if (f.language.empty()) {
            f.language = "unknown";
        }
    }

    // Filter to supported languages for Phase 1
    std::vector<FileInfo> supported;
    for (const auto& f : files) {
        if (f.language != "unknown") {
            supported.push_back(f);
        }
    }
    fmt::print("Supported language files: {}\n", supported.size());

    // Open database
    auto astera_dir = path / ".astera";
    if (!fs::exists(astera_dir)) {
        fmt::print(stderr, "Not initialized. Run 'astera init' first.\n");
        return 1;
    }

    Database db;
    auto open_result = db.open(astera_dir / "index.db");
    if (!open_result) {
        fmt::print(stderr, "Failed to open database: {}\n",
                   open_result.error().message());
        return 1;
    }

    auto migrate_result = db.migrate();
    if (!migrate_result) {
        fmt::print(stderr, "Failed to migrate database: {}\n",
                   migrate_result.error().message());
        return 1;
    }

    // Insert files
    for (const auto& f : supported) {
        auto id_result = db.insert_file(f);
        if (!id_result) {
            fmt::print(stderr, "Failed to insert file {}: {}\n",
                       f.relative_path, id_result.error().message());
        }
    }

    fmt::print("Indexing complete.\n");
    return 0;
}

int cmd_serve(const fs::path& path, const std::string& host, uint16_t port) {
    fmt::print("API server starting on {}:{}\n", host, port);
    fmt::print("Phase 2: Drogon HTTP server\n");
    (void)path;
    return 0;
}

int main(int argc, char** argv) {
    // Setup logging
    auto logger = spdlog::stdout_color_mt("astera");
    spdlog::set_default_logger(logger);
    spdlog::set_level(spdlog::level::info);

    CLI::App app{"Astera — structural code analysis engine"};

    std::string repo_path = ".";
    std::string host = "127.0.0.1";
    uint16_t port = 8080;

    // Global option
    app.add_option("-p,--project", repo_path, "Path to repository");

    // init
    auto* init_cmd = app.add_subcommand("init", "Initialize a repository for indexing");
    init_cmd->callback([&]() { return cmd_init(repo_path); });

    // index
    auto* index_cmd = app.add_subcommand("index", "Index a repository");
    index_cmd->callback([&]() { return cmd_index(repo_path); });

    // serve
    auto* serve_cmd = app.add_subcommand("serve", "Start the API server");
    serve_cmd->add_option("--host", host, "Host to bind to");
    serve_cmd->add_option("--port", port, "Port to bind to");
    serve_cmd->callback([&]() { return cmd_serve(repo_path, host, port); });

    // Require a subcommand
    app.require_subcommand(1);

    try {
        app.parse(argc, argv);
    } catch (const CLI::ParseError& e) {
        return app.exit(e);
    }

    return 0;
}
