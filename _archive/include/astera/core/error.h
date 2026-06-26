#ifndef ASTERA_CORE_ERROR_H
#define ASTERA_CORE_ERROR_H

#include <string>
#include <system_error>
#include <string_view>
#include <optional>
#include "export.h"

namespace astera::core {

enum class ASTERA_EXPORT Errc {
    Success = 0,
    FileNotFound,
    FileNotReadable,
    InvalidPath,
    ParserError,
    LanguageNotSupported,
    GrammarNotFound,
    ConfigParseError,
    DatabaseError,
    DatabaseCorrupt,
    SchemaMismatch,
    RepoNotFound,
    SymbolNotFound,
    IndexInProgress,
    NotIndexed,
    InvalidParameter,
    InternalError,
};

ASTERA_EXPORT std::error_code make_error_code(Errc e) noexcept;

// Simple Result type for hot paths where exceptions are undesirable
template <typename T>
class Result {
public:
    Result(T value) : value_(std::move(value)) {}
    Result(Errc err) : err_(make_error_code(err)) {}
    Result(std::error_code err) : err_(err) {}

    explicit operator bool() const noexcept { return !err_; }
    bool has_value() const noexcept { return !err_; }
    bool has_error() const noexcept { return !!err_; }

    T& value() {
        // user should check has_value first; panic in debug if not
        return *value_;
    }

    const T& value() const { return *value_; }

    std::error_code error() const noexcept { return err_; }

    template <typename F>
    T or_else(F&& f) {
        if (value_) return std::move(*value_);
        return f();
    }

private:
    std::optional<T> value_;
    std::error_code err_;
};

// Specialization for void
template <>
class Result<void> {
public:
    Result() = default;
    Result(Errc err) : err_(make_error_code(err)) {}
    Result(std::error_code err) : err_(err) {}

    explicit operator bool() const noexcept { return !err_; }
    bool has_value() const noexcept { return !err_; }
    std::error_code error() const noexcept { return err_; }

private:
    std::error_code err_{};
};

} // namespace astera::core

namespace std {
    template <>
    struct is_error_code_enum<astera::core::Errc> : true_type {};
}

#endif // ASTERA_CORE_ERROR_H
