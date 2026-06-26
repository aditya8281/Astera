#include "astera/discovery/walker.h"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>

namespace astera::discovery {

/// Simple glob match — supports * (any non-slash chars). Phase 2: full **, ?, [...] support.
static bool match_glob(std::string_view pattern, std::string_view name) {
    auto pi = pattern.begin(), pe = pattern.end();
    auto ni = name.begin(), ne = name.end();
    while (pi != pe) {
        if (*pi == '*') {
            ++pi;
            // Trailing * matches everything
            if (pi == pe) return true;
            // Try each suffix position
            while (ni != ne) {
                if (match_glob(std::string_view(&*pi, static_cast<size_t>(pe - pi)), std::string_view(&*ni, static_cast<size_t>(ne - ni))))
                    return true;
                ++ni;
            }
            return false;
        }
        if (ni == ne || *pi != *ni) return false;
        ++pi; ++ni;
    }
    return ni == ne;
}

// ---- GitIgnoreMatcher ----

bool GitIgnoreMatcher::load(const std::filesystem::path& path) {
    std::ifstream file(path);
    if (!file) return false;
    std::stringstream buffer;
    buffer << file.rdbuf();
    load_string(buffer.str());
    return true;
}

void GitIgnoreMatcher::load_string(std::string_view content) {
    patterns_.clear();
    std::istringstream stream{std::string(content)};
    std::string line;
    while (std::getline(stream, line)) {
        // Trim
        auto start = line.find_first_not_of(" \t\r\n");
        if (start == std::string::npos) continue;
        auto end = line.find_last_not_of(" \t\r\n");
        line = line.substr(start, end - start + 1);

        // Skip comments and empty
        if (line.empty() || line[0] == '#') continue;

        Pattern p;
        // Negation
        if (line[0] == '!') {
            p.negate = true;
            line = line.substr(1);
        }
        // Directory-only
        if (!line.empty() && line.back() == '/') {
            p.dir_only = true;
            line.pop_back();
        }

        // Store without leading ./ or /
        if (line.size() >= 2 && line[0] == '.' && line[1] == '/')
            line = line.substr(2);
        else if (!line.empty() && line[0] == '/')
            line = line.substr(1);

        p.pattern = line;
        patterns_.push_back(std::move(p));
    }
}

bool GitIgnoreMatcher::is_ignored(
    const std::filesystem::path& relative_path, bool is_directory) const
{
    std::string path_str = relative_path.generic_string();
    bool ignored = false;

    for (const auto& p : patterns_) {
        if (p.dir_only && !is_directory) continue;

        if (p.pattern.find('/') == std::string::npos) {
            // Pattern without slash applies to leaf name
            auto leaf = relative_path.filename().generic_string();
            if (match_glob(p.pattern, leaf)) {
                ignored = !p.negate;
            }
        } else {
            // Pattern with slash matches against full relative path
            if (match_glob(p.pattern, path_str) ||
                (path_str.size() > p.pattern.size() &&
                 path_str.compare(path_str.size() - p.pattern.size(),
                                  p.pattern.size(), p.pattern) == 0 &&
                 path_str[path_str.size() - p.pattern.size() - 1] == '/'))
            {
                ignored = !p.negate;
            }
        }
    }
    return ignored;
}

// ---- FileWalker ----

FileWalker::FileWalker(const core::DiscoveryConfig& config) : config_(config) {}

core::Result<std::vector<core::FileInfo>> FileWalker::walk(
    const std::filesystem::path& root)
{
    std::vector<std::filesystem::path> gitignore_files;
    // Collect all .gitignore files from root and subdirectories
    // For Phase 1, just check root
    auto root_gitignore = root / ".gitignore";
    if (std::filesystem::exists(root_gitignore)) {
        gitignore_files.push_back(root_gitignore);
    }
    return walk(root, gitignore_files);
}

core::Result<std::vector<core::FileInfo>> FileWalker::walk(
    const std::filesystem::path& root,
    const std::vector<std::filesystem::path>& gitignore_files)
{
    // Load gitignore patterns
    GitIgnoreMatcher gitignore;
    for (const auto& gif : gitignore_files) {
        gitignore.load(gif);
    }

    std::vector<core::FileInfo> files;

    if (!std::filesystem::exists(root)) {
        return core::Errc::InvalidPath;
    }

    for (const auto& entry :
         std::filesystem::recursive_directory_iterator(root,
             std::filesystem::directory_options::skip_permission_denied))
    {
        if (!entry.is_regular_file()) continue;

        auto rel_path = std::filesystem::relative(entry.path(), root);
        auto size = entry.file_size();

        // Size check
        if (size > config_.max_file_size) continue;

        // Gitignore check
        if (gitignore.is_ignored(rel_path, false)) continue;

        // Skip hidden files and common non-source dirs
        auto leaf = rel_path.filename().string();
        if (!leaf.empty() && leaf[0] == '.') continue;

        core::FileInfo info;
        info.relative_path = rel_path.generic_string();
        info.size = static_cast<int64_t>(size);
        files.push_back(std::move(info));
    }

    return files;
}

} // namespace astera::discovery
