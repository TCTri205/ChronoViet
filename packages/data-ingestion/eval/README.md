# ChronoViet Module 0 Evaluation Benchmark Suite (`Data-Ingestion ETL`)

This package contains the automated benchmark runner and evaluation metrics for **Mô-đun 0 — Data Preprocessing & Ingestion Engine** (`@chronoviet/data-ingestion`).

## KPI Targets & Quality Thresholds

| Metric | Target KPI | Description |
| :--- | :---: | :--- |
| **Entity Disambiguation Accuracy** | **$> 98.0\%$** | Accuracy of resolving historical character aliases, titles, and era-based location mappings. |
| **Copyright License Compliance** | **$100\%$** | Audit rate of media assets ensuring whitelisted non-commercial/public domain licenses. |
| **Golden Dataset Integrity** | **$100\%$** | Schema compliance and parsing integrity across primary historical datasets. |
| **Hierarchical Chunk Quality** | **$100\%$** | Structural validity and metadata enrichment across parent and child chunks. |

## Running Evaluation

```bash
# Run evaluation specifically for Data Ingestion Engine
pnpm --filter @chronoviet/data-ingestion eval

# Run all evaluations monorepo-wide
pnpm eval:all
```

Reports are generated at `packages/data-ingestion/eval/reports/ingest-eval-report.json`.
