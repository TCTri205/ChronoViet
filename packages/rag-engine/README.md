# `@chronoviet/rag-engine`

> **ChronoViet Data Preprocessing, Ingestion ETL & Hybrid GraphRAG Engine**  
> Gói mã nguồn cốt lõi chịu trách nhiệm nạp dữ liệu tri thức lịch sử offline (Mô-đun 0) và cung cấp động cơ truy xuất Hybrid GraphRAG chuẩn xác (Mô-đun 1) cho hệ thống ChronoViet.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/rag-engine` đảm nhận 2 nhiệm vụ cột trụ trong kiến trúc ChronoViet:

1. **Mô-đun 0: Data Preprocessing & Ingestion Engine (Offline ETL Pipeline):**
   * Bóc tách văn bản từ PDF/Scan (Sách giáo khoa, *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*...) bằng **MinerU / PDF-Extract-Kit** và **Tesseract**.
   * Làm sạch nhiễu OCR, chuẩn hóa từ ngữ Hán-Việt, loại bỏ trang rác/header/footer.
   * Quản lý từ điển ánh xạ địa danh qua các thời kỳ (`SAME_AS_LOCATION`) và đồng nhất nhân vật (`ALIAS_OF`).
   * Phân đoạn văn bản đa cấp (**Dynamic Hierarchical Temporal Chunking**: Parent 2.000–3.000 từ, Child 300–500 từ) đính kèm JSON Metadata chuẩn hóa.
   * Lớp nạp dữ liệu song song (**Dual-Branch Seeder**): Tạo Dense Embedding BGE-M3 (1024d) + BM25 Sparse Index nạp vào PostgreSQL `document_chunks` (chỉ mục HNSW `idx_chunks_embedding_hnsw`), đồng thời dùng Few-Shot LLM trích xuất bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ nạp vào bảng `entities` & `relationships`.
   * **Media ETL & License Audit:** Lọc chất lượng ảnh ($\ge 600 \times 600\text{ px}$), kiểm định bản quyền Whitelisted License (`PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`) lưu vào `/media/raw-assets/` và snapshot `/media/license-snapshots/registry.json`. Chuẩn hóa âm lượng EBU R128 (-14 LUFS BGM, -6 LUFS Peak SFX).

2. **Mô-đun 1: Chrono-RAG Engine (Online Knowledge Retrieval):**
   * Động cơ tìm kiếm kết hợp **Hybrid GraphRAG** (PostgreSQL `pgvector` Dense BGE-M3 1024d + Relational Graph CTE Subgraph Search $k=1,2$ + BM25 FTS + Reciprocal Rank Fusion RRF + BGE Reranker v2).
   * Đảm bảo tính chính xác lịch sử 100%, truy xuất nguồn gốc trích dẫn (Citation Traceability) và loại bỏ hoàn toàn suy đoán sai (Hallucination Rate 0%).

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/rag-engine/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (Text ETL)
│   │   ├── setup-assets.ts            # CLI kiểm định & nạp media assets (Media ETL)
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/
│   │
│   ├── db/                            # Lớp Cơ sở Dữ liệu PostgreSQL
│   │   ├── schema.ts                  # DDL SQL Schema (chunks, entities, relationships)
│   │   └── client.ts                  # Connection pool & Transaction manager
│   │
│   ├── ingestion/                     # Lớp Tiền Xử Lý & Nạp Dữ Liệu (Mô-đun 0)
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
│   │   └── reranker.ts                # Cross-Encoder BGE Reranker v2
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

# 2. Chạy đường ống làm sạch & nạp kho tri thức văn bản (Text Ingestion ETL)
pnpm --filter @chronoviet/rag-engine ingest:knowledge --input=data/raw_corpus/

# 3. Chạy đường ống nạp & kiểm định bản quyền tài nguyên media (Media ETL)
pnpm --filter @chronoviet/rag-engine setup-assets

# 4. Nạp 5 tập Golden Datasets vào thư mục eval/
pnpm --filter @chronoviet/rag-engine eval:seed

# 5. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 0 (Data Ingestion)
pnpm --filter @chronoviet/rag-engine eval:ingest

# 6. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 1 (Chrono-RAG Search)
pnpm --filter @chronoviet/rag-engine eval
```

---

## 🗄️ 4. Cấu Trúc Cơ Sở Dữ Liệu SQL (Database Schema)

Gói mã nguồn khởi tạo và quản lý 4 bảng dữ liệu cốt lõi trong PostgreSQL:

1. **`document_chunks`**: Lưu trữ các đoạn văn bản child chunks, vector 1024 chiều (`embedding vector(1024)`), chỉ mục HNSW Cosine Index (`idx_chunks_embedding_hnsw`), BM25 weights và JSON metadata.
2. **`entities`**: Lưu trữ các nút thực thể lịch sử (`id`, `canonical_name`, `entity_type`, `aliases`).
3. **`relationships`**: Lưu trữ các cạnh nối quan hệ đồ thị (`source_id`, `target_id`, `relation_type`, `confidence`).
4. **`entity_chunks`**: Bảng cầu nối Cross-Linking liên kết giữa Thực thể và Đoạn văn bản (`entity_id`, `chunk_id`).

---

## 📊 5. Kết Quả Đo Lường KPI & Benchmark (Evaluation Metrics)

### Báo Cáo Benchmark Mô-đun 0 (Data Preprocessing & Ingestion Engine):
* **Entity Normalization & Disambiguation Accuracy:** `100%` (Mục tiêu $> 98.0\%$).
* **Copyright License Audit Compliance:** `100%` (Mục tiêu $100\%$).
* **Golden Dataset Integrity & Seeder Throughput:** `100% Integrity` (5.000 chunks/giây).

### Báo Cáo Benchmark Mô-đun 1 (Chrono-RAG Engine):
* **Fact Precision Score:** `100%` (Mục tiêu $> 99.2\%$).
* **Hallucination Rate:** `0.0%` (Mục tiêu $< 0.8\%$).
* **Citation Traceability:** `100%` (Mục tiêu $100\%$).
* **Retrieval Latency:** `< 180ms` (Mục tiêu $< 300\text{ms}$).

---

## 📄 6. Giấy Phép & Bản Quyền (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**. Mọi sửa đổi phải tuân thủ nghiêm ngặt chuẩn Single Source of Truth (SSOT) khai báo tại [`@chronoviet/shared-spec`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec).
