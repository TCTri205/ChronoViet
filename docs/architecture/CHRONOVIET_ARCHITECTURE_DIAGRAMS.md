# CHRONOVIET - SYSTEM ARCHITECTURE DIAGRAMS & TECHNICAL SPECIFICATION

Document tổng hợp và đối chiếu toàn bộ Sơ đồ Kiến trúc Hệ thống, Quy trình xử lý dữ liệu Multi-Agent, Hạ tầng Polyglot Persistence, Message Queues, State Machine Engine, VieNeu TTS và Topology Triển khai Single-Host Docker Compose cho dự án **ChronoViet**.

---

## 1. 🏗️ Sơ Đồ Kiến Trúc Hệ Thống Tổng Thể (System Topology & Service Boundaries)

Sơ đồ thể hiện 6 tầng kiến trúc của **ChronoViet** giai đoạn MVP (Single-Host Docker Compose + Hybrid Cloud VLM):

```mermaid
flowchart TB
    subgraph ClientLayer["1. CLIENT / PRESENTATION LAYER"]
        WebClient["Web Client (Next.js / React)"]
        MobileClient["Mobile App (React Native)"]
    end

    subgraph GatewayLayer["2. API GATEWAY & SECURITY LAYER"]
        APIGateway["API Gateway (Nginx Reverse Proxy)\n- Auth JWT & SSL Termination\n- Rate Limiting & CORS Routing"]
    end

    subgraph ServiceLayer["3. CORE MICROSERVICES LAYER"]
        UserAssetService["User & Asset Service (NestJS / Node.js)\n- User Profile & Billing\n- Projects CRUD & History"]
        RAGService["Hybrid GraphRAG Service (FastAPI / Python)\n- Text Chunking & Local Search\n- Qdrant Vector + Neo4j Knowledge Graph"]
        OrchestratorService["Agentic Orchestrator Service (LangGraph.js / Node.js/TS)\n- LangGraph.js State Router & Postgres Checkpointer\n- Step 0 Chaptering & 5-Step Script Micro-Pipeline (kèm Narrative Context & Duration Reconcile)\n- Hybrid Fact-Checker (Alias Table & 4-Tier Escalation Path)\n- Contract Formatter (JSON v3.2 Zod Schema kèm License & Attribution)"]
    end

    subgraph HybridCloudLayer["4. HYBRID VLM & LICENSE INSPECTION LAYER"]
        GeminiAPI["Hybrid VLM Inspector (Cloud Gemini 2.5 Flash + Offline Local CLIP Fallback)\n- License Whitelist Filter (PD, CC0, CC-BY)\n- Sub-second Visual Noise Audit\n- Historical Context Inspection (Strategy 3+3 Candidates)"]
    end

    subgraph BrokerLayer["5. ASYNCHRONOUS BROKER & CACHE LAYER"]
        RedisCluster["Redis Container / Cluster\n- Multi-Layer Cache (LLM/Context/VLM Score)\n- PubSub & Session Store\n- BullMQ Task Broker"]
        TTSQueue["Queue: tts-gen-queue\n(Priority: High | Concurrency: 10)"]
        VLMQueue["Queue: vlm-inspect-queue\n(Priority: Medium | Gemini Cloud Dispatch)"]
        RenderQueue["Queue: remotion-render-queue\n(Priority: Normal | Local Pre-fetch & Isolation)"]
    end

    subgraph WorkerPools["6. WORKER SERVICES & HEAVY ENGINES"]
        VieNeuWorker["VieNeu TTS Engine (Python FastAPI / ONNX Runtime)\n- Self-Hosted VieNeu Neural Voice Model\n- Audio (.wav) + Word Timestamps"]
        RenderWorker["Remotion Render Worker (Node.js Container)\n- Chromium Isolation Pool\n- Pre-download Local Media & CLI Render MP4"]
    end

    subgraph StorageLayer["7. POLYGLOT PERSISTENCE LAYER (DOCKER COMPOSE)"]
        PostgresDB[("PostgreSQL Database\n- Users, Billing & Video Projects\n- LangGraph Checkpoints & Render Logs")]
        QdrantDB[("Qdrant Vector DB\n- BGE-M3 Dense + BM25 Sparse (1024d)\n- HNSW Index (Cosine Similarity)")]
        Neo4jDB[("Neo4j Graph DB\n- Historical Schema Ontology\n- Local Search (k-Hop) & MENTIONED_IN Links")]
        MinIOStorage[("MinIO / AWS S3 Storage\n- Raw Assets & Audio (.wav)\n- Final Rendered MP4 Videos")]
    end

    %% Communications & Interactions
    WebClient & MobileClient -->|HTTPS REST / WS / SSE| APIGateway
    APIGateway -->|Route Requests| UserAssetService & RAGService & OrchestratorService

    UserAssetService -->|Read / Write Auth & Projects| PostgresDB
    RAGService -->|Vector Hybrid Search| QdrantDB
    RAGService -->|Graph Traversal Queries| Neo4jDB

    OrchestratorService -->|Get History Context| RAGService
    OrchestratorService -->|State Checkpoints & JSON v3.0| PostgresDB
    OrchestratorService -->|Push Async Tasks| RedisCluster
    OrchestratorService -.->|Batch VLM Inspection| GeminiAPI

    RedisCluster --> TTSQueue & VLMQueue & RenderQueue
    RedisCluster <-->|Read / Write Cache| UserAssetService & RAGService & OrchestratorService

    TTSQueue --> VieNeuWorker
    VLMQueue --> GeminiAPI
    RenderQueue --> RenderWorker

    VieNeuWorker -->|Store WAV Audio| MinIOStorage
    GeminiAPI -.->|Cache VLM Scores & pHash| RedisCluster
    RenderWorker -->|Pre-fetch Local Assets| MinIOStorage
    RenderWorker -->|Upload Final MP4| MinIOStorage
    RenderWorker -->|Update Status & Logs| PostgresDB
    RenderWorker -.->|Progress Updates via WebSocket| WebClient
```

