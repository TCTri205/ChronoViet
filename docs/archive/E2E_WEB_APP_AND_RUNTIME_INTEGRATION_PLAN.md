# KẾ HOẠCH TRIỂN KHAI HOÀN THIỆN LỚP ỨNG DỤNG (APPS/WEB), CẦU NỐI REALTIME VÀ HẠ TẦNG RUNTIME E2E
## (ChronoViet End-to-End Application, Realtime Gateway & Runtime Infrastructure Implementation Plan — Final Calibrated Version)

> 🗄️ **TÀI LIỆU LƯU TRỮ (ARCHIVED / SUPERSEDED):**  
> Bản kế hoạch tích hợp E2E này đã hoàn thành (Phase 4) và được chuẩn hóa chính thức tại:
> - **Tài liệu Kiến trúc:** [`docs/architecture/04_STATE_MANAGEMENT_AND_DEPLOY.md`](../architecture/04_STATE_MANAGEMENT_AND_DEPLOY.md), [`docs/architecture/02_COMMUNICATION_AND_QUEUES.md`](../architecture/02_COMMUNICATION_AND_QUEUES.md)
> - **Tài liệu UI/UX:** [`docs/specs/UI_UX_DESIGN_SPECIFICATION.md`](../specs/UI_UX_DESIGN_SPECIFICATION.md)
> - **Codebase Production:** [`apps/web`](../../apps/web), [`apps/render-worker`](../../apps/render-worker)

---

## 1. Tổng Quan & Phân Tích Hiện Trạng (Baseline & Gap Analysis)

### 1.1. Đánh giá Hiện trạng Hệ thống (Current State)
Qua rà soát toàn diện codebase và đối chiếu hệ thống tài liệu kiến trúc, ChronoViet đã hoàn thiện các gói nghiệp vụ lõi (Core Backend Modules & Processing Services):
- **`packages/shared-spec`**: Single Source of Truth (SSOT) Types, Zod Schemas (`ChronoVideoProps` / Video Script Schema v4.1, `TimelineScene`, `CaptionWord`, `WordTimestamp`), PostgreSQL Client (`pgvector`), Workspace Asset Manager (`initProjectWorkspace`, `cleanProjectWorkspace`), LLM Client (Qwen3.8 Local + Cloud Gemini/Agnes 2.5 Flash Fallback), Unified Logger.
- **`packages/rag-engine`**: Hybrid GraphRAG (PostgreSQL `pgvector` Dense 1024d + Graph CTEs + BM25 FTS + RRF + BGE Reranker v2), đạt chuẩn KPI benchmark (`rag-engine/eval/`).
- **`packages/agent-orchestrator`**: LangGraph.js State Machine chuẩn 15 trạng thái, PostgreSQL Checkpointer, 5 Script Micro-Steps, Duration Reconciler, Research Agent (Crawl ảnh trực tuyến đa nguồn kèm Whitelist bản quyền) và JSON Schema Packager.
- **`packages/vlm-inspector`**: Dual VLM Scorer (Local Qwen3-VL-8B / Cloud Gemini VLM / Local CLIP Fallback), Whitelisted License Filter (CC0, CC-BY, Public Domain), SHA-256 / pHash Redis Cache.
- **`packages/remotion-engine`**: Render Engine 31 LayoutModes, 19 TransitionTypes, Composition components, CLI Renderer.
- **`services/vieneu-tts`**: Node.js HTTP Service + Python FastAPI ONNX Engine (cổng 8080), tính toán `wordTimestamps` chính xác.
- **`apps/render-worker`**: Khung BullMQ Queues (`tts-gen-queue`, `vlm-inspect-queue`, `remotion-render-queue`), 3 Workers xử lý background jobs, cơ chế cô lập tiến trình render (`CONCURRENCY=1`).

---

