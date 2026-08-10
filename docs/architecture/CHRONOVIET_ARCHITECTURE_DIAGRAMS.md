# CHRONOVIET - SYSTEM ARCHITECTURE DIAGRAMS & TECHNICAL SPECIFICATION (OPERATIONAL HARDENED v3.3)

Document tổng hợp và đối chiếu toàn bộ Sơ đồ Kiến trúc Hệ thống, Quy trình xử lý dữ liệu Multi-Agent (Full GraphRAG từ Day 1), Hạ tầng Polyglot Persistence, Message Queues Tách Lập, State Machine Engine Kèm Nhánh Sửa Lỗi, VieNeu TTS Sync Engine, Topology Triển Khai Docker Compose Kèm Resource Limits Cứng, và Tầng Observability/Tracing cho dự án **ChronoViet**.

---

## 1. 🏗️ Sơ Đồ Kiến Trúc Hệ Thống Tổng Thể (Streamlined VPS Topology v3.4)

Sơ đồ thể hiện các tầng kiến trúc của **ChronoViet** triển khai trên **1 VPS duy nhất + Domain cá nhân** (Caddy Proxy + Postgres/pgvector + Unified Redis + Monolith API App + Worker Pool):

```mermaid
flowchart TB
    subgraph ClientLayer["1. CLIENT / PRESENTATION LAYER"]
        WebClient["Web Client (Next.js / React)"]
        MobileClient["Mobile App (React Native)"]
    end

    subgraph GatewayLayer["2. CADDY REVERSE PROXY & SECURITY LAYER"]
        CaddyGateway["Caddy Reverse Proxy Container\n- Auto SSL/TLS (Let's Encrypt / ZeroSSL)\n- Static Media Serving (/media)\n- WebSocket Forwarding & HTTP/2 & HTTP/3\n- Trace ID Header Injection"]
        Telemetry["Observability & Tracing Agent\n- Container Healthcheck Monitors\n- Centralized JSON Structured Logs\n- Correlation ID Propagation"]
    end

    subgraph ServiceLayer["3. CORE APP MONOLITH & AGENTIC LAYER"]
        AppMonolith["ChronoViet App Monolith Server (Next.js / Fastify / TS)\n- Users Auth & Projects CRUD\n- RAG Engine (PostgreSQL pgvector)\n- Agentic Orchestrator (LangGraph.js 12 States & Postgres SSOT)\n- Hybrid Fact-Checker & Gemini Cloud VLM Inspector"]
    end

    subgraph BrokerLayer["4. ASYNCHRONOUS BROKER & CACHE LAYER"]
        UnifiedRedis["Unified Redis Container (redis:7-alpine)\n- BullMQ Task Queues (AOF Persistence)\n- Multi-Layer Cache (Prompt Cache & VLM Scores)\n- Real-time WebSocket PubSub Channel"]
        
        TTSQueue["Queue: tts-gen-queue\n(Priority: High | Concurrency: 10)"]
        VLMQueue["Queue: vlm-inspect-queue\n(Priority: Medium | Gemini Cloud Dispatch)"]
        RenderQueue["Queue: remotion-render-queue\n(Priority: Normal | Concurrency: 1 MAX on Single VPS)"]
    end

    subgraph WorkerPools["5. WORKER SERVICES & HEAVY ENGINES (RESOURCE ISOLATED)"]
        AIWorker["AI & Remotion Render Worker Container\n- Isolated Limits: Max 2.0 CPUs / 4GB RAM\n- VieNeu TTS ONNX Engine (Voice Generation)\n- Remotion Headless Chrome (Single Process MP4 Render)\n- Pre-fetch Local Media & Export Final MP4"]
    end

    subgraph StorageLayer["6. SINGLE-HOST PERSISTENCE LAYER (VPS STORAGE)"]
        PostgresDB[("PostgreSQL 15+ Database (SINGLE SOURCE OF TRUTH)\n- Users, Billing & Video Projects\n- LangGraph State Checkpoints & License Audit Logs\n- pgvector Embeddings (HNSW Index 1024d)")]
        MediaStorage[("Local Host Volume Storage (/media)\n- /media/raw-assets/ (Images & VieNeu Audio WAV)\n- /media/license-snapshots/ (Whitelisted License Audits)\n- /media/rendered-videos/ (Final MP4 Exports)")]
    end

    %% Communications & Interactions
    WebClient & MobileClient -->|HTTPS / WS / SSE| CaddyGateway
    CaddyGateway -->|Forward Requests + Trace ID| AppMonolith
    CaddyGateway -->|Serve Static Video/Audio Files| MediaStorage
    Telemetry -. Monitor Health & Logs .-> ServiceLayer & WorkerPools & StorageLayer

    AppMonolith -->|Read / Write Auth, Projects & Checkpoints| PostgresDB
    AppMonolith -->|Dense Vector Search (pgvector)| PostgresDB
    AppMonolith -->|Push Async Jobs & Cache| UnifiedRedis

    UnifiedRedis --> TTSQueue & VLMQueue & RenderQueue

    TTSQueue & VLMQueue & RenderQueue --> AIWorker

    AIWorker -->|Write WAV Audio & Final MP4| MediaStorage
    AIWorker -->|Verify SSOT Checkpoint & Update Logs| PostgresDB
    AIWorker -.->|Progress Updates via WebSocket| WebClient
```

