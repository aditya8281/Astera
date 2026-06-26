#ifndef ASTERA_DISCOVERY_WALKER_H
#define ASTERA_DISCOVERY_WALKER_H

#include <vector>
#include <filesystem>
#include <string>
#include "astera/core/types.h"
#include "astera/core/error.h"
#include "astera/core/config.h"

namespace astera::discovery {

// .gitignore pattern matcher — supports basic gitignore patterns.
class ASTERA_EXPORT GitIgnoreMatcher {
public:
    GitIgnoreMatcher() = default;

    // Load .gitignore patterns from a file.
    bool load(const std::filesystem::path& path);

    // Load from an inline string (for testing).
    void load_string(std::string_view content);

    // Returns true if the given relative path should be ignored.
    bool is_ignored(const std::filesystem::path& relative_path, bool is_directory) const;

private:
    struct Pattern {
        std::string pattern;
        bool negate = false;
        bool dir_only = false;
    };
    std::vector<Pattern> patterns_;
};

// Recursively walks a directory and returns files suitable for indexing.
class ASTERA_EXPORT FileWalker {
public:
    explicit FileWalker(const core::DiscoveryConfig& config);

    // Walk the given root path and return matching files.
    core::Result<std::vector<core::FileInfo>> walk(
        const std::filesystem::path& root);

    // Walk with an explicit set of gitignore paths.
    core::Result<std::vector<core::FileInfo>> walk(
        const std::filesystem::path& root,
        const std::vector<std::filesystem::path>& gitignore_files);

private:
    core::DiscoveryConfig config_;
};

} // namespace astera::discovery

#endif // ASTERA_DISCOVERY_WALKER_H
