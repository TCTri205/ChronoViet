# ChronoViet Module 0 Evaluation Benchmark Suite (`Data-Ingestion ETL`)

This package contains the automated benchmark runner and evaluation metrics for **Mô-đun 0 — Data Preprocessing & Ingestion Engine** (`@chronoviet/data-ingestion`).

## Multi-Tier Evaluation Architecture

ChronoViet áp dụng kiến trúc kiểm định dữ liệu đa tầng nhằm phân định rõ giữa kiểm thử định dạng cô lập và đánh giá chất lượng dữ liệu thật nạp vào hệ thống:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ISOLATED BENCHMARK (In-Memory Fast Check)                               │
│ pnpm --filter @chronoviet/data-ingestion eval                                    │
│ ├─ Đo Disambiguation Accuracy (> 98.0%) trên 40 test cases lịch sử              │
│ ├─ Đo tính hợp lệ cấu trúc Parent (2k-3k từ) & Child (300-500 từ) Chunks         │
│ └─ Kiểm tra Ground-Truth Schema của 5 Golden Datasets                            │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: CORPUS INGESTION DIAGNOSTICS (Real Raw Corpus Scan)                      │
│ pnpm eval:ingest:diagnostic (hoặc --input=data/raw_corpus)                       │
│ ├─ Quét toàn bộ kho văn bản thật để phát hiện CHUNK_TOKEN_OVERSIZED / UNDERSIZED │
│ ├─ Thống kê UNMAPPED_ENTITY (thực thể mới chưa có trong từ điển chuẩn hóa)       │
│ └─ Phân tích LOW_CONFIDENCE_TRIPLE & DANGLING_RELATION đưa vào quarantine_triples│
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: REAL-DATABASE END-TO-END EVALUATION (PostgreSQL + Graph Retrieval)       │
│ pnpm ingest:knowledge --strict ──► pnpm eval --chain ingest-rag                  │
│ ├─ Nạp toàn bộ 33,000+ chunks thật vào PostgreSQL (pgvector HNSW) & Graph        │
│ ├─ Bắn bộ câu hỏi benchmark thực tế (Multi-hop, Ambiguity, Epoch, Adversarial)   │
│ └─ Đo lường: MRR >= 0.70 | nDCG@5 >= 0.75 | Fact Precision >= 85% | Rejection 100%│
└──────────────────────────────────────────────────────────────────────────────────┘
```

## KPI Targets & Quality Thresholds (Isolated Module 0)

| Metric | Target KPI | Description |
| :--- | :---: | :--- |
| **Entity Disambiguation Accuracy** | **$> 98.0\%$** | Accuracy of resolving historical character aliases, titles, and era-based location mappings. |
| **Golden Dataset Integrity** | **$100\%$** | Schema compliance, parsing integrity, and ground-truth entity/triple resolution across primary historical datasets. |
| **Hierarchical Chunk Quality** | **$100\%$** | Structural validity and metadata enrichment across parent and child chunks. |
| **Seeder Throughput** | **$> 10\text{ chunks/s}$** | Ingestion processing speed across structured document corpora. |

## Chunking Bounds (Spec-Compliant)

Validated against the production chunker (`src/chunking/hierarchical-chunker.ts`):

- **Parent Chunk:** `2000 - 3000` words
- **Child Chunk:** `300 - 500` words (target `400`, overlap `40`)

The bounds live in `@chronoviet/shared-spec` (`src/chunking.ts`) as the single source of truth and are shared by both the chunker and the eval metrics.

## Running Evaluation & Diagnostics

### 1. Isolated Module 0 Benchmark (In-Memory)
```bash
# Run isolated benchmark specifically for Data Ingestion Engine
pnpm --filter @chronoviet/data-ingestion eval

# Run unit tests (chunk bounds, metrics logic)
pnpm --filter @chronoviet/data-ingestion test
```
Reports are generated at `packages/data-ingestion/eval/reports/ingest-eval-report.json`.

### 2. Ingestion Quality Diagnostic (Real Corpus Analysis)
```bash
# Scan and diagnose quality on raw_corpus (chunk bounds, unmapped entities, quarantine triples)
pnpm eval:ingest:diagnostic

# Diagnose a specific directory or document
pnpm --filter @chronoviet/data-ingestion eval:diagnostic --input=data/raw_corpus/wiki/
```

### 3. Real-Database End-to-End Evaluation (Full Production Benchmark)
```bash
# 1. Start database stack
docker compose up -d postgres redis

# 2. Ingest real data into PostgreSQL with strict preflight verification
pnpm ingest:knowledge --strict

# 3. Evaluate real retrieval & fact precision against the populated database
pnpm eval --chain ingest-rag
```

## Golden Datasets

Located at `eval/test-cases/` in the monorepo root (shared with the RAG engine):

- `battle_bach_dang_938.json` — BATTLE
- `biography_tran_hung_dao.json` — BIOGRAPHY
- `dynasty_nha_ly.json` — DYNASTY
- `mystery_le_chi_vien.json` — MYSTERY
- `artifact_trong_dong_ngoc_lu.json` — ARTIFACT

Each golden dataset contains a `content` field of **≥ 2000 words** (so a valid parent chunk can be produced), plus `ground_truth_entities` and `ground_truth_triples` that the runner validates against the document content. A dataset only passes when **100% of its ground-truth entities and triples** are resolvable from the content.

