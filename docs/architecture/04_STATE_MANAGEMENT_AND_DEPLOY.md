# QUẢN LÝ STATE, KHẢ NĂNG CHỊU LỖI & TOPOLOGY TRIỂN KHAI
## (State Management, Workflow Engine & Deployment Topology Specification)

---

## 1. Quản Lý State Máy Trạng Thái (State Machine Lifecycle)

Vòng đời từ khi người dùng nhập yêu cầu cho đến khi nhận video hoàn chỉnh trải qua 12 trạng thái quản lý nghiêm ngặt qua **LangGraph với Postgres Checkpointer SSOT**:

```
 [DRAFT] ──> [RAG_RETRIEVED] ──> [OUTLINE_CHAPTERED] ──> [CHAPTER_SCRIPT_GENERATED] <──────┐
                                                                  │                       │
 [COMPLETED] <─── [RENDERING] <─── [ASSETS_AUDITED] <─── [RECONCILED]                     │
      │                                    │                │ (>15% Mismatch)             │
  [FAILED] <─── (Max Retry Exceeded) <──────┴──────── [DURATION_MISMATCH] ────────────────┘
      ▲
      └─────────────────────────────────── [NEEDS_HUMAN_REVIEW]
```

### Chi tiết các trạng thái (v3.3 Operational):

| State | Mô tả trạng thái | Xử lý Idempotency & Compensation (Phục hồi lỗi) |
| :--- | :--- | :--- |
| `DRAFT` | Tạo bản nháp dự án video từ prompt người dùng. | Tạo `projectId` duy nhất (UUIDv4). |
| `RAG_RETRIEVED` | Lấy xong trích dẫn sử liệu chuẩn từ PostgreSQL (`pgvector` + Relational Graph). | Checkpoint state vào PostgreSQL, cache context vào Redis. |
| `OUTLINE_CHAPTERED` | Micro-Step 0 chia video thành $N$ Chapters (2-3 min/Chap). | Checkpoint danh sách Chapter Outlines & `runningNarrativeState`. |
| `CHAPTER_SCRIPT_GENERATED` | Scriptwriter Agent sinh xong lời thoại truyền `narrativeContext`. | Checkpoint voiceover text của từng Chapter. |
| `CHAPTER_FACT_CHECKED` | Hybrid Fact-Checker (Alias Table + Fuzzy Match) duyệt xong. | Áp dụng Thang Escalation 4 Tầng: Tier 0 Retry $\le 2$ ➔ Tier 1 Code Auto-Fix ➔ Tier 2 Cloud Model 72B ➔ Tier 3 Flag `NEEDS_HUMAN_REVIEW`. |
| `RECONCILED` | Step 1B-Reconcile đối soát tổng thời lượng Scene với Target Chapter. | Cân bằng pacing nhẹ nếu sai số 5-15% (Time-Stretch ±10%). Nếu sai số > 15%, chuyển trạng thái `DURATION_MISMATCH`. |
| `DURATION_MISMATCH` | Phát hiện độ lệch thời lượng audio vs scene script > 15%. | Trigger Script Agent viết lại pacing / kịch bản (retry $\le 2$ lần). Nếu quá 2 lần, chuyển `FAILED`. |
| `ASSETS_AUDITED` | Audio VieNeu, License Snapshot & Hybrid VLM Strategy 3+3 hoàn tất. | File JSON Production v3.2 chính thức được đóng gói và checkpoint vào PostgreSQL SSOT. |
| `RENDERING` | Render Worker pre-download media và chạy `npx remotion render`. | Cập nhật % tiến độ qua WebSocket. Nếu Worker sập giữa chừng, Re-queue task từ checkpoint gần nhất. |
| `NEEDS_HUMAN_REVIEW` | Fact-Check không thể tự xử lý sau 4 lần retry. | Gửi Alert Webhook/UI để biên tập viên duyệt/sửa tay, không làm sập pipeline. |
| `COMPLETED` | Video MP4 đã xuất thành công và tải lên Object Storage. | Trả link download MP4 cho client, dọn dẹp temp files & Chrome processes. |
| `FAILED` | Dự án bị lỗi rớt không thể khắc phục. | Ghi lại traceback log, hoàn lại token/credit cho người dùng. |

---

## 2. Tính Nhất Quán & Idempotency (Idempotency Control)

* **Idempotent Job Submission:**
  Mọi tác vụ render đều mang một `idempotency_key` dạng `md5(json_spec_v3_content)`. Nếu người dùng ấn nút Render nhiều lần liên tiếp, worker sẽ nhận diện key trùng lặp và không render lại.
