# CHRONOVIET DOCUMENTATION PORTAL (TRUNG TÂM TÀI LIỆU DỰ ÁN)

Chào mừng bạn đến với Trung tâm Tài liệu Kỹ thuật và Kiến trúc của dự án **ChronoViet** — Nền tảng EdTech tự động hóa video lịch sử và Chatbot RAG tương tác.

---

## 🗂️ 1. Cấu Trúc & Phân Nhóm Tài Liệu (Documentation Directory)

Tài liệu dự án được tổ chức thành 4 nhóm chính theo tầng kiến trúc, được đánh dấu rõ rệt giữa **[✅ ĐÃ IMPLEMENTED]** (Code Engine đã hoàn thiện) và **[📐 THIẾT KẾ KẾ HOẠCH / ROADMAP]**:

```
d:\Persional_Projects\ChronoViet\docs\
├── 🏛️ architecture/                           [KIẾN TRÚC HỆ THỐNG & HẠ TẦNG KỸ THUẬT]
│   ├── architecture/README.md                 [Tổng quan Kiến trúc Hệ thống & Hạ tầng]
│   ├── architecture/01_ARCHITECTURAL_STYLE.md [Kiểu Kiến trúc: Event-Driven + Decoupled Pipeline]
│   ├── architecture/02_COMMUNICATION_AND_QUEUES.md [Giao tiếp IPC, Message Queue (BullMQ/RabbitMQ)]
│   ├── architecture/03_DATA_STORAGE_AND_CACHE.md [Cơ sở dữ liệu (Postgres pgvector SSOT) & Cache (Redis)]
│   ├── architecture/04_STATE_MANAGEMENT_AND_DEPLOY.md [Quản lý State (LangGraph.js), VPS Docker Compose Caddy Deploy]
│   └── architecture/05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md [Tối ưu Sản xuất & VieNeu TTS Engine]
│
├── ⚙️ modules/                                [CHI TIẾT 5 MÔ-ĐUN XỬ LÝ PIPELINE]
│   ├── modules/README.md                      [Tổng quan 5 Mô-đun Xử lý Dữ liệu]
│   ├── modules/00_DATA_PREPROCESSING_AND_INGESTION.md [Mô-đun 0: Data Preprocessing & Ingestion Engine [✅]]
│   ├── modules/01_CHRONO_RAG_ENGINE.md        [Mô-đun 1: Knowledge Retrieval & Anti-Hallucination [✅]]
│   ├── modules/02_MULTI_AGENT_ORCHESTRATOR.md [Mô-đun 2: Small LLM & Long-Form Script Pipeline v3.2 [📐]]
│   ├── modules/03_VLM_INSPECTOR_AGENT.md      [Mô-đun 3: Visual Quality Control & Fallback System [📐]]
│   └── modules/04_REMOTION_RENDER_ENGINE.md   [Mô-đun 4: 100% Data-Driven Video Pipeline [✅]]
│
├── 🔊 services/vieneu-tts                      [Mô-đun VieNeu TTS Engine Standalone Microservice & Eval [✅ Phase 1]]
│
├── 💻 MACOS_LOCAL_MODEL_OPTIMIZATION.md       [Hướng dẫn Tối ưu hóa Mô hình Local trên macOS (Apple Silicon)]
├── 📘 SystemOverview.md                       [Kiến trúc RAG + Multi-Agent + VLM + Remotion [✅ Engine & TTS / 📐 Agent Roadmap]]
├── 🚀 IMPLEMENTATION_PLAN.md                  [★ Kế hoạch Triển khai, Phân tích Song song & Khung Đánh giá [✅ Phase 1 DONE / 📐 Phase 2-5]]
│
├── ⚙️ EVAL_REMOTION_TECHNICAL_SPEC.md        [★ Source of Truth: 31 LayoutMode, 19 Transition, Zod Schema, 11 Compositions [✅]]
├── 📜 REMOTION_CONTENT_FORMATS_SPEC.md       [Quy chuẩn 5 Domain, Schema Production v4.1, Lego Components [✅]]
└── 🧠 KNOWLEDGE_DATA_GOVERNANCE_SPEC.md      [★ Source of Truth: Quản trị Số lượng, Chất lượng & Giải quyết Xung đột Sử liệu [✅]]
│
├── 🎨 3. HƯỚNG DẪN THIẾT KẾ & VISUAL DESIGN
│   └── TEMPLATE_GUIDE_VIDEO_ESSAY.md          [Bộ nhận diện thị giác Video Essay, Typography [📐 Design Spec]]
│
└── 📜 4. KỊCH BẢN MẪU & RESEARCH LOG
    ├── RESEARCH_PROMPTS_LOG.md                [Nhật ký audit ảnh tư liệu Wikimedia (Phase 1: Quang Trung 15 scenes) [🟡 Audit In Progress]]
    └── script_examples/                      [Tất cả kịch bản chuẩn Schema v4.1 [✅]]
        ├── KICH_BAN_BIOGRAPHY_TRAN_HUNG_DAO.md [Kịch bản Domain BIOGRAPHY: Trần Hưng Đạo (20 nội dung + 1 brand intro = 21 JSON scenes, 405s)]
        ├── KICH_BAN_BATTLE_BACH_DANG_938.md     [Kịch bản Domain BATTLE: Trận Bạch Đằng 938 (20 nội dung + 1 brand intro = 21 JSON scenes, 405s)]
        ├── KICH_BAN_DYNASTY_TRIEU_LY.md          [Kịch bản Domain DYNASTY: Triều Đại Nhà Lý (20 nội dung + 1 brand intro = 21 JSON scenes, 405s)]
        ├── KICH_BAN_MYSTERY_LE_CHI_VIEN.md      [Kịch bản Domain MYSTERY: Vụ Án Lệ Chi Viên (19 scenes, 375s)]
        ├── KICH_BAN_ARTIFACT_TRONG_DONG_NGOC_LU.md [Kịch bản Domain ARTIFACT: Trống Đồng Ngọc Lũ (18 nội dung + 1 brand intro = 19 JSON scenes, 375s)]
        ├── KICH_BAN_QUANG_TRUNG.md              [Kịch bản Legacy: Hoàng đế Quang Trung (24 scenes)]
        ├── KICH_BAN_HAI_BA_TRUNG.md              [Kịch bản Legacy: Khởi nghĩa Hai Bà Trưng (28 scenes)]
        └── KICH_BAN_MONG_CO_DAI_VIET_LAN_2.md   [Kịch bản Legacy: Chống Nguyên Mông Lần 2 (25 scenes, 18 phút)]
```

