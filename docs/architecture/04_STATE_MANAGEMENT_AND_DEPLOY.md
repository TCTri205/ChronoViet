# QUẢN LÝ STATE, KHẢ NĂNG CHỊU LỖI & TOPOLOGY TRIỂN KHAI
## (State Management, Workflow Engine & Deployment Topology Specification)

---

## 1. Quản Lý State Máy Trạng Thái (State Machine Lifecycle)

Vòng đời từ khi người dùng nhập yêu cầu cho đến khi nhận video hoàn chỉnh được quản lý nghiêm ngặt qua **LangGraph với Postgres Checkpointer SSOT** (gồm Micro-Step 0 Chaptering và 5 Micro-Steps kịch bản + Guardrails):

```
 [INIT] ──► [RAG_RETRIEVED] ──► [OUTLINE_CHAPTERED] ──► [CHAPTER_SCRIPT_GENERATED]
                                                               │
                                                               ▼
 [RESEARCH_COMPLETED] ◄─── [SCENES_SEGMENTED] ◄─── [CHAPTER_FACT_CHECKED]
       │
       ▼
 [TTS_SYNTHESIZED] ──► [DURATION_RECONCILED] ──► [KEYWORDS_EXTRACTED]
                                                        │
                                                        ▼
 [COMPLETED] ◄─── [PACKAGED] ◄─── [ASSETS_AUDITED] ◄────┘
      │               │                  │
   [FAILED] ◄─────────┴──────────────────┴── (Max Retry Exceeded)
      ▲
      └───────────────────────────────────── [NEEDS_HUMAN_REVIEW]
```

### Chi tiết các trạng thái (15 Canonical Operational States):

| State | Mô tả trạng thái | Xử lý Idempotency & Compensation (Phục hồi lỗi) |
| :--- | :--- | :--- |
| `INIT` | Khởi tạo session dự án video từ prompt người dùng. | Tạo `projectId` duy nhất (UUIDv4). |
| `RAG_RETRIEVED` | Lấy xong trích dẫn sử liệu chuẩn từ PostgreSQL (`pgvector` + Graph). | Checkpoint state vào PostgreSQL, cache context vào Redis. |
| `OUTLINE_CHAPTERED` | Micro-Step 0 chia video thành $N$ Chapters (2-3 min/Chap). | Checkpoint danh sách Chapter Outlines & `runningNarrativeState`. |
| `CHAPTER_SCRIPT_GENERATED` | Micro-Step 1A sinh lời thoại voiceover truyền `narrativeContext`. | Checkpoint voiceover text của từng Chapter. |
| `CHAPTER_FACT_CHECKED` | Micro-Step 1B Dual Guardrails (Folklore Regex + NLI Entailment Judge $\ge 0.80$). | Thang Escalation: Safe Auto-Fix ➔ Retry $\le 2$ ➔ Flag `NEEDS_HUMAN_REVIEW` (Resume trực tiếp `segmenter` không lặp node). |
| `SCENES_SEGMENTED` | Phân đoạn kịch bản thành các scene chi tiết theo timing và visual cue. | Checkpoint danh sách các scene cần tìm tài nguyên. |
| `RESEARCH_COMPLETED` | Micro-Step 1C Research Agent tìm kiếm tư liệu lịch sử tương ứng. | Thu thập provenance, license candidates cho từng scene. |
| `TTS_SYNTHESIZED` | VieNeu TTS sinh file audio và word-level timestamps cho từng scene. | Lưu audio vào Host Volume `/media/audio-cache/`, fallback `SyntheticTTSFallbackEngine` (sine 480Hz) khi service Python chưa sẵn sàng (dev). |
| `DURATION_RECONCILED` | Micro-Step 2 Pacing Reconcile cân bằng thời lượng thoại và hình ảnh. | Time-Stretch ±10%, reconcile frame timings. |
| `KEYWORDS_EXTRACTED` | Micro-Step 3 Trích xuất từ khóa, thực thể & typography tags. | Checkpoint overlay metadata cho Remotion rendering. |
| `ASSETS_AUDITED` | VLM Inspector kiểm định bản quyền & chất lượng ảnh (`PD`, `CC0`, `CC-BY`). | Tự động fallback Pure Code Layout nếu ảnh < 60 điểm. |
| `PACKAGED` | Micro-Step 4 Đóng gói toàn diện thành `ChronoVideoScriptSchema` v4.1. | Validate 100% Zod Schema v4.1 trước khi đưa vào Render Queue. |
| `COMPLETED` | Video MP4 đã render xuất xưởng thành công vào `/media/rendered-videos/`. | Trả link download MP4 cho client, dọn dẹp temp files & Chrome processes. |
| `NEEDS_HUMAN_REVIEW` | Fact-Check hoặc Asset Audit không thể tự giải quyết sau retry. | Gửi Alert Webhook/UI để biên tập viên duyệt/sửa tay, không sập pipeline. |
| `FAILED` | Dự án bị lỗi nghiêm trọng không thể khắc phục sau toàn bộ escalation. | Ghi lại traceback log, giải phóng job queue và hoàn token. |

