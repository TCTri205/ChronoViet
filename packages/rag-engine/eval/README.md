# Chrono-RAG Engine Evaluation Benchmark Suite (`ChronoEval-1000`)

This package contains the automated benchmark runner and evaluation metrics for **Mô-đun 1 — Chrono-RAG Engine** (`@chronoviet/rag-engine`).

## KPI Targets & Quality Thresholds

| Metric | Target KPI | Description |
| :--- | :---: | :--- |
| **Fact Precision Score** | **$> 99.2\%$** | Ratio of ground-truth historical facts accurately retrieved and verified. |
| **Hallucination Rate** | **$< 0.8\%$** | Percentage of unverified or hallucinated facts in context response. |
| **Citation Traceability** | **$100\%$** | Percentage of contexts containing explicit, traceable source citations. |
| **Retrieval Latency** | **$< 300\text{ms}$** | Total latency of the 5-step online retrieval engine. |

## Running Evaluation

```bash
# Run evaluation specifically for Chrono-RAG Engine
pnpm --filter @chronoviet/rag-engine eval

# Run all evaluations monorepo-wide
pnpm eval:all
```

Reports are generated at `packages/rag-engine/eval/reports/chronoeval-report.json`.
