# CHRONOVIET DOCUMENTATION PORTAL (TRUNG TÂM TÀI LIỆU DỰ ÁN)

Chào mừng bạn đến với Trung tâm Tài liệu Kỹ thuật và Kiến trúc của dự án **ChronoViet** — Nền tảng EdTech nghiên cứu lịch sử phong cách NotebookLM (Khung Chatbot tra cứu RAG chuyên sâu & Tạo video tài liệu 1-Click hoàn toàn tự động qua Multi-Agent).

---

## 🗂️ 1. Cấu Trúc & Phân Nhóm Tài Liệu (Documentation Directory)

Tài liệu dự án được tổ chức khoa học thành các nhóm chuyên biệt, phân định rõ ràng giữa **Kiến trúc (Architecture)**, **Mô-đun Core (Modules)**, **Quy chuẩn kỹ thuật (Specs - SSOT)**, **Hướng dẫn (Guides)**, **Kịch bản (Script Examples)** và **Lưu trữ lịch sử (Archive)**:

```
docs/
├── 📘 SystemOverview.md                       [Kiến trúc Toàn diện RAG + Multi-Agent + VLM + Remotion + Web App [✅]]
├── 🚀 IMPLEMENTATION_PLAN.md                  [★ Kế hoạch Triển khai 5 Phase & Khung Đánh giá 8 Mô-đun [✅ 100% Phase 1-5 Implemented & Verified]]
│
├── 🏛️ architecture/                           [KIẾN TRÚC HỆ THỐNG & HẠ TẦNG KỸ THUẬT]
│   ├── README.md                              [Tổng quan Kiến trúc Hệ thống & Hạ tầng]
│   ├── 01_ARCHITECTURAL_STYLE.md              [Kiểu Kiến trúc: Event-Driven + Decoupled Pipeline]
│   ├── 02_COMMUNICATION_AND_QUEUES.md         [Giao tiếp IPC, BullMQ Task Queues & WebSocket]
│   ├── 03_DATA_STORAGE_AND_CACHE.md           [Cơ sở dữ liệu (Postgres pgvector SSOT) & Cache (Redis)]
│   ├── 04_STATE_MANAGEMENT_AND_DEPLOY.md      [Quản lý State (LangGraph.js), Docker Compose & App Deploy]
│   ├── 05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md [Tối ưu Sản xuất & VieNeu TTS Engine]
│   ├── 06_OBSERVABILITY_AND_LOGGING.md        [Unified Structured Logging & Hướng dẫn Truy vết]
│   └── CHRONOVIET_ARCHITECTURE_DIAGRAMS.md    [Bộ Sơ đồ Kiến trúc Toàn diện]
│
├── ⚙️ modules/                                [CHI TIẾT 5 MÔ-ĐUN XỬ LÝ PIPELINE]
│   ├── README.md                              [Tổng quan 5 Mô-đun Xử lý Dữ liệu]
│   ├── 00_DATA_PREPROCESSING_AND_INGESTION.md [Mô-đun 0: Data Preprocessing & Ingestion Engine [✅]]
│   ├── 01_CHRONO_RAG_ENGINE.md                [Mô-đun 1: Knowledge Retrieval & Anti-Hallucination [✅]]
│   ├── 02_MULTI_AGENT_ORCHESTRATOR.md         [Mô-đun 2: Multi-Agent LangGraph.js & Script Pipeline v4.1 [✅]]
│   ├── 03_VLM_INSPECTOR_AGENT.md              [Mô-đun 3: Visual Quality Control & Dual Scorer [✅]]
│   └── 04_REMOTION_RENDER_ENGINE.md           [Mô-đun 4: 100% Data-Driven Video Pipeline [✅]]
│
├── 📐 specs/                                  [QUY CHUẨN KỸ THUẬT & THIẾT KẾ (SSOT)]
│   ├── EVAL_REMOTION_TECHNICAL_SPEC.md        [★ Source of Truth: 31 LayoutMode, 19 Transition, Zod Schema, 11 Compositions [✅]]
│   ├── REMOTION_CONTENT_FORMATS_SPEC.md       [Quy chuẩn 5 Domain, Schema Production v4.1, Lego Components [✅]]
│   ├── KNOWLEDGE_DATA_GOVERNANCE_SPEC.md      [★ Source of Truth: Quản trị Số lượng, Chất lượng & Giải quyết Xung đột Sử liệu [✅]]
│   ├── RAG_COMPONENT_BENCHMARK_SPEC.md        [★ Benchmark Chi tiết từng Component RAG: C0-C10, Dataset, Metrics & Regression Gate [✅]]
│   ├── UI_UX_DESIGN_SPECIFICATION.md          [★ Đặc tả Thiết Kế UI/UX NotebookLM Workspace & 1-Click Studio [✅ Spec]]
│   ├── USER_AUTH_AND_PERMISSIONS_SPEC.md      [★ Đặc tả Quản lý Người dùng, Xác thực Google OAuth & Phân quyền [📐 Spec]]
│   └── TEMPLATE_GUIDE_VIDEO_ESSAY.md          [Bộ nhận diện thị giác Video Essay, Typography [📐 Design Spec]]
│
├── 📖 guides/                                 [HƯỚNG DẪN KỸ THUẬT & AUDIT LOGS]
│   ├── MACOS_LOCAL_MODEL_OPTIMIZATION.md      [Hướng dẫn Tối ưu hóa Mô hình Local trên macOS (Apple Silicon)]
│   └── RESEARCH_PROMPTS_LOG.md                [Nhật ký audit ảnh tư liệu Wikimedia (Phase 1: Quang Trung 15 scenes) [🟡 Audit In Progress]]
│
├── 📜 script_examples/                        [KỊCH BẢN MẪU CHUẨN SCHEMA v4.1]
│   ├── KICH_BAN_BIOGRAPHY_TRAN_HUNG_DAO.md    [Domain BIOGRAPHY: Trần Hưng Đạo (21 JSON scenes, 405s)]
│   ├── KICH_BAN_BATTLE_BACH_DANG_938.md       [Domain BATTLE: Trận Bạch Đằng 938 (21 JSON scenes, 405s)]
│   ├── KICH_BAN_DYNASTY_TRIEU_LY.md           [Domain DYNASTY: Triều Đại Nhà Lý (21 JSON scenes, 405s)]
│   ├── KICH_BAN_MYSTERY_LE_CHI_VIEN.md        [Domain MYSTERY: Vụ Án Lệ Chi Viên (19 scenes, 375s)]
│   ├── KICH_BAN_ARTIFACT_TRONG_DONG_NGOC_LU.md [Domain ARTIFACT: Trống Đồng Ngọc Lũ (19 JSON scenes, 375s)]
│   ├── KICH_BAN_QUANG_TRUNG.md                [Kịch bản Legacy: Hoàng đế Quang Trung (18 scenes JSON, 245s)]
│   ├── KICH_BAN_HAI_BA_TRUNG.md               [Kịch bản Legacy: Khởi nghĩa Hai Bà Trưng (27 scenes JSON, 450s)]
│   └── KICH_BAN_MONG_CO_DAI_VIET_LAN_2.md     [Kịch bản Legacy: Chống Nguyên Mông Lần 2 (25 scenes JSON, 1140s)]
│
└── 🗄️ archive/                                [LƯU TRỮ CÁC BẢN KẾ HOẠCH TẠM THỜI ĐÃ HOÀN THÀNH]
    ├── RAG_plan.md                            [Kế hoạch RAG Engine khởi tạo (Phase 1-4 draft)]
    ├── data_preprocessing_plan.md             [Kế hoạch Ingestion Engine khởi tạo draft]
    └── E2E_WEB_APP_AND_RUNTIME_INTEGRATION_PLAN.md [Kế hoạch Tích hợp E2E Web App & Scripts draft]
```