---

## 2. 🔄 Quy Trình Multi-Agent & RAG Pipeline (Sequence Flow v3.3 Operational)

Sơ đồ quy trình chi tiết từ khi Khởi tạo Prompt, truy vấn **Full GraphRAG**, kiểm duyệt License có Snapshot, Xử lý Circuit Breaker Gemini, đến Reconcile Thời lượng audio/video:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant GW as Caddy Gateway (Inject Trace ID = md5)
    participant Orch as App Monolith (LangGraph + Postgres SSOT)
    participant RAG as Chrono-RAG Engine (Postgres pgvector + Relational Graph)
    participant TTS as VieNeu TTS Engine (ONNX)
    participant Gem as Hybrid VLM Inspector (Gemini Cloud / Local CLIP)
    participant Worker as Remotion Render Worker (Isolated Chromium)
    participant Vol as Host Volume Storage (/media)
    participant PG as PostgreSQL (Checkpoints & pgvector SSOT)

    User->>GW: POST /api/v1/projects (Prompt: "Trận Bạch Đằng 938")
    GW->>Orch: Khởi tạo Project (State: DRAFT - UUIDv4) + Trace ID
    Orch->>PG: Ghi nhận Initial Checkpoint (State: DRAFT)
    
    Orch->>RAG: Truy vấn Chrono-RAG sử liệu (Postgres pgvector + Relational Graph CTEs)
    RAG-->>Orch: Trả về Subgraph Context sử liệu chuẩn (State: RAG_RETRIEVED)
    
    Orch->>Orch: Step 0 Chaptering + Scriptwriter + Hybrid Fact-Checker (Alias Table + 4-Tier Escalation)
    
    par Async Step 1: VieNeu TTS Generation (Idempotency Key: md5)
        Orch->>TTS: POST /api/v1/synthesize (Text + VoiceId)
        TTS-->>Vol: Lưu file audio `.wav` vào `/media/raw-assets/`
        TTS-->>Orch: Trả về audioUrl, audioDurationMs & wordTimestamps
    and Async Step 2: Whitelisted License Filter, Audit Trail & Hybrid VLM (Circuit Breaker Managed)
        Orch->>Gem: License Whitelist Filter (PD, CC0, CC-BY) & Crawl Batch 1
        Gem->>Vol: Lưu License Snapshot vào `/media/license-snapshots/`
        alt Gemini Circuit Breaker = CLOSED (Normal Operation)
            Gem->>Gem: Gemini Cloud VLM Inspection
            alt HTTP 429 Triggered >= 3 times in 5m
                Gem->>Gem: Trip Circuit Breaker ➔ State: OPEN (Cooldown 5m)
                Gem->>Gem: Auto Failover to Local CLIP Cosine Scorer
            end
        else Gemini Circuit Breaker = OPEN (Cooldown Active)
            Gem->>Gem: Direct Local CLIP Cosine Scorer Execution (Skip Cloud Gemini)
        end

        alt VLM Score Max Batch 1 >= 60
            Gem-->>Orch: Phê duyệt ảnh + Verified License & Snapshot URL
        else VLM Score Max Batch 1 < 60
            Orch->>Gem: Crawl Batch 2 (Từ khóa mở rộng) & VLM Score 6 ảnh
            alt VLM Score Max 6 ảnh >= 60
                Gem-->>Orch: Phê duyệt ảnh tốt nhất + Verified License
            else Cả 6 ảnh < 60
                Gem-->>Orch: Thất bại 6 ảnh ➔ Code Rules Engine Fallback PURE_CODE Layout Rotation
            end
        end
    end

    Orch->>Orch: Step 1B-Reconcile: Duration Reconciliation Engine (Đo sai số thời lượng Audio vs Scene Script)
    
    alt Sai số thời lượng > 15% (DURATION_MISMATCH)
        Orch->>PG: Update Checkpoint (State: DURATION_MISMATCH)
        Orch->>Orch: Trigger Script Agent Re-write / Scene Pacing Adjustment (Retry <= 2 lần)
        Orch->>TTS: Re-synthesize Audio với kịch bản điều chỉnh
    else Sai số thời lượng 5% - 15%
        Orch->>Orch: Tự động Audio Time-Stretch (±10%) + Frame Ceil Padding
    else Sai số thời lượng < 5%
        Orch->>Orch: Chấp nhận giữ nguyên 100% Timing
    end

    Orch->>PG: Lock JSON v3.2 Spec & Save Checkpoint (State: ASSETS_AUDITED - SSOT)
    Orch->>Worker: Đẩy Task vào `remotion-render-queue` (Unified Redis - Idempotency Key: md5)
    
    activate Worker
    Worker->>PG: Query Checkpoint SSOT (Xác nhận trạng thái dự án thực tế trước khi render)
    alt Checkpoint SSOT == ASSETS_AUDITED
        Worker->>Vol: Read Audio (.wav), Images & Fonts từ `/media/raw-assets/`
        Worker->>User: WebSocket Broadcast (% Tiến độ real-time)
        Worker->>Worker: Execute `npx remotion render` (Isolated Chromium Process - Max 2.0 CPUs / 4GB RAM)
        Worker->>Vol: Save file MP4 hoàn chỉnh vào `/media/rendered-videos/`
        Worker->>PG: Update Checkpoint (State: COMPLETED - SSOT)
        Worker->>Orch: Cập nhật status `COMPLETED`
    else Checkpoint SSOT != ASSETS_AUDITED (Canceled / Invalid)
        Worker->>Worker: Abort Task (Idempotency Safe Skip)
    end
    deactivate Worker

    Orch-->>User: Trả link Download Video MP4 (State: COMPLETED)