### 1.2. Các Khoảng Trống Cần Khắc Phục (Identified Gaps)
Hệ thống hiện tại chưa thể vận hành End-to-End (từ người dùng nhập prompt $\rightarrow$ tạo video $\rightarrow$ xem và tải video trên giao diện web) do 3 nhóm khoảng trống:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 HIỆN TRẠNG KHOẢNG TRỐNG                               │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│ 1. Khoảng trống Web App  │ 2. Khoảng trống Cầu nối     │ 3. Khoảng trống Hạ tầng       │
│    (`apps/web`)          │    Realtime & Assets        │    Runtime & Scripts          │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ • `apps/web/src/index.ts`│ • `render-worker` chưa push │ • Redis / Postgres chưa có    │
│   chỉ có 5 dòng log      │   progress qua Redis PubSub │   healthcheck trong compose   │
│ • Chưa có RESTful API    │ • Chưa có pre-download      │ • Python TTS FastAPI chưa bật │
│   (CRUD, Stream, Review) │   remote assets về `/media` │ • Thiếu scripts tiện ích:     │
│ • Chưa có WebSocket      │ • Thiếu BullMQ Producer     │   `start-tts-local.sh`,       │
│ • Chưa có Frontend UI/UX │   gọi `queue.add()`         │   `start-local-ai.sh`,        │
│ • Chưa có tests/eval     │ • Chưa sync trạng thái      │   `dev-stack.sh`,             │
│                          │   render vào DB/Redis SSOT  │   `pnpm stack:infra`          │
└──────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

---

### 1.3. Bảng Chuẩn Hóa Các Điểm Hiệu Chỉnh Kỹ Thuật (Architecture Calibration SSOT)

Để đảm bảo tuyệt đối tính nhất quán giữa Code thực tế, Kế hoạch triển khai và Hệ thống tài liệu kiến trúc, các quy chuẩn sau đây được chốt làm chuẩn chung duy nhất (SSOT):

| Hạng Mục | Hiện Trạng Cũ / Lệch | Chuẩn Hóa SSOT Mới Nhất | Căn Cứ Kỹ Thuật |
| :--- | :--- | :--- | :--- |
| **Cloud LLM Fallback** | Gemini 2.5 Flash (`GEMINI_API_KEY`) | **Agnes 2.5 Flash (`AGNES_API_KEY`)** | `packages/shared-spec/src/llm-client.ts`, `.env.example` (model: `agnes-2.5-flash`). |
| **Schema Versioning** | VideoProjectSchema v3.2 | **ChronoVideoScriptSchema v4.1** | `REMOTION_CONTENT_FORMATS_SPEC.md`, `SystemOverview.md`, `packages/shared-spec/src/schema.ts`. |
| **PubSub & WS Channel** | `project_status:{project_id}` | **`project_events:${projectId}`** | Hỗ trợ tường minh event types (`RENDER_PROGRESS`, `RENDER_COMPLETED`, `RENDER_FAILED`). |
| **15 Trạng Thái Vòng Đời** | Tên lệch giữa docs cũ (`DURATION_MISMATCH` vs `SCENES_SEGMENTED`) | **Chuẩn SSOT 15 trạng thái** theo `packages/agent-orchestrator/src/graph/state.ts` | Khớp 100% với LangGraph State Machine trong code lõi. |
| **Worker Concurrency** | Mô tả `--concurrency=2` | **`CONCURRENCY=1` (Chromium Process Isolation)** | `apps/render-worker/src/workers/render-worker.ts`, `Dockerfile.worker`, `docs/architecture/05_...` |
| **BullMQ Enqueue** | Chưa có Producer nào gọi `queue.add()` | **Xây dựng BullMQ Producer trong `apps/web`** | `apps/web` đóng vai trò Producer đẩy job vào các hàng đợi BullMQ. |
| **`pnpm dev` Script** | Đang chỉ chạy `tsc -w` | **Chạy song song Next.js Dev Server + Worker Runtime** | Cập nhật `package.json` và scripts khởi động thực tế. |
| **Dev Environment Sync** | `.env` vs `.env.example` lệch port/model | **Chuẩn hóa Port 8080 cho LLM/TTS & model embedding `qwen3-embedding-0.6b`** | Đảm bảo script `start-local-ai.sh` và `dev-stack.sh` chạy thông suốt. |

---