---

## 📖 2. Tóm Tắt Nhanh Nội Dung Từng Tài Liệu

### 2.1. [SystemOverview.md](SystemOverview.md) — Kiến Trúc Hệ Thống Tổng Quan
- **Mục đích:** Cung cấp cái nhìn toàn cảnh về dự án ChronoViet.
- **Trạng thái:** 
  - **[✅ IMPLEMENTED]:** Remotion Rendering Engine, Zod Data Schema Validation, 19 Components, 31 LayoutModes, 11 Compositions trong `Root.tsx`.
  - **[✅ IMPLEMENTED]:** VieNeu TTS Dual-Layer Microservice + Eval Suite (`services/vieneu-tts/`).
  - **[📐 ROADMAP]:** RAG Engine, Multi-Agent Orchestrator, VLM Inspector Agent (mô hình thiết kế kiến trúc chuẩn bị kết nối với Remotion Engine).

### 2.2. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Kế Hoạch Triển Khai v1.1, Phân Tích Song Song & Khung Đánh Giá `eval/`
- **Mục đích:** Kế hoạch thực thi dự án chi tiết, lộ trình 5 giai đoạn, phân tích khả năng phát triển song song của 4 mô-đun, quy tắc bắt buộc có thư mục `eval/` riêng cho từng mô-đun và bộ hợp đồng giao tiếp Type-Safe giữa các mô-đun (`packages/shared-spec`).
- **Trạng thái:** **[📐 ROADMAP SPECIFICATION v1.1]** Đã xác định rõ Workstream A (RAG), B (VieNeu TTS), C (VLM Inspector) triển khai và tự đánh giá song song bằng bộ `eval/` riêng trước khi hợp nhất ở Workstream D (Orchestrator).

### 2.3. [EVAL_REMOTION_TECHNICAL_SPEC.md](EVAL_REMOTION_TECHNICAL_SPEC.md) — ★ Quy Chuẩn Kỹ Thuật (Source of Truth)
- **Mục đích:** Tài liệu tham chiếu kỹ thuật chi tiết và chính xác nhất cho `packages/remotion-engine/src/`.
- **Trọng tâm:**
  - Mô hình 3 Lớp Rendering (`HistoryBackground` + `HistoryForeground` + `Persistent Overlays`) & cơ chế `TransitionSeries` trong `ChronoVideo.tsx`
  - **31 `LayoutMode`** đầy đủ (11 Pure Image + 20 Pure Code)
  - **19 `TransitionType`**, **4 `FilterStyle`**, **6 `KenBurnsEffect`**
  - Zod Schema (`ChronoVideoSchema`, `TimelineSceneSchema`, `OverlayDataSchema`)
  - **11 Composition** đã đăng ký trong `Root.tsx` (BIOGRAPHY 21 scenes, BATTLE 21 scenes, DYNASTY 21 scenes, MYSTERY 19 scenes, ARTIFACT 19 scenes, Quick Shorts, Modern News + 3 Legacy)

### 2.4. [REMOTION_CONTENT_FORMATS_SPEC.md](REMOTION_CONTENT_FORMATS_SPEC.md) — Quy Chuẩn Định Dạng Nội Dung v4.1
- **Mục đích:** Quy định ranh giới cho AI Agent khi lập kịch bản video.
- **Trọng tâm:** Triết lý "1 Scene = 1 Trạng thái", Bảng mapping 5 Domain lịch sử với Component flow bắt buộc, Schema JSON Production mẫu cho cả 5 domain.
- **Lưu ý Âm thanh & Tải tài nguyên:** Trường `sfxUrl`, `soundEffects[]` & `sceneAudioUrl` được hỗ trợ 100% trong Zod Schema và `ChronoVideo.tsx` render pipeline. Tài nguyên âm thanh SFX & hình ảnh tư liệu được cấu hình nạp trực tiếp qua `media/` hoặc `packages/remotion-engine/public/`.

