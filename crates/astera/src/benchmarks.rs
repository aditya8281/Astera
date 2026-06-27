use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Baseline benchmark result for a single benchmark
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub name: String,
    pub mean_ns: f64,
    pub std_dev_ns: f64,
    pub iterations: u64,
}

/// Stored baseline of all benchmark results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkBaseline {
    pub version: String,
    pub timestamp: String,
    pub commit: String,
    pub results: HashMap<String, BenchmarkResult>,
}

/// Regression detected between baseline and current
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkRegression {
    pub name: String,
    pub baseline_mean_ns: f64,
    pub current_mean_ns: f64,
    pub change_pct: f64,
    pub severity: RegressionSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RegressionSeverity {
    /// 10-25% slower
    Warning,
    /// 25-50% slower
    Significant,
    /// 50%+ slower
    Critical,
    /// 10-25% faster (improvement)
    Improvement,
}

fn baseline_path(workspace: &Path) -> PathBuf {
    workspace.join(".astera").join("bench-baseline.json")
}

/// Save a baseline from parsed criterion output
pub fn save_baseline(workspace: &Path, results: Vec<BenchmarkResult>) -> anyhow::Result<()> {
    let mut map = HashMap::new();
    for r in results {
        map.insert(r.name.clone(), r);
    }

    let baseline = BenchmarkBaseline {
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        commit: get_git_commit().unwrap_or_else(|| "unknown".to_string()),
        results: map,
    };

    let json = serde_json::to_string_pretty(&baseline)?;
    let path = baseline_path(workspace);
    std::fs::write(&path, json)?;
    Ok(())
}

/// Load a stored baseline
pub fn load_baseline(workspace: &Path) -> anyhow::Result<BenchmarkBaseline> {
    let path = baseline_path(workspace);
    if !path.exists() {
        anyhow::bail!(
            "No baseline found at {}. Run benchmarks with --save-baseline first.",
            path.display()
        );
    }
    let content = std::fs::read_to_string(&path)?;
    let baseline: BenchmarkBaseline = serde_json::from_str(&content)?;
    Ok(baseline)
}

/// Compare current results against a stored baseline
pub fn detect_regressions(
    baseline: &BenchmarkBaseline,
    current: &[BenchmarkResult],
    threshold_pct: f64,
) -> Vec<BenchmarkRegression> {
    let mut regressions = Vec::new();

    for result in current {
        if let Some(base) = baseline.results.get(&result.name) {
            let change_pct = ((result.mean_ns - base.mean_ns) / base.mean_ns) * 100.0;

            let severity = if change_pct > 50.0 {
                RegressionSeverity::Critical
            } else if change_pct > 25.0 {
                RegressionSeverity::Significant
            } else if change_pct > threshold_pct {
                RegressionSeverity::Warning
            } else if change_pct < -threshold_pct {
                RegressionSeverity::Improvement
            } else {
                continue; // within threshold
            };

            regressions.push(BenchmarkRegression {
                name: result.name.clone(),
                baseline_mean_ns: base.mean_ns,
                current_mean_ns: result.mean_ns,
                change_pct,
                severity,
            });
        }
    }

    // Sort by severity (critical first)
    regressions.sort_by(|a, b| {
        let order = |s: &RegressionSeverity| match s {
            RegressionSeverity::Critical => 0,
            RegressionSeverity::Significant => 1,
            RegressionSeverity::Warning => 2,
            RegressionSeverity::Improvement => 3,
        };
        order(&a.severity).cmp(&order(&b.severity))
    });

    regressions
}

/// Parse criterion JSON output file into BenchmarkResults
pub fn parse_criterion_json(path: &Path) -> anyhow::Result<Vec<BenchmarkResult>> {
    let content = std::fs::read_to_string(path)?;
    let raw: serde_json::Value = serde_json::from_str(&content)?;

    let mut results = Vec::new();

    if let Some(groups) = raw.as_object() {
        for (group_name, group_val) in groups {
            if let Some(benchmarks) = group_val.get("benchmarks") {
                if let Some(arr) = benchmarks.as_array() {
                    for bench in arr {
                        let name = bench
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();

                        let mean_ns = bench
                            .get("mean")
                            .and_then(|v| v.get("point_estimate"))
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);

                        let std_dev = bench
                            .get("mean")
                            .and_then(|v| v.get("standard_deviation"))
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);

                        let iters = bench
                            .get("iterations")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);

                        results.push(BenchmarkResult {
                            name: format!("{}:{}", group_name, name),
                            mean_ns,
                            std_dev_ns: std_dev,
                            iterations: iters,
                        });
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Pretty-print regression report
pub fn print_regression_report(baseline: &BenchmarkBaseline, regressions: &[BenchmarkRegression]) {
    println!("Benchmark Regression Report");
    println!("═══════════════════════════════════════════════════════════════");
    println!(
        "Baseline: {} (commit: {})",
        baseline.timestamp, baseline.commit
    );
    println!();

    if regressions.is_empty() {
        println!("✅ No regressions detected. All benchmarks within threshold.");
        return;
    }

    let critical = regressions
        .iter()
        .filter(|r| r.severity == RegressionSeverity::Critical)
        .count();
    let significant = regressions
        .iter()
        .filter(|r| r.severity == RegressionSeverity::Significant)
        .count();
    let warning = regressions
        .iter()
        .filter(|r| r.severity == RegressionSeverity::Warning)
        .count();
    let improvements = regressions
        .iter()
        .filter(|r| r.severity == RegressionSeverity::Improvement)
        .count();

    println!(
        "Found: {} critical, {} significant, {} warnings, {} improvements",
        critical, significant, warning, improvements
    );
    println!();

    println!(
        "{:<50} {:>12} {:>12} {:>10}",
        "Benchmark", "Baseline", "Current", "Change"
    );
    println!("{}", "─".repeat(86));

    for reg in regressions {
        let icon = match reg.severity {
            RegressionSeverity::Critical => "🔴",
            RegressionSeverity::Significant => "🟠",
            RegressionSeverity::Warning => "🟡",
            RegressionSeverity::Improvement => "🟢",
        };

        let base_str = format_ns(reg.baseline_mean_ns);
        let curr_str = format_ns(reg.current_mean_ns);
        let change_str = format!("{:+.1}%", reg.change_pct);

        println!(
            "{} {:<48} {:>12} {:>12} {:>10}",
            icon, reg.name, base_str, curr_str, change_str
        );
    }
}

pub(crate) fn format_ns(ns: f64) -> String {
    if ns < 1_000.0 {
        format!("{:.0}ns", ns)
    } else if ns < 1_000_000.0 {
        format!("{:.2}µs", ns / 1_000.0)
    } else if ns < 1_000_000_000.0 {
        format!("{:.2}ms", ns / 1_000_000.0)
    } else {
        format!("{:.2}s", ns / 1_000_000_000.0)
    }
}

pub(crate) fn get_git_commit() -> Option<String> {
    std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                String::from_utf8(output.stdout)
                    .ok()
                    .map(|s| s.trim().to_string())
            } else {
                None
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_baseline() -> BenchmarkBaseline {
        let mut results = HashMap::new();
        results.insert(
            "parse_throughput:typescript_medium".into(),
            BenchmarkResult {
                name: "parse_throughput:typescript_medium".into(),
                mean_ns: 1_000_000.0,
                std_dev_ns: 50_000.0,
                iterations: 100,
            },
        );
        results.insert(
            "extraction:extract:typescript".into(),
            BenchmarkResult {
                name: "extraction:extract:typescript".into(),
                mean_ns: 2_000_000.0,
                std_dev_ns: 100_000.0,
                iterations: 50,
            },
        );
        results.insert(
            "metrics:compute_metrics:1000".into(),
            BenchmarkResult {
                name: "metrics:compute_metrics:1000".into(),
                mean_ns: 500_000.0,
                std_dev_ns: 25_000.0,
                iterations: 200,
            },
        );

        BenchmarkBaseline {
            version: "0.1.0".into(),
            timestamp: "2024-01-01T00:00:00Z".into(),
            commit: "abc1234".into(),
            results,
        }
    }

    #[test]
    fn test_detect_no_regressions() {
        let baseline = sample_baseline();
        let current = vec![
            BenchmarkResult {
                name: "parse_throughput:typescript_medium".into(),
                mean_ns: 1_010_000.0, // +1% — within threshold
                std_dev_ns: 50_000.0,
                iterations: 100,
            },
            BenchmarkResult {
                name: "extraction:extract:typescript".into(),
                mean_ns: 1_990_000.0, // -0.5% — within threshold
                std_dev_ns: 100_000.0,
                iterations: 50,
            },
        ];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert!(regressions.is_empty());
    }

    #[test]
    fn test_detect_critical_regression() {
        let baseline = sample_baseline();
        let current = vec![BenchmarkResult {
            name: "parse_throughput:typescript_medium".into(),
            mean_ns: 2_000_000.0, // +100% — critical
            std_dev_ns: 50_000.0,
            iterations: 100,
        }];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert_eq!(regressions.len(), 1);
        assert_eq!(regressions[0].severity, RegressionSeverity::Critical);
        assert!((regressions[0].change_pct - 100.0).abs() < 0.1);
    }

    #[test]
    fn test_detect_warning_regression() {
        let baseline = sample_baseline();
        let current = vec![BenchmarkResult {
            name: "parse_throughput:typescript_medium".into(),
            mean_ns: 1_150_000.0, // +15% — warning
            std_dev_ns: 50_000.0,
            iterations: 100,
        }];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert_eq!(regressions.len(), 1);
        assert_eq!(regressions[0].severity, RegressionSeverity::Warning);
    }

    #[test]
    fn test_detect_improvement() {
        let baseline = sample_baseline();
        let current = vec![BenchmarkResult {
            name: "parse_throughput:typescript_medium".into(),
            mean_ns: 850_000.0, // -15% — improvement
            std_dev_ns: 50_000.0,
            iterations: 100,
        }];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert_eq!(regressions.len(), 1);
        assert_eq!(regressions[0].severity, RegressionSeverity::Improvement);
    }

    #[test]
    fn test_sort_by_severity() {
        let baseline = sample_baseline();
        let current = vec![
            BenchmarkResult {
                name: "parse_throughput:typescript_medium".into(),
                mean_ns: 2_000_000.0, // +100% — critical
                std_dev_ns: 50_000.0,
                iterations: 100,
            },
            BenchmarkResult {
                name: "extraction:extract:typescript".into(),
                mean_ns: 2_600_000.0, // +30% — significant
                std_dev_ns: 100_000.0,
                iterations: 50,
            },
            BenchmarkResult {
                name: "metrics:compute_metrics:1000".into(),
                mean_ns: 600_000.0, // +20% — warning
                std_dev_ns: 25_000.0,
                iterations: 200,
            },
        ];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert!(regressions.len() >= 2);
        // Critical should come first
        assert_eq!(regressions[0].severity, RegressionSeverity::Critical);
    }

    #[test]
    fn test_ignores_unknown_benchmarks() {
        let baseline = sample_baseline();
        let current = vec![BenchmarkResult {
            name: "new_benchmark:unknown".into(),
            mean_ns: 10_000_000.0,
            std_dev_ns: 1_000_000.0,
            iterations: 10,
        }];

        let regressions = detect_regressions(&baseline, &current, 10.0);
        assert!(regressions.is_empty());
    }

    #[test]
    fn test_format_ns() {
        assert_eq!(format_ns(500.0), "500ns");
        assert_eq!(format_ns(5_000.0), "5.00µs");
        assert_eq!(format_ns(5_000_000.0), "5.00ms");
        assert_eq!(format_ns(5_000_000_000.0), "5.00s");
    }

    #[test]
    fn test_save_and_load_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let astera_dir = dir.path().join(".astera");
        std::fs::create_dir_all(&astera_dir).unwrap();

        let results = vec![
            BenchmarkResult {
                name: "test:bench1".into(),
                mean_ns: 1_000_000.0,
                std_dev_ns: 50_000.0,
                iterations: 100,
            },
            BenchmarkResult {
                name: "test:bench2".into(),
                mean_ns: 2_500_000.0,
                std_dev_ns: 100_000.0,
                iterations: 50,
            },
        ];

        save_baseline(dir.path(), results).unwrap();

        let loaded = load_baseline(dir.path()).unwrap();
        assert_eq!(loaded.results.len(), 2);
        assert!(loaded.results.contains_key("test:bench1"));
        assert!(loaded.results.contains_key("test:bench2"));
        assert_eq!(loaded.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn test_load_missing_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let result = load_baseline(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_print_regression_report_no_regressions() {
        let baseline = sample_baseline();
        // Should print "No regressions" message
        print_regression_report(&baseline, &[]);
    }
}
