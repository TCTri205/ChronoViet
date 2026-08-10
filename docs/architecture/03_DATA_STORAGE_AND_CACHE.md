# CƠ SỞ DỮ LIỆU & CHIẾN LƯỢC CACHING
## (Data Persistence & Caching Strategy Specification)

---

## 1. Tổng Quan Tầng Lưu Trữ (Streamlined Single-VPS Storage Architecture)

Hệ thống **ChronoViet** áp dụng chiến lược lưu trữ tối giản hóa tối đa cho môi trường **Single-Host VPS Deployment** (tối ưu memory footprint và khả năng vận hành):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   STREAMLINED VPS STORAGE ARCHITECTURE (DOCKER COMPOSE)                │
│                                                                                        │
│ ┌──────────────────────────────────────┐  ┌──────────────────────────────────────────┐ │
│ │ 1. PostgreSQL 15+ (pgvector) DB SSOT │  │ 2. Unified Redis Database                │ │
│ │ - Core Data, Users, Projects & Auth  │  │ - BullMQ Task Queues (AOF Persistence)   │ │
│ │ - LangGraph State Checkpointer Blobs │  │ - Multi-Layer Caching (Prompt & VLM)     │ │
│ │ - Vector Embeddings Search (pgvector)│  │ - Real-time WebSocket PubSub Channel     │ │
│ └──────────────────────────────────────┘  └──────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 3. Local Host Media Volume Storage (/media)                                        │ │
│ │ - s3:// /media/raw-assets/ (Ảnh thô & VieNeu Audio WAV)                            │ │
│ │ - /media/license-snapshots/ (Bằng chứng bản quyền Whitelisted & Response Headers) │ │
│ │ - /media/rendered-videos/ (Video MP4 đầu ra cho client tải xuống)                  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Cơ Sở Dữ Liệu

### 2.1. PostgreSQL + pgvector (SSOT Duy Nhất Cho Data, State Checkpoint & Vector Search)
* **Nhiệm vụ:** Đóng vai trò cơ sở dữ liệu quan hệ trung tâm (SSOT) cho toàn bộ hệ thống, lưu vết trạng thái 12 bước LangGraph, đồng thời thực hiện tìm kiếm vector tri thức RAG thông qua plugin `pgvector`.
* **Cấu hình Vector Search (`pgvector`):**
  * Extension: `CREATE EXTENSION IF NOT EXISTS vector;`
  * Model Embedding: `BAAI/bge-m3` (1024d) hoặc `vietnamese-bi-encoder`.
  * Indexing: `HNSW` index với `m=16`, `ef_construction=64` trên vector column `embedding vector(1024)` giúp truy vấn similarity k-NN dưới 5ms ngay trong Postgres.
* **Các Bảng Chính (Main Tables):**
  * `users` (`id`, `email`, `password_hash`, `role`, `created_at`)
  * `video_projects` (`id`, `user_id`, `title`, `video_type`, `template_id`, `status`, `json_spec_v3`, `created_at`)
  * `document_chunks` (`id`, `title`, `text_content`, `dynasty`, `key_figures`, `embedding vector(1024)`)
  * `checkpoints` & `checkpoint_blobs` (LangGraph State Checkpointer - Lưu vết 100% biến trạng thái từng bước agent)
  * `render_jobs` (`id`, `project_id`, `status`, `duration_seconds`, `output_url`, `error_log`, `started_at`, `finished_at`)
  * `audit_assets` (`id`, `scene_id`, `asset_url`, `vlm_score`, `license_type`, `reasons`)

### 2.2. Unified Redis Database (Broker Queue & Multi-Layer Cache)
* **Nhiệm vụ:** Đảm nhận đồng thời việc lưu vết hàng đợi BullMQ Jobs (với `appendonly yes`), lưu trữ bộ đệm (Prompt Cache, Asset VLM Scores), và truyền thông điệp real-time qua PubSub.
* **Max Memory & Policy:** Giới hạn max 1GB RAM (`maxmemory 1gb`), cơ chế không tự hủy queue (`noeviction` cho DB queue, LRU cho DB cache).

### 2.3. Local Host Media Storage (Tư Liệu Số, License Snapshots & Video MP4)
* **Nhiệm vụ:** Lưu trữ các tệp phương tiện dưới dạng file system cục bộ tại Mount Volume `/media`, được Caddy Reverse Proxy serve static trực tiếp đến client với tốc độ cao.
* **Cấu trúc Thư mục `/media`:**
  * `/media/raw-assets/`: Chứa hình ảnh crawl và file âm thanh VieNeu TTS `.wav`.
  * `/media/license-snapshots/`: Chứa file ảnh snapshot + JSON response headers để đối soát giấy phép thương mại (`Public Domain`, `CC0`, `CC-BY`).
  * `/media/rendered-videos/`: Chứa file video MP4 hoàn thành.

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