---

## 📖 2. Tóm Tắt Nhanh Nội Dung Từng Tài Liệu

### 2.1. [SystemOverview.md](SystemOverview.md) — Kiến Trúc Hệ Thống Tổng Quan
- **Mục đích:** Cung cấp cái nhìn toàn cảnh về dự án ChronoViet.
- **Trạng thái:** 
  - **[✅ IMPLEMENTED]:** Remotion Rendering Engine, Zod Data Schema Validation v4.1, 19 Components, 31 LayoutModes, 11 Compositions trong `Root.tsx`.
  - **[✅ IMPLEMENTED]:** VieNeu TTS Microservice (Python FastAPI ONNX + Node.js Client SDK tại `@chronoviet/infra/tts`).
  - **[✅ IMPLEMENTED]:** Data Preprocessing & Ingestion Engine (`packages/data-ingestion/`) & Chrono-RAG Engine (`packages/rag-engine/`).
  - **[✅ IMPLEMENTED]:** Multi-Agent Orchestrator LangGraph.js (`packages/agent-orchestrator/`) & VLM Inspector (`packages/vlm-inspector/`).
  - **[✅ IMPLEMENTED]:** App Monolith Web UI/UX NotebookLM Workspace, REST API, WebSocket & Render Worker (`apps/web` & `apps/render-worker`).

