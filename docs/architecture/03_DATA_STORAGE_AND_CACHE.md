# CƠ SỞ DỮ LIỆU & CHIẾN LƯỢC CACHING
## (Data Persistence & Caching Strategy Specification)

---

## 1. Tổng Quan Tầng Lưu Trữ (Polyglot Persistence Architecture)

Hệ thống **ChronoViet** sử dụng mô hình **Polyglot Persistence** — mỗi loại dữ liệu được lưu trữ trong một công nghệ cơ sở dữ liệu tối ưu nhất cho mục đích sử dụng đó. Ở giai đoạn MVP, toàn bộ các data stores này được đóng gói và vận hành trong **Docker Compose**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        POLYGLOT PERSISTENCE LAYER (DOCKER COMPOSE)                     │
│                                                                                        │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │ 1. Qdrant Vector DB    │  │ 2. PostgreSQL          │  │ 3. Neo4j Graph DB          │ │
│ │ - Semantic Embeddings  │  │ - Core Data & Billing  │  │ - Family Tree (Dòng tộc)   │ │
│ │ - BGE-M3 (1024d)       │  │ - LangGraph Checkpoint │  │ - Event & Person Graph     │ │
│ └────────────────────────┘  └────────────────────────┘  └────────────────────────────┘ │
│ ┌────────────────────────┐  ┌────────────────────────┐                                 │
│ │ 4. Redis Cluster       │  │ 5. MinIO / AWS S3      │                                 │
│ │ - BullMQ Queues & Cache│  │ - Raw Assets (.wav)    │                                 │
│ │ - Multi-Layer LLM Cache│  │ - Rendered MP4 Videos  │                                 │
│ └────────────────────────┘  └────────────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Cơ Sở Dữ Liệu

### 2.1. Vector Database — Qdrant (Dữ liệu Tri thức RAG)
* **Nhiệm vụ:** Lưu trữ hàng triệu vector đại diện cho các đoạn văn bản lịch sử đã chunking.
* **Vector Configuration:**
  * Model: `BAAI/bge-m3` (Dense: 1024 dimensions + Lexical Sparse BM25 + Multi-Vector) hoặc `bkai-foundation-models/vietnamese-bi-encoder`.
  * Metric: Cosine Similarity.
  * HNSW Indexing parameters: `m=16`, `ef_construct=100` giúp truy vấn dưới 10ms.
* **Payload Fields:** `chunk_id`, `source_book`, `dynasty`, `year_start`, `year_end`, `key_figures`, `location`, `text_content`.

### 2.2. Relational Database — PostgreSQL (Dữ liệu Core & LangGraph Checkpointer)
* **Nhiệm vụ:** Quản lý người dùng, phân quyền, cấu hình dự án video, lưu trữ LangGraph State Checkpoints và logs render.
* **Các bảng chính (Main Tables):**
  * `users` (`id`, `email`, `password_hash`, `role`, `created_at`)
  * `video_projects` (`id`, `user_id`, `title`, `video_type`, `template_id`, `status`, `json_spec_v3`, `created_at`)
  * `checkpoint_blobs` & `checkpoints` (LangGraph State Checkpointer - Lưu vết 100% biến trạng thái từng bước agent)
  * `render_jobs` (`id`, `project_id`, `status`, `duration_seconds`, `output_url`, `error_log`, `started_at`, `finished_at`)
  * `audit_assets` (`id`, `scene_id`, `asset_url`, `vlm_score`, `verdict`, `reasons`)

### 2.3. Graph Database — Neo4j (Đồ thị Lịch sử GraphRAG)
* **Nhiệm vụ:** Biểu diễn các mối quan hệ phức tạp giữa nhân vật, triều đại và địa danh cho Hybrid GraphRAG Local Search.
* **Nodes:** `:Person`, `:Event`, `:Location`, `:Dynasty`, `:TimePeriod`, `:DocumentChunk`.
* **Relationships:** `PART_OF`, `LED_BY`, `HAPPENED_IN`, `HAPPENED_AT`, `SAME_AS_LOCATION` (đổi tên địa danh), `ALIAS_OF` (tên húy/niên hiệu), `ROYAL_LINEAGE` (dòng tộc), `MENTIONED_IN` (liên kết chéo Node Đồ thị & Chunk Vector ID).

### 2.4. Object Storage — MinIO / AWS S3 (Tư Liệu Số & Video MP4)
* **Nhiệm vụ:** Lưu trữ file tĩnh (Audio voiceover, BGM, SFX, hình ảnh crawl được, và file video MP4 sau khi render xong).
* **Bucket Layout:**
  * `s3://chronoviet-raw-assets/`: Chứa ảnh thô crawl được và file audio TTS.
  * `s3://chronoviet-rendered-videos/`: Chứa file MP4 đầu ra cho người dùng tải xuống.

---

## 3. Chiến Lược Caching Multi-Layer (Redis Caching Strategy)

Dịch vụ Redis được sử dụng làm bộ nhớ đệm đa tầng để tăng tốc độ phản hồi và giảm chi phí gọi API LLM:

```
                                    ┌───────────────────────────┐
                                    │    Incoming API Request   │
                                    └─────────────┬─────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────────┐
                                    │     L1: Prompt Cache      │
                                    │  (Exact Match Query Hash) │
                                    └─────────────┬─────────────┘
                                                  │ (Miss)
                                                  ▼
                                    ┌───────────────────────────┐
                                    │   L2: RAG Context Cache   │
                                    │  (Vector Search Results)  │
                                    └─────────────┬─────────────┘
                                                  │ (Miss)
                                                  ▼
                                    ┌───────────────────────────┐
                                    │  L3: Asset URL & VLM Score│
                                    │ (Tránh audit lại ảnh cũ) │
                                    └───────────────────────────┘
```

### Các Use Case Caching Chi Tiết:

1. **LLM Response & Prompt Caching (TTL: 24 giờ):**
   * Hash của câu hỏi RAG phổ biến (ví dụ: *"Trận Bạch Đằng năm 938 diễn ra như thế nào?"*) được lưu cache. Nếu user khác hỏi câu tương tự, trả về kết quả ngay lập tức mà không cần gọi lại LLM.
2. **Asset VLM Score Caching (TTL: 30 ngày):**
   * Nếu bức ảnh `ngoc-hoi-map.jpg` đã được Gemini 2.5 Flash VLM chấm 85 điểm trước đó, kết quả này (kèm pHash) được cache lại. Các dự án video sau có cùng ảnh sẽ không tốn chi phí gọi VLM lại.
3. **Session & Rate-limiting Store (TTL: 1 giờ):**
   * Lưu Token JWT, số lượt tạo video còn lại của User (Free vs Premium tier).

