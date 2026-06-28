# Astera Benchmark Results

**Generated**: 2026-06-28 06:25 UTC from `target/criterion`  
**Commit**: `096bae7`  
**Total**: 92 benchmarks across 11 groups

---

## Summary

| Group | Count | Fastest | Slowest | Median |
|---|---|---|---|---|
| `api_simulation` | 3 | 3.27µs | 1.72ms | 21.93µs |
| `concurrent_storage` | 2 | 4.26ms | 6.09ms | 6.09ms |
| `discovery` | 11 | 33ns | 500.17µs | 35ns |
| `end_to_end` | 4 | 5.08ms | 12.69ms | 9.04ms |
| `extraction` | 8 | 651.71µs | 7.02ms | 2.81ms |
| `impact_analysis` | 16 | 2.92µs | 473.86ms | 24.50µs |
| `metrics` | 8 | 12.61µs | 80.30ms | 603.44µs |
| `parse_edge_cases` | 6 | 624ns | 4.25ms | 52.41µs |
| `parse_throughput` | 7 | 106.21µs | 80.44ms | 3.19ms |
| `scalability` | 15 | 5.33µs | 229.13ms | 21.72µs |
| `storage` | 12 | 1.06µs | 70.53ms | 837.69µs |

---

## API SIMULATION

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `api_stats` | 3.27µs | ±10ns | 0 | 306.0K ops/s |
| `api_search_json` | 21.93µs | ±95ns | 0 | 45.6K ops/s |
| `api_symbols_json` | 1.72ms | ±5.74µs | 0 | 581.0 ops/s |

## CONCURRENT STORAGE

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `sequential_reads_50` | 4.26ms | ±10.02µs | 0 | 234.8 ops/s |
| `mixed_queries_10` | 6.09ms | ±12.95µs | 0 | 164.1 ops/s |

## DISCOVERY

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `classify_language/typescript` | 33ns | ±0ns | 0 | 30.7M ops/s |
| `classify_language/javascript` | 33ns | ±0ns | 0 | 30.2M ops/s |
| `classify_language/python` | 33ns | ±0ns | 0 | 30.1M ops/s |
| `classify_language/rust` | 33ns | ±0ns | 0 | 30.1M ops/s |
| `classify_language/unknown` | 35ns | ±1ns | 0 | 28.5M ops/s |
| `classify_language/go` | 35ns | ±0ns | 0 | 28.5M ops/s |
| `classify_language/tsx` | 35ns | ±0ns | 0 | 28.4M ops/s |
| `sha256_hash/1KB` | 563ns | ±1ns | 0 | 1.8M ops/s |
| `sha256_hash/64KB` | 30.66µs | ±112ns | 0 | 32.6K ops/s |
| `count_lines_10k` | 38.92µs | ±173ns | 0 | 25.7K ops/s |
| `sha256_hash/1MB` | 500.17µs | ±5.39µs | 0 | 2.0K ops/s |

## END TO END

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `parse_extract_store/go` | 5.08ms | ±39.47µs | 0 | 196.9 ops/s |
| `parse_extract_store/python` | 8.75ms | ±40.77µs | 0 | 114.3 ops/s |
| `parse_extract_store/rust` | 9.04ms | ±38.65µs | 0 | 110.6 ops/s |
| `parse_extract_store/typescript` | 12.69ms | ±140.31µs | 0 | 78.8 ops/s |

## EXTRACTION

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `extract/go` | 651.71µs | ±5.11µs | 0 | 1.5K ops/s |
| `extract/python` | 1.04ms | ±7.04µs | 0 | 961.3 ops/s |
| `extract/rust` | 1.11ms | ±9.69µs | 0 | 898.1 ops/s |
| `extract/typescript` | 1.97ms | ±25.74µs | 0 | 508.1 ops/s |
| `full_pipeline/go` | 2.81ms | ±7.67µs | 0 | 355.8 ops/s |
| `full_pipeline/rust` | 4.37ms | ±31.61µs | 0 | 229.0 ops/s |
| `full_pipeline/python` | 5.05ms | ±36.26µs | 0 | 198.1 ops/s |
| `full_pipeline/typescript` | 7.02ms | ±50.35µs | 0 | 142.4 ops/s |