### 2.2. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Kế Hoạch Triển Khai v1.1 & Khung Đánh Giá `eval/`
- **Mục đích:** Kế hoạch thực thi dự án chi tiết, lộ trình 5 giai đoạn, phân tích khả năng phát triển song song của các mô-đun, quy tắc bắt buộc có thư mục `eval/` riêng cho từng mô-đun và bộ hợp đồng giao tiếp Type-Safe giữa các mô-đun (`packages/shared-spec`).
- **Trạng thái:** **[✅ PHASE 1–5 COMPLETED & VERIFIED]** Toàn bộ Workstream 0, A, B, C, D, App Layer và Orchestration Scripts đã hoàn thành 100% codebase và unit tests.

### 2.3. [specs/EVAL_REMOTION_TECHNICAL_SPEC.md](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) — ★ Quy Chuẩn Kỹ Thuật (Source of Truth)
- **Mục đích:** Tài liệu tham chiếu kỹ thuật chi tiết và chính xác nhất cho `packages/remotion-engine/src/`.
- **Trọng tâm:**
  - Mô hình 3 Lớp Rendering (`HistoryBackground` + `HistoryForeground` + `Persistent Overlays`) & cơ chế `TransitionSeries` trong `ChronoVideo.tsx`
  - **31 `LayoutMode`** đầy đủ (11 Pure Image + 20 Pure Code)
  - **19 `TransitionType`**, **4 `FilterStyle`**, **6 `KenBurnsEffect`**
  - Zod Schema (`ChronoVideoSchema`, `TimelineSceneSchema`, `OverlayDataSchema`)
  - **11 Composition** đã đăng ký trong `Root.tsx` (BIOGRAPHY 21 scenes, BATTLE 21 scenes, DYNASTY 21 scenes, MYSTERY 19 scenes, ARTIFACT 19 scenes, Quick Shorts, Modern News + 3 Legacy)

### 2.4. [specs/REMOTION_CONTENT_FORMATS_SPEC.md](specs/REMOTION_CONTENT_FORMATS_SPEC.md) — Quy Chuẩn Định Dạng Nội Dung v4.1
- **Mục đích:** Quy định ranh giới cho AI Agent khi lập kịch bản video.
- **Trọng tâm:** Triết lý "1 Scene = 1 Trạng thái", Bảng mapping 5 Domain lịch sử với Component flow bắt buộc, Schema JSON Production mẫu cho cả 5 domain.
- **Lưu ý Âm thanh & Tải tài nguyên:** Trường `sfxUrl`, `soundEffects[]` & `sceneAudioUrl` được hỗ trợ 100% trong Zod Schema và `ChronoVideo.tsx` render pipeline. Tài nguyên âm thanh SFX & hình ảnh tư liệu được cấu hình nạp trực tiếp qua `media/` hoặc `packages/remotion-engine/public/`.

### 2.5. [specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) — Quy Chuẩn Quản Trị Tri Thức
- **Mục đích:** Đặc tả quản trị số lượng, chất lượng, phân cấp độ tin cậy của tài liệu nguồn (Level 1-3) và giải quyết xung đột sử liệu.

### 2.6. [specs/UI_UX_DESIGN_SPECIFICATION.md](specs/UI_UX_DESIGN_SPECIFICATION.md) — Đặc Tả Thiết Kế Giao Diện UI/UX
- **Mục đích:** Bản đặc tả chi tiết toàn diện giao diện NotebookLM Heritage Workspace: Hệ thống màu sắc HSL di sản, Typography font Playfair Display & Plus Jakarta Sans, Khung Chatbot RAG, Panel Tạo Video 1-Click, Live Agent Stepper và MP4 Video Player.
- **Trạng thái:** **[✅ IMPLEMENTED]** Đã triển khai đầy đủ trong `apps/web/src/components/`.