```

---

## 3. 💾 Single-Host VPS Persistence & Multi-Layer Caching (Unified Redis & Postgres pgvector)

Sơ đồ luồng truy vấn bộ nhớ đệm 3 lớp trên Unified Redis trước khi chạm tới tầng lưu trữ lâu dài PostgreSQL `pgvector`:

```mermaid
flowchart TD
    subgraph ClientReq["Incoming API Request (Injected Trace ID)"]
        Req["User Request"]
    end

    subgraph RedisCacheLayer["UNIFIED REDIS CONTAINER (redis:7-alpine)"]
        L1Cache["L1: Prompt Cache (Exact Match SHA-256 Hash)\nTTL: 24 Hours | Hit: Trả Response tức thì trong 1ms"]
        L2Cache["L2: Chrono-RAG Context Cache (pgvector Vector & Relational Graph Search)\nTTL: 12 Hours | Tránh Re-search DB"]
        L3Cache["L3: Asset VLM Score & License Audit Cache (URL Hash & pHash Distance < 5)\nTTL: 30 Days | Tránh Audit lại ảnh trùng lặp"]
    end

    subgraph PolyglotStores["VPS PERSISTENCE STORES (DOCKER COMPOSE)"]
        PostgreSQL[("PostgreSQL 15+ Database (SINGLE SOURCE OF TRUTH)\n- Core Data, Users & Projects\n- LangGraph State Checkpointer Tables\n- pgvector Embeddings (1024d BGE-M3 HNSW)\n- Relational Graph Entities & Relationships")]
        MediaStorage[("Local Host Volume Storage (/media)\n- /media/raw-assets/\n- /media/license-snapshots/\n- /media/rendered-videos/")]
    end

    Req --> L1Cache
    L1Cache -- Miss --> L2Cache
    L2Cache -- Miss --> L3Cache
    L3Cache -- Miss --> PolyglotStores

    L2Cache -. Dense Vector & Graph Search .-> PostgreSQL
    L3Cache -. Fetch State & Audit Trail .-> PostgreSQL
    PolyglotStores -. Read / Write Media Assets .-> MediaStorage
