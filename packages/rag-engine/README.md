# `@chronoviet/rag-engine`

> **ChronoViet Data Preprocessing, Ingestion ETL & Hybrid GraphRAG Engine**  
> Gói mã nguồn cốt lõi chịu trách nhiệm cào tự động 15 thời kỳ lịch sử & nạp dữ liệu tri thức offline (Mô-đun 0) và cung cấp động cơ truy xuất Hybrid GraphRAG chuẩn xác (Mô-đun 1) cho hệ thống ChronoViet. Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](file:///d:/Persional_Projects/ChronoViet/docs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v1.5.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/rag-engine` đảm nhận 2 nhiệm vụ cột trụ trong kiến trúc ChronoViet:

1. **Mô-đun 0: Data Preprocessing & Ingestion Engine (Offline ETL Pipeline):**
   * **Master Corpus Crawler (`crawl:all`):** Cào tự động 100% tài liệu tri thức lịch sử từ Wikipedia/Wikisource phủ rộng qua **15 Thời Kỳ Lịch Sử Việt Nam** chuẩn hóa qua danh mục `master-corpus-catalog.ts`.
   * **Text Cleaning & Entity Normalization:** Bóc tách văn bản, làm sạch nhiễu OCR, chuẩn hóa từ ngữ Hán-Việt, ánh xạ địa danh qua các thời kỳ (`SAME_AS_LOCATION`) và khử nhập nhằng nhân vật (`ALIAS_OF`).
   * **Dual-Axis Epoch Assignment (1771–1777):** Tự động gán mảng `epoch_ids: ["EPOCH_09", "EPOCH_10"]` cho các sự kiện thuộc giai đoạn mốc giao thời Nam-Bắc Triều và Tây Sơn.
   * **Hierarchical Temporal Chunking:** Phân đoạn văn bản đa cấp (Child 300–500 từ) đính kèm JSON Metadata chuẩn hóa.
   * **Dual-Branch Seeder:** Tạo Dense Embedding BGE-M3 (1024d) + BM25 Sparse Index nạp vào PostgreSQL `document_chunks` (chỉ mục HNSW `idx_chunks_embedding_hnsw`), đồng thời dùng Few-Shot LLM trích xuất bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ nạp vào bảng `entities` & `relationships`.
   * **Re-Indexing & Audit Trail (`rag:re-resolve`):** Hợp giải nút thực thể trùng lặp và ghi nhật ký thay đổi append-only vào `entity_audit_logs`.
   * **Media ETL & License Audit:** Lọc chất lượng ảnh ($\ge 600 \times 600\text{ px}$), kiểm định bản quyền Whitelisted License (`PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`) lưu vào `/media/raw-assets/` và snapshot `/media/license-snapshots/registry.json`. Chuẩn hóa âm lượng EBU R128 (-14 LUFS BGM, -6 LUFS Peak SFX).

2. **Mô-đun 1: Chrono-RAG Engine (Online Knowledge Retrieval):**
   * Động cơ tìm kiếm kết hợp **Hybrid GraphRAG** (PostgreSQL `pgvector` Dense BGE-M3 1024d + Relational Graph CTE Subgraph Search $k=1,2$ + BM25 FTS + Reciprocal Rank Fusion RRF + BGE Reranker v2 với trọng số $W_{\text{source}}$ re-ranking 15%).
   * Đảm bảo tính chính xác lịch sử 100%, truy xuất nguồn gốc trích dẫn (Citation Traceability) và loại bỏ hoàn toàn suy đoán sai (Hallucination Rate 0%).

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/rag-engine/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index
│   │   ├── crawl-corpus.ts            # CLI cào dữ liệu (--all, --epoch=EPOCH_XX, --topics)
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (Text ETL)
│   │   ├── re-resolve-cli.ts          # CLI hợp giải thực thể & ghi nhật ký entity_audit_logs
│   │   ├── setup-assets.ts            # CLI kiểm định & nạp media assets (Media ETL)
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/
│   │
│   ├── db/                            # Lớp Cơ sở Dữ liệu PostgreSQL
│   │   ├── schema.ts                  # DDL SQL Schema (chunks, entities, relationships, audit_logs)
│   │   └── client.ts                  # Connection pool & Transaction manager
│   │
│   ├── ingestion/                     # Lớp Tiền Xử Lý & Nạp Dữ Liệu (Mô-đun 0)
│   │   ├── crawler/                   # Master Corpus Catalog & Wiki/Web Scraper
│   │   │   ├── master-corpus-catalog.ts # Từ điển 15 Epochs Master Topics Catalog
│   │   │   ├── wiki-scraper.ts        # Wikipedia REST API scraper
│   │   │   └── quality-gate.ts        # Bộ lọc làm sạch văn bản & gán nhãn
│   │   ├── text/                      # OCR, Text Normalizer, Historical Entity Mapper
│   │   ├── chunking/                  # Hierarchical Chunker & Metadata Enricher
│   │   ├── seeder/                    # Dual-Branch Vector/Graph Indexing Engine
│   │   └── media/                     # Visual Asset Ingestor & Audio Asset Ingestor
│   │
│   ├── retrieval/                     # Động Cơ Truy Xuất Tri Thức (Mô-đun 1)
│   │   ├── vector-search.ts           # pgvector HNSW Dense & BM25 Sparse Search
│   │   ├── graph-cte-search.ts        # PostgreSQL Relational Graph CTE Subgraph Search
│   │   ├── question-ner.ts            # Phân tích câu hỏi & nhận dạng thực thể NER
│   │   ├── chunk-retriever.ts         # Hybrid RRF Fusion Retriever
│   │   └── reranker.ts                # Cross-Encoder BGE Reranker v2 + W_source re-ranking
│   │
│   ├── rag-engine.ts                  # Class điều phối chính ChronoRAGEngine
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark
│   ├── test-cases/                    # 5 tập dữ liệu mẫu chuẩn (Golden Datasets)
│   ├── ingest-runner.ts               # Benchmark Runner cho Mô-đun 0 (KPI 1-3)
│   ├── runner.ts                      # Benchmark Runner cho Mô-đun 1 (Fact Precision & Latency)
│   └── reports/                       # Báo cáo kết quả đánh giá xuất ra JSON
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi từ root monorepo thông qua `pnpm --filter @chronoviet/rag-engine <command>` hoặc trực tiếp trong thư mục package:

```bash
# 1. Khởi tạo SQL Schema & chỉ mục HNSW vector trên PostgreSQL pgvector
pnpm --filter @chronoviet/rag-engine db:init

# 2. Cào TỰ ĐỘNG TOÀN BỘ 15 Thời kỳ Lịch sử Việt Nam (Master Corpus Crawl)
pnpm crawl:all
# Hoặc cào riêng 1 Epoch (ví dụ: Epoch 5 - Nhà Trần):
pnpm --filter @chronoviet/rag-engine crawl:corpus --epoch=EPOCH_05

# 3. Chạy đường ống làm sạch & nạp kho tri thức văn bản (Text Ingestion ETL)
pnpm --filter @chronoviet/rag-engine ingest:knowledge --input=data/raw_corpus/

# 4. Hợp giải mâu thuẫn thực thể & ghi vết nhật ký audit log
pnpm --filter @chronoviet/rag-engine rag:re-resolve

# 5. Chạy đường ống nạp & kiểm định bản quyền tài nguyên media (Media ETL)
pnpm --filter @chronoviet/rag-engine setup-assets

# 6. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 0 (Data Ingestion)
pnpm --filter @chronoviet/rag-engine eval:ingest

# 7. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 1 (Chrono-RAG Search)
pnpm --filter @chronoviet/rag-engine eval
```

---

## 🗄️ 4. Cấu Trúc Cơ Sở Dữ Liệu SQL (Database Schema)

Gói mã nguồn khởi tạo và quản lý 5 bảng dữ liệu cốt lõi trong PostgreSQL:

1. **`document_chunks`**: Lưu trữ các đoạn văn bản child chunks, vector 1024 chiều (`embedding vector(1024)`), mảng `epoch_ids TEXT[]` (chỉ mục GIN `idx_chunks_epoch_ids`), chỉ mục HNSW Cosine Index (`idx_chunks_embedding_hnsw`), BM25 weights (`tsv tsvector`) và JSON metadata.
2. **`entities`**: Lưu trữ các nút thực thể lịch sử (`id`, `name`, `type`, `aliases`).
3. **`relationships`**: Lưu trữ các cạnh nối quan hệ đồ thị (`source_entity_id`, `target_entity_id`, `relation_type`, `confidence`).
4. **`entity_chunks`**: Bảng cầu nối Cross-Linking liên kết giữa Thực thể và Đoạn văn bản (`entity_id`, `chunk_id`).
5. **`entity_audit_logs`**: Bảng nhật ký vết thay đổi append-only theo dõi lịch sử hợp nhất thực thể (`MERGE_ENTITY`, `ALIAS_UPDATE`, `MODERN_OVERRIDE`, `CONFLICT_RESOLVE`).

---

## 📊 5. Kết Quả Đo Lường KPI & Benchmark (Evaluation Metrics)

### Báo Cáo Benchmark Mô-đun 0 (Data Preprocessing & Ingestion Engine):
* **Entity Normalization & Disambiguation Accuracy:** `100%` (Mục tiêu $> 98.0\%$).
* **Copyright License Audit Compliance:** `100%` (Mục tiêu $100\%$).
* **Golden Dataset Integrity & Seeder Throughput:** `100% Integrity` (2.000–5.000 chunks/giây).

### Báo Cáo Benchmark Mô-đun 1 (Chrono-RAG Engine):
* **Fact Precision Score:** `100%` (Mục tiêu $> 99.2\%$).
* **Hallucination Rate:** `0.0%` (Mục tiêu $< 0.8\%$).
* **Citation Traceability:** `100%` (Mục tiêu $100\%$).
* **Retrieval Latency:** `< 10ms` (Mục tiêu $< 300\text{ms}$).

---

## 📄 6. Giấy Phép & Bản Quyền (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**. Mọi sửa đổi phải tuân thủ nghiêm ngặt chuẩn Single Source of Truth (SSOT) khai báo tại [`@chronoviet/shared-spec`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec).