---

## 2. 🔄 Quy Trình Multi-Agent & RAG Pipeline (Sequence Flow v3.2)

Sơ đồ quy trình chi tiết từ khi Người dùng khởi tạo câu lệnh đến khi xuất video hoàn chỉnh.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant GW as API Gateway (Nginx)
    participant Orch as Orchestrator Agent (LangGraph + Postgres Checkpoint)
    participant RAG as RAG Service (Qdrant + Neo4j)
    participant TTS as VieNeu TTS Service (ONNX)
    participant Gem as Hybrid VLM Inspector (Gemini Cloud / Local CLIP)
    participant Worker as Remotion Render Worker
    participant S3 as MinIO / S3 Storage

    User->>GW: POST /api/v1/projects (Prompt: "Trận Bạch Đằng 938")
    GW->>Orch: Khởi tạo Project (State: DRAFT - UUIDv4)
    Orch->>RAG: Truy vấn trích dẫn lịch sử chuẩn (Hybrid GraphRAG + Local Search)
    RAG-->>Orch: Trả về Context sử liệu chuẩn (State: RAG_RETRIEVED)
    
    Orch->>Orch: Step 0 Chaptering + Scriptwriter (Narrative Context) + Hybrid Fact-Checker (Alias Table + 4-Tier Escalation Path)
    
    par Async Step 1: VieNeu TTS Generation (Hash Key Idempotency)
        Orch->>TTS: POST /api/v1/synthesize (Text + VoiceId)
        TTS-->>S3: Lưu file audio `.wav`
        TTS-->>Orch: Trả về audioUrl, audioDurationMs & wordTimestamps
    and Async Step 2: Whitelisted License Filter, Asset Crawling & Hybrid VLM Strategy 3+3
        Orch->>Gem: Whitelisted License Filter (PD, CC0, CC-BY) & Crawl Batch 1 (3 ảnh thô)
        Gem->>Gem: Gemini Cloud VLM Inspection (Fallback: Local CLIP Cosine Scorer khi HTTP 429)
        alt VLM Score Max Đợt 1 >= 60
            Gem-->>Orch: Phê duyệt ảnh tốt nhất + Metadata License & Attribution
        else VLM Score Max Đợt 1 < 60
            Orch->>Gem: Crawl Batch 2 (3 ảnh từ khóa mở rộng) & VLM Score 6 ảnh
            alt VLM Score Max 6 ảnh >= 60
                Gem-->>Orch: Phê duyệt ảnh tốt nhất trong 6 ảnh + License Metadata
            else Cả 6 ảnh < 60
                Gem-->>Orch: Thất bại 6 ảnh ➔ Code Rules Engine Fallback PURE_CODE Layout Rotation
            end
        end
    end

    Orch->>Orch: Step 1B-Reconcile: Duration Reconciliation Engine (Đo lệch thời lượng <= 15%)
    Orch->>Orch: Đóng gói JSON v3.2 Spec & Checkpoint (State: ASSETS_AUDITED)
    Orch->>Worker: Đẩy task vào `remotion-render-queue` (Idempotency Key: md5)
    
    activate Worker
    Worker->>S3: Pre-download Audio (.wav), Images & Fonts về Local Disk
    Worker->>User: WebSocket Broadcast (% Tiến độ real-time)
    Worker->>Worker: Execute `npx remotion render` (Isolated Chromium Process)
    Worker->>S3: Upload file MP4 hoàn chỉnh & Purge Temp Files
    Worker->>Orch: Cập nhật status `COMPLETED`
    deactivate Worker

    Orch-->>User: Trả link Download Video MP4 (State: COMPLETED)