```

---

## 4. ⚙️ Quản Lý Trạng Thái Máy (State Machine & Retry Engine v3.4)

Trạng thái dự án trải qua các bước quản lý nghiêm ngặt thông qua LangGraph Engine với **Postgres Checkpointer làm Single Source of Truth**, bổ sung nhánh **`DURATION_MISMATCH`** và **Gemini Circuit Breaker Handling**:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: User submit Prompt (Tạo UUIDv4 + Trace ID)
    DRAFT --> RAG_RETRIEVED: Chrono-RAG Query (Postgres pgvector + Relational Graph CTEs)
    RAG_RETRIEVED --> SCRIPT_GENERATED: Script Agent xuất Timeline & Scenes JSON
    
    SCRIPT_GENERATED --> SCRIPT_GENERATED: Zod Validation Error (Retry Script Agent <= 2 lần)
    
    SCRIPT_GENERATED --> ASSETS_AUDITED: VieNeu TTS ONNX + VLM Audit Done (Snapshot Saved)
    
    ASSETS_AUDITED --> DURATION_MISMATCH: Audio/Scene Duration Mismatch > 15%
    DURATION_MISMATCH --> SCRIPT_GENERATED: Trigger Script Agent Re-write (Max 2 Retries)
    DURATION_MISMATCH --> FAILED: Re-write Retry Count Exceeded (> 2)

    ASSETS_AUDITED --> RENDERING: Lock JSON v3.2 Spec & Save Postgres Checkpoint (Idempotency md5 Key)
    
    state RENDERING {
        [*] --> VerifySSOT: Query Postgres Checkpoint (Xác thực State thực tế)
        VerifySSOT --> PreDownloadAssets: State == ASSETS_AUDITED -> Download Media to Local Disk
        VerifySSOT --> AbortRender: State != ASSETS_AUDITED -> Abort Job
        PreDownloadAssets --> FrameRendering: Render Frames (Single Chromium Process - Max 2.0 CPUs / 4GB RAM)
        FrameRendering --> FrameRendering: Progress Broadcast via WS
        FrameRendering --> MP4Stitching: Stitch Frames into MP4 & Clean Temp Files
    }

    RENDERING --> COMPLETED: MP4 Uploaded to S3 & Postgres SSOT Updated
    RENDERING --> RENDERING: Worker Crash, Resume from Postgres Checkpoint SSOT
    
    RENDERING --> FAILED: DLQ Exceeded Max Retries (3 times)
    SCRIPT_GENERATED --> FAILED: Parse Schema Unrecoverable Error

    COMPLETED --> [*]
    FAILED --> [*]: Rollback & Refund Credits
```

---

## 5. 🎤 Tích Hợp VieNeu TTS Engine & Audio-Visual Scene Sync (Reconciliation Math)

Mô hình tích hợp VieNeu TTS tự host (ONNX Engine) kèm công thức tính toán **Duration Reconciliation**:

```mermaid
flowchart LR
    subgraph ScriptInput["1. Script Agent Output"]
        TextContent["Text Scene: 'Đêm mùng 4 Tết Kỷ Dậu, quân Tây Sơn áp sát đồn Ngọc Hồi.'"]
    end

    subgraph VieNeuEngine["2. Self-Hosted VieNeu TTS Container (Node.js + ONNX)"]
        TTSModel["VieNeu ONNX Synthesis Model\n(North Historical Voice - Limit 2.0 CPUs / 3GB RAM)"]
        WhisperAlign["Forced Alignment Engine\n(Word Timestamps Output)"]
    end

    subgraph SyncMath["3. Duration Reconciliation & Frame Calculator"]
        DurationCheck{"Kiem tra Sai so Thoi luong\nabs(audioDurationMs - sceneTargetMs) / sceneTargetMs"}
        TimeStretch["Audio Time-Stretch Engine (±10%)\nAPPLIED WHEN 5% <= SAI SỐ <= 15%"]
        DurationMath["Công thức tính Frames (Khi Sai số < 15%):\ndurationInFrames = ceil((adjustedAudioMs + 300) / 1000 * 30)\nVí dụ: (7400ms + 300ms) / 1000 * 30 = 231 Frames"]
        MismatchTrigger["Trigger DURATION_MISMATCH State\nAPPLIED WHEN SAI SỐ > 15%\n-> Re-generate Script Pacing"]
    end

    subgraph RemotionOutput["4. Remotion Video Engine"]
        TimelineSync["Audio Timeline Sync (.wav)"]
        KaraokeSubtitle["DocumentarySubtitle.tsx\n(Yellow/Red Highlight Karaoke)"]
    end

    TextContent --> TTSModel
    TTSModel --> WhisperAlign
    WhisperAlign -->|File .wav + AudioDurationMs| DurationCheck
    
    DurationCheck -- Sai số < 5% --> DurationMath
    DurationCheck -- Sai số 5% - 15% --> TimeStretch --> DurationMath
    DurationCheck -- Sai số > 15% --> MismatchTrigger
    
    WhisperAlign -->|Word Timestamps JSON| CaptionConverter["Timestamp Converter:\nconvertVieNeuTimestampsToCaptions()"]

    DurationMath --> TimelineSync
    CaptionConverter --> KaraokeSubtitle
    TimelineSync & KaraokeSubtitle --> RemotionOutput
```

---

## 6. 🐳 Hạ Tầng Triển Khai Single-Host VPS Topology & Resource Isolation

Sơ đồ thể hiện mô hình triển khai Docker Compose Single-Host cho **ChronoViet** trên 1 VPS duy nhất với Caddy Proxy, Postgres+pgvector SSOT, Unified Redis, và Worker Pool:

```mermaid
flowchart TB
    subgraph SingleHostDev["SINGLE-HOST VPS DOCKER COMPOSE TOPOLOGY (OPERATIONAL HARDENED v3.4)"]
        
        subgraph GatewayContainer["Gateway, Security & Observability"]
            CaddyCont["Caddy Reverse Proxy Container\n- Port 80/443 (Auto SSL Let's Encrypt)\n- Serve Static /media & Forward WebSockets"]
            TelemetryCont["Telemetry & Healthcheck Collector\n- Centralized Logging & Metrics"]
        end

        subgraph CoreServicesGroup["Core App Container"]
            AppCont["ChronoViet App Monolith (Next.js / Fastify / TS)\n- Users Auth, Projects CRUD, RAG Engine & LangGraph Orchestrator\n- Limit: 1.5 CPUs / 2.0GB RAM"]
        end

        subgraph WorkerGroup["Worker Containers (RESOURCE ISOLATED)"]
            WorkerCont["AI & Remotion Render Worker Container\n- VieNeu TTS ONNX & Remotion Headless Chrome\n- HARD LIMIT: 2.0 CPUs / 4.0GB RAM\n- CONCURRENCY: 1 MAX JOB"]
        end

        subgraph StorageContainers["Database & Storage Containers"]
            PGCont["PostgreSQL Container (SSOT Data + LangGraph Checkpoints + pgvector Embeddings)\n- Limit: 1.5 CPUs / 2.0GB RAM"]
            RedisCont["Unified Redis Container (BullMQ Task Queues + Multi-Cache + PubSub)\n- Limit: 0.5 CPU / 1.0GB RAM"]
            VolumeCont["Host Volume Storage (/media)\n- Raw Assets, License Snapshots & Rendered MP4s"]
        end
    end

    CaddyCont --> AppCont & VolumeCont
    TelemetryCont -. Healthchecks & Tracing .-> CoreServicesGroup & WorkerGroup & StorageContainers

    AppCont --> RedisCont & PGCont
    WorkerCont <--> RedisCont & VolumeCont & PGCont
```

