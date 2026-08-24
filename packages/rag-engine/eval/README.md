# ChronoEval v2.0: Production-Grade Hardened Hybrid Graph RAG Evaluation Framework

This package contains the automated component-level and end-to-end benchmark suite for **Chrono-RAG Engine** (`@chronoviet/rag-engine`), implementing the production-grade, statistically sound, anti-overfitting evaluation framework.

---

## 1. Architecture: 11 Component Benchmark Tiers (C0 – C10) & System Ablation

| Tier | Component Benchmark | File | Production Hardening Specification |
| :--- | :--- | :--- | :--- |
| **C0** | Knowledge Graph Construction | `benchmarks/c0-graph-construction.bench.ts` | Multi-entity extraction precision/recall via 2-Stage Async Pipeline (`extractTriplesFromTextAsync`), canonical resolution, provenance |
| **C1** | Chunking & Document Ingestion | `benchmarks/c1-chunking.bench.ts` | Child word count compliance ($[300, 500]$), syntax integrity, parent-child linking, event boundary preservation |
| **C2** | Query Understanding & NER | `benchmarks/c2-query-understanding.bench.ts` | Entity recall/precision, alias resolution, temporal extraction, intent classification, typo/telex robustness |
| **C3** | Graph Traversal & Reasoning | `benchmarks/c3-graph-reasoning.bench.ts` | Strict gold path recall (no tautology), shortest valid path rate, hub node guards, CTE latency |
| **C4** | Dense + Lexical Hybrid Retrieval | `benchmarks/c4-hybrid-retrieval.bench.ts` | Strict Gold Chunk ID Recall@10, Candidate Union Recall, Hybrid Fusion Recall@10/5, RRF sweep (no substring cheating) |
| **C5** | Graph-Guided Chunk Linking | `benchmarks/c5-graph-chunk-link.bench.ts` | Graph-exclusive recall, hop-distance precision (1h vs 2h), noise suppression |
| **C6** | Reranker & Relevance Ordering | `benchmarks/c6-reranker.bench.ts` | Pure Local Cross-Encoder (nDCG@5), pairwise ranking accuracy, delta MRR, Multi-Factor Fusion (zero gold injection in E2E mode) |
| **C7** | Context Assembly & Budgeting | `benchmarks/c7-context-assembly.bench.ts` | Context evidence recall, deduplication loss, lost-in-the-middle resilience, prompt token budgeting |
| **C8** | Answer Generation & Correctness | `benchmarks/c8-generation.bench.ts` | Propositional semantic entailment (`verifyClaimEntailment`), temporal consistency, causal reasoning (no length/word cheats) |
| **C9** | Grounding & Citation Verification | `benchmarks/c9-grounding-citation.bench.ts` | Factual proposition vs discourse separation (`isDiscourseOrMetaSentence`), true hallucination rate, genuine claim attribution |
| **C10** | Robustness, Conflict & Abstain | `benchmarks/c10-robustness-reasoning.bench.ts` | Abstention accuracy, 5 adversarial trap categories, historical conflict resolution, Brier calibration |
| **SYS** | System Ablation & Bootstrap CI | `benchmarks/sys-ablation-regression.bench.ts` | 6-Config Ablation Matrix, Content-aware Graded Relevance, Paired Bootstrap 95% CI, p50/p95/p99 Latency |

---

## 2. Production-Grade Benchmark Datasets (`eval/datasets/`)

