#include "astera/core/error.h"

namespace astera::core {

namespace {
    struct ErrorCategory : std::error_category {
        const char* name() const noexcept override { return "astera"; }
        std::string message(int ev) const override {
            switch (static_cast<Errc>(ev)) {
                case Errc::Success: return "success";
                case Errc::FileNotFound: return "file not found";
                case Errc::FileNotReadable: return "file not readable";
                case Errc::InvalidPath: return "invalid path";
                case Errc::ParserError: return "parser error";
                case Errc::LanguageNotSupported: return "language not supported";
                case Errc::GrammarNotFound: return "grammar not found";
                case Errc::ConfigParseError: return "config parse error";
                case Errc::DatabaseError: return "database error";
                case Errc::DatabaseCorrupt: return "database corrupt";
                case Errc::SchemaMismatch: return "schema version mismatch";
                case Errc::RepoNotFound: return "repository not found";
                case Errc::SymbolNotFound: return "symbol not found";
                case Errc::IndexInProgress: return "index already in progress";
                case Errc::NotIndexed: return "repository has not been indexed";
                case Errc::InvalidParameter: return "invalid parameter";
                case Errc::InternalError: return "internal error";
            }
            return "unknown error";
        }
    };
    const ErrorCategory category;
}

std::error_code make_error_code(Errc e) noexcept {
    return {static_cast<int>(e), category};
}

} // namespace astera::core
