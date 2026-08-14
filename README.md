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

Dự án ứng dụng mô hình **Decoupled Event-Driven Architecture** với 5 mô-đun xử lý chuyên biệt:
0. **Data Preprocessing & Ingestion Engine [✅]**: Nạp tri thức lịch sử offline, cào tự động toàn bộ 15 thời kỳ lịch sử (`pnpm crawl:all`), làm sạch lỗi OCR, chuẩn hóa địa danh qua các thời kỳ (`SAME_AS_LOCATION`), khử nhập nhằng nhân vật (`ALIAS_OF`), Dynamic Hierarchical Chunking, nạp PostgreSQL pgvector (1024d BGE-M3 + FTS BM25), Relational Graph & Append-Only Audit Trail (`entity_audit_logs`).
1. **Hybrid GraphRAG Engine [✅]**: Động cơ tìm kiếm kết hợp Knowledge Graph + Dense Vector BGE-M3 + Sparse BM25 + Recursive CTE Subgraph Search + BGE Reranker v2. Đảm bảo tri thức lịch sử chính xác 100%, loại bỏ hoàn toàn suy đoán sai (Hallucination Rate 0%).
2. **Multi-Agent Orchestrator (LangGraph.js) [✅]**: Lập kịch bản video chi tiết, phân chia phân cảnh & chọn bố cục trực quan phù hợp, tích hợp NLI Entailment Hallucination Judge & Folklore Guardrail Gate.
3. **VLM Inspector Agent (Gemini 2.5 Flash / CLIP) [📐]**: Kiểm định bối cảnh lịch sử của tư liệu hình ảnh & thẩm định giấy phép bản quyền.
4. **Remotion Render Engine [✅]**: Engine render video MP4 100% Data-Driven từ Zod JSON Schema v4.1.

---

## ✨ 2. Tính Năng Nổi Bật (Key Features)

