#include "astera/core/config.h"
#include <fstream>
#include <sstream>

namespace astera::core {

AsteraConfig load_config(const std::filesystem::path& path) {
    AsteraConfig config;
    // For Phase 1, just return defaults with repo_path set
    // Phase 2: parse TOML properly (using tomlplusplus or similar)
    config.repo_path = path.string();
    return config;
}

bool create_default_config(const std::filesystem::path& path) {
    std::ofstream ofs(path);
    if (!ofs) return false;

    ofs << "# Astera configuration\n\n";
    ofs << "[discovery]\n";
    ofs << "max_file_size = 10485760\n";
    ofs << "exclude_patterns = [\"node_modules\", \"__pycache__\", \".git\", \"build\", \"target\"]\n\n";
    ofs << "[server]\n";
    ofs << "host = \"127.0.0.1\"\n";
    ofs << "port = 8080\n";
    return true;
}

} // namespace astera::core
