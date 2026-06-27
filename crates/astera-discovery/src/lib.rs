use std::collections::HashMap;
use std::path::Path;

use astera_core::FileInfo;
use ignore::WalkBuilder;
use sha2::{Digest, Sha256};
use tracing::warn;

/// Language classification from file extension
pub fn classify_language(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "ts" => Some("typescript"),
        "tsx" => Some("tsx"),
        "js" | "jsx" | "mjs" | "cjs" => Some("javascript"),
        "py" => Some("python"),
        "rs" => Some("rust"),
        "go" => Some("go"),
        "c" | "h" => Some("c"),
        "cpp" | "hpp" | "cc" | "hh" | "cxx" | "hxx" => Some("cpp"),
        _ => None,
    }
}

/// Known parseable languages for Phase 1
pub fn known_languages() -> &'static [&'static str] {
    &["typescript", "javascript", "tsx", "python", "rust", "go"]
}

/// Compute SHA-256 hash of file contents
pub fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())
}

/// Count lines in content
pub fn count_lines(content: &[u8]) -> u64 {
    content.iter().filter(|&&b| b == b'\n').count() as u64
}

/// Discover files in a repository with gitignore support
pub struct FileWalker {
    root: String,
    exclude_patterns: Vec<String>,
    _language_map: HashMap<String, &'static str>,
}

impl FileWalker {
    pub fn new(root: &str) -> Self {
        FileWalker {
            root: root.to_string(),
            exclude_patterns: vec![
                ".git".into(),
                "node_modules".into(),
                "target".into(),
                "build".into(),
                "dist".into(),
                ".astera".into(),
                ".claude".into(),
            ],
            _language_map: HashMap::new(),
        }
    }

    pub fn with_exclude(mut self, patterns: Vec<String>) -> Self {
        self.exclude_patterns = patterns;
        self
    }

    pub fn add_exclude(&mut self, pattern: &str) {
        self.exclude_patterns.push(pattern.to_string());
    }

    /// Walk directory and return discovered files
    pub fn walk(&self) -> Vec<FileInfo> {
        let root_path = Path::new(&self.root).to_path_buf();
        let exclude = self.exclude_patterns.clone();

        let mut walker = WalkBuilder::new(&root_path);
        walker.standard_filters(true);
        walker.hidden(true);

        let filter_root = root_path.clone();
        walker.filter_entry(move |entry| {
            let p = entry.path();
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                return false;
            }
            if let Ok(rel) = p.strip_prefix(&filter_root) {
                let rel_str = rel.to_string_lossy();
                for pattern in &exclude {
                    if rel_str == *pattern || rel_str.starts_with(&format!("{}/", pattern)) {
                        return false;
                    }
                }
            }
            true
        });

        let mut files = Vec::new();
        for result in walker.build() {
            let entry = match result {
                Ok(e) => e,
                Err(e) => {
                    warn!("Walk error: {}", e);
                    continue;
                }
            };
            let path = entry.path().to_path_buf();
            if !path.is_file() {
                continue;
            }

            let relative_path = path
                .strip_prefix(&root_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            let language = match classify_language(&path) {
                Some(lang) => lang.to_string(),
                None => continue,
            };

            let metadata = match path.metadata() {
                Ok(m) => m,
                Err(e) => {
                    warn!("Failed to read metadata for {:?}: {}", path, e);
                    continue;
                }
            };

            let content = match std::fs::read(&path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to read {:?}: {}", path, e);
                    continue;
                }
            };

            let hash = compute_hash(&content);
            let line_count = count_lines(&content);
            let size = content.len() as u64;

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                    let secs = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)?;
                    Some(secs.to_rfc3339())
                })
                .unwrap_or_default();

            files.push(FileInfo {
                id: None,
                repo_root: self.root.clone(),
                relative_path,
                language,
                hash,
                size,
                line_count,
                indexed_at: None,
                last_modified: modified,
            });
        }

        files
    }

    /// Discover files for parallel processing — returns (path, language, content, hash)
    pub fn discover_with_content(&self) -> Vec<(String, String, Vec<u8>, String)> {
        let root_path = Path::new(&self.root).to_path_buf();
        let exclude = self.exclude_patterns.clone();

        let mut walker = WalkBuilder::new(&root_path);
        walker.standard_filters(true);
        walker.hidden(true);

        let filter_root = root_path.clone();
        walker.filter_entry(move |entry| {
            let p = entry.path();
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                return false;
            }
            if let Ok(rel) = p.strip_prefix(&filter_root) {
                let rel_str = rel.to_string_lossy();
                for pattern in &exclude {
                    if rel_str == *pattern || rel_str.starts_with(&format!("{}/", pattern)) {
                        return false;
                    }
                }
            }
            true
        });

        let mut result = Vec::new();
        for entry in walker.build().flatten() {
            let path = entry.path().to_path_buf();
            if !path.is_file() {
                continue;
            }

            let language = match classify_language(&path) {
                Some(lang) => lang,
                None => continue,
            };

            if !known_languages().contains(&language) {
                continue;
            }

            let content = match std::fs::read(&path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to read {:?}: {}", path, e);
                    continue;
                }
            };

            let hash = compute_hash(&content);
            let relative = path
                .strip_prefix(&root_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            result.push((relative, language.to_string(), content, hash));
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_typescript() {
        assert_eq!(classify_language(Path::new("file.ts")), Some("typescript"));
        assert_eq!(classify_language(Path::new("file.tsx")), Some("tsx"));
    }

    #[test]
    fn test_classify_python() {
        assert_eq!(classify_language(Path::new("file.py")), Some("python"));
    }

    #[test]
    fn test_classify_rust() {
        assert_eq!(classify_language(Path::new("file.rs")), Some("rust"));
    }

    #[test]
    fn test_classify_unknown() {
        assert_eq!(classify_language(Path::new("file.txt")), None);
        assert_eq!(classify_language(Path::new("Makefile")), None);
    }

    #[test]
    fn test_hash_empty() {
        let hash = compute_hash(b"");
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_hash_deterministic() {
        let a = compute_hash(b"hello");
        let b = compute_hash(b"hello");
        assert_eq!(a, b);
    }

    #[test]
    fn test_count_lines() {
        assert_eq!(count_lines(b""), 0);
        assert_eq!(count_lines(b"hello"), 0);
        assert_eq!(count_lines(b"hello\n"), 1);
        assert_eq!(count_lines(b"hello\nworld\n"), 2);
    }

    #[test]
    fn test_known_languages() {
        let langs = known_languages();
        assert!(langs.contains(&"typescript"));
        assert!(langs.contains(&"python"));
        assert!(langs.contains(&"rust"));
    }
}