## 2. Thiết Kế Kiến Trúc Lớp Ứng Dụng (Target Architecture for `apps/web`)

Theo đúng đặc tả kiến trúc Monolith tinh gọn (`docs/architecture/01_ARCHITECTURAL_STYLE.md` & `02_COMMUNICATION_AND_QUEUES.md`), `apps/web` đảm nhận vai trò **App Monolith Server** (kết hợp Backend API / WebSocket Gateway và Web Frontend UI).

```
                               ┌───────────────────────────┐
                               │   CADDY REVERSE PROXY     │
                               │   (Port 80 / 443 / 3000)  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │                                   APPS/WEB CONTAINER                                  │
 │                                                                                       │
 │ ┌───────────────────────────────────────────────────────────────────────────────────┐ │
 │ │                   FRONTEND LAYER (Next.js 14 App Router / React)                  │ │
 │ │ • NotebookLM-Style Historical Workspace (Integrated Knowledge & Chat Hub)         │ │
 │ │ • Interactive RAG Historical Chatbot (Dual-branch search + Citations)             │ │
 │ │ • 1-Click Autonomous Video Generator Panel (Prompt / Conversation Topic to Video) │ │
 │ │ • Realtime Autonomous Agent Stepper & Monitor (12-State LangGraph & Frame Meter)  │ │
 │ │ • Finished Video Player & Attribution Drawer (MP4 playback, Subtitles, Download)  │ │
 │ └─────────────────────────────────────────┬─────────────────────────────────────────┘ │
 │                                           │ (Internal API Calls & WebSocket)          │
 │ ┌─────────────────────────────────────────▼─────────────────────────────────────────┐ │
 │ │                   BACKEND LAYER (Next.js API Routes / Fastify Bridge)             │ │
 │ │ • RESTful API Endpoints (`/api/v1/projects`, `/api/v1/chat`, `/api/v1/media`)     │ │
 │ │ • SSE Stream Endpoint (`/api/v1/projects/:id/stream`) for LangGraph Progress      │ │
 │ │ • WebSocket Gateway Server (`/ws/projects/:id`) listening to Redis PubSub         │ │
 │ │ • BullMQ Producer (`queue.add()` đẩy job sang `remotion-render-queue`)            │ │
 │ └───────────────────────────────────────────────────────────────────────────────────┘ │
 └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
            ┌────────────────────┐                       ┌────────────────────┐
            │   PostgreSQL DB    │                       │  Unified Redis DB  │
            │ (Checkpoints/SSOT) │                       │ (BullMQ + PubSub)  │
            └────────────────────┘                       └─────────┬──────────┘
                                                                   │
                                                                   ▼
                                                         ┌────────────────────┐
                                                         │   Render Worker    │
                                                         │ (TTS, VLM, Render) │
                                                         │ (CONCURRENCY = 1)  │
                                                         └────────────────────┘
```

---

## 3. Chi Tiết Kỹ Thuật Các Thành Phần Cần Triển Khai

### 3.1. RESTful API & Server-Sent Events (SSE) Specifications

Tất cả các API tuân thủ nghiêm ngặt Zod Schemas từ `@chronoviet/shared-spec` (Schema v4.1):