---

## 2. Tính Nhất Quán & Idempotency (Idempotency Control)

* **Idempotent Job Submission:**
  Mọi tác vụ render đều mang một `idempotency_key` dạng `md5(json_spec_v4_content)`. Nếu người dùng ấn nút Render nhiều lần liên tiếp, worker sẽ nhận diện key trùng lặp và không render lại.
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
│ │ (Relational + Checkpoints│   │ (Next.js 14 App Router │     │ (BullMQ Job Queue &  │ │
│ │  + pgvector Embeddings)│     │  + LangGraph Node.js)  │     │  LRU Multi-Layer     │ │
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
4. **App Monolith (`app`)**: Tích hợp Web Dashboard UI, User API, RAG Engine, và LangGraph Orchestrator vào 1 quy trình Node.js Next.js 14 duy nhất.
5. **Render & AI Worker (`worker`)**: Nhận job từ Redis BullMQ Queue để sinh voiceover VieNeu TTS và render video Remotion (khóa `CONCURRENCY=1` để không gây nghẽn CPU/RAM VPS).

---

## 4. File Cấu Hình Triển Khai Thực Tế (VPS Production Docker Compose)

### 4.1. `docker-compose.yml`

```yaml
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
      app:
        condition: service_healthy
    logging: &default-logging
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

  postgres:
    image: pgvector/pgvector:pg15
    restart: always
    environment:
      POSTGRES_DB: chronoviet_db
      POSTGRES_USER: chronoviet
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-${DB_PASSWORD:-chronoviet_secret}}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chronoviet -d chronoviet_db"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 1500M
    logging: *default-logging

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --maxmemory 768mb --maxmemory-policy noeviction
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
    deploy:
      resources:
        limits:
          memory: 768M
    logging: *default-logging

  vieneu-tts-service:
    build:
      context: .
      dockerfile: services/vieneu-tts/Dockerfile
    container_name: vieneu_tts_engine
    restart: always
    environment:
      - NODE_ENV=production
      - LOG_FORMAT=json
      - TTS_SERVICE_PORT=8080
      - MEDIA_DIR=/app/media
      - AUDIO_CACHE_DIR=/app/media/audio-cache
      - WEB_CONCURRENCY=2
    ports:
      - "8080:8080"
    volumes:
      - ./media:/app/media
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 2000M
    logging: *default-logging

  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    restart: always
    environment:
      - NODE_ENV=production
      - LOG_FORMAT=json
      - DATABASE_URL=postgres://chronoviet:${POSTGRES_PASSWORD:-${DB_PASSWORD:-chronoviet_secret}}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
      - VIENEU_PYTHON_URL=http://vieneu-tts-service:8080
      - GEMINI_API_KEYS=${GEMINI_API_KEYS}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      vieneu-tts-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/healthz || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    volumes:
      - ./media:/app/media
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 2000M
    logging: *default-logging

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: always
    shm_size: '2gb'
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 4000M
    environment:
      - NODE_ENV=production
      - LOG_FORMAT=json
      - CONCURRENCY=1
      - RENDER_CONCURRENCY=1
      - WORKER_PROBE_PORT=3001
      - DATABASE_URL=postgres://chronoviet:${POSTGRES_PASSWORD:-${DB_PASSWORD:-chronoviet_secret}}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
      - VIENEU_PYTHON_URL=http://vieneu-tts-service:8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      vieneu-tts-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/healthz || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    volumes:
      - ./media:/app/media
    logging: *default-logging

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