* **LangGraph Persistence Checkpointer:**
  Mọi bước chuyển trạng thái (State Transition) trong LangGraph đều được tự động lưu checkpoint dưới dạng serialized binary/json trong PostgreSQL. Khi server hoặc worker bị rớt hoặc restart, Orchestrator tự động khôi phục đúng biến trạng thái tại bước bị dừng mà không phải chạy lại RAG hay Script Agent từ đầu.

---

## 3. Kiến Trúc Triển Khai (Single-Host VPS Deployment Topology)

Hệ thống được đóng gói bằng **Docker Containers** và tinh gọn tối đa để vận hành ổn định, tiết kiệm tài nguyên trên **1 VPS duy nhất + Domain cá nhân** (tối thiểu 8GB RAM):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             SINGLE-HOST VPS STREAMLINED TOPOLOGY (OPERATIONAL HARDENED v3.4)           │
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         CADDY REVERSE PROXY CONTAINER                              │ │
│ │          (Auto SSL/TLS Let's Encrypt - GitOps Caddyfile - WebSocket - Static Media)  │ │
│ └─────────────────────────────────────────┬──────────────────────────────────────────┘ │
│                                           │                                            │
│        ┌──────────────────────────────────┼──────────────────────────────────┐         │
│        ▼                                  ▼                                  ▼         │
│ ┌────────────────────────┐     ┌────────────────────────┐     ┌──────────────────────┐ │
│ │  PostgreSQL Container  │     │   App Monolith API     │     │   Redis Container    │ │
│ │ (Relational + Checkpoints│   │ (Next.js / Fastify /   │     │ (BullMQ Job Queue &  │ │
│ │  + pgvector Embeddings)│     │  LangGraph Orchestrator│     │  LRU Multi-Layer     │ │
│ └────────────────────────┘     └──────────┬─────────────┘     │  Cache & WS PubSub)  │ │
│                                           │                   └──────────┬───────────┘ │
│                                           └─────────────┬────────────────┘             │
│                                                         ▼                              │
│                                ┌─────────────────────────────────────────────────────┐ │
│                                │             AI & RENDER WORKER CONTAINER            │ │
│                                │ (VieNeu TTS ONNX Engine & Remotion Headless Chrome) │ │
│                                └─────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Chi Tiết Thành Phần Tinh Gọn (VPS Minimal Stack):
1. **Caddy Reverse Proxy (`caddy:2-alpine`)**: Tự động cấp & gia hạn SSL Cert Let's Encrypt theo Domain. Forward WebSocket và serve trực tiếp file video/audio từ Host Volume `/media` (RAM footprint ~30MB).
2. **PostgreSQL + pgvector (`pgvector/pgvector:pg15`)**: Đóng vai trò **SSOT duy nhất** cho toàn bộ dữ liệu quan hệ, LangGraph State Checkpoint, và Vector Embeddings (thay thế việc phải chạy đồng thời Qdrant + Neo4j).
3. **Unified Redis (`redis:7-alpine`)**: Quản lý đồng thời BullMQ Job Queues (AOF persistence) và LRU Cache trong 1 container duy nhất.
4. **App Monolith (`app`)**: Tích hợp Web Dashboard UI, User API, RAG Engine, và LangGraph Orchestrator vào 1 quy trình Node.js duy nhất.
5. **Render & AI Worker (`worker`)**: Nhận job từ Redis BullMQQueue để sinh voiceover VieNeu TTS và render video Remotion (khóa `CONCURRENCY=1` để không gây nghẽn CPU/RAM VPS).

---

## 4. File Cấu Hình Triển Khai Thực Tế (VPS Production Docker Compose)

### 4.1. `docker-compose.yml`

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./media:/app/media:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

  postgres:
    image: pgvector/pgvector:pg15
    restart: always
    environment:
      POSTGRES_DB: chronoviet_db
      POSTGRES_USER: chronoviet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy noeviction
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data

  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    restart: always
    environment:
      - DATABASE_URL=postgres://chronoviet:${DB_PASSWORD}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./media:/app/media

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 4000M
    environment:
      - CONCURRENCY=1
      - DATABASE_URL=postgres://chronoviet:${DB_PASSWORD}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./media:/app/media

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

### 4.2. `Caddyfile` (Cấu hình Domain & Reverse Proxy)

```caddyfile
chronoviet.yourdomain.com {
    # 1. Serve trực tiếp file media (Video MP4, Audio, License Snapshots)
    handle /media/* {
        root * /app
        file_server
    }

    # 2. Forward toàn bộ API & Web Dashboard & WebSockets đến App Monolith
    handle {
        reverse_proxy app:3000
    }

    # 3. Tự động nén dữ liệu HTTP
    encode zstd gzip
}
```


