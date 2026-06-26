#include <gtest/gtest.h>
#include "astera/core/types.h"

using namespace astera::core;

TEST(TypesTest, NodeKindToString) {
    EXPECT_EQ(to_string(NodeKind::Function), "Function");
    EXPECT_EQ(to_string(NodeKind::Class), "Class");
    EXPECT_EQ(to_string(NodeKind::File), "File");
}

TEST(TypesTest, EdgeKindToString) {
    EXPECT_EQ(to_string(EdgeKind::Calls), "Calls");
    EXPECT_EQ(to_string(EdgeKind::Contains), "Contains");
    EXPECT_EQ(to_string(EdgeKind::Inherits), "Inherits");
}

TEST(TypesTest, SourceSpanContains) {
    SourceSpan span{2, 1, 10, 80};
    EXPECT_TRUE(span.contains(2, 1));
    EXPECT_TRUE(span.contains(5, 30));
    EXPECT_TRUE(span.contains(10, 80));
    EXPECT_FALSE(span.contains(1, 1));
    EXPECT_FALSE(span.contains(10, 81));
    EXPECT_FALSE(span.contains(2, 0));
}

TEST(TypesTest, DefaultSourceSpan) {
    SourceSpan span;
    EXPECT_EQ(span.start_line, 0);
    EXPECT_EQ(span.end_line, 0);
    EXPECT_FALSE(span.contains(0, 0)); // Should be empty
}
