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
│ │ - /media/projects/:id/ (Cấu trúc SSOT Workspace: assets, audio, temp, output)     │ │
│ │ - /media/projects/:id/output/video.mp4 (Video MP4 đầu ra SSOT)                     │ │
│ │ - /media/audio-cache/ (Bộ nhớ đệm âm thanh VieNeu TTS tái sử dụng)                │ │
│ │ - /media/raw-assets/ (Ảnh thô & tư liệu số gốc)                                    │ │
│ │ - /media/license-snapshots/ (Bằng chứng bản quyền Whitelisted & Response Headers) │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Cơ Sở Dữ Liệu

### 2.1. PostgreSQL + pgvector (SSOT Duy Nhất Cho Data, State Checkpoint & Vector Search)
* **Nhiệm vụ:** Đóng vai trò cơ sở dữ liệu quan hệ trung tâm (SSOT) cho toàn bộ hệ thống, lưu vết 15 trạng thái LangGraph (`INIT` → `COMPLETED`/`FAILED`), đồng thời thực hiện tìm kiếm vector tri thức RAG thông qua plugin `pgvector`.
* **Cấu hình Vector Search (`pgvector`):**
  * Extension: `CREATE EXTENSION IF NOT EXISTS vector;`
  * Model Embedding: `BAAI/bge-m3` (SSOT 1024-dim Dense Vector Space).
  * Indexing: `HNSW` index với `m=16`, `ef_construction=64` trên vector column `embedding vector(1024)` giúp truy vấn similarity k-NN dưới 5ms ngay trong Postgres.
* **Các Bảng Chính (Main Tables):**
  * `users` (`id`, `email`, `password_hash`, `role`, `created_at`)
  * `video_projects` (`id`, `user_id`, `title`, `video_type`, `template_id`, `status`, `json_spec_v4`, `created_at`)
  * `document_chunks` (`id`, `title`, `text_content`, `dynasty`, `key_figures`, `embedding vector(1024)`)
  * `checkpoints` & `checkpoint_blobs` (LangGraph State Checkpointer - Lưu vết 100% biến trạng thái từng bước agent)
  * `render_jobs` (`id`, `project_id`, `status`, `duration_seconds`, `output_url`, `error_log`, `started_at`, `finished_at`)
  * `audit_assets` (`id`, `scene_id`, `asset_url`, `vlm_score`, `license_type`, `reasons`)
  * `entity_audit_logs` (`id`, `entity_id`, `action`, `changes_payload`, `performed_by`, `created_at`)

### 2.2. Unified Redis Database (Broker Queue & Multi-Layer Cache)
* **Nhiệm vụ:** Đảm nhận đồng thời việc lưu vết hàng đợi BullMQ Jobs (với `appendonly yes`), lưu trữ bộ đệm (Prompt Cache, Asset VLM Scores), và truyền thông điệp real-time qua PubSub.
* **Max Memory & Policy:** Giới hạn max 1GB RAM (`maxmemory 1gb`), cơ chế không tự hủy queue (`noeviction` cho DB queue, LRU cho DB cache).

### 2.3. Local Host Media Storage (SSOT Project Workspace & Video Streaming)
* **Nhiệm vụ:** Lưu trữ các tệp phương tiện dưới dạng file system cục bộ tại Mount Volume `/media`, được quản lý nhất quán thông qua `initProjectWorkspace()` của `@chronoviet/infra`.
* **Cấu trúc Thư mục `/media` Chuẩn Hóa:**
  * `/media/projects/:projectId/`:
    * `assets/`: Hình ảnh và clip minh họa phục vụ dự án.
    * `audio/`: File âm thanh giọng đọc VieNeu TTS `.wav`/`.mp3` theo từng phân cảnh.
    * `captions/`: Phụ đề chi tiết `.srt`, `.vtt` hoặc `.json`.
    * `temp/`: Dữ liệu đệm phục vụ render Chromium (được tự động dọn dẹp sau render).
    * `output/video.mp4`: Video MP4 hoàn thiện đầu ra chuẩn SSOT.
    * `project_schema.json`: Schema chi tiết của project (bị chặn truy cập công khai qua Caddy 403).
  * `/media/audio-cache/`: Bộ nhớ đệm audio TTS dùng chung.
  * `/media/raw-assets/`: Tư liệu gốc chưa qua xử lý.
  * `/media/license-snapshots/`: Ảnh snapshot + JSON response headers đối soát bản quyền (`Public Domain`, `CC0`, `CC-BY`).
