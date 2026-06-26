add_executable(astera_cli main.cpp)

target_link_libraries(astera_cli
    PRIVATE
        astera
        CLI11::CLI11
        fmt::fmt
        spdlog::spdlog
)

include(${CMAKE_SOURCE_DIR}/cmake/CompilerWarnings.cmake)
set_project_warnings(astera_cli)

include(${CMAKE_SOURCE_DIR}/cmake/Sanitizers.cmake)
enable_sanitizers(astera_cli)