### 2.7. [specs/TEMPLATE_GUIDE_VIDEO_ESSAY.md](specs/TEMPLATE_GUIDE_VIDEO_ESSAY.md) — Hướng Dẫn Thiết Kế Format Video Essay
- **Mục đích:** Hướng dẫn quy chuẩn đồ họa cho format Video Essay phân tích dài (Spiderum style).

### 2.8. [guides/RESEARCH_PROMPTS_LOG.md](guides/RESEARCH_PROMPTS_LOG.md) — Nhật Ký Audit Ảnh Tư Liệu
- **Trạng thái:** **[🟡 PHASE 1 VERIFIED AUDIT]** Chứa bảng kiểm định 15 ảnh tư liệu cốt lõi cho kịch bản Quang Trung.

### 2.9. [architecture/06_OBSERVABILITY_AND_LOGGING.md](architecture/06_OBSERVABILITY_AND_LOGGING.md) — Unified Structured Logging
- **Mục đích:** Mô tả logger dùng chung đặt tại `@chronoviet/infra/src/logger.ts` (JSON Lines, level filter, correlation ID, redaction secrets) và cách truy vết log toàn monorepo bằng `jq`.

---

## ⚡ 3. Quickstart: Vận Hành Hệ Thống ChronoViet

### Quy Trình Khởi Động 3 Bước:

#### Bước 1: Cài Đặt Dependencies & Cấu Hình Môi Trường
```bash
# 1. Cài đặt monorepo dependencies
pnpm install

# 2. Tạo cấu hình môi trường từ template
cp .env.example .env

# 3. (Tùy chọn) Chọn Chế Độ Vận Hành AI (AI_EXECUTION_MODE trong .env):
# - AI_EXECUTION_MODE=local_only : 100% Local LLM (8092/8094), không dùng Cloud, 0 phí API.
# - AI_EXECUTION_MODE=fallback   : (Mặc định) Ưu tiên Local, tự động fallback sang Cloud khi lỗi/render.
# - AI_EXECUTION_MODE=hybrid     : Chia tải Round-Robin giữa Local và Cloud API Keys.
# - AI_EXECUTION_MODE=cloud_only : 100% Cloud (Agnes/Gemini/OpenRouter), 0% RAM Local, không cần GPU.
```

#### Bước 2: Tải Mô Hình AI Cục Bộ & Khởi Tạo Cơ Sở Dữ Liệu
```bash
# 1. Tải trọng số mô hình GGUF (BGE-M3 1024d, Qwen 3.5 9B, mmproj, Qwen 3.5 4B)
pnpm models:download

# Hoặc tải tùy chọn theo nhu cầu công việc (Granular Downloads):
pnpm models:download:lite     # Chỉ tải BGE-M3 + Qwen Extraction LLM (~2.4 GB)
pnpm models:download:emb      # Chỉ tải BGE-M3 (~605 MB)
pnpm models:download:extract  # Chỉ tải Qwen Extraction LLM (~1.8 GB)
pnpm models:download:llm      # Chỉ tải Qwen 3.5 9B (~5.8 GB)

# 2. Khởi chạy cụm CSDL PostgreSQL pgvector & Redis
pnpm stack:infra

# 3. Khởi tạo schema CSDL 11 bảng chuẩn hóa
pnpm db:init
```

#### Bước 3: Khởi Chạy Toàn Bộ Hệ Thống (1-Lệnh Duy Nhất)
```bash
# [Khuyến nghị] 🚀 1-Click Smart Dev: Tự động khởi động Docker Infra (Postgres+Redis) + Auto AI Detect + Web & Worker
pnpm dev

# Hoặc khởi chạy theo chế độ chuyên biệt:
pnpm dev:full        # Full Stack: Docker Infra + AI Supervisor + VieNeu TTS + Web UI + Worker
pnpm dev:cloud       # Chế độ siêu nhẹ: 0% GPU/RAM máy, Web + Worker với Cloud AI
pnpm dev:data        # Data Ingestion Stack: Postgres + Redis + AI Lite (8090 + 8094)
```