| Method | Endpoint | Chức Năng | Payload / Response |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/chat` | Hỏi đáp RAG Lịch Sử tương tác | **Body:** `{ query: string, conversationId?: string }`<br>**Response:** Stream tokens + trích dẫn sử liệu (`citations`) từ GraphRAG. |
| `POST` | `/api/v1/projects` | Khởi tạo dự án video tự động (1-Click) | **Body:** `{ prompt: string, conversationId?: string, targetDurationMinutes?: number, aspectRatio?: '16:9'\|'9:16', tone?: string }`<br>**Response:** `{ projectId: string, status: 'INIT', createdAt: string }` |
| `GET` | `/api/v1/projects` | Lấy danh sách video/dự án đã tạo | **Query:** `?limit=20&offset=0`<br>**Response:** `{ items: ProjectSummary[], total: number }` |
| `GET` | `/api/v1/projects/:id` | Lấy chi tiết trạng thái & schema v4.1 | **Response:** `{ projectId, status, currentStep, schema: ChronoVideoProps, videoUrl, metadata, createdAt }` |
| `GET` | `/api/v1/projects/:id/stream` | Stream tiến độ Multi-Agent qua SSE | **Response:** `text/event-stream` stream các sự kiện tiến trình `{ nodeName, update, state, status }` |
| `POST` | `/api/v1/projects/:id/render` | Kích hoạt render video MP4 | Gọi BullMQ Producer `queue.add()` vào `remotion-render-queue`.<br>**Response:** `{ jobId: string, status: 'RENDERING' }` |
| `GET` | `/api/v1/projects/:id/video` | Stream file MP4 đã render | Trả về stream file `/media/projects/:id/output/video.mp4` |

---

### 3.2. Cầu Nối Real-Time Progress: Redis PubSub & WebSocket Gateway

Để đảm bảo decoupling hoàn toàn giữa `render-worker` và `apps/web`:
1. **Render Worker** (`apps/render-worker/src/workers/render-worker.ts`):
   - Trong quá trình Remotion render, định kỳ phát event tiến độ vào Redis PubSub channel **`project_events:${projectId}`**:
     ```json
     {
       "projectId": "proj_1288_bach_dang",
       "type": "RENDER_PROGRESS",
       "status": "RENDERING",
       "progressPercent": 45,
       "currentFrame": 450,
       "totalFrames": 1000,
       "estimatedRemainingSec": 20,
       "timestamp": "2026-08-15T15:00:00.000Z"
     }
     ```
   - Khi render hoàn tất hoặc thất bại, gửi event `RENDER_COMPLETED` (kèm `outputPath`, `fileSizeBytes`, `durationMs`) hoặc `RENDER_FAILED` (kèm `errorMessage`).
2. **WebSocket Gateway** (`apps/web`):
   - Khởi tạo WebSocket route `/ws/projects/:projectId`.
   - Kết nối Redis Subscriber lắng nghe channel `project_events:${projectId}` và forward trực tiếp xuống các client WebSocket đang theo dõi dự án tương ứng.

---

### 3.3. Cải Tiến Asset Pre-download, Workspace Preparation & Concurrency

Trong `apps/render-worker/src/workers/render-worker.ts`:
- **Concurrency**: Đảm bảo duy trì nghiêm ngặt `concurrency: 1` (đọc từ `process.env.RENDER_CONCURRENCY || 1`) để bảo toàn bộ nhớ RAM/VRAM và cô lập Chromium process.
- **Hàm `ensureProjectAssetsReady(projectId, schema)`**:
  - Duyệt qua toàn bộ `timeline[].sceneAudioUrl` và `timeline[].assetUrl`.
  - Nếu là remote URL (HTTP/HTTPS), tải về thư mục cục bộ `/media/projects/:id/assets/` hoặc `/media/projects/:id/audio/`.
  - Chuyển đổi đường dẫn thành absolute local path hoặc Base64 data URI trước khi gọi CLI `npx remotion render`.
- **Dọn dẹp tệp tạm**: Sau khi render xong, dọn dẹp workspace tạm thời qua `cleanProjectWorkspace(projectId, { cleanTempOnly: true })`.

---

### 3.4. Giao Diện Người Dùng (NotebookLM-Inspired UI Workspace trong `apps/web`)

Giao diện Next.js được thiết kế theo tiêu chuẩn thẩm mỹ cao cấp (Modern Historical Heritage, Dark Mode, Typography Tối Ưu, Minimalist & Focused) lấy cảm hứng trực tiếp từ **NotebookLM Workspace**:

1. **Khung Chatbot Sử Liệu & Tương Tác Tri Thức (Central Knowledge Hub)**:
   - Là giao diện trung tâm nơi người dùng trò chuyện, đặt câu hỏi về các sự kiện, nhân vật, trận đánh lịch sử.
   - Kết nối trực tiếp với **Chrono-RAG Engine** (Hybrid GraphRAG pgvector + Relational Graph CTEs).
   - Câu trả lời được stream trực tiếp kèm **Trích dẫn nguồn gốc (Interactive Citations)** ghim trực tiếp vào các đoạn sử liệu gốc (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Thông Giám Cương Mục...).
2. **Panel Tạo Video Tổng Quan 1-Click (Automated Video Studio)**:
   - Tương tự tính năng tạo "Audio Overview" của NotebookLM nhưng được nâng cấp thành **Video Documentary Generator**.
   - Người dùng chỉ cần nhập chủ đề mong muốn hoặc bấm *"Tạo Video từ cuộc hội thoại này"*, tùy chọn thời lượng (1-3-5 phút) và tỷ lệ (16:9 Landscape hoặc 9:16 Shorts/Reels).
   - **Tự động hóa hoàn toàn (Zero Manual Micro-Intervention)**: Người dùng **không cần và không phải can thiệp** vào các thao tác biên tập thủ công (không sửa kịch bản, không kéo thả timeline/scene). Đội ngũ Multi-Agent tự động đảm nhiệm 100% từ nghiên cứu, viết lời thoại, thu âm giọng đọc VieNeu đến kiểm định ảnh VLM và Remotion render.
3. **Thanh Trạng Thái & Giám Sát Tiến Trình Realtime (Autonomous Agent Monitor)**:
   - Hiển thị trực quan luồng vận hành của các Agent theo thời gian thực (Live Agent Stepper & Status Badge):
     - `1. RAG Tri Thức` ➔ `2. Soạn Kịch Bản 5 Bước` ➔ `3. Thẩm Định Lịch Sử` ➔ `4. Thu Âm VieNeu TTS` ➔ `5. VLM Kiểm Định Ảnh` ➔ `6. Render Remotion MP4`.
   - Kết nối WebSocket nhận cập nhật % frame render từ Worker ngầm (`project_events:${projectId}`).
4. **Trình Chiếu & Thư Viện Video Thành Phẩm (Video Player & Attribution Drawer)**:
   - Video Player HTML5 cao cấp phát video MP4 hoàn chỉnh với phụ đề Karaoke đồng bộ chính xác từng mili-giây.
   - Bảng kê khai Bản quyền & Nguồn gốc tư liệu (Attribution Table) minh bạch.
   - Nút Tải Video MP4 chất lượng cao (1080p).

---

### 3.5. Bộ Công Cụ & Scripts Quản Lý Hạ Tầng Runtime (Dev & E2E Orchestration)

Xây dựng bộ script điều hành hạ tầng để lập trình viên có thể khởi động môi trường E2E dễ dàng:

1. **Docker Compose Dev Profile (`docker-compose.yml`) & Healthcheck**:
   - Bổ sung healthcheck chuẩn cho Postgres (`pg_isready -U chronoviet -d chronoviet_db`) và Redis (`redis-cli ping`).
   - Lệnh khởi động nhanh: `pnpm stack:infra` (`docker compose up -d postgres redis`).
2. **Python TTS Engine Starter (`scripts/start-tts-local.sh`)**:
   - Tự động kích hoạt virtual environment và khởi chạy `services/vieneu-tts/app.py` trên cổng 8080.
3. **Local AI Model Starter (`scripts/start-local-ai.sh`)**:
   - Hỗ trợ khởi động `llama-server` cho LLM (Qwen-2.5) và Embedding server (`qwen3-embedding-0.6b`) khi chạy local Metal/CUDA.
   - Hỗ trợ chế độ **Hybrid Dev Mode** (`HYBRID_DEV=true`): Tự động fallback sang **Agnes 2.5 Flash (`AGNES_API_KEY`)** để phát triển nhanh mà không yêu cầu máy cấu hình lớn.
4. **Master Dev Command**:
   - Cập nhật `package.json` để lệnh `pnpm dev` thực sự khởi chạy song song Next.js App Server và BullMQ Render Worker.

---

## 4. Lộ Trình Triển Khai Chi Tiết (Phased Action Plan)

Kế hoạch được chia làm 4 Sprint tuần tự:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1: HẠ TẦNG RUNTIME, SCRIPT TIỆN ÍCH & WORKER REALTIME                           │
│ • Thêm healthcheck vào `docker-compose.yml` & cấu hình lệnh `pnpm stack:infra`         │
│ • Viết các script khởi động: `scripts/start-tts-local.sh`, `start-local-ai.sh`,        │
│   `scripts/dev-stack.sh` (hỗ trợ Agnes 2.5 Flash Hybrid Dev Mode)                      │
│ • Bổ sung Redis PubSub (`project_events:${projectId}`) emitter vào `render-worker`     │
│ • Triển khai `ensureProjectAssetsReady` (tải remote asset về `/media`) & giữ           │
│   `CONCURRENCY=1` trong `render-worker`                                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SPRINT 2: BACKEND API SERVER, WEBSOCKET & BULLMQ PRODUCER (`apps/web`)                 │
│ • Khởi tạo Next.js 14 App Router / API Server trong `apps/web`                         │
│ • Viết RESTful API routes (`/api/v1/chat`, `/api/v1/projects`, `/api/v1/media`)        │
│ • Viết SSE Stream Handler (`/api/v1/projects/:id/stream`) bắt stream LangGraph         │
│ • Viết WebSocket Gateway bắt sự kiện từ Redis PubSub chuyển tiếp về Client             │
│ • Viết BullMQ Producer (`queue.add()`) kết nối `remotion-render-queue`                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SPRINT 3: GIAO DIỆN NOTEBOOKLM WORKSPACE & 1-CLICK VIDEO GENERATOR                     │
│ • Thiết lập Theme di sản, Layout và Design System (Vanilla CSS / Tailwind)             │
│ • Xây dựng Khung Chatbot Tra Cứu Sử Liệu GraphRAG tương tác kèm Citations              │
│ • Xây dựng Panel Tạo Video 1-Click (Nhập chủ đề/thời lượng ➔ Kích hoạt Pipeline)       │
│ • Xây dựng Realtime Agent Stepper & Monitor (Theo dõi tiến trình Agent & % Render)     │
│ • Xây dựng Trình Chiếu Video MP4, Karaoke Subtitles & Drawer Nguồn Gốc Bản Quyền       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SPRINT 4: TÍCH HỢP TOÀN DIỆN (E2E INTEGRATION & VERIFICATION)                          │
│ • Kiểm thử luồng E2E: Chat/Prompt -> RAG -> Script -> TTS -> VLM -> Remotion MP4       │
│ • Viết E2E Integration Test trong `apps/web/__tests__/e2e-pipeline.test.ts`            │
│ • Viết bộ Eval Suite `apps/web/eval/` và cập nhật `eval:all`                           │
│ • Đồng bộ hóa toàn bộ tài liệu kỹ thuật trong `docs/`                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Bảng Phân Nhiệm Tác Vụ Cụ Thể (Task Breakdown & File Changes)

| STT | Tác Vụ | Tệp Tin Tác Động | Mô Tả Kỹ Thuật |
| :---: | :--- | :--- | :--- |
| **1.1** | Docker Compose Healthcheck & Infra Script | `docker-compose.yml`, `package.json` | Thêm healthcheck cho Postgres/Redis; bổ sung script `pnpm stack:infra`. |
| **1.2** | Runtime Launch Scripts | `scripts/start-tts-local.sh`, `scripts/start-local-ai.sh`, `scripts/dev-stack.sh` | Viết scripts khởi chạy hạ tầng; hỗ trợ Agnes 2.5 Flash cho Hybrid Dev Mode; đồng bộ .env. |
| **1.3** | Redis PubSub Progress Emitter | `apps/render-worker/src/workers/render-worker.ts` | Bổ sung Redis publish vào channel `project_events:${projectId}` khi render. |
| **1.4** | Asset Pre-download & Workspace Prep | `apps/render-worker/src/workers/render-worker.ts` | Viết hàm `ensureProjectAssetsReady` tải remote assets về `/media/projects/:id/`. |
| **2.1** | Cấu hình Dependencies cho `apps/web` | `apps/web/package.json`, `tsconfig.json` | Bổ sung `next`, `react`, `react-dom`, `ws`, `ioredis`, `bullmq`, `lucide-react`. |
| **2.2** | BullMQ Producer Module | `apps/web/src/lib/queues.ts` | Khởi tạo producer `queue.add()` cho `remotion-render-queue` và các queue liên quan. |
| **2.3** | REST API Routes (Chat & Projects) | `apps/web/src/app/api/...` | Triển khai các endpoint RESTful theo chuẩn Schema v4.1 & GraphRAG Chat stream. |
| **2.4** | SSE Streaming & WebSocket Gateway | `apps/web/src/server/ws-gateway.ts` | SSE stream cho LangGraph và WebSocket server forward PubSub events. |
| **3.1** | UI Components & Global Styling | `apps/web/src/components/...`, `globals.css` | Thiết kế theme di sản, Layout NotebookLM, ChatMessage, CitationBadge, VideoPlayer. |
| **3.2** | NotebookLM Workspace & RAG Chat Hub | `apps/web/src/app/page.tsx`, `components/chat/...` | Khung chat tra cứu sử liệu thời gian thực, hiển thị trích dẫn nguồn gốc tương tác. |
| **3.3** | 1-Click Video Generator & Live Agent Monitor | `apps/web/src/components/video/...` | Panel kích hoạt tạo video 1-click, Stepper hiển thị tiến độ 12 bước của Multi-Agent & thanh render. |
| **3.4** | Video Player & Attribution Drawer | `apps/web/src/components/player/...` | Player phát video MP4 hoàn chỉnh kèm phụ đề karaoke và bảng nguồn gốc tư liệu. |
| **4.1** | E2E Integration Test | `apps/web/__tests__/e2e-pipeline.test.ts` | Kiểm thử tích hợp tự động toàn bộ luồng từ Prompt -> Chat -> Autonomous Video Render. |
| **4.2** | Web App Eval Suite | `apps/web/eval/runner.ts` | Đo lường API latency, WebSocket throughput và tỉ lệ phản hồi UI. |
| **4.3** | Cập nhật Master Dev Script | `package.json` | Cập nhật `pnpm dev` để khởi chạy đồng thời Next.js app và render-worker. |

---

## 6. Ma Trận Kiểm Thử & Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **API Server & WebSocket**:
   - Tất cả các endpoint trả về đúng định dạng JSON Schema v4.1 từ `@chronoviet/shared-spec`.
   - WebSocket kết nối ổn định, nhận đủ 100% các sự kiện render progress từ channel `project_events:${projectId}`.
2. **Frontend Trải Nghiệm Người Dùng (NotebookLM Experience)**:
   - Giao diện tra cứu và tương tác mượt mà, phản hồi nhanh, hiển thị trích dẫn nguồn lịch sử trực quan.
   - Tính năng tạo video 1-Click tự động kích hoạt toàn bộ pipeline Multi-Agent mà không bắt người dùng phải chỉnh sửa thủ công.
3. **End-to-End Execution**:
   - Nhập prompt: *"Trận chiến Bạch Đằng năm 1288"* hoặc bấm "Tạo Video" từ đoạn chat $\rightarrow$ Hệ thống tự động RAG $\rightarrow$ Sinh kịch bản 3 hồi $\rightarrow$ Sinh giọng đọc VieNeu $\rightarrow$ Kiểm định ảnh VLM $\rightarrow$ Render xuất video MP4 $\rightarrow$ Video hiển thị phát được trên trình duyệt web.
4. **Hạ Tầng & Cô Lập Tiến Trình**:
   - Render Worker tuân thủ `CONCURRENCY=1`, Chromium process được giải phóng hoàn toàn sau render.
   - Hỗ trợ chạy Hybrid Dev Mode với fallback Agnes 2.5 Flash mượt mà.
5. **Tuân thủ Chuẩn Monorepo**:
   - `pnpm typecheck` đạt 0 lỗi TypeScript toàn monorepo.
   - `pnpm lint` đạt chuẩn 100%.
   - Không vi phạm nguyên tắc SSOT của `packages/shared-spec`.
