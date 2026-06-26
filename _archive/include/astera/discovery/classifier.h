#ifndef ASTERA_DISCOVERY_CLASSIFIER_H
#define ASTERA_DISCOVERY_CLASSIFIER_H

#include <string>
#include <string_view>
#include <unordered_map>
#include "astera/core/export.h"

namespace astera::discovery {

// Maps file extensions to language names.
class ASTERA_EXPORT LanguageClassifier {
public:
    LanguageClassifier();

    // Given a file extension (e.g., ".ts", ".py"), returns the language name.
    // Returns empty string for unknown extensions.
    std::string classify(std::string_view extension) const;

    // Given a full filename, returns the language name based on its extension.
    std::string classify_file(std::string_view filename) const;

    // Returns true if the extension is recognized.
    bool is_supported(std::string_view extension) const;

    // Available languages
    const std::unordered_map<std::string, std::string>& extensions() const { return map_; }

private:
    std::unordered_map<std::string, std::string> map_;
};

} // namespace astera::discovery

#endif // ASTERA_DISCOVERY_CLASSIFIER_H