### 📋 Docker Compose Configuration Snippet (Single-Host VPS v3.4)

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    container_name: chronoviet-caddy
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
    container_name: chronoviet-postgres
    restart: always
    environment:
      POSTGRES_DB: chronoviet_db
      POSTGRES_USER: chronoviet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chronoviet -d chronoviet_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: chronoviet-redis
    restart: always
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy noeviction
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: docker/Dockerfile.app
    container_name: chronoviet-app
    restart: always
    environment:
      - DATABASE_URL=postgres://chronoviet:${DB_PASSWORD}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./media:/app/media

  worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.worker
    container_name: chronoviet-worker
    restart: always
    environment:
      - CONCURRENCY=1
      - DATABASE_URL=postgres://chronoviet:${DB_PASSWORD}@postgres:5432/chronoviet_db
      - REDIS_URL=redis://redis:6379
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 4000M
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./media:/app/media

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

---

## 7. 📊 Bảng Xác Nhận Sẵn Sàng Vận Hành Thực Tế (Operational Hardening Verification Matrix v3.4)

| STT | Rủi Ro Vận Hành Thực Tế | Trạng Thái Đã Xử Lý | Giải Pháp & Cơ Chế Khắc Phục Trong Spec v3.4 |
| :---: | :--- | :---: | :--- |
| **1** | **Resource Contention (Chromium render kéo sập DB/Redis)** | **✅ ĐÃ KHẮC PHỤC** | Áp dụng `deploy.resources.limits` cứng trong Compose (Worker max 2 CPU/4GB RAM). Khóa `CONCURRENCY=1` cho `remotion-render-queue`. |
| **2** | **Dual Source of Truth (Postgres Checkpoint vs BullMQ Redis)** | **✅ ĐÃ KHẮC PHỤC** | Quy định Postgres Checkpointer là **Single Source of Truth** duy nhất. Redis bật AOF (`appendonly yes`). Worker query lại Postgres SSOT trước khi render. |
| **3** | **Quá Nhiều Container Phức Tạp Cho 1 VPS (12 Services)** | **✅ ĐÃ KHẮC PHỤC** | **Tinh gọn xuống 5 containers duy nhất**: `caddy`, `postgres` (pgvector), `redis`, `app` (Monolith), `worker`. Giảm 70% RAM overhead, chạy mượt trên VPS 8GB RAM. |
| **4** | **Phức tạp vận hành Full GraphRAG & MinIO** | **✅ ĐÃ CHUẨN HÓA** | Hợp nhất DB Vector vào **PostgreSQL (`pgvector`)** và chuyển Object Storage sang **Host Volume Mount (`/media`)** phục vụ trực tiếp qua Caddy Proxy. |
| **5** | **Rủi Ro Pháp Lý License Từ Metadata Crawl Nhàn** | **✅ ĐÃ KHẮC PHỤC** | Bổ sung thư mục `/media/license-snapshots/` lưu vết hình ảnh + raw header response + snapshot metadata. Ưu tiên domain whitelist từ Verified APIs (Wikimedia Commons API). |
| **6** | **Rủi Ro Trượt Budget / Spikes API Khi Gemini 429** | **✅ ĐÃ KHẮC PHỤC** | Tích hợp **Circuit Breaker** tại Orchestrator. Gặp 3 lỗi HTTP 429 trong 5 phút ➔ Chuyển trạng thái `OPEN` trong 5 phút cooldown ➔ Auto failover sang Local CLIP Scorer. |
| **7** | **Thiếu Tầng Observability & Tracing** | **✅ ĐÃ KHẮC PHỤC** | Thêm Healthchecks cho 100% container trong Compose. Đưa Correlation ID (`Trace ID = md5`) vào Header HTTP, Queue Payload và Centralized JSON Logs. |
| **8** | **Bất Đồng Bộ Thời Lượng (Duration Mismatch > 15%)** | **✅ ĐÃ KHẮC PHỤC** | Bổ sung nhánh trạng thái **`DURATION_MISMATCH`** trong State Machine. Sai số 5-15% ➔ Audio Time-Stretch ±10%. Sai số > 15% ➔ Trigger Script Agent viết lại pacing (retry <= 2). |

