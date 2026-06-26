#include <gtest/gtest.h>
#include <filesystem>
#include <fstream>
#include <cstdlib>

#include "astera/discovery/walker.h"
#include "astera/discovery/classifier.h"

using namespace astera::discovery;
using namespace astera::core;

class TempDir {
public:
    TempDir() {
        path_ = std::filesystem::temp_directory_path() / "astera-test-XXXXXX";
        // Use mkdtemp equivalent
        auto s = path_.string();
        if (mkdtemp(s.data())) {
            path_ = s;
        }
    }
    ~TempDir() {
        std::filesystem::remove_all(path_);
    }
    const std::filesystem::path& path() const { return path_; }

private:
    std::filesystem::path path_;
};

TEST(GitIgnoreTest, EmptyIgnoresNothing) {
    GitIgnoreMatcher matcher;
    matcher.load_string("");
    EXPECT_FALSE(matcher.is_ignored("foo.txt", false));
}

TEST(GitIgnoreTest, SimpleFileName) {
    GitIgnoreMatcher matcher;
    matcher.load_string("node_modules\nbuild\n");
    EXPECT_TRUE(matcher.is_ignored("node_modules", true));
    EXPECT_TRUE(matcher.is_ignored("build", true));
    EXPECT_FALSE(matcher.is_ignored("src/main.ts", false));
}

TEST(GitIgnoreTest, Negation) {
    GitIgnoreMatcher matcher;
    matcher.load_string("*.log\n!important.log\n");
    EXPECT_TRUE(matcher.is_ignored("debug.log", false));
    EXPECT_FALSE(matcher.is_ignored("important.log", false));
}

TEST(ClassifierTest, KnownExtensions) {
    LanguageClassifier classifier;
    EXPECT_EQ(classifier.classify(".ts"), "typescript");
    EXPECT_EQ(classifier.classify(".py"), "python");
    EXPECT_EQ(classifier.classify(".js"), "javascript");
    EXPECT_EQ(classifier.classify(".rs"), "rust");
}

TEST(ClassifierTest, ClassifyFile) {
    LanguageClassifier classifier;
    EXPECT_EQ(classifier.classify_file("main.ts"), "typescript");
    EXPECT_EQ(classifier.classify_file("app.py"), "python");
    EXPECT_EQ(classifier.classify_file("Makefile"), "");
}

TEST(ClassifierTest, UnknownExtension) {
    LanguageClassifier classifier;
    EXPECT_EQ(classifier.classify(".xyz"), "");
    EXPECT_FALSE(classifier.is_supported(".xyz"));
}

TEST(FileWalkerTest, EmptyDirectory) {
    TempDir dir;
    DiscoveryConfig config;
    FileWalker walker(config);
    auto result = walker.walk(dir.path());
    EXPECT_TRUE(result.has_value());
    EXPECT_TRUE(result.value().empty());
}

TEST(FileWalkerTest, SkipsGitIgnored) {
    TempDir dir;

    // Create a file
    std::ofstream(dir.path() / "main.ts") << "let x = 1;";
    std::ofstream(dir.path() / ".gitignore") << "*.ts\n";

    DiscoveryConfig config;
    FileWalker walker(config);
    auto result = walker.walk(dir.path(), {dir.path() / ".gitignore"});
    EXPECT_TRUE(result.has_value());
    EXPECT_TRUE(result.value().empty()); // .ts should be ignored
}

TEST(FileWalkerTest, FindsSourceFiles) {
    TempDir dir;
    std::ofstream(dir.path() / "main.ts") << "let x = 1;";
    std::ofstream(dir.path() / "app.py") << "print('hello')";

    DiscoveryConfig config;
    FileWalker walker(config);
    auto result = walker.walk(dir.path());
    EXPECT_TRUE(result.has_value());
    EXPECT_EQ(result.value().size(), 2);
}