- `chronoeval-canonical-300.json`: 300 gold-standard test cases across 15 historical epochs with rich multi-sentence historical extracts (*Đại Việt Sử Ký Toàn Thư, Lam Sơn Thực Lục, Khâm Định Việt Sử*), Graded Relevance annotations $\{0, 1, 2, 3\}$, explicit hard negatives (Grade 0), and multi-hop reasoning paths.
- `chronoeval-adversarial-200.json`: 200 distinct adversarial historical traps across 5 categories:
  1. *Anachronisms & Modern Tech Inversions* (e.g. cannon in 938, tanks in 40, telegraph in 1285).
  2. *Same-Name / Cross-Dynasty Confusions* (e.g. Lê Lợi vs Lê Hoàn; Lý Thường Kiệt vs Lý Thái Tổ).
  3. *Mythology vs Official Historical Facts* (e.g. Golden Turtle treaty, Laser Crossbow).
  4. *Inverted Battle Outcomes & False Treaties* (e.g. Mongol victory at Bạch Đằng, Tôn Sĩ Nghị captures Quang Trung).
  5. *Geographical & Chronological Fallacies*.
- `chronoeval-perturbations-500.json`: 500 realistic perturbations covering unaccented Vietnamese, Telex/spelling typos, historical feudal title substitutions (*Bình Định Vương, Ức Trai, Chúa Tiên, Đức Thánh Trần*), and conversational syntax.
- `gold-knowledge-graph-triples.json`: 200 clean gold knowledge graph triples covering master entities, relationships, aliases, and historical epochs.

---

## 3. Anti-Hardcoding & Dynamic Evaluation Principles (v2.0)

> 🛡️ **Anti-Overfitting & Anti-Cheating Directives:**
> - **Zero Synthetic Shortcuts:** Benchmarks NEVER inject missing ground truth into candidate pools or fall back to arbitrary default citations when attribution fails.
> - **Strict Information Retrieval Metrics:** Precision, Recall@K, MAP@K, and nDCG@K evaluate strictly against verified ground-truth chunk IDs or high-confidence evidence propositions.
> - **Propositional Entailment over Word Matching:** Fact Precision and Grounding evaluate semantic entailment using bi-gram, polarity, and numeric checks rather than brittle string matching.
> - **Stratified Epoch Sampling:** Fast smoke-testing selects balanced queries across all 15 Vietnamese historical epochs via `getStratifiedHistoricalSample` instead of naive modulo indexing.
> - **Multi-Tier Automated Regression Quality Gates:**
>   - Gate 1: Fact Precision $\ge 80\%$
>   - Gate 2: Hallucination Rate $\le 10\%$
>   - Gate 3: Retrieval Recall@10 $\ge 75\%$
>   - Gate 4: Ranking nDCG@5 $\ge 0.70$
>   - Gate 5: Retrieval Latency p95 $\le 1500\text{ms}$
>   - Gate 6: TTFT Streaming Latency $\le 1500\text{ms}$

```bash
# Run all 11 component benchmarks + System Ablation + CI/CD Quality Gates
pnpm --filter @chronoviet/rag-engine eval

# Run individual component benchmarks
pnpm --filter @chronoviet/rag-engine eval -- --c0    # Knowledge Graph Construction
pnpm --filter @chronoviet/rag-engine eval -- --c2    # Query Understanding & Perturbations
pnpm --filter @chronoviet/rag-engine eval -- --c4    # Hybrid Dense+FTS Retrieval
pnpm --filter @chronoviet/rag-engine eval -- --c6    # Reranker & nDCG@5
pnpm --filter @chronoviet/rag-engine eval -- --c9    # Claim-level Grounding
pnpm --filter @chronoviet/rag-engine eval -- --c10   # Adversarial Traps & Abstention
pnpm --filter @chronoviet/rag-engine eval -- --sys   # System Ablation Matrix

# Run deterministic unit tests
pnpm --filter @chronoviet/rag-engine test
pnpm --filter @chronoviet/rag-engine test:eval
```

---

## 4. Reports & Artifacts (`eval/reports/`)

- `component-benchmark-report.json`: Aggregate JSON report for all component tiers C0–C10.
- `ablation-study-report.json`: Comparative matrix of 6 RAG configurations with 95% Bootstrap CI.
- `regression-diff-report.json`: Automated blocking gates status for CI/CD pipeline.
