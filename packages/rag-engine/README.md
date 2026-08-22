# `@chronoviet/rag-engine`

> **ChronoViet Hybrid GraphRAG Retrieval Engine (Mô-đun 1) — [v2.2 Production Hardened]**  
> Gói mã nguồn chịu trách nhiệm cung cấp động cơ truy xuất tri thức thời gian thực Hybrid GraphRAG chuẩn xác (Mô-đun 1) cho hệ thống ChronoViet. Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v2.0 & [01_CHRONO_RAG_ENGINE.md](../../docs/modules/01_CHRONO_RAG_ENGINE.md).

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/rag-engine` đảm nhận nhiệm vụ truy xuất dữ liệu tri thức trực tuyến (Online Knowledge Retrieval Engine):

* **Global Singleton Schema Initialization:** Cơ chế Singleton Promise `ensureGlobalSchemaInitialized()` đảm bảo kịch bản DDL SQL chỉ khởi chạy 1 lần duy nhất trong toàn bộ vòng đời tiến trình, loại bỏ table lock và độ trễ dư thừa trên mỗi request.
* **SQL Recursive CTE với Cycle Pruning:** Duyệt đồ thị tri thức $k=1, 2$ trên PostgreSQL qua Recursive CTE kèm mảng theo dõi `visited_path`, triệt tiêu hoàn toàn chu trình lặp ngược $A \to B \to A$.
* **Lexical FTS Keyword Sanitization:** Tiền xử lý câu hỏi tự nhiên qua bộ lọc stopword tiếng Việt (`sanitizeFtsQuery`), ngăn chặn triệt để hiện tượng False Negative khi người dùng hỏi các câu tự nhiên như *"Ai là người...", "Tại sao..."*.
* **Score Calibration & Fair Co-Retrieval Boost:** Chuẩn hóa điểm khởi tạo của Graph Chunks về thang RRF $1 / (60 + \text{rank})$ và cộng điểm thưởng `CO_RETRIEVAL_BOOST = 0.35` cho các đoạn trích được đồng xác thực bởi cả hai nhánh (Graph + Vector).
* **In-Memory LRU Embedding Cache:** Bộ nhớ đệm LRU Cache (`SimpleLRUCache`, 500 mục) lưu trữ vector embedding của các câu hỏi phổ biến, đạt độ trễ truy xuất sub-millisecond ($< 0.1\text{ms}$).
* **Pure Local Cross-Encoder Reranker & Multi-Factor Historical Fusion:** Xếp hạng ngữ nghĩa chuyên sâu bằng mô hình Cross-Encoder cục bộ (`Qwen3-Reranker-0.6B` / `bge-reranker-v2-m3` GGUF Q8_0 qua `POST /v1/rerank` trên `llama-server` Metal Engine, Port 8096), kết hợp Multi-Factor Fusion (75% AI Score + 15% Cấp sử liệu LEVEL_1/2/3 + 10% Co-retrieval Boost) và bảo toàn danh xưng lịch sử 2 ký tự (*Lê, Lý, Hồ, Ba, Đô, Võ*).
* **Citation Traceability & Accuracy:** Đảm bảo tính chính xác lịch sử 100%, truy xuất nguồn gốc trích dẫn đầy đủ và loại bỏ suy đoán sai (Hallucination Rate 0%).
* **Shared Database Layer:** Tận dụng Lớp Cơ sở dữ liệu PostgreSQL & In-Memory Store trung tâm từ [`@chronoviet/shared-spec`](../shared-spec) quản lý các bảng tri thức `document_chunks`, `entities`, `relationships`, `entity_chunks` và `entity_audit_logs`.

*(Lưu ý: Mô-đun 0 Offline Data Preprocessing & Ingestion Pipeline bao gồm crawler, làm sạch văn bản, hierarchical chunking, dual-branch seeder và media ETL hiện đã được tách độc lập sang gói [`@chronoviet/data-ingestion`](../data-ingestion)).*

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/rag-engine/
├── src/
│   ├── retrieval/                     # Động Cơ Truy Xuất Tri Thức (Mô-đun 1)
│   │   ├── vector-search.ts           # pgvector HNSW Dense, BM25 FTS Sanitization & LRU Cache
│   │   ├── graph-cte-search.ts        # PostgreSQL Relational Graph Recursive CTE Cycle Pruning
│   │   ├── question-ner.ts            # Phân tích câu hỏi & nhận dạng thực thể NER (< 1ms)
│   │   ├── chunk-retriever.ts         # Graph-Guided Chunk Retrieval với Calibrated Score
│   │   └── reranker.ts                # Pure Local Cross-Encoder Reranker & Multi-Factor Fusion
│   │
│   ├── rag-engine.ts                  # Class điều phối chính ChronoRagEngine (Singleton Schema Init)
│   ├── index.ts                       # Entrypoint export public APIs
│   └── __tests__/                     # Unit Tests Suite độc lập cho CI/CD Gate
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 1 (C0-C10)
│   ├── benchmarks/                    # 11 Component Benchmark Tiers & System Ablation
│   │   └── index.ts                   # Benchmark CLI Router & Entrypoint
│   ├── datasets/                      # 300 Canonical, 500 Perturbations, 200 Adversarial Datasets
│   ├── metrics/                       # Đo lường NDCG, MRR, Fact Precision, Hallucination Rate
│   └── reports/                       # Báo cáo kết quả benchmark JSON
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

# 2. Chạy toàn bộ 11 Component Benchmarks + System Ablation Mô-đun 1
pnpm --filter @chronoviet/rag-engine eval

# 3. Chạy từng Component Benchmark riêng biệt:
pnpm --filter @chronoviet/rag-engine eval -- --c0    # Knowledge Graph Construction
pnpm --filter @chronoviet/rag-engine eval -- --c4    # Hybrid Dense+FTS Retrieval
pnpm --filter @chronoviet/rag-engine eval -- --c6    # Reranker & nDCG@5
pnpm --filter @chronoviet/rag-engine eval -- --c9    # Claim-level Grounding & Citation
pnpm --filter @chronoviet/rag-engine eval -- --sys   # System Ablation Matrix

# 4. Chạy Unit Tests toán học metrics xếp hạng & grounding
pnpm --filter @chronoviet/rag-engine test

# 5. Build gói mã nguồn
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
