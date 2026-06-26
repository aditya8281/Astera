# libastera — core static library
add_library(astera STATIC
    core/types.cpp
    core/error.cpp
    core/config.cpp
    discovery/walker.cpp
    discovery/classifier.cpp
    parser/parser.cpp
    storage/database.cpp
)

target_include_directories(astera
    PUBLIC
        ${CMAKE_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_SOURCE_DIR}/src
)

target_link_libraries(astera
    PUBLIC
        tree-sitter::tree-sitter
        nlohmann_json::nlohmann_json
        SQLite::SQLite3
        fmt::fmt
        spdlog::spdlog
)

# Link tree-sitter language grammars (downloaded via FetchContent)
foreach(grammar javascript typescript tsx python)
    if(TARGET tsg-${grammar})
        target_link_libraries(astera PRIVATE tsg-${grammar})
    endif()
endforeach()

# Compiler warnings
include(${CMAKE_SOURCE_DIR}/cmake/CompilerWarnings.cmake)
set_project_warnings(astera)

# Sanitizers
include(${CMAKE_SOURCE_DIR}/cmake/Sanitizers.cmake)
enable_sanitizers(astera)
