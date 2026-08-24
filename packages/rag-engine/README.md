# `@chronoviet/rag-engine`

> **ChronoViet Hybrid GraphRAG Retrieval Engine (Mô-đun 1) — [v5.0 Production Hardened]**  
> Gói mã nguồn chịu trách nhiệm cung cấp động cơ truy xuất tri thức thời gian thực Hybrid GraphRAG chuẩn xác (Mô-đun 1) cho hệ thống ChronoViet. Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v2.0 & [01_CHRONO_RAG_ENGINE.md](../../docs/modules/01_CHRONO_RAG_ENGINE.md).

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/rag-engine` đảm nhận nhiệm vụ truy xuất dữ liệu tri thức trực tuyến (Online Knowledge Retrieval Engine):

* **Global Singleton Schema Initialization:** Cơ chế Singleton Promise `ensureGlobalSchemaInitialized()` đảm bảo kịch bản DDL SQL chỉ khởi chạy 1 lần duy nhất trong toàn bộ vòng đời tiến trình, loại bỏ table lock và độ trễ dư thừa trên mỗi request.
* **Directed BFS Graph Traversal (thay Recursive CTE cũ):** Duyệt đồ thị tri thức $k=1, 2$ với Global Visited-Set (chống nhân bản path), Node Budget (mặc định 50) + Timeout (mặc định 40ms) chống Hub Explosion, lọc edge nhiễu (`MENTIONED_IN`/`SAME_AS_LOCATION` bị loại trừ; duyệt ngược chỉ cho `LED_BY`/`PART_OF`/`ALIAS_OF`), lọc `confidence >= 0.5` — giảm C3-M6 HubNodeExpansion từ 4,792 → 14 nodes và CTE latency từ 119ms → 2ms.
* **Lexical FTS Keyword Sanitization & Unaccent Normalization:** Tiền xử lý câu hỏi tự nhiên qua bộ lọc stopword tiếng Việt (`sanitizeFtsQuery`) kết hợp chuẩn hóa không dấu (`removeVietnameseAccents`), mở rộng khả năng khớp danh xưng lịch sử và triều đại.
* **Deterministic Graph Chunk Ordering + Seed-Priority:** Truy vấn `getChunksForEntities` ưu tiên chunk gắn seed entity từ Question NER trước, sau đó sắp xếp tất định theo độ tin cậy nguồn (`LEVEL_1` > `LEVEL_2` > `LEVEL_3`) và ID (`LIMIT 20`), gán `graphScore = confidence * 0.6^(hop-1)` cho fusion.
* **Explicit Co-Retrieval State Contract (`isCoRetrieved`):** Khai báo tường minh cờ kiểu `isCoRetrieved: boolean` trong `VectorSearchResult` và cộng điểm thưởng nhỏ theo tín hiệu đồ thị `GRAPH_BOOST_SCALE * graphScore = 0.05 * (confidence * 0.6^(hop-1))` (thay boost flat `+0.35` cũ gây nhiễu ranking); graph-only chunks vào pool với score rất thấp để không chiếm chỗ candidate vector/FTS tốt hơn.
* **In-Memory LRU Embedding Cache:** Bộ nhớ đệm LRU Cache (`SimpleLRUCache`, 500 mục) lưu trữ vector embedding của các câu hỏi phổ biến, đạt độ trễ truy xuất sub-millisecond ($< 0.1\text{ms}$).
* **Pure Local Cross-Encoder Reranker & Sentence-Boundary Truncation:** Xếp hạng ngữ nghĩa chuyên sâu bằng mô hình Cross-Encoder cục bộ (`Qwen3-Reranker-0.6B` / `bge-reranker-v2-m3` GGUF Q8_0 qua `POST /v1/rerank` trên `llama-server` Metal Engine, Port 8096), pool tối đa 5 candidates (`RERANK_CANDIDATE_POOL`), cắt ngắn an toàn theo ranh giới câu (`truncateToSentenceBoundary`) $\le 700\text{ ký tự}$ (đạt SLA p95 $\le 300\text{ms}$), kết hợp Multi-Factor Fusion (75% AI Score + 15% Cấp sử liệu LEVEL_1/2/3 + 5% Co-retrieval Boost) và bảo toàn danh xưng lịch sử 2 ký tự (*Lê, Lý, Hồ, Ba, Đô, Võ*).
* **Token-Budgeted Context Assembly (`maxTokens`):** Bộ đóng gói context tính toán ngân sách token động (~3.5 ký tự/token tiếng Việt), tuân thủ nghiêm ngặt `request.maxTokens` (mặc định 2048) và luôn đảm bảo giữ lại tối thiểu Top-1 thực thể.
* **High-Recall HNSW & Database Reverse Index:** Bổ sung reverse B-Tree index `idx_entity_chunks_chunk_id`, `idx_chunks_reliability` và nâng cấp cấu hình HNSW ($m=32, \text{ef\_construction}=128, \text{ef\_search}=100$).
* **Fail-Fast Preflight Probes in Evaluation:** Các bộ đo chẩn đoán (C4, C5, C6) tích hợp kiểm tra sức khỏe hạ tầng (DB & Cross-Encoder Port) trước khi chạy benchmark, chặn đứng hiện tượng báo cáo điểm 0 và độ trễ giả lập.
* **Citation Traceability & Accuracy:** Đảm bảo tính chính xác lịch sử 100%, truy xuất nguồn gốc trích dẫn đầy đủ và loại bỏ suy đoán sai (Hallucination Rate 0%).
* **Shared Database Layer:** Tận dụng Lớp Cơ sở dữ liệu PostgreSQL & In-Memory Store trung tâm từ [`@chronoviet/infra`](../infra) (connection pool `pg`, transaction helper `withTransaction`) quản lý các bảng tri thức `document_chunks`, `entities`, `relationships`, `entity_chunks` và `entity_audit_logs`.

*(Lưu ý: Mô-đun 0 Offline Data Preprocessing & Ingestion Pipeline bao gồm crawler, làm sạch văn bản, hierarchical chunking, dual-branch seeder và media ETL hiện đã được tách độc lập sang gói [`@chronoviet/data-ingestion`](../data-ingestion)).*

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/rag-engine/
├── src/
│   ├── retrieval/                     # Động Cơ Truy Xuất Tri Thức (Mô-đun 1)
│   │   ├── vector-search.ts           # pgvector HNSW Dense, BM25 FTS Sanitization & LRU Cache
│   │   ├── graph-cte-search.ts        # Directed BFS Graph Traversal (Visited-Set, Budget, Timeout)
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