```

---

## 3. 💾 Polyglot Persistence & Caching Multi-Layer

Sơ đồ luồng truy vấn bộ nhớ đệm 3 lớp trên Redis trước khi chạm tới tầng lưu trữ lâu dài Polyglot Persistence.

```mermaid
flowchart TD
    subgraph ClientReq["Incoming API Request"]
        Req["User Request"]
    end

    subgraph RedisCacheLayer["REDIS MULTI-LAYER CACHE LAYER"]
        L1Cache["L1: Prompt Cache (Exact Match SHA-256 Hash)\nTTL: 24 Hours | Hit: Trả Response tức thì trong 1ms"]
        L2Cache["L2: RAG Context Cache (Vector & Graph Search Results)\nTTL: 12 Hours | Tránh Re-search Vector DB"]
        L3Cache["L3: Asset VLM Score Cache (URL Hash & pHash Distance < 5)\nTTL: 30 Days | Tránh Audit lại ảnh trùng lặp"]
    end

    subgraph DataStores["POLYGLOT PERSISTENCE DATA STORES (DOCKER COMPOSE)"]
        Qdrant[("Qdrant Vector DB\n- BGE-M3 Embeddings (1024d)\n- HNSW Indexing (m=16, ef=100)\n- Semantic Historical Chunks")]
        Neo4j[("Neo4j Graph DB\n- Nodes: Person, Event, Location, Dynasty, Battle\n- Rel: COMMANDED, OCCURRED_AT, BELONGS_TO\n- GraphRAG Deep Queries")]
        PostgreSQL[("PostgreSQL Database\n- Relational Core Data & Render Logs\n- LangGraph State Checkpointer Tables")]
        MinIOS3[("MinIO / AWS S3 Object Storage\n- s3://chronoviet-raw-assets/\n- s3://chronoviet-rendered-videos/\n- Audio .wav & Final MP4 Video Output")]
    end

    Req --> L1Cache
    L1Cache -- Miss --> L2Cache
    L2Cache -- Miss --> L3Cache
    L3Cache -- Miss --> DataStores

    L2Cache -. Fetch Vector Context .-> Qdrant
    L2Cache -. Fetch Graph Network .-> Neo4j
    L3Cache -. Fetch Metadata & Audit .-> PostgreSQL
    DataStores -. Media Fetch & Store .-> MinIOS3
