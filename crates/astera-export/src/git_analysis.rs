use serde::{Deserialize, Serialize};

/// Represents a change between two git commits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiff {
    pub from_commit: String,
    pub to_commit: String,
    pub files_changed: Vec<GitFileChange>,
    pub total_additions: u32,
    pub total_deletions: u32,
}

/// A single file change between commits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
    pub path: String,
    pub language: Option<String>,
    pub change_type: ChangeType,
    pub additions: u32,
    pub deletions: u32,
    pub symbols_affected: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Added,
    Modified,
    Deleted,
    Renamed,
}

/// Analyze git diff between two commits and correlate with indexed data
pub fn analyze_git_diff(from_commit: &str, to_commit: &str, diff_output: &str) -> GitDiff {
    let mut files_changed = Vec::new();
    let mut total_additions = 0u32;
    let mut total_deletions = 0u32;

    let mut current_file: Option<String> = None;
    let mut current_additions = 0u32;
    let mut current_deletions = 0u32;

    for line in diff_output.lines() {
        if line.starts_with("diff --git") {
            // Save previous file
            if let Some(path) = current_file.take() {
                total_additions += current_additions;
                total_deletions += current_deletions;
                files_changed.push(GitFileChange {
                    path,
                    language: None, // will be filled in later
                    change_type: ChangeType::Modified,
                    additions: current_additions,
                    deletions: current_deletions,
                    symbols_affected: Vec::new(),
                });
                current_additions = 0;
                current_deletions = 0;
            }
            // Extract filename from "diff --git a/path b/path"
            if let Some(pos) = line.rfind(" b/") {
                current_file = Some(line[pos + 3..].to_string());
            }
        } else if line.starts_with('+') && !line.starts_with("+++") {
            current_additions += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            current_deletions += 1;
        }
    }

    // Save last file
    if let Some(path) = current_file {
        total_additions += current_additions;
        total_deletions += current_deletions;
        files_changed.push(GitFileChange {
            path,
            language: None,
            change_type: ChangeType::Modified,
            additions: current_additions,
            deletions: current_deletions,
            symbols_affected: Vec::new(),
        });
    }

    GitDiff {
        from_commit: from_commit.to_string(),
        to_commit: to_commit.to_string(),
        files_changed,
        total_additions,
        total_deletions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_empty_diff() {
        let diff = analyze_git_diff("abc123", "def456", "");
        assert_eq!(diff.files_changed.len(), 0);
        assert_eq!(diff.total_additions, 0);
        assert_eq!(diff.total_deletions, 0);
    }

    #[test]
    fn test_analyze_single_file_diff() {
        let diff_output = r#"diff --git a/src/main.rs b/src/main.rs
index 1234567..abcdefg 100644
--- a/src/main.rs
+++ b/src/main.rs
@@ -1,5 +1,6 @@
 fn main() {
+    let x = 1;
     println!("hello");
 }
"#;
        let diff = analyze_git_diff("abc123", "def456", diff_output);
        assert_eq!(diff.files_changed.len(), 1);
        assert_eq!(diff.files_changed[0].path, "src/main.rs");
        assert_eq!(diff.files_changed[0].additions, 1);
        assert_eq!(diff.files_changed[0].deletions, 0);
        assert_eq!(diff.total_additions, 1);
    }

    #[test]
    fn test_analyze_multi_file_diff() {
        let diff_output = r#"diff --git a/src/a.rs b/src/a.rs
--- a/src/a.rs
+++ b/src/a.rs
@@ -1 +1,2 @@
+line1
+line2
diff --git a/src/b.rs b/src/b.rs
--- a/src/b.rs
+++ b/src/b.rs
@@ -1 +1 @@
-old
+new
"#;
        let diff = analyze_git_diff("abc", "def", diff_output);
        assert_eq!(diff.files_changed.len(), 2);
        assert_eq!(diff.total_additions, 3);
        assert_eq!(diff.total_deletions, 1);
    }
}