* 👑 **Master Historical Corpus Crawler**: Cào tự động 100% tài liệu tri thức phủ rộng qua **15 Thời Kỳ Lịch Sử Việt Nam** chuẩn hóa trong 1 câu lệnh (`pnpm crawl:all`).
* 🎬 **100% Data-Driven Remotion Video Engine**: Render video chất lượng cao từ file JSON mà không cần sửa code React.
* 📐 **31 LayoutModes & 19 TransitionTypes**: Hỗ trợ 11 bố cục hình ảnh tư liệu & 20 bố cục lập trình đồ họa (Pure Code), 4 hiệu ứng bộ lọc màu (*Historical, Sepia, Monochrome, Vivid*) và hiệu ứng camera Ken Burns.
* 🏛️ **5 Miền Nội Dung Lịch Sử (Domains)**: Quy chuẩn kịch bản chuẩn cho *BIOGRAPHY* (Nhân vật), *BATTLE* (Chiến dịch), *DYNASTY* (Triều đại), *MYSTERY* (Bí ẩn/Vụ án) và *ARTIFACT* (Bảo vật quốc gia).
* 🛡️ **Tự Động Bảo Đảm Giọng Văn Dã Sử (Folklore Guardrail Gate)**: Tự động bắt lỗi Regex Pattern Matching và yêu cầu LLM dùng giọng văn giả thuyết cho nguồn tin Level 3/Dã sử.
* 🎙️ **Self-Hosted VieNeu Neural TTS**: Giọng đọc thuyết minh truyền cảm với word-level timestamps cho hiệu ứng chữ Karaoke.
* 🔒 **Type-Safe Monorepo System**: Định nghĩa hợp đồng dữ liệu chuẩn hóa qua `@chronoviet/shared-spec` bằng Zod runtime validation.

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
│   ├── agent-orchestrator/      # [✅ READY] LangGraph.js Multi-Agent Pipeline & Guardrails (+ eval/)
│   ├── rag-engine/              # [✅ READY] Data Ingestion ETL (Mô-đun 0) & Chrono-RAG Engine (Mô-đun 1) (+ eval/)
│   ├── remotion-engine/         # [✅ READY] Remotion Render Engine & Studio (+ eval/ test suite)
│   ├── shared-spec/             # [✅ READY] Zod Schemas & Data Contracts (SSOT)
│   └── vlm-inspector/           # [📐 ROADMAP] Gemini 2.5 VLM & CLIP Inspector (+ eval/)
│
├── services/
│   └── vieneu-tts/              # [✅ READY] VieNeu ONNX Neural TTS Service (+ eval/)
│
├── eval/                        # Tầng Đánh Giá Tập Trung (E2E Integration Benchmark & Golden Datasets)
├── docs/                        # Trung tâm Tài liệu Kỹ thuật & Kiến trúc (Documentation Portal)
│   ├── architecture/            # Tài liệu Kiến trúc Hệ thống, Data Storage & Caching
│   ├── modules/                 # Tài liệu Chi tiết 5 Mô-đun Xử lý
│   └── KNOWLEDGE_DATA_GOVERNANCE_SPEC.md # Master Source of Truth về Quản trị Dữ liệu RAG v1.5
├── media/                       # Local Mount Volume cho media assets (/raw-assets, /rendered-videos, /license-snapshots)
├── docker-compose.yml           # Cấu hình Hạ tầng Docker (Postgres pgvector, Redis, Caddy Proxy)
└── Caddyfile                    # Cấu hình Reverse Proxy & Serving Static Media Assets
```

### Chi Tiết Phân Nhóm Mô-đun (Packages & Apps):

| Package / App | Vai Trò | Trạng Thái | Thư Mục Eval |
| :--- | :--- | :---: | :---: |
| [`@chronoviet/shared-spec`](packages/shared-spec) | Nguồn sự thật duy nhất (SSOT) cho Zod Schemas & Data Contracts | **✅ Ready** | N/A (Shared Spec) |
| [`@chronoviet/rag-engine`](packages/rag-engine) | Data Ingestion ETL (Mô-đun 0) & Chrono-RAG Engine (Mô-đun 1) PostgreSQL pgvector + Graph | **✅ Ready** | `packages/rag-engine/eval/` |
| [`@chronoviet/agent-orchestrator`](packages/agent-orchestrator) | Đội ngũ Multi-Agent LangGraph.js chia phân cảnh, NLI Judge & Folklore Guardrail Gate | **✅ Ready** | `packages/agent-orchestrator/eval/` |
| [`@chronoviet/remotion-engine`](packages/remotion-engine) | Engine render video Remotion v4, 31 LayoutModes, 19 Components, 11 Compositions | **✅ Ready** | `packages/remotion-engine/eval/` |
| [`@chronoviet/vieneu-tts`](services/vieneu-tts) | Dịch vụ tổng hợp giọng nói thuyết minh Neural TTS (VieNeu ONNX) | **✅ Ready** | `services/vieneu-tts/eval/` |
| [`@chronoviet/vlm-inspector`](packages/vlm-inspector) | Thẩm định hình ảnh tư liệu & lọc bản quyền (PD, CC0, CC-BY) | **📐 Roadmap** | `packages/vlm-inspector/eval/` |
| [`@chronoviet/render-worker`](apps/render-worker) | Tiến trình xử lý hàng đợi render video bất đồng bộ (BullMQ + Redis) | **📐 Roadmap** | `apps/render-worker/eval/` |
| [`@chronoviet/web`](apps/web) | Giao diện người dùng Web Dashboard & Chatbot RAG | **📐 Roadmap** | `apps/web/` |

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

### Bước 2: Khởi Tạo CSDL & Cào Dữ Liệu Tự Động 15 Thời Kỳ (`pnpm crawl:all`)

```bash
# 1. Khởi tạo PostgreSQL pgvector & Relational Graph Schema
pnpm --filter @chronoviet/data-ingestion db:init

# 2. Cào tự động toàn bộ 15 Thời kỳ Lịch sử Việt Nam trong 1 lệnh
pnpm crawl:all

# 3. Tiền xử lý & Nạp kho tri thức vào CSDL PostgreSQL
pnpm --filter @chronoviet/data-ingestion ingest:knowledge

# 4. Kiểm định chất lượng nạp dữ liệu (Entity Normalization Accuracy > 98%)
pnpm eval:ingest

# 5. Trải nghiệm Chatbot RAG tương tác trực tiếp trên Terminal CLI
pnpm rag:chat
```

### Bước 3: Xem Preview & Render Video Chi Tiết

#### 1. Xem Trực Quan Trên Remotion Studio:
```bash
pnpm remotion:studio
```
*Trình duyệt sẽ tự động mở Remotion Studio tại `http://localhost:9876` để bạn xem trực quan 31 LayoutModes, 19 Transitions và hiệu ứng chuyển cảnh real-time.*

#### 2. Chạy Suite Kiểm Định & Đánh Giá Kịch Bản Mẫu (Eval Runner & Clean Lifecycle):
```bash
# Dọn dẹp sạch toàn bộ audio rác, báo cáo cũ & port bị chiếm giữ:
pnpm eval:clean

# Chạy eval runner thẩm định Zod Schema v4.1 & metrics:
pnpm --filter @chronoviet/remotion-engine eval -- --fresh

# Chạy toàn bộ Master Global Eval Monorepo:
pnpm eval:all --fresh
```

