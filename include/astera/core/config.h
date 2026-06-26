#ifndef ASTERA_CORE_CONFIG_H
#define ASTERA_CORE_CONFIG_H

#include <string>
#include <vector>
#include <optional>
#include <filesystem>
#include "export.h"

namespace astera::core {

struct ASTERA_EXPORT LanguageConfig {
    std::vector<std::string> extensions;
    bool enabled = true;
};

struct ASTERA_EXPORT DiscoveryConfig {
    std::vector<std::string> exclude_patterns = {
        "node_modules", "__pycache__", ".git", ".svn",
        "target", "build", "dist", ".astera", "vcpkg"
    };
    size_t max_file_size = 10 * 1024 * 1024; // 10MB
};

struct ASTERA_EXPORT ServerConfig {
    std::string host = "127.0.0.1";
    uint16_t port = 8080;
    std::string web_root;
};

struct ASTERA_EXPORT AsteraConfig {
    std::string repo_path;
    DiscoveryConfig discovery;
    ServerConfig server;
    std::vector<std::string> languages; // enabled languages
};

// Load config from a TOML file. Returns defaults if file doesn't exist.
ASTERA_EXPORT AsteraConfig load_config(const std::filesystem::path& path);

// Create a default config file at the given path.
ASTERA_EXPORT bool create_default_config(const std::filesystem::path& path);

} // namespace astera::core

#endif // ASTERA_CORE_CONFIG_H
