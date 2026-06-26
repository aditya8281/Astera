# Sanitizer configuration for debug builds

function(enable_sanitizers target)
    if(NOT CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        return()
    endif()

    set(SANITIZERS "")

    if(ASTERA_ENABLE_ASAN)
        list(APPEND SANITIZERS "address")
    endif()

    if(ASTERA_ENABLE_UBSAN)
        list(APPEND SANITIZERS "undefined")
    endif()

    if(ASTERA_ENABLE_TSAN)
        list(APPEND SANITIZERS "thread")
    endif()

    if(SANITIZERS)
        list(JOIN SANITIZERS "," SANITIZER_FLAGS)
        target_compile_options(${target} PRIVATE -fsanitize=${SANITIZER_FLAGS})
        target_link_options(${target} PRIVATE -fsanitize=${SANITIZER_FLAGS})
    endif()
endfunction()