#### 3. Render Các Kịch Bản Mẫu Chuẩn ra Video MP4:
```bash
# Render kịch bản Nhân vật (Trần Hưng Đạo - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/biography_tran_hung_dao.json -o media/rendered-videos/biography.mp4

# Render kịch bản Chiến dịch (Bạch Đằng 938 - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/battle_bach_dang_938.json -o media/rendered-videos/battle.mp4

# Render kịch bản Triều đại (Triều Nhà Lý - 21 scenes)
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/dynasty_nha_ly.json -o media/rendered-videos/dynasty.mp4
```

---

## 🔄 5. CI/CD (GitHub Actions)

Pipeline tự động chạy trên **mọi Pull Request và push lên `main`** — tất cả quality gates bắt buộc phải PASS trước khi merge:

| Job | Nội dung |
| :--- | :--- |
| **Lint** | `pnpm lint` (tsc `--noEmit` recursive) |
| **Typecheck** | `pnpm typecheck` + `pnpm typecheck:extras` (eval & scripts) |
| **Unit Tests** | `pnpm test` (vitest recursive — chỉ chạy `src/__tests__`, eval bị exclude) |
| **Build** | `pnpm build` (build toàn bộ monorepo) |
| **Security Audit** | `pnpm audit --audit-level=high` |
| **Integration** | Postgres pgvector + Redis services → `pnpm db:init` → `verify-db-health.ts` |

> **Eval suite (`pnpm eval:*`) không nằm trong CI** — là các benchmark phi-deterministic (chất lượng AI/RAG/render), chạy thủ công theo hướng dẫn ở mục 4. Unit test của eval-infra (metric functions) chạy riêng qua `pnpm test:eval`, tách hẳn khỏi `pnpm test`.

Chạy tương đương cục bộ:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Dependency updates tự động qua Dependabot (`npm` + `github-actions`, hàng tuần).

---

## 🐳 6. Triển Khai Hạ Tầng Qua Docker Compose

Hệ thống được cấu hình sẵn với `docker-compose.yml` phục vụ môi trường Production / VPS:

```bash
# Khởi chạy toàn bộ hạ tầng (Postgres pgvector, Redis, Caddy Proxy, App Server, Worker)
docker compose up -d --build
```

---

## 📚 7. Trung Tâm Tài Liệu Dự Án (Documentation Portal)

Toàn bộ tài liệu thiết kế kiến trúc và quy chuẩn kỹ thuật nằm tại thư mục [`docs/`](docs/):

* 📜 [**Master Data Governance Spec (`docs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md`)**](docs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md): Quy chuẩn Master Source of Truth cho 15 Epochs, 7 Entity Taxonomies, RRF Min-Max, FPC Cochran formula & Audit Logs.
* 📑 [**Documentation Portal (`docs/README.md`)**](docs/README.md): Bản đồ tra cứu tài liệu tổng quan.
* 🏛️ [**System Overview (`docs/SystemOverview.md`)**](docs/SystemOverview.md): Kiến trúc RAG + Multi-Agent + VLM + Remotion.
* ⚙️ [**Remotion Technical Spec (`docs/EVAL_REMOTION_TECHNICAL_SPEC.md`)**](docs/EVAL_REMOTION_TECHNICAL_SPEC.md): Hướng dẫn chi tiết 31 LayoutModes, 19 Transitions, Zod Schema & Compositions.
* 📜 [**Content Formats Spec (`docs/REMOTION_CONTENT_FORMATS_SPEC.md`)**](docs/REMOTION_CONTENT_FORMATS_SPEC.md): Quy chuẩn 5 Domain lịch sử & Schema Production v4.1.
* 📊 [**RAG Component Benchmark Spec (`docs/RAG_COMPONENT_BENCHMARK_SPEC.md`)**](docs/RAG_COMPONENT_BENCHMARK_SPEC.md): Benchmark từng component RAG (C0-C10), datasets, metrics & regression gate.
* 🩺 [**Observability & Logging (`docs/architecture/06_OBSERVABILITY_AND_LOGGING.md`)**](docs/architecture/06_OBSERVABILITY_AND_LOGGING.md): Unified structured logger (`@chronoviet/shared-spec`), correlation ID, event names & hướng dẫn truy vết log bằng `jq`.
* 💻 [**macOS Local Model Optimization (`docs/MACOS_LOCAL_MODEL_OPTIMIZATION.md`)**](docs/MACOS_LOCAL_MODEL_OPTIMIZATION.md): Tối ưu mô hình local trên Apple Silicon.

---

## 📄 8. Giấy Phép (License)

Dự án thuộc sở hữu riêng của **ChronoViet Team**. Mọi quyền được bảo lưu.

