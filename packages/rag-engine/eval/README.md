# ChronoEval v2.0: Comprehensive Historical Hybrid Graph RAG Evaluation Framework

This package contains the automated component-level and end-to-end benchmark suite for **Chrono-RAG Engine** (`@chronoviet/rag-engine`), implementing the specification defined in [`docs/RAG_COMPONENT_BENCHMARK_SPEC.md`](../../../docs/RAG_COMPONENT_BENCHMARK_SPEC.md).

---

## 1. Architecture: 11 Component Benchmark Tiers (C0 – C10) & System Ablation

| Tier | Component Benchmark | File | Target Focus |
| :--- | :--- | :--- | :--- |
| **C0** | Knowledge Graph Construction | `benchmarks/c0-graph-construction.bench.ts` | Triple extraction precision/recall, directionality, canonical linking, provenance |
| **C1** | Chunking & Document Ingestion | `benchmarks/c1-chunking.bench.ts` | Word count compliance ($[300, 500]$), syntax integrity, parent-child linking, throughput |
| **C2** | Query Understanding & NER | `benchmarks/c2-query-understanding.bench.ts` | Entity recall/precision, alias resolution, temporal constraints, typo robustness |
| **C3** | Graph Traversal & Reasoning | `benchmarks/c3-graph-reasoning.bench.ts` | Gold path recall, shortest valid path rate, hub node guards, CTE latency |
| **C4** | Dense + Lexical Hybrid Retrieval | `benchmarks/c4-hybrid-retrieval.bench.ts` | Dense/FTS Recall@10, Candidate Union Recall, Hybrid Fusion Recall@10/5, RRF sweep |
| **C5** | Graph-Guided Chunk Linking | `benchmarks/c5-graph-chunk-link.bench.ts` | Graph-exclusive recall, hop-distance precision (1h vs 2h), noise suppression |
| **C6** | Reranker & Relevance Ordering | `benchmarks/c6-reranker.bench.ts` | Graded relevance (nDCG@5), pairwise ranking accuracy, delta MRR, $W_{\text{source}}$ |
| **C7** | Context Assembly & Budgeting | `benchmarks/c7-context-assembly.bench.ts` | Context evidence recall, deduplication loss, lost-in-the-middle resilience |
| **C8** | Answer Generation & Correctness | `benchmarks/c8-generation.bench.ts` | Historical fact precision ($> 99.2\%$), answer completeness, temporal correctness |
| **C9** | Grounding & Citation Verification | `benchmarks/c9-grounding-citation.bench.ts` | Claim-level faithfulness, hallucination rate ($< 0.8\%$), citation entailment |
| **C10** | Robustness, Conflict & Abstain | `benchmarks/c10-robustness-reasoning.bench.ts` | Abstention accuracy ($> 98\%$), false premise traps, conflict resolution |
| **SYS** | System Ablation & Bootstrap CI | `benchmarks/sys-ablation-regression.bench.ts` | 6-Config Ablation Matrix, Paired Bootstrap 95% CI, p50/p95/p99 Latency |

---

## 2. Benchmark Datasets (`eval/datasets/`)

- `chronoeval-canonical-300.json`: 300 gold-standard test cases across 15 historical epochs with Graded Relevance annotations $\{0, 1, 2, 3\}$ and reasoning paths.
- `chronoeval-perturbations-500.json`: 500 perturbation cases (unaccented Vietnamese, typos, alias substitutions).
- `chronoeval-adversarial-200.json`: 200 adversarial traps, false premises, anachronisms, and unanswerable queries.
- `gold-knowledge-graph-triples.json`: 115 gold knowledge graph triples for C0 validation.

---

## 3. Running Benchmarks

```bash
# Run all 11 component benchmarks + System Ablation + CI/CD Quality Gates
pnpm --filter @chronoviet/rag-engine eval

# Run individual component benchmarks
pnpm --filter @chronoviet/rag-engine eval -- --c0    # Knowledge Graph Construction
pnpm --filter @chronoviet/rag-engine eval -- --c4    # Hybrid Dense+FTS Retrieval
pnpm --filter @chronoviet/rag-engine eval -- --c6    # Reranker & nDCG@5
pnpm --filter @chronoviet/rag-engine eval -- --c9    # Claim-level Grounding
pnpm --filter @chronoviet/rag-engine eval -- --sys   # System Ablation Matrix

# Run unit tests for ranking and grounding math metrics
pnpm --filter @chronoviet/rag-engine test
```

---

## 4. Reports & Artifacts (`eval/reports/`)

- `component-benchmark-report.json`: Aggregate JSON report for all component tiers C0–C10.
- `ablation-study-report.json`: Comparative matrix of 6 RAG configurations with 95% Bootstrap CI.
- `regression-diff-report.json`: Automated blocking gates status for CI/CD pipeline.