* **Phân phối Video & Phục vụ Media:**
  * **Video Streaming:** Endpoint `/api/v1/projects/:id/video` hỗ trợ chuẩn HTTP 206 Partial Content (Range Requests) cho trình duyệt tua và phát video mượt mà.
  * **Static Media:** Caddy Reverse Proxy phân phối file tĩnh từ `/media/` kèm `Cache-Control` và bảo mật `X-Content-Type-Options: nosniff`.

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
   * Nếu bức ảnh `ngoc-hoi-map.jpg` đã được Gemini 3.6 Flash VLM chấm 85 điểm trước đó, kết quả này (kèm pHash) được cache lại. Các dự án video sau có cùng ảnh sẽ không tốn chi phí gọi VLM lại.
3. **Session & Rate-limiting Store (TTL: 1 giờ):**
   * Lưu Token JWT, số lượt tạo video còn lại của User (Free vs Premium tier).
4. **Persistent ETL Chunk Extraction Checkpoint & Cache (`.cache/extraction_triples/`):**
   * Lưu kết quả trích xuất bộ ba tri thức theo mã băm SHA-256 của từng đoạn văn bản (`chunk`).
   * Hỗ trợ pipeline `pnpm ingest:knowledge` tự động tiếp tục (Resume) từ vị trí dừng mà không cần trích xuất lại các chunk đã hoàn thành, tiết kiệm thời gian và tài nguyên suy luận LLM. Xóa sạch khi dùng cờ `--force`.
5. **Project Directory In-Memory Cache (TTL: 60 giây):**
   * Bộ nhớ đệm danh sách thư mục dự án cho `GET /api/v1/projects` giúp triệt tiêu hiện tượng $O(N)$ Disk I/O Amplification khi quét thư mục lưu trữ `/media/projects`.
   * Tự động vô hiệu hóa (Invalidate) tức thì khi có dự án mới được khởi tạo qua `POST /api/v1/projects`.
   * Phân cấp quản lý đường dẫn: `getProjectPaths(id)` (chỉ truy xuất đường dẫn bộ nhớ, không tạo thư mục, an toàn cho các GET requests) và `initProjectWorkspace(id)` (khởi tạo cấu trúc thư mục đĩa idempotent cho pipeline ghi).
6. **In-Memory Dense Vector Embedding Cache (Smooth 20% LRU/FIFO Eviction):**
   * Lưu trữ bộ đệm các vector nhúng BGE-M3 (1024 chiều) trong `embeddingCache` (`MAX_CACHE_SIZE = 5000`).
   * Thay vì xóa sạch 100% gây hiện tượng Cache Stampede khi quá tải, hàm `evictOldestCacheEntries()` tự động giải phóng 20% bản ghi cũ nhất (1000 items) theo thứ tự chèn (FIFO/LRU) và giữ lại 80% warm cache, bảo toàn tỷ lệ hit rate cao cho các tác vụ batch ingestion và multi-scene generation.

---

## 4. Tầng Dữ Liệu Đánh Giá & Thử Nghiệm (Dev & Hybrid Evaluation Data Architecture)