```

---

## 4. ⚙️ Quản Lý Trạng Thái Máy (State Machine & Retry Engine)

Trạng thái dự án trải qua 7 bước quản lý nghiêm ngặt thông qua LangGraph Engine kèm Postgres Checkpointer.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: User submit Prompt (Tạo UUIDv4)
    DRAFT --> RAG_RETRIEVED: Hybrid Query Qdrant & Neo4j
    RAG_RETRIEVED --> SCRIPT_GENERATED: Script Agent xuất Timeline & Scenes JSON
    
    SCRIPT_GENERATED --> SCRIPT_GENERATED: Zod Validation Error (Retry Script Agent <= 2 lần)
    SCRIPT_GENERATED --> ASSETS_AUDITED: VieNeu TTS ONNX + Gemini VLM Batch Done
    
    ASSETS_AUDITED --> RENDERING: Lock JSON v3.0 & Checkpoint (Idempotency md5 Key)
    
    state RENDERING {
        [*] --> PreDownloadAssets: Download Audio & Images to Local Disk
        PreDownloadAssets --> FrameRendering: Render Frames (Isolated Chromium Process)
        FrameRendering --> FrameRendering: Progress Broadcast via WS
        FrameRendering --> MP4Stitching: Stitch Frames into MP4 & Clean Temp Files
    }

    RENDERING --> COMPLETED: MP4 Uploaded to S3 & Clean Temp Files
    RENDERING --> RENDERING: Worker Crash, Resume from Postgres Checkpoint
    
    RENDERING --> FAILED: DLQ Exceeded Max Retries (3 times)
    SCRIPT_GENERATED --> FAILED: Parse Schema Unrecoverable Error

    COMPLETED --> [*]
    FAILED --> [*]: Rollback & Refund Credits
```

---

## 5. 🎤 Tích Hợp VieNeu TTS Engine & Audio-Visual Scene Sync

Mô hình tích hợp VieNeu TTS tự host (ONNX Engine) và công thức toán học đồng bộ số khung hình Remotion.

```mermaid
flowchart LR
    subgraph ScriptInput["1. Script Agent Output"]
        TextContent["Text Scene: 'Đêm mùng 4 Tết Kỷ Dậu, quân Tây Sơn áp sát đồn Ngọc Hồi.'"]
    end

    subgraph VieNeuEngine["2. Self-Hosted VieNeu TTS Container (FastAPI + ONNX)"]
        TTSModel["VieNeu ONNX Synthesis Model\n(North Historical Voice)"]
        WhisperAlign["Forced Alignment Engine\n(Word Timestamps Output)"]
    end

    subgraph SyncMath["3. Audio-Visual Sync Calculator"]
        DurationMath["Công thức tính Frames:\ndurationInFrames = ceil((audioDurationMs + 300) / 1000 * 30)\nVí dụ: (7400ms + 300ms) / 1000 * 30 = 231 Frames"]
        CaptionConverter["Timestamp Converter:\nconvertVieNeuTimestampsToCaptions()\nms ➔ Remotion Frames"]
    end

    subgraph RemotionOutput["4. Remotion Video Engine"]
        TimelineSync["Audio Timeline Sync (.wav)"]
        KaraokeSubtitle["DocumentarySubtitle.tsx\n(Yellow/Red Highlight Karaoke)"]
    end

    TextContent --> TTSModel
    TTSModel --> WhisperAlign
    WhisperAlign -->|File .wav + AudioDurationMs| DurationMath
    WhisperAlign -->|Word Timestamps JSON| CaptionConverter

    DurationMath --> TimelineSync
    CaptionConverter --> KaraokeSubtitle
    TimelineSync & KaraokeSubtitle --> RemotionOutput
```