### Bảng Tra Cứu Bộ Lệnh Toàn Hệ Thống:
```bash
# ===============================================================
# 1. BỘ LỆNH THIẾT YẾU HÀNG NGÀY (CORE 4)
# ===============================================================
pnpm dev             # 🚀 Khởi chạy 1-Click: Tự động hạ tầng + AI Detect + Web & Worker
pnpm data:setup      # 📦 Nạp dữ liệu 1-Click: Docker Infra -> DB Init -> Ingest -> Health Audit
pnpm ai              # 🤖 Bảng điều khiển quản lý AI tương tác trực quan
pnpm check           # ✅ Cổng kiểm tra toàn diện: Typecheck -> Lint -> Test -> Build

# ===============================================================
# 2. HẠ TẦNG DOCKER & CONTAINER PROFILES
# ===============================================================
pnpm stack:infra     # Khởi chạy PostgreSQL (pgvector 1024d) & Redis BullMQ
pnpm stack:prod      # Khởi chạy toàn bộ hệ thống Production (Caddy, Postgres, Redis, App, Worker)
pnpm stack:prod:all  # Khởi chạy Production kèm AI Containers (CUDA)
pnpm stack:ai        # Khởi chạy AI Container Cluster
pnpm stack:down      # Dừng toàn bộ Docker containers
pnpm stack:ps        # Xem trạng thái các container
pnpm stack:logs      # Xem logs thời gian thực

# ===============================================================
# 3. QUẢN LÝ DỊCH VỤ AI CỤC BỘ (LOCAL AI STACK)
# ===============================================================
pnpm ai:start        # Bật Full Local AI Stack (8090, 8092, 8094, 8096, 8080)
pnpm ai:lite         # Bật cặp nhẹ Data Ingestion (8090 + 8094) (~3.1 GB RAM)
pnpm ai:emb          # Bật riêng Embedding Engine BGE-M3 (Port 8090)
pnpm ai:extract      # Bật riêng Extraction LLM Qwen-4B (Port 8094)
pnpm ai:rerank       # Bật riêng Cross-Encoder Reranker Qwen-0.6B (Port 8096)
pnpm ai:llm          # Bật riêng Primary LLM / VLM Qwen-9B (Port 8092)
pnpm ai:tts          # Bật riêng VieNeu TTS Microservice (Port 8080)
pnpm ai:status       # Kiểm tra trạng thái các port AI (8090, 8092, 8094, 8096, 8080)
pnpm ai:stop         # Dừng/giải phóng toàn bộ tiến trình AI & TTS, trả lại 100% RAM/VRAM

# ===============================================================
# 4. FAST TYPECHECK & UNIT TESTS THEO PACKAGE
# ===============================================================
pnpm typecheck:spec | :infra | :ingest | :rag | :orchestrator | :vlm | :remotion | :web | :worker
pnpm test:spec | :infra | :ingest | :rag | :orchestrator | :vlm | :remotion | :web | :worker

# ===============================================================
# 5. CƠ SỞ DỮ LIỆU & NẠP TRI THỨC LỊCH SỬ
# ===============================================================
pnpm db:init         # Khởi tạo CSDL & Schema Vector/Graph (pgvector 1024d, 11 bảng)
pnpm db:health       # Audit sức khỏe DB (dangling refs, embeddings, chunks, entities, indexes)
pnpm db:backup       # Sao lưu snapshot CSDL
pnpm db:restore      # Khôi phục CSDL từ snapshot
pnpm db:clean        # Dọn dẹp transactional: xóa trùng lặp, self-loops & dangling relations
pnpm crawl:corpus    # Cào dữ liệu sử liệu từ corpus
pnpm ingest:vector   # Stage 1: Nạp Chunks & Vector Store (BGE-M3 1024d) + Fast NER
pnpm ingest:graph    # Stage 2: Nạp Knowledge Graph Triples bằng LLM 4B
pnpm ingest:knowledge# Nạp trọn gói cả 2 Stage liên hoàn
pnpm rag:chat        # Chatbot tra cứu RAG trên Terminal

# ===============================================================
# 6. VIDEO ENGINE & REMOTION STUDIO
# ===============================================================
pnpm remotion:studio # Mở Remotion Studio UI xem kịch bản (port 9876)
pnpm remotion:render # Render video MP4 qua Remotion CLI

# ===============================================================
# 7. ĐÁNH GIÁ CHẤT LƯỢNG TỪNG MODULE (EVAL)
# ===============================================================
pnpm eval:ingest        # Đánh giá Data Ingestion Master Benchmark
pnpm eval:ner           # Đánh giá Stage 1 Fast NER
pnpm eval:triples       # Đánh giá Stage 2 Knowledge Triples Extraction
pnpm eval:rag           # Đánh giá Chrono-RAG Engine (C0-C10 benchmarks)
pnpm eval:rag:c0 .. :c10# Đánh giá từng tầng RAG riêng biệt (C0 đến C10)
pnpm eval:rag:sys       # Đánh giá System Ablation RAG
pnpm eval:orchestrator  # Đánh giá Multi-Agent Orchestrator Pipeline (A0-A5 + SYS)
pnpm eval:orchestrator:a0 .. :a5 # Đánh giá từng Agent A0 đến A5
pnpm eval:orchestrator:sys # Đánh giá Orchestrator Pipeline End-to-End
pnpm eval:vlm           # Đánh giá VLM Inspector visual quality scoring
pnpm eval:remotion      # Đánh giá Remotion Video Rendering Fidelity
pnpm eval:chat          # Đánh giá Chatbot Dialogue RAG
pnpm eval:video:stage1  # Video Gen Stage 1: Kịch bản & Phân cảnh (Text-Only Preflight siêu tốc)
pnpm eval:video:stage2  # Video Gen Stage 2: Curation Ảnh & VLM Quality (Nối tiếp Stage 1)
pnpm eval:video:golden  # Video Gen Stage 2: Đánh giá độc lập trên Golden Script Fixtures
pnpm eval:video         # Video Gen Master Benchmark (Pre-Render Pipeline)
pnpm eval:all           # Master Benchmark toàn hệ thống (Chatbot + Video Gen)
```

