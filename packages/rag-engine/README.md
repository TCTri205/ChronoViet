# `@chronoviet/rag-engine`

> **ChronoViet Hybrid GraphRAG Retrieval Engine (Mô-đun 1)**  
> Gói mã nguồn chịu trách nhiệm cung cấp động cơ truy xuất tri thức thời gian thực Hybrid GraphRAG chuẩn xác (Mô-đun 1) cho hệ thống ChronoViet. Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v1.5.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/rag-engine` đảm nhận nhiệm vụ truy xuất dữ liệu tri thức (Online Knowledge Retrieval Engine):

* **Hybrid GraphRAG Engine:** Kết hợp **PostgreSQL pgvector Dense (BGE-M3 1024d)** + **Relational Graph CTE Subgraph Search ($k=1,2$)** + **BM25 Sparse FTS** + **Reciprocal Rank Fusion (RRF)** + **BGE Reranker v2** với trọng số nguồn tin $W_{\text{source}}$ re-ranking 15%.
* **Citation Traceability & Accuracy:** Đảm bảo tính chính xác lịch sử 100%, truy xuất nguồn gốc trích dẫn đầy đủ và loại bỏ suy đoán sai (Hallucination Rate 0%).
* **Shared Database Layer:** Tận dụng Lớp Cơ sở dữ liệu PostgreSQL & In-Memory Store trung tâm từ [`@chronoviet/shared-spec`](../shared-spec) quản lý các bảng tri thức `document_chunks`, `entities`, `relationships`, `entity_chunks` và `entity_audit_logs`.

*(Lưu ý: Mô-đun 0 Offline Data Preprocessing & Ingestion Pipeline bao gồm crawler, làm sạch văn bản, hierarchical chunking, dual-branch seeder và media ETL hiện đã được tách độc lập sang gói [`@chronoviet/data-ingestion`](../data-ingestion)).*

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/rag-engine/
├── src/
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
├── eval/                              # Tầng Đánh Giá & Benchmark Module 1
│   ├── datasets/                      # Tập dữ liệu mẫu chuẩn (Golden Datasets)
│   ├── runner.ts                      # Benchmark Runner cho Mô-đun 1 (Fact Precision & Latency)
│   └── metrics.ts                     # Đo lường Fact Precision, Hallucination Rate & Citation
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

```bash
# 1. Trải nghiệm Chatbot RAG tương tác trực tiếp trên Terminal CLI
pnpm --filter @chronoviet/rag-engine chat
# hoặc từ root monorepo:
pnpm rag:chat

# 2. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 1 (Chrono-RAG Search Engine)
pnpm --filter @chronoviet/rag-engine eval

# 3. Build gói mã nguồn
pnpm --filter @chronoviet/rag-engine build
```

### 💬 Các lệnh khả dụng trong Terminal Chatbot (`pnpm rag:chat`):
* `/help`: Hiển thị trợ giúp bộ lệnh.
* `/stats`: Kiểm tra số lượng văn bản, thực thể và liên kết trong kho tri thức.
* `/ingest <nội dung sử liệu>`: Nạp thêm văn bản tri thức lịch sử mới trực tiếp vào RAG Engine.
* `/exit`: Thoát terminal chatbot.

---

## 📄 4. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.