### 2.5. [TEMPLATE_GUIDE_VIDEO_ESSAY.md](TEMPLATE_GUIDE_VIDEO_ESSAY.md) — Hướng Dẫn Thiết Kế Format Video Essay
- **Mục đích:** Hướng dẫn quy chuẩn đồ họa cho format Video Essay phân tích dài (Spiderum style).
- **Trạng thái:** **[📐 DESIGN SPECIFICATION]** Định hướng thiết kế cho các component mở rộng tương lai (`VideoEssayTitleCard`, `HistoricalQuoteCard`), tuân thủ quy tắc không override code lõi.

### 2.6. [RESEARCH_PROMPTS_LOG.md](RESEARCH_PROMPTS_LOG.md) — Nhật Ký Audit Ảnh Tư Liệu
- **Trạng thái:** **[🟡 PHASE 1 VERIFIED AUDIT]** Chứa bảng kiểm định 15 ảnh tư liệu cốt lõi cho kịch bản Quang Trung. Phụ lục chứa template audit cho các phân cảnh và kịch bản còn lại trong lộ trình Phase 2.

### 2.7. [script_examples/](script_examples) — Kịch Bản Mẫu
- 5 kịch bản chuẩn domain (BIOGRAPHY, BATTLE, DYNASTY, MYSTERY, ARTIFACT) + 3 kịch bản legacy (Quang Trung, Hai Bà Trưng, Mông Cổ lần 2) — **tất cả file đều có JSON template chuẩn Schema v4.1**.

---

## ⚡ 3. Quickstart: Lệnh Render Video Remotion Nhanh (Chạy tại Root Monorepo)

```bash
# 1. Khởi tạo CSDL PostgreSQL pgvector & Relational Graph Schema
pnpm --filter @chronoviet/rag-engine db:init

# 2. Cào TỰ ĐỘNG toàn bộ 15 Thời kỳ Lịch sử Việt Nam
pnpm crawl:all

# 3. Tiền xử lý & Nạp kho tri thức vào CSDL
pnpm --filter @chronoviet/rag-engine ingest:knowledge

# 4. Render các kịch bản domain chuẩn ra MP4 từ root monorepo
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/biography_tran_hung_dao.json -o media/rendered-videos/biography.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/battle_bach_dang_938.json -o media/rendered-videos/battle.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/dynasty_nha_ly.json -o media/rendered-videos/dynasty.mp4
```

---

## 🗺️ 4. Bản Đồ Tham Chiếu Nhanh (Quick Reference)

| Tôi muốn biết... | Đọc tại |
| :--- | :--- |
| `LayoutMode` nào cần dùng cho scene này? | [EVAL_REMOTION_TECHNICAL_SPEC.md §4.1](EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Cách 3 Layer Rendering phối hợp trong `ChronoVideo.tsx`? | [EVAL_REMOTION_TECHNICAL_SPEC.md §2](EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Trường nào trong `overlayData` cho `STAT_CARD`? | [EVAL_REMOTION_TECHNICAL_SPEC.md §5.3](EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Domain `BATTLE` cần flow component nào? | [REMOTION_CONTENT_FORMATS_SPEC.md §III](REMOTION_CONTENT_FORMATS_SPEC.md) |
| JSON mẫu đầy đủ cho video BIOGRAPHY? | [REMOTION_CONTENT_FORMATS_SPEC.md §IV.1](REMOTION_CONTENT_FORMATS_SPEC.md) |
| Cách dùng `startTime`/`endTime` vs `durationInFrames`? | [EVAL_REMOTION_TECHNICAL_SPEC.md §5.4](EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Composition IDs thực tế trong `Root.tsx`? | [EVAL_REMOTION_TECHNICAL_SPEC.md §7](EVAL_REMOTION_TECHNICAL_SPEC.md) |
| Color palette & font cho Video Essay style? | [TEMPLATE_GUIDE_VIDEO_ESSAY.md](TEMPLATE_GUIDE_VIDEO_ESSAY.md) |
| Quy trình tiền xử lý, nạp dữ liệu offline & chuẩn hóa địa danh/nhân vật? | [00_DATA_PREPROCESSING_AND_INGESTION.md](modules/00_DATA_PREPROCESSING_AND_INGESTION.md) |
| Trạng thái hiện tại: Đã implement vs Thiết kế tương lai? | [SystemOverview.md §1 & §2](SystemOverview.md) |
| Lộ trình triển khai 5 giai đoạn & phân tích song song? | [IMPLEMENTATION_PLAN.md §2 & §3](IMPLEMENTATION_PLAN.md) |
| Ma trận đánh giá KPI & quản trị rủi ro hệ thống? | [IMPLEMENTATION_PLAN.md §4 & §5](IMPLEMENTATION_PLAN.md) |