---

## 🗺️ 4. Bản Đồ Tham Chiếu Nhanh (Quick Reference)

| Tôi muốn biết... | Đọc tại |
| :--- | :--- |
| `LayoutMode` nào cần dùng cho scene này? | [specs/EVAL_REMOTION_TECHNICAL_SPEC.md §4.1](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Cách 3 Layer Rendering phối hợp trong `ChronoVideo.tsx`? | [specs/EVAL_REMOTION_TECHNICAL_SPEC.md §2](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Trường nào trong `overlayData` cho `STAT_CARD`? | [specs/EVAL_REMOTION_TECHNICAL_SPEC.md §5.3](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Domain `BATTLE` cần flow component nào? | [specs/REMOTION_CONTENT_FORMATS_SPEC.md §III](specs/REMOTION_CONTENT_FORMATS_SPEC.md) |
| JSON mẫu đầy đủ cho video BIOGRAPHY? | [specs/REMOTION_CONTENT_FORMATS_SPEC.md §IV.1](specs/REMOTION_CONTENT_FORMATS_SPEC.md) |
| Cách dùng `startTime`/`endTime` vs `durationInFrames`? | [specs/EVAL_REMOTION_TECHNICAL_SPEC.md §5.4](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Composition IDs thực tế trong `Root.tsx`? | [specs/EVAL_REMOTION_TECHNICAL_SPEC.md §7](specs/EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Color palette & font cho Video Essay style? | [specs/TEMPLATE_GUIDE_VIDEO_ESSAY.md](specs/TEMPLATE_GUIDE_VIDEO_ESSAY.md) |
| Quy trình tiền xử lý, nạp dữ liệu offline & chuẩn hóa địa danh/nhân vật? | [modules/00_DATA_PREPROCESSING_AND_INGESTION.md](modules/00_DATA_PREPROCESSING_AND_INGESTION.md) |
| Trạng thái hiện tại: Đã implement vs Thiết kế tương lai? | [SystemOverview.md §1 & §2](SystemOverview.md) |
| Lộ trình triển khai 5 giai đoạn & phân tích song song? | [IMPLEMENTATION_PLAN.md §2 & §3](IMPLEMENTATION_PLAN.md) |
| Đặc tả thiết kế UI/UX NotebookLM Workspace & Design System? | [specs/UI_UX_DESIGN_SPECIFICATION.md](specs/UI_UX_DESIGN_SPECIFICATION.md) |
| Ma trận đánh giá KPI & quản trị rủi ro hệ thống? | [IMPLEMENTATION_PLAN.md §4 & §5](IMPLEMENTATION_PLAN.md) |
| Khung đánh giá 2 Giai đoạn Video Gen (Stage 1 Script + Stage 2 Visual)? | [../eval/README.md](../eval/README.md) |
| Cách dùng logger thống nhất, correlation ID, event names, truy vết lỗi? | [architecture/06_OBSERVABILITY_AND_LOGGING.md](architecture/06_OBSERVABILITY_AND_LOGGING.md) |
