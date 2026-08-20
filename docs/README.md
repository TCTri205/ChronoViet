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
  - **[✅ IMPLEMENTED]:** VieNeu TTS Dual-Layer Microservice + Eval Suite (`services/vieneu-tts/`).
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
- **Mục đích:** Mô tả logger dùng chung đặt tại `@chronoviet/shared-spec/src/logger.ts` (JSON Lines, level filter, correlation ID, redaction secrets) và cách truy vết log toàn monorepo bằng `jq`.

---

## ⚡ 3. Quickstart: Vận Hành Hệ Thống ChronoViet

### Quy Trình Khởi Động 3 Bước:

#### Bước 1: Cài Đặt Dependencies & Cấu Hình Môi Trường
```bash
# 1. Cài đặt monorepo dependencies
pnpm install

# 2. Tạo cấu hình môi trường từ template
cp .env.example .env
```

#### Bước 2: Tải Mô Hình AI Cục Bộ & Khởi Tạo Cơ Sở Dữ Liệu
```bash
# 1. Tải trọng số mô hình GGUF (BGE-M3 1024d, Qwen3.8-27B, mmproj, Qwen3.5-4B)
pnpm models:download

# Hoặc tải tùy chọn theo nhu cầu công việc (Granular Downloads):
pnpm models:download:lite     # Chỉ tải BGE-M3 + Qwen Extraction LLM (~2.4 GB)
pnpm models:download:emb      # Chỉ tải BGE-M3 (~605 MB)
pnpm models:download:extract  # Chỉ tải Qwen Extraction LLM (~1.8 GB)
pnpm models:download:llm      # Chỉ tải Qwen 27B/32B (~18.5 GB)

# 2. Khởi chạy cụm CSDL PostgreSQL pgvector & Redis
pnpm stack:infra

# 3. Khởi tạo schema CSDL 7 bảng chuẩn hóa
pnpm db:init
```

#### Bước 3: Khởi Chạy Toàn Bộ Hệ Thống (1-Lệnh Duy Nhất)
```bash
# [Khuyến nghị] Khởi chạy trọn gói: Docker Infra + AI Supervisor + VieNeu TTS + Web UI + Worker
pnpm dev:stack

# Hoặc khởi chạy theo Profile công việc tối ưu tài nguyên (Daily Dev Profiles):
pnpm dev:hybrid      # Web + Worker với Cloud AI fallback (0% RAM/GPU AI Local)
pnpm dev:data        # Postgres + Redis + AI Lite (Embedding + Extraction) cho Data/Crawler
```

