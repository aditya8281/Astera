include(GoogleTest)

# -- Test: types --
add_executable(test_types test_types.cpp)
target_link_libraries(test_types PRIVATE astera GTest::gmock_main)
gtest_discover_tests(test_types)

# -- Test: discovery --
add_executable(test_discovery test_discovery.cpp)
target_link_libraries(test_discovery PRIVATE astera GTest::gmock_main)
gtest_discover_tests(test_discovery)

# -- Test: storage --
add_executable(test_storage test_storage.cpp)
target_link_libraries(test_storage PRIVATE astera GTest::gmock_main)
gtest_discover_tests(test_storage)

# -- Test: parser (Phase 1.2) --
# add_executable(test_parser test_parser.cpp)
# target_link_libraries(test_parser PRIVATE astera GTest::gmock_main)
# gtest_discover_tests(test_parser)
