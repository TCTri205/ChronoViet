# ChronoViet Module 0 Evaluation & Benchmark Suite (`Data-Ingestion ETL`)

This package contains the automated benchmark runner, quality diagnostic engine, and evaluation metrics for **Mô-đun 0 — Data Preprocessing & Ingestion Engine** (`@chronoviet/data-ingestion`).

---

## 🏛️ Hai Trụ Cột Đánh Giá Chất Lượng Thực Chiến (2 Production Pillars)

ChronoViet áp dụng 2 Trụ Cột Đánh Giá Chất Lượng Thực Chiến để đảm bảo tri thức nạp vào hệ thống đạt chuẩn cao nhất trước và sau khi lưu vào CSDL:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TRỤ CỘT 1: PRE-INGESTION CORPUS DIAGNOSTICS (Kho Văn Bản Thật)                          │
│ Lệnh: pnpm eval:ingest:diagnostic (hoặc --input=data/raw_corpus)                       │
│ ├─ Quét toàn bộ kho văn bản thật (.md, .txt, .json) trước khi nạp vào CSDL            │
│ ├─ Bóc tách phân cấp Parent (2k-3k từ) và Child (300-500 từ) Chunks                   │
│ ├─ Phân loại 5 nhóm lỗi:                                                              │
│ │  1. GENERIC_OR_HALLUCINATED_ENTITY (Nhiễu/danh từ chung bị gán sai)                 │
│ │  2. UNMAPPED_ENTITY (Thực thể mới chưa có trong Master Ontology)                    │
│ │  3. LOW_CONFIDENCE_RELATION (Quan hệ có độ tin cậy < 0.85)                          │
│ │  4. TEMPORAL_SPATIAL_MISSING (Thiếu niên đại/triều đại/không gian)                  │
│ │  5. DANGLING_RELATIONSHIP (Quan hệ lơ lửng, thiếu đích xác định)                    │
│ ├─ Tự động cách ly vào Quarantine Buffer (quarantine_triples, unmapped_entities)       │
│ └─ Xuất báo cáo kép: ingest-diagnostic-report.json & ingest-diagnostic-report.md       │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TRỤ CỘT 2: REAL-DATABASE HYBRID INGESTION & E2E RAG EVALUATION (CSDL Thật)             │
│ Lệnh: pnpm ingest:knowledge --strict  ──►  pnpm eval --chain ingest-rag               │
│ ├─ Nạp song song đa nhánh: Dense Vector pgvector (1024d HNSW) + Knowledge Graph Triples│
│ │  + Junction Table entity_chunks vào PostgreSQL thật                                  │
│ ├─ Chế độ --strict kiểm soát nghiêm ngặt AI Gateway, Embedding Server & PostgreSQL   │
│ ├─ Chạy bộ câu hỏi benchmark thực tế (Multi-hop, Ambiguity, Historical Alias, Epoch)   │
│ └─ Đo đạc bộ chỉ số IR:                                                               │
│    • MRR (Mean Reciprocal Rank) >= 0.70                                               │
│    • nDCG@5 (Rank Quality) >= 0.75                                                    │
│    • Fact Precision >= 85.0%                                                          │
│    • Adversarial Rejection Rate = 100% (Từ chối câu hỏi tiền đề sai)                  │
│    • Citation Traceability = 100% (Minh bạch trích dẫn nguồn)                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Chỉ Tiêu KPI Đánh Giá Cục Bộ (Module 0 KPIs)

Khi chạy bộ kiểm thử đánh giá nhanh độc lập (`pnpm --filter @chronoviet/data-ingestion eval`):