## IMPACT ANALYSIS

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `impact_depth_3/500` | 2.92µs | ±20ns | 0 | 342.5K ops/s |
| `impact_depth_3/5000` | 2.92µs | ±22ns | 0 | 341.9K ops/s |
| `impact_depth_3/100` | 2.99µs | ±22ns | 0 | 334.3K ops/s |
| `impact_depth_3/1000` | 3.00µs | ±30ns | 0 | 333.8K ops/s |
| `reverse_impact/5000` | 23.44µs | ±296ns | 0 | 42.7K ops/s |
| `forward_impact/500` | 23.69µs | ±67ns | 0 | 42.2K ops/s |
| `forward_impact/5000` | 23.89µs | ±72ns | 0 | 41.9K ops/s |
| `forward_impact/100` | 24.12µs | ±212ns | 0 | 41.5K ops/s |
| `forward_impact/1000` | 24.50µs | ±177ns | 0 | 40.8K ops/s |
| `reverse_impact/100` | 24.78µs | ±109ns | 0 | 40.4K ops/s |
| `reverse_impact/500` | 26.17µs | ±146ns | 0 | 38.2K ops/s |
| `reverse_impact/1000` | 26.42µs | ±91ns | 0 | 37.8K ops/s |
| `critical_path/100` | 123.14µs | ±823ns | 0 | 8.1K ops/s |
| `critical_path/500` | 3.11ms | ±13.29µs | 0 | 321.6 ops/s |
| `critical_path/1000` | 13.23ms | ±101.00µs | 0 | 75.6 ops/s |
| `critical_path/5000` | 473.86ms | ±1.26ms | 0 | 2.1 ops/s |

## METRICS

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `compute_importance/100` | 12.61µs | ±99ns | 0 | 79.3K ops/s |
| `compute_metrics/100` | 38.78µs | ±285ns | 0 | 25.8K ops/s |
| `compute_importance/500` | 69.98µs | ±211ns | 0 | 14.3K ops/s |
| `compute_importance/1000` | 142.37µs | ±1.13µs | 0 | 7.0K ops/s |
| `compute_metrics/500` | 603.44µs | ±7.33µs | 0 | 1.7K ops/s |
| `compute_importance/5000` | 705.10µs | ±4.07µs | 0 | 1.4K ops/s |
| `compute_metrics/1000` | 2.20ms | ±22.33µs | 0 | 453.7 ops/s |
| `compute_metrics/5000` | 80.30ms | ±497.08µs | 0 | 12.5 ops/s |

## PARSE EDGE CASES

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `empty_file` | 624ns | ±3ns | 0 | 1.6M ops/s |
| `minimal_ts` | 1.62µs | ±3ns | 0 | 617.0K ops/s |
| `unicode_source` | 6.85µs | ±21ns | 0 | 145.9K ops/s |
| `malformed_ts` | 52.41µs | ±140ns | 0 | 19.1K ops/s |
| `deeply_nested` | 404.60µs | ±1.01µs | 0 | 2.5K ops/s |
| `very_long_line` | 4.25ms | ±7.27µs | 0 | 235.1 ops/s |

## PARSE THROUGHPUT

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `python_small` | 106.21µs | ±863ns | 0 | 9.4K ops/s |
| `typescript_small` | 109.80µs | ±776ns | 0 | 9.1K ops/s |
| `go_medium` | 2.13ms | ±5.02µs | 0 | 469.1 ops/s |
| `rust_medium` | 3.19ms | ±10.55µs | 0 | 313.7 ops/s |
| `python_medium` | 4.04ms | ±35.19µs | 0 | 247.8 ops/s |
| `typescript_medium` | 4.89ms | ±10.91µs | 0 | 204.6 ops/s |
| `typescript_large` | 80.44ms | ±1.15ms | 0 | 12.4 ops/s |

## SCALABILITY

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `importance/50` | 5.33µs | ±14ns | 0 | 187.5K ops/s |
| `metrics_full/50` | 9.54µs | ±31ns | 0 | 104.8K ops/s |
| `impact_forward/1000` | 9.70µs | ±30ns | 0 | 103.0K ops/s |
| `impact_forward/50` | 12.44µs | ±97ns | 0 | 80.4K ops/s |
| `impact_forward/200` | 12.58µs | ±58ns | 0 | 79.5K ops/s |
| `impact_forward/5000` | 13.25µs | ±72ns | 0 | 75.5K ops/s |
| `impact_forward/10000` | 13.33µs | ±50ns | 0 | 75.0K ops/s |
| `importance/200` | 21.72µs | ±214ns | 0 | 46.0K ops/s |
| `metrics_full/200` | 84.81µs | ±666ns | 0 | 11.8K ops/s |
| `importance/1000` | 123.84µs | ±543ns | 0 | 8.1K ops/s |
| `importance/5000` | 607.85µs | ±7.27µs | 0 | 1.6K ops/s |
| `importance/10000` | 1.27ms | ±4.15µs | 0 | 790.1 ops/s |
| `metrics_full/1000` | 1.53ms | ±6.34µs | 0 | 652.9 ops/s |
| `metrics_full/5000` | 55.03ms | ±168.86µs | 0 | 18.2 ops/s |
| `metrics_full/10000` | 229.13ms | ±871.98µs | 0 | 4.4 ops/s |