### Bảng Tra Cứu Bộ Lệnh Toàn Hệ Thống:
```bash
# ===============================================================
# 1. PHÁT TRIỂN & ĐIỀU PHỐI HỆ THỐNG
# ===============================================================
pnpm dev:stack                                  # 1-Lệnh khởi động trọn gói: Docker Infra + AI Supervisor + TTS + Web + Worker
pnpm dev:hybrid                                 # Khởi động Web + Worker với Cloud AI fallback (0% RAM/GPU AI Local)
pnpm dev:data                                   # Khởi động Postgres + Redis + AI Lite (Embedding + Extraction) cho Data/Crawler
pnpm dev                                        # Chạy song song Web App (port 3000) và Render Worker
pnpm dev:web                                    # Chạy riêng Web App Next.js (port 3000)
pnpm dev:worker                                 # Chạy riêng BullMQ Video Render Worker (port 3001)

# ===============================================================
# 2. HẠ TẦNG DOCKER & COMPOSE PROFILES
# ===============================================================
pnpm stack:infra                                # Khởi chạy cụm Postgres (pgvector) & Redis Cache
pnpm stack:prod                                 # Khởi chạy cụm Production Containers (DB, Redis, TTS, App, Worker, Caddy)
pnpm stack:prod:all                             # Khởi chạy Full Stack Production bao gồm cả Local CUDA LLM & Embedding (Linux GPU)
pnpm stack:ai                                   # Khởi chạy containers llama.cpp CUDA (LLM 8092 + Embedding 8090)
pnpm stack:tts                                  # Khởi chạy microservice VieNeu TTS Container
pnpm stack:down                                 # Dừng và giải phóng toàn bộ containers Docker
pnpm stack:ps                                   # Xem trạng thái sống của containers
pnpm stack:logs                                 # Xem stream logs containers thời gian thực

# ===============================================================
# 3. QUẢN LÝ MÔ HÌNH AI & SUPERVISOR (GRANULAR AI CONTROL)
# ===============================================================
pnpm models:download                            # Tải và xác thực model weights GGUF tiêu chuẩn
pnpm models:download:lite                       # Chỉ tải BGE-M3 + Qwen Extraction LLM (~2.4 GB)
pnpm models:download:emb                        # Chỉ tải BGE-M3 (~605 MB)
pnpm models:download:extract                    # Chỉ tải Qwen Extraction LLM (~1.8 GB)
pnpm models:download:llm                        # Chỉ tải Qwen 27B/32B (~18.5 GB)
pnpm ai                                         # [Tương tác] Xem trạng thái các port (8090, 8092, 8094, 8080) & model đã nạp
pnpm ai:start                                   # Khởi chạy Full Local AI Stack (Embedding 8090 + Extraction 8094 + LLM 27B 8092)
pnpm ai:lite                                    # Chạy cặp đôi AI Lite: Embedding (8090) + Extraction (8094) (~3.1GB RAM)
pnpm ai:emb                                     # Chỉ chạy Embedding Server (Port 8090, BGE-M3 ~600MB) cho Vector Search
pnpm ai:extract                                 # Chỉ chạy Extraction LLM (Port 8094, Qwen 4B ~2.5GB) cho Triples/Crawler
pnpm ai:llm                                     # Chỉ chạy Chat/Agent LLM (Port 8092, Qwen 27B)
pnpm ai:tts                                     # Khởi chạy microservice VieNeu TTS FastAPI trong Docker (Port 8080)
pnpm ai:stop                                    # Dừng/giải phóng toàn bộ tiến trình AI & TTS (host & Docker), trả lại 100% RAM/VRAM
pnpm ai:supervisor                              # Daemon giám sát llama-server: auto-evict RAM khi idle, JIT wake-up, giải phóng port

# ===============================================================
# 4. CƠ SỞ DỮ LIỆU & NẠP TRI THỨC LỊCH SỬ
# ===============================================================
pnpm db:init                                    # Khởi tạo CSDL & Schema Vector/Graph (pgvector 1024d)
pnpm db:health                                  # Audit sức khỏe DB (dangling refs, embeddings, chunks, entities, indexes)
pnpm db:clean                                   # Dọn dẹp transactional: xóa trùng lặp, self-loops & dangling relations
pnpm db:audit-quarantine                        # Audit & xem danh sách cạnh cách ly / thực thể chưa ánh xạ (Quarantine Buffer)
pnpm db:audit-quarantine --dry-run              # Chạy kiểm toán thử nghiệm mô phỏng không ghi CSDL
pnpm db:audit-quarantine --accept-all-high-conf --threshold=0.85 # Thăng cấp cạnh đạt chuẩn vào Graph & ghi entity_audit_logs
pnpm db:audit-quarantine --purge-spurious       # Thanh lọc cạnh rác/từ chối & thực thể nhiễu khỏi buffer
pnpm crawl:corpus                               # Cào dữ liệu sử liệu từ corpus
pnpm crawl:all                                  # Cào toàn bộ 15 thời kỳ lịch sử
pnpm crawl:pdf                                  # Nạp dữ liệu từ PDF scan
pnpm extract:pdf                                # Trích xuất PDF sang Markdown
pnpm ingest:knowledge                           # Nạp tri thức vào CSDL & trích xuất Triples
pnpm rag:re-resolve                             # Hợp giải thực thể mâu thuẫn & ghi audit logs
pnpm rag:chat                                   # Chatbot tra cứu RAG trên Terminal

# ===============================================================
# 5. VIDEO ENGINE & REMOTION STUDIO
# ===============================================================
pnpm setup-assets                               # Tải và đồng bộ fonts chữ, tư liệu đồ họa di sản
pnpm remotion:studio                            # Mở Remotion Studio UI xem kịch bản (port 9876)
pnpm remotion:render                            # Render video MP4 qua Remotion CLI
pnpm remotion:render:quangtrung                 # Render video mẫu: Đại phá quân Thanh (Quang Trung)
pnpm remotion:render:haibatrung                 # Render video mẫu: Khởi nghĩa Hai Bà Trưng
pnpm remotion:render:mongolviet2                # Render video mẫu: Kháng chiến chống Nguyên Mông lần 2

# ===============================================================
# 6. ĐÁNH GIÁ TỔNG THỂ & CHUỖI TÍCH HỢP (EVAL)
# ===============================================================
pnpm eval:clean                                 # Dọn dẹp artifact rác, file tạm & port treo
pnpm eval:all --fresh                           # Đánh giá toàn diện Monorepo với lifecycle sạch
pnpm eval:chain                                 # Đánh giá chuỗi TTS -> Remotion Engine
pnpm eval:seed                                  # Tạo dữ liệu mẫu cho benchmark
pnpm eval:ingest                                # Đánh giá chất lượng trích xuất RAG chunks
pnpm eval:orchestrator                          # Đánh giá Agent Orchestrator Pipeline
pnpm eval:research                              # Đánh giá Agent nghiên cứu hình ảnh
pnpm eval:tts                                   # Đánh giá VieNeu TTS Engine
pnpm eval:remotion                              # Đánh giá Remotion Video Engine

# ===============================================================
# 7. VERIFICATION & CI/CD QUALITY GATES
# ===============================================================
pnpm check:all                                  # [Master Gate] typecheck -> lint -> test -> build
pnpm typecheck                                  # Kiểm tra TypeScript toàn dự án (0 lỗi)
pnpm lint                                       # Kiểm tra Formatting & Lints
pnpm test                                       # Unit Tests trên src/ (CI Gate)
pnpm build                                      # Build toàn bộ packages & apps
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
| Cách dùng logger thống nhất, correlation ID, event names, truy vết lỗi? | [architecture/06_OBSERVABILITY_AND_LOGGING.md](architecture/06_OBSERVABILITY_AND_LOGGING.md) |
