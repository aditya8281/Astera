#include "astera/core/types.h"

namespace astera::core {

std::string_view to_string(NodeKind kind) noexcept {
    using enum NodeKind;
    switch (kind) {
        case File: return "File";
        case Module: return "Module";
        case Function: return "Function";
        case Class: return "Class";
        case Method: return "Method";
        case Interface: return "Interface";
        case Enum: return "Enum";
        case Variable: return "Variable";
        case Field: return "Field";
        case Parameter: return "Parameter";
        case TypeAlias: return "TypeAlias";
        case Import: return "Import";
        case Macro: return "Macro";
        case Anonymous: return "Anonymous";
    }
    return "Unknown";
}

std::optional<NodeKind> node_kind_from_string(std::string_view s) noexcept {
    using enum NodeKind;
    if (s == "File") return File;
    if (s == "Module") return Module;
    if (s == "Function") return Function;
    if (s == "Class") return Class;
    if (s == "Method") return Method;
    if (s == "Interface") return Interface;
    if (s == "Enum") return Enum;
    if (s == "Variable") return Variable;
    if (s == "Field") return Field;
    if (s == "Parameter") return Parameter;
    if (s == "TypeAlias") return TypeAlias;
    if (s == "Import") return Import;
    if (s == "Macro") return Macro;
    if (s == "Anonymous") return Anonymous;
    return std::nullopt;
}

std::optional<EdgeKind> edge_kind_from_string(std::string_view s) noexcept {
    using enum EdgeKind;
    if (s == "Contains") return Contains;
    if (s == "Calls") return Calls;
    if (s == "References") return References;
    if (s == "Defines") return Defines;
    if (s == "Inherits") return Inherits;
    if (s == "Implements") return Implements;
    if (s == "Overrides") return Overrides;
    if (s == "Imports") return Imports;
    if (s == "Exports") return Exports;
    if (s == "DependsOn") return DependsOn;
    if (s == "Declares") return Declares;
    return std::nullopt;
}

std::string_view to_string(EdgeKind kind) noexcept {
    using enum EdgeKind;
    switch (kind) {
        case Contains: return "Contains";
        case Calls: return "Calls";
        case References: return "References";
        case Defines: return "Defines";
        case Inherits: return "Inherits";
        case Implements: return "Implements";
        case Overrides: return "Overrides";
        case Imports: return "Imports";
        case Exports: return "Exports";
        case DependsOn: return "DependsOn";
        case Declares: return "Declares";
    }
    return "Unknown";
}

} // namespace astera::core
