# ChronoViet 🇻🇳

> **Automated Historical EdTech & Interactive GraphRAG Video Platform**  
> Nền tảng tự động hóa sản xuất video giáo dục lịch sử Việt Nam 100% Data-Driven kết hợp Hệ thống Chatbot RAG tương tác hai chiều & Multi-Agent Pipeline.

---

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm Workspaces](https://img.shields.io/badge/pnpm-monorepo-orange.svg)](https://pnpm.io/)
[![Remotion Engine](https://img.shields.io/badge/Remotion-v4-blue.svg)](https://www.remotion.dev/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791.svg)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg)](https://www.docker.com/)

---

## 📌 1. Giới Thiệu (Overview)

**ChronoViet** (*Chronology + Việt Nam*) giải quyết bài toán sấy khô kiến thức lịch sử bằng cách biến nguồn tri thức lịch sử Việt Nam dạng văn bản thành các **Video tóm tắt trực quan tự động** kết hợp **Hệ thống Chatbot RAG tương tác hai chiều**.

Dự án ứng dụng mô hình **Decoupled Event-Driven Architecture** với 4 mô-đun xử lý chuyên biệt:
1. **Hybrid GraphRAG Engine**: Đảm bảo tri thức lịch sử chính xác, loại bỏ hoàn toàn hiện tượng suy đoán sai (hallucination).
2. **Multi-Agent Orchestrator (LangGraph.js)**: Lập kịch bản video chi tiết, phân chia phân cảnh & chọn bố cục trực quan phù hợp.
3. **VLM Inspector Agent (Gemini 2.5 Flash / CLIP)**: Kiểm định bối cảnh lịch sử của tư liệu hình ảnh & thẩm định giấy phép bản quyền.
4. **Remotion Render Engine**: Engine render video MP4 100% Data-Driven từ Zod JSON Schema v3.0/v3.2.

---

## ✨ 2. Tính Năng Nổi Bật (Key Features)

* 🎬 **100% Data-Driven Remotion Video Engine**: Render video chất lượng cao từ file JSON mà không cần sửa code React.
* 📐 **18 LayoutModes & 15 TransitionTypes**: Hỗ trợ 7 bố cục hình ảnh tư liệu & 11 bố cục lập trình đồ họa (Pure Code), 4 hiệu ứng bộ lọc màu (*Historical, Sepia, Monochrome, Vivid*) và hiệu ứng camera Ken Burns.
* 🏛️ **5 Miền Nội Dung Lịch Sử (Domains)**: Quy chuẩn kịch bản chuẩn cho *BIOGRAPHY* (Nhân vật), *BATTLE* (Chiến dịch), *DYNASTY* (Triều đại), *MYSTERY* (Bí ẩn/Vụ án) và *ARTIFACT* (Bảo vật quốc gia).
* 🔍 **Thẩm Định Lịch Sử Bằng VLM**: Loại bỏ ảnh phim cổ trang sai bối cảnh, ảnh dính watermark hoặc logo thương mại; tự động chuyển sang layout Pure Code nếu ảnh không đạt tiêu chuẩn.
* 🎙️ **Self-Hosted VieNeu Neural TTS**: Giọng đọc thuyết minh truyền cảm với word-level timestamps cho hiệu ứng chữ Karaoke.
* 🛡️ **Type-Safe Monorepo System**: Định nghĩa hợp đồng dữ liệu chuẩn hóa qua `@chronoviet/shared-spec` bằng Zod runtime validation.

---

## 🏗️ 3. Cấu Trúc Dự Án (Monorepo Architecture)

Dự án được tổ chức dạng **pnpm Workspace Monorepo**:

```text
ChronoViet/
├── apps/
│   ├── render-worker/           # Background Job Worker (BullMQ + Redis) (+ eval/)
│   └── web/                     # Frontend Dashboard & REST/WebSocket API Server
│
├── packages/
│   ├── agent-orchestrator/      # [📐 ROADMAP] LangGraph.js Multi-Agent Pipeline (+ eval/)
│   ├── rag-engine/              # [📐 ROADMAP] GraphRAG Engine (pgvector) (+ eval/)
│   ├── remotion-engine/         # [✅ READY] Remotion Render Engine & Studio (+ eval/ test suite)
│   ├── shared-spec/             # [✅ READY] Zod Schemas & Data Contracts (SSOT)
│   └── vlm-inspector/           # [📐 ROADMAP] Gemini 2.5 VLM & CLIP Inspector (+ eval/)
│
├── services/
│   └── vieneu-tts/              # [📐 ROADMAP] VieNeu ONNX Neural TTS Service (+ eval/)
│
├── eval/                        # [📐 ROADMAP] Tầng Đánh Giá Tập Trung (E2E Integration Benchmark & Golden Datasets)
├── docs/                        # Trung tâm Tài liệu Kỹ thuật & Kiến trúc (Documentation Portal)
│   ├── architecture/            # Tài liệu Kiến trúc Hệ thống, Data Storage & Caching
│   ├── modules/                 # Tài liệu Chi tiết 4 Mô-đun Chức năng
│   └── script_examples/         # Các Kịch bản Mẫu Lịch sử Chuẩn (Markdown/JSON)
├── media/                       # Local Mount Volume cho media assets (/raw-assets, /rendered-videos, /license-snapshots)
├── docker-compose.yml           # Cấu hình Hạ tầng Docker (Postgres pgvector, Redis, Caddy Proxy)
└── Caddyfile                    # Cấu hình Reverse Proxy & Serving Static Media Assets
```

### Chi Tiết Phân Nhóm Mô-đun (Packages & Apps):

| Package / App | Vai Trò | Trạng Thái | Thư Mục Eval |
| :--- | :--- | :---: | :---: |
| [`@chronoviet/remotion-engine`](file:///d:/Persional_Projects/ChronoViet/packages/remotion-engine) | Engine render video Remotion v4, 18 LayoutModes, 13 Components, 8 Compositions | **✅ Ready** | `packages/remotion-engine/eval/` |
| [`@chronoviet/shared-spec`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec) | Nguồn sự thật duy nhất (SSOT) cho Zod Schemas & Data Contracts | **✅ Ready** | N/A (Shared Spec) |
| [`@chronoviet/rag-engine`](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine) | Truy xuất tri thức lịch sử với PostgreSQL pgvector & Relational Graph CTEs | **📐 Roadmap** | `packages/rag-engine/eval/` |
| [`@chronoviet/agent-orchestrator`](file:///d:/Persional_Projects/ChronoViet/packages/agent-orchestrator) | Đội ngũ Multi-Agent LangGraph.js chia phân cảnh & biên tập kịch bản | **📐 Roadmap** | `packages/agent-orchestrator/eval/` |
| [`@chronoviet/vlm-inspector`](file:///d:/Persional_Projects/ChronoViet/packages/vlm-inspector) | Thẩm định hình ảnh tư liệu & lọc bản quyền (PD, CC0, CC-BY) | **📐 Roadmap** | `packages/vlm-inspector/eval/` |
| [`@chronoviet/vieneu-tts`](file:///d:/Persional_Projects/ChronoViet/services/vieneu-tts) | Dịch vụ tổng hợp giọng nói thuyết minh Neural TTS (VieNeu ONNX) | **📐 Roadmap** | `services/vieneu-tts/eval/` |
| [`@chronoviet/render-worker`](file:///d:/Persional_Projects/ChronoViet/apps/render-worker) | Tiến trình xử lý hàng đợi render video bất đồng bộ (BullMQ + Redis) | **📐 Roadmap** | `apps/render-worker/eval/` |
| [`@chronoviet/web`](file:///d:/Persional_Projects/ChronoViet/apps/web) | Giao diện người dùng Web Dashboard & Chatbot RAG | **📐 Roadmap** | `apps/web/` |

---

### 💾 3.1. Kiến Trúc Lưu Trữ Dữ Liệu & Hybrid Evaluation Architecture

Hệ thống **ChronoViet** thiết kế rạch ròi giữa dữ liệu vận hành (Production Data) và dữ liệu kiểm thử trong mã nguồn (Dev/Eval Data):

1. **Môi Trường Production (100% Stateless Codebase):**
   * **Database SSOT (PostgreSQL 15+ `pgvector`)**: Lưu người dùng, tri thức RAG (`document_chunks`), trạng thái kịch bản (`video_projects`), LangGraph checkpoints, lịch sử audit VLM và render jobs.
   * **Redis**: Lưu BullMQ Task Queues và bộ đệm đa tầng (LLM Prompts, RAG context, VLM Scores).
   * **Mount Volume `/media`**: Lưu trữ ảnh crawl, audio giọng đọc WAV từ TTS, license snapshots và video MP4 đầu ra.
2. **Môi Trường Development & Evaluation (Hybrid Evaluation Model):**
   * **Tầng Độc Lập (Unit/Module Eval)**: Mỗi mô-đun đều có thư mục `eval/` riêng (`packages/agent-orchestrator/eval/`, `packages/rag-engine/eval/`, `packages/remotion-engine/eval/`, `packages/vlm-inspector/eval/`, `services/vieneu-tts/eval/`, `apps/render-worker/eval/`). Giúp developer chạy benchmark nhanh độc lập từng module mà không tốn tài nguyên load toàn bộ hệ thống.
   * **Tầng Tập Trung (End-to-End Pipeline Eval)**: Nằm tại thư mục `eval/` ở Root Monorepo. Chứa **Golden Datasets** chuẩn để chạy Integration Benchmark toàn bộ luồng tích hợp (từ Prompt RAG -> Script JSON -> VLM Audit -> TTS Audio -> Remotion Render MP4).


---

## 🚀 4. Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Quickstart)

### Yêu cầu hệ thống:
* **Node.js**: `>= 20.0.0`
* **pnpm**: `>= 9.0.0`
* **Docker & Docker Compose** *(cho hạ tầng cơ sở dữ liệu)*

### Bước 1: Clone Repository & Cài Đặt Dependencies

```bash
git clone https://github.com/TCTri205/ChronoViet.git
cd ChronoViet

# Cài đặt tất cả các gói phụ thuộc trong monorepo
pnpm install
```

### Bước 2: Kiểm Tra & Khởi Tạo Assets

```bash
# Kiểm tra TypeScript trên toàn bộ monorepo (đảm bảo 0 lỗi)
pnpm typecheck

# Chuẩn bị file asset âm thanh & hiệu ứng cho Remotion Engine
pnpm --filter @chronoviet/remotion-engine setup-assets
```

### Bước 3: Xem Preview & Render Video Chi Tiết

#### 1. Xem Trực Quan Trên Remotion Studio:
```bash
pnpm remotion:studio
```
*Trình duyệt sẽ tự động mở Remotion Studio tại `http://localhost:3000` để bạn xem trực quan 18 LayoutModes, 15 Transitions và hiệu ứng chuyển cảnh real-time.*

#### 2. Chạy Suite Kiểm Định & Đánh Giá Kịch Bản Mẫu (Eval Runner):
```bash
# Chạy eval runner để thẩm định Zod Schema v3.0 & render frame ảnh minh họa cho 9 kịch bản mẫu
pnpm --filter @chronoviet/remotion-engine eval
```

#### 3. Render Các Kịch Bản Mẫu Chuẩn ra Video MP4:
```bash
# Render kịch bản Nhân vật (Trần Hưng Đạo - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/biography_tran_hung_dao.json -o media/rendered-videos/biography.mp4

# Render kịch bản Chiến dịch (Bạch Đằng 938 - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/battle_bach_dang_938.json -o media/rendered-videos/battle.mp4

# Render kịch bản Triều đại (Triều Nhà Lý - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/dynasty_nha_ly.json -o media/rendered-videos/dynasty.mp4

# Render kịch bản Vụ án / Bí ẩn (Vụ án Lệ Chi Viên - 19 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/mystery_le_chi_vien.json -o media/rendered-videos/mystery.mp4

# Render kịch bản Bảo vật quốc gia (Trống Đồng Ngọc Lũ - 19 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/artifact_trong_dong_ngoc_lu.json -o media/rendered-videos/artifact.mp4
```

---

## 🐳 5. Triển Khai Hạ Tầng Qua Docker Compose

Hệ thống được cấu hình sẵn với `docker-compose.yml` phục vụ môi trường Production / VPS:

```bash
# Khởi chạy toàn bộ hạ tầng (Postgres pgvector, Redis, Caddy Proxy, App Server, Worker)
docker compose up -d --build
```

Dịch vụ chạy tại:
* **Caddy Reverse Proxy**: `http://localhost` (Port 80 / 443)
* **PostgreSQL (pgvector)**: `127.0.0.1:5432`
* **Redis**: `127.0.0.1:6379`

---

## 📚 6. Trung Tâm Tài Liệu Dự Án (Documentation Portal)

Toàn bộ tài liệu thiết kế kiến trúc và quy chuẩn kỹ thuật nằm tại thư mục [`docs/`](file:///d:/Persional_Projects/ChronoViet/docs):

* 📑 [**Documentation Portal (`docs/README.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/README.md): Bản đồ tra cứu tài liệu tổng quan.
* 🏛️ [**System Overview (`docs/SystemOverview.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/SystemOverview.md): Kiến trúc RAG + Multi-Agent + VLM + Remotion.
* ⚙️ [**Remotion Technical Spec (`docs/EVAL_REMOTION_TECHNICAL_SPEC.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/EVAL_REMOTION_TECHNICAL_SPEC.md): Hướng dẫn chi tiết 18 LayoutModes, 15 Transitions, Zod Schema & Compositions.
* 📜 [**Content Formats Spec (`docs/REMOTION_CONTENT_FORMATS_SPEC.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/REMOTION_CONTENT_FORMATS_SPEC.md): Quy chuẩn 5 Domain lịch sử & Schema Production v3.0.
* 🗺️ [**Implementation Plan (`docs/IMPLEMENTATION_PLAN.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/IMPLEMENTATION_PLAN.md): Lộ trình 5 giai đoạn phát triển & bộ đánh giá `eval/`.
* 🎨 [**Video Essay Design Guide (`docs/TEMPLATE_GUIDE_VIDEO_ESSAY.md`)**](file:///d:/Persional_Projects/ChronoViet/docs/TEMPLATE_GUIDE_VIDEO_ESSAY.md): Bộ nhận diện thị giác & thiết kế đồ họa.

---

## 📄 7. Giấy Phép (License)

Dự án thuộc sở hữu riêng của **ChronoViet Team**. Mọi quyền được bảo lưu.