---

## 6. 🐳 Hạ Tầng Triển Khai Single-Host Docker Compose Topology

Sơ đồ thể hiện mô hình triển khai Docker Compose Single-Host cho toàn bộ hệ thống ChronoViet:

```mermaid
flowchart TB
    subgraph SingleHostDev["SINGLE-HOST DOCKER COMPOSE TOPOLOGY (MVP PHASE 1)"]
        
        subgraph GatewayContainer["Gateway & Ingress"]
            NginxCont["Nginx Reverse Proxy Container\n- Port 80/443"]
        end

        subgraph CoreServicesGroup["Core App Containers"]
            UserCont["User & Asset Service (NestJS)"]
            RAGCont["Hybrid GraphRAG Service (FastAPI)"]
            OrchCont["Orchestrator Agent (LangGraph + Postgres Checkpoint)"]
        end

        subgraph WorkerGroup["Heavy Task Containers"]
            VieNeuCont["VieNeu TTS Engine (FastAPI + ONNX Runtime)"]
            RenderCont["Remotion Render Worker (BullMQ + Chromium Isolation)"]
        end

        subgraph StorageContainers["Database Containers"]
            PGCont["PostgreSQL Container (Core Data + State Checkpoints)"]
            QdrantCont["Qdrant Vector DB Container"]
            Neo4jCont["Neo4j Graph DB Container"]
            RedisCont["Redis Container (BullMQ Queues + Cache)"]
            MinIOCont["MinIO Object Storage Container"]
        end
    end

    NginxCont --> UserCont & RAGCont & OrchCont
    OrchCont --> RedisCont & PGCont
    RAGCont --> QdrantCont & Neo4jCont
    RenderCont <--> RedisCont & MinIOCont & PGCont
    VieNeuCont --> MinIOCont
```

---

## 7. 📊 Bảng Đối Chiếu & Xác Nhận Tính Đầy Đủ (Verification Matrix)

| Hạng Mục Kiến Trúc | File Gốc Trong Spec | Trạng Thái Đối Chiếu Trong Sơ Đồ | Điểm Tối Ưu Đã Thể Hiện |
| :--- | :--- | :---: | :--- |
| **Architectural Style** | [01_ARCHITECTURAL_STYLE.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/01_ARCHITECTURAL_STYLE.md) | **✅ ĐẦY ĐỦ** | Single-Host Docker Compose Architecture + Gemini 2.5 Flash VLM API. |
| **Communication & Queues** | [02_COMMUNICATION_AND_QUEUES.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/02_COMMUNICATION_AND_QUEUES.md) | **✅ ĐẦY ĐỦ** | REST API, SSE, WebSocket, 3 BullMQ Task Queues (`tts`, `vlm`, `remotion`), Asset Pre-download. |
| **Polyglot Persistence & Cache** | [03_DATA_STORAGE_AND_CACHE.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/03_DATA_STORAGE_AND_CACHE.md) | **✅ ĐẦY ĐỦ** | Qdrant (Vector), Neo4j (Graph), PostgreSQL (Relational + LangGraph Checkpoint), MinIO, Redis 3 Lớp. |
| **State Machine & Deployment** | [04_STATE_MANAGEMENT_AND_DEPLOY.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/04_STATE_MANAGEMENT_AND_DEPLOY.md) | **✅ ĐẦY ĐỦ** | 7 Trạng thái LangGraph Lifecycle, Postgres Checkpointer, Idempotency `md5(json_spec_v3)`. |
| **VieNeu TTS & Production Sync** | [05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md) | **✅ ĐẦY ĐỦ** | VieNeu ONNX Engine, Chrome Isolation & Pre-download, Gemini VLM API, Karaoke Timestamps. |