## STORAGE

| Benchmark | Mean | Std Error | Iters | Throughput |
|---|---|---|---|---|
| `edge_count` | 1.06µs | ±6ns | 0 | 941.7K ops/s |
| `symbol_count` | 1.15µs | ±10ns | 0 | 868.2K ops/s |
| `get_children_of` | 2.22µs | ±9ns | 0 | 451.1K ops/s |
| `list_files` | 3.84µs | ±23ns | 0 | 260.1K ops/s |
| `search_fts5_symbol_42` | 16.16µs | ±84ns | 0 | 61.9K ops/s |
| `query_by_kind_function` | 253.20µs | ±1.24µs | 0 | 3.9K ops/s |
| `query_all_2000` | 837.69µs | ±6.18µs | 0 | 1.2K ops/s |
| `insert_nodes/100` | 1.08ms | ±9.47µs | 0 | 924.0 ops/s |
| `insert_nodes/500` | 5.95ms | ±51.11µs | 0 | 168.2 ops/s |
| `insert_2000_edges` | 7.63ms | ±66.33µs | 0 | 131.1 ops/s |
| `insert_nodes/1000` | 13.10ms | ±80.65µs | 0 | 76.4 ops/s |
| `insert_nodes/5000` | 70.53ms | ±355.05µs | 0 | 14.2 ops/s |

---

## Performance Characteristics

### Parse Throughput

| Language | File Size | Time | Est. LOC/s |
|---|---|---|---|
| typescript_small | ~100 LOC | 109.80µs | 910763 LOC/s |
| python_medium | ~400 LOC | 4.04ms | 99129 LOC/s |
| typescript_large | ~5000 LOC | 80.44ms | 62159 LOC/s |
| go_medium | ~300 LOC | 2.13ms | 140724 LOC/s |
| python_small | ~80 LOC | 106.21µs | 753208 LOC/s |
| typescript_medium | ~500 LOC | 4.89ms | 102301 LOC/s |
| rust_medium | ~350 LOC | 3.19ms | 109806 LOC/s |

### Storage Latency

| Operation | Latency | Notes |
|---|---|---|
| `symbol_count` | 1.15µs | Aggregate |
| `query_all_2000` | 837.69µs | Read-heavy |
| `insert_2000_edges` | 7.63ms | Write-heavy |
| `insert_nodes` | 70.53ms | Write-heavy |
| `insert_nodes` | 5.95ms | Write-heavy |
| `insert_nodes` | 13.10ms | Write-heavy |
| `insert_nodes` | 1.08ms | Write-heavy |
| `list_files` | 3.84µs |  |
| `get_children_of` | 2.22µs |  |
| `search_fts5_symbol_42` | 16.16µs | FTS5 full-text |
| `edge_count` | 1.06µs | Aggregate |
| `query_by_kind_function` | 253.20µs | Read-heavy |

### Scalability

| Operation | Input Size | Time | Scaling |
|---|---|---|---|
| `impact_forward` | 1000 nodes | 9.70µs | |
| `impact_forward` | 50 nodes | 12.44µs | |
| `impact_forward` | 200 nodes | 12.58µs | |
| `impact_forward` | 5000 nodes | 13.25µs | |
| `impact_forward` | 10000 nodes | 13.33µs | |
| `importance` | 50 nodes | 5.33µs | |
| `importance` | 200 nodes | 21.72µs | |
| `importance` | 1000 nodes | 123.84µs | |
| `importance` | 5000 nodes | 607.85µs | |
| `importance` | 10000 nodes | 1.27ms | |
| `metrics_full` | 50 nodes | 9.54µs | |
| `metrics_full` | 200 nodes | 84.81µs | |
| `metrics_full` | 1000 nodes | 1.53ms | |
| `metrics_full` | 5000 nodes | 55.03ms | |
| `metrics_full` | 10000 nodes | 229.13ms | |
