#include "astera/discovery/classifier.h"

namespace astera::discovery {

LanguageClassifier::LanguageClassifier() {
    map_[".ts"] = "typescript";
    map_[".tsx"] = "typescript";
    map_[".js"] = "javascript";
    map_[".jsx"] = "javascript";
    map_[".mjs"] = "javascript";
    map_[".cjs"] = "javascript";
    map_[".py"] = "python";
    map_[".rs"] = "rust";
    map_[".go"] = "go";
    map_[".c"] = "c";
    map_[".h"] = "c";
    map_[".cpp"] = "cpp";
    map_[".hpp"] = "cpp";
    map_[".cc"] = "cpp";
    map_[".cxx"] = "cpp";
    map_[".java"] = "java";
    map_[".rb"] = "ruby";
    map_[".php"] = "php";
    map_[".swift"] = "swift";
    map_[".kt"] = "kotlin";
    map_[".scala"] = "scala";
    map_[".rs"] = "rust";
}

std::string LanguageClassifier::classify(std::string_view extension) const {
    auto it = map_.find(std::string(extension));
    if (it != map_.end()) return it->second;
    return {};
}

std::string LanguageClassifier::classify_file(std::string_view filename) const {
    auto pos = filename.rfind('.');
    if (pos == std::string::npos) return {};
    return classify(filename.substr(pos));
}

bool LanguageClassifier::is_supported(std::string_view extension) const {
    return map_.contains(std::string(extension));
}

} // namespace astera::discovery