Trong môi trường phát triển (Development) và kiểm thử tự động (CI/CD), dữ liệu không nằm trên Database production mà được quản lý theo **Mô hình Hybrid (2 Tầng)** ngay trong repository:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        HYBRID EVALUATION DATA ARCHITECTURE                              │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Tầng Độc Lập / Unit Eval (Nằm tại từng mô-đun: packages/<module>/eval/)        │  │
│  │ - rag-engine/eval/data/      : Ground-truth chunks & test query vectors          │  │
│  │ - vlm-inspector/eval/        : Test images & ground-truth licenses               │  │
│  │ - remotion-engine/eval/      : Test JSON specs (v4.1) & sample assets            │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Tầng Tập Trung / End-to-End Eval (Nằm tại Root: /eval hoặc apps/eval-suite/)   │  │
│  │ - eval/datasets/             : Golden Benchmark Datasets cho toàn bộ Pipeline     │  │
│  │ - eval/golden_outputs/       : Output kỳ vọng chuẩn E2E (RAG -> Script -> MP4)   │  │
│  │ - eval/e2e_runner.ts         : Script chạy Integration Benchmark toàn hệ thống    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Nguyên Tắc Quản Lý Dữ Liệu Eval:
1. **Phân biệt rạch ròi môi trường:** Dữ liệu trong Codebase chỉ là Mock/Benchmark. Mọi dữ liệu thực tế phát sinh của người dùng đều lưu ở Postgres/Redis/Volume `/media`.
2. **Unit Benchmark Nhanh:** Dev làm việc ở module nào chỉ cần chạy eval độc lập ở module đó (`pnpm --filter @chronoviet/rag-engine eval`) mà không bị phình dung lượng repo hay phụ thuộc môi trường ngoài.
3. **E2E Regression Test:** Thư mục `/eval` tập trung tại Root chịu trách nhiệm chạy test tích hợp toàn pipeline từ A-Z để đảm bảo 0 lỗi phát sinh khi kết hợp các module lại với nhau trước khi release.

---

## 5. Chiến Lược Sao Lưu & Khôi Phục Dữ Liệu (PostgreSQL Backup & Disaster Recovery)

Nhằm bảo vệ dữ liệu tri thức đồ thị (Knowledge Graph) và không gian vector (1024d HNSW Embeddings) trước các tác vụ làm sạch, chuẩn hóa hoặc kiểm thử phá hủy (destructive operations), hệ thống tích hợp sẵn bộ công cụ sao lưu và khôi phục tự động qua Docker:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL BACKUP & DISASTER RECOVERY PIPELINE                      │
│                                                                                         │
│  [PostgreSQL Container]                                                                 │
│           │                                                                             │
│           ├───► pg_dump (-Fc Binary Custom Format) ───► backups/db_backup_<timestamp>.dump│
│           │                                                    │ (Auto Copy)            │
│           │                                                    ▼                        │
│           │                                          backups/db_latest.dump             │
│           │                                                    │                        │
│           │     (When recovery needed)                         │                        │
│           ◄─── pg_restore (--clean --if-exists) ───────────────┘                        │
│           │                                                                             │
│           └───► Auto Trigger: verifyDbHealth() ───► Audit 6 Chiều Toàn Vẹn CSDL         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1. Đặc Tính Kỹ Thuật:
1. **Binary Custom Format (`.dump` qua `-Fc`):**
   - Nén nhị phân hiệu năng cao, bảo toàn 100% định nghĩa cấu trúc, chỉ mục Vector HNSW (`vector_cosine_ops`), Full-Text Search tsvector và toàn bộ ràng buộc khóa ngoại (Foreign Keys).
2. **Pointer Bản Mới Nhất (`backups/db_latest.dump`):**
   - Mỗi lần chạy sao lưu, hệ thống tự động cập nhật bản snapshot vào file `db_latest.dump` để có thể khôi phục tức thì bằng 1 lệnh mà không cần chỉ định tên file cụ thể.
3. **Tự Động Kiểm Định Tính Toàn Vẹn (Automated Post-Restore Audit):**
   - Lệnh khôi phục tự động kích hoạt `scripts/verify-db-health.ts` để rà soát 6 chiều: không có self-loops, không có quan hệ mồ côi (zero dangling references), 100% chỉ mục duy nhất và HNSW vector còn nguyên vẹn.

### 5.2. Lệnh Vận Hành & Quản Lý Phiên Bản:
```bash
# 1. Tạo bản sao lưu Snapshot có định danh tên & phiên bản cụ thể (Khuyến nghị):
pnpm db:backup --name post_ingest_v1
# (Hệ thống tạo file backups/post_ingest_v1.dump và tự động cập nhật pointer backups/db_latest.dump)

# 2. Khôi phục CSDL từ file phiên bản Snapshot cụ thể:
pnpm db:restore --file backups/post_ingest_v1.dump

# 3. Khôi phục nhanh từ bản Snapshot mới nhất:
pnpm db:restore
```

