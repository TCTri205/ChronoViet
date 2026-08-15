# ChronoViet Module 0 Evaluation Benchmark Suite (`Data-Ingestion ETL`)

This package contains the automated benchmark runner and evaluation metrics for **Mô-đun 0 — Data Preprocessing & Ingestion Engine** (`@chronoviet/data-ingestion`).

## KPI Targets & Quality Thresholds

| Metric | Target KPI | Description |
| :--- | :---: | :--- |
| **Entity Disambiguation Accuracy** | **$> 98.0\%$** | Accuracy of resolving historical character aliases, titles, and era-based location mappings. |
| **Copyright License Compliance** | **$100\%$** | Audit rate of media assets ensuring whitelisted non-commercial/public domain licenses. |
| **Golden Dataset Integrity** | **$100\%$** | Schema compliance, parsing integrity, and ground-truth entity/triple resolution across primary historical datasets. |
| **Hierarchical Chunk Quality** | **$100\%$** | Structural validity and metadata enrichment across parent and child chunks. |

## Chunking Bounds (Spec-Compliant)

Validated against the production chunker (`src/chunking/hierarchical-chunker.ts`):

- **Parent Chunk:** `2000 - 3000` words
- **Child Chunk:** `300 - 500` words (target `400`, overlap `40`)

The bounds live in `@chronoviet/shared-spec` (`src/chunking.ts`) as the single source of truth and are shared by both the chunker and the eval metrics.

## Running Evaluation

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu **LLM server** (`LLM_BASE_URL`) không hoạt động — triple extraction không được fallback sang regex/dict. `seedDualBranch` yêu cầu **PostgreSQL pgvector thật** khi được gọi qua ingest-rag chain. Dev-mode: `EVAL_STRICT=false` (KHÔNG hợp lệ làm benchmark).

```bash
# Run evaluation specifically for Data Ingestion Engine
pnpm --filter @chronoviet/data-ingestion eval

# Run unit tests (chunk bounds, license audit, metrics)
pnpm --filter @chronoviet/data-ingestion test

# Run all evaluations monorepo-wide
pnpm eval:all
```

Reports are generated at `packages/data-ingestion/eval/reports/ingest-eval-report.json`.

## Golden Datasets

Located at `eval/test-cases/` in the monorepo root (shared with the RAG engine):

- `battle_bach_dang_938.json` — BATTLE
- `biography_tran_hung_dao.json` — BIOGRAPHY
- `dynasty_nha_ly.json` — DYNASTY
- `mystery_le_chi_vien.json` — MYSTERY
- `artifact_trong_dong_ngoc_lu.json` — ARTIFACT

Each golden dataset contains a `content` field of **≥ 2000 words** (so a valid parent chunk can be produced), plus `ground_truth_entities` and `ground_truth_triples` that the runner validates against the document content. A dataset only passes when **100% of its ground-truth entities and triples** are resolvable from the content.