| KPI | Tiêu chuẩn | Mô tả |
| :--- | :---: | :--- |
| **KPI 1: Entity Normalization & Disambiguation** | **$> 98.0\%$** | Độ chính xác giải quyết tên gọi, danh hiệu, thụy hiệu và địa danh lịch sử trên 40 test cases. |
| **KPI 2: Triple Extraction Accuracy** | **$\ge 90.0\%$** | Trích xuất chính xác bộ ba thực thể $(S \rightarrow P \rightarrow O)$ từ ngữ cảnh lịch sử. |
| **KPI 3: Golden Dataset Integrity** | **$100\%$** | Đảm bảo 100% thực thể và bộ ba ground truth được đối soát hợp lệ với văn bản gốc trên 5 Golden Datasets. |
| **KPI 4: Hierarchical Chunk Structural Quality** | **$100\%$** | Tuân thủ 100% quy chuẩn giới hạn từ và metadata cho Parent và Child Chunks. |
| **Seeder Throughput** | **$> 10\text{ chunks/s}$** | Tốc độ phân tách và xử lý văn bản đa cấp. |

---

## 📏 Giới Hạn Phân Đoạn Chunk Chuẩn Hóa (SSOT)

Mọi giới hạn phân đoạn được định nghĩa tập trung tại [`@chronoviet/shared-spec`](../../shared-spec/src/chunking.ts):

- **Parent Chunk:** `2000 - 3000` từ (`CHUNK_PARENT_MIN_WORDS` - `CHUNK_PARENT_MAX_WORDS`)
- **Child Chunk:** `300 - 500` từ (`CHUNK_CHILD_MIN_WORDS` - `CHUNK_CHILD_MAX_WORDS`, target `400`, overlap `40`)

---

## 🚀 Hướng Dẫn Thực Thi Đánh Giá

### 1. Trụ Cột 1: Chẩn Đoán Kho Văn Bản Thật (Corpus Diagnostics)
```bash
# Quét toàn bộ kho dữ liệu thật trong data/raw_corpus
pnpm eval:ingest:diagnostic

# Quét có giới hạn số lượng tài liệu hoặc chỉ định thư mục
pnpm --filter @chronoviet/data-ingestion eval:diagnostic --input=data/raw_corpus/ --limit=10

# Chạy nhanh với chế độ regex-only offline
pnpm --filter @chronoviet/data-ingestion eval:diagnostic --offline
```
*Báo cáo xuất tại:* `packages/data-ingestion/eval/reports/ingest-diagnostic-report.json` và `ingest-diagnostic-report.md`.

### 2. Trụ Cột 2: Đánh Giá Toàn Diện Trên CSDL PostgreSQL Thật (E2E RAG Chain)
```bash
# 1. Khởi động CSDL
docker compose up -d postgres redis

# 2. Khởi tạo schema 7 bảng CSDL
pnpm --filter @chronoviet/data-ingestion db:init

# 3. Nạp dữ liệu với cờ --strict
pnpm ingest:knowledge --strict

# 4. Chạy chuỗi đánh giá IR & Adversarial Rejection
pnpm eval --chain ingest-rag
```
*Báo cáo xuất tại:* `eval/reports/ingest-rag-chain-report.json`.

### 3. Đánh Giá Cục Bộ & Kiểm Thử Đơn Vị (Unit Tests & Local Benchmark)
```bash
# Chạy bộ benchmark 4 KPI của Module 0
pnpm --filter @chronoviet/data-ingestion eval

# Chạy deterministic unit tests (chạy trong CI)
pnpm --filter @chronoviet/data-ingestion test
```
*Báo cáo xuất tại:* `packages/data-ingestion/eval/reports/ingest-eval-report.json`.

---

## 📁 Golden Datasets

Tập 5 Golden Datasets nằm tại thư mục `eval/test-cases/` (dùng chung cho toàn bộ monorepo):
1. `battle_bach_dang_938.json` — Trận Bạch Đằng năm 938 (BATTLE)
2. `biography_tran_hung_dao.json` — Tiểu sử Hưng Đạo Đại Vương Trần Quốc Tuấn (BIOGRAPHY)
3. `dynasty_nha_ly.json` — Triều đại nhà Lý (DYNASTY)
4. `mystery_le_chi_vien.json` — Vụ án Lệ Chi Viên (MYSTERY)
5. `artifact_trong_dong_ngoc_lu.json` — Trống đồng Ngọc Lũ (ARTIFACT)


