# KẾ HOẠCH TRIỂN KHAI VÀ ĐÁNH GIÁ DỰ ÁN CHRONOVIET
## (Project Implementation Roadmap, Parallelization Strategy & Modular Evaluation Framework v1.1)

---

## 1. Tổng Quan & Đánh Giá Hiện Trạng Dự Án (Baseline Assessment)

Dự án **ChronoViet** được thiết kế theo kiến trúc **Single-Language TypeScript Monorepo** kết hợp với mô hình triển khai **Streamlined VPS Topology** (vận hành trên 1 VPS duy nhất với Docker Compose).

Qua quá trình rà soát toàn bộ tài liệu kiến trúc (`docs/architecture/`) và chi tiết mô-đun (`docs/modules/`), trạng thái thực tế của dự án được phân định rõ ràng như sau:

### 1.1. Bảng Phân Tích Trạng Thái Thành Phần (Status Matrix)

| Thành phần / Mô-đun | Trạng thái Thực tế | Mức độ Phức tạp | Đánh giá Công nghệ & Sẵn sàng | Thư mục Đánh giá (`eval/`) |
| :--- | :---: | :---: | :--- | :--- |
| **Mô-đun 4: Remotion Render Engine** | **[✅ IMPLEMENTED]** | Trung bình | **100% Hoàn thiện codebase** (`packages/remotion-engine/src/`). Đã có 18 `LayoutMode`, 15 `TransitionType`, Zod Schema runtime validation (`schema.ts`), 13 UI Components, 8 Compositions. | `packages/remotion-engine/eval/` |
| **Dịch vụ VieNeu TTS (ONNX Engine)** | **[📐 ROADMAP Spec]** | Thấp - Trung bình | Đã thiết kế spec API ONNX Runtime + thuật toán tính toán `durationInFrames` dựa trên audio `.wav` thực tế và mốc từ `wordTimestamps` cho phụ đề Karaoke. | `services/vieneu-tts/eval/` |
| **Mô-đun 1: Chrono-RAG Engine** | **[📐 ROADMAP Spec]** | Phức tạp | Hybrid GraphRAG dùng PostgreSQL 15+ (`pgvector` Dense Embedding BGE-M3 + Relational Graph Schema CTEs + k-hop Local Search + BGE Reranker v2). | `packages/rag-engine/eval/` |
| **Mô-đun 2: Multi-Agent Orchestrator** | **[📐 ROADMAP Spec]** | Rất Phức tạp | LangGraph.js State Machine trên Node.js/TS, Postgres Checkpointer SSOT, quy trình 12 trạng thái, Chaptering Agent + 5 Script Micro-Steps, Duration Reconciler, Alias Table Fact-Checker. | `packages/agent-orchestrator/eval/` |
| **Mô-đun 3: VLM Inspector Sub-Agent** | **[📐 ROADMAP Spec]** | Trung bình | Gemini 2.5 Flash Cloud Primary + Local CLIP ONNX Fallback + Whitelisted License Filter (CC0/PD/CC-BY) + Unified Redis Cache (SHA-256/pHash) + Chiến lược 3+3 Candidates. | `packages/vlm-inspector/eval/` |
| **Hạ tầng Worker & Render Queue** | **[📐 ROADMAP Spec]** | Trung bình | Docker Compose (Caddy Reverse Proxy, PostgreSQL `pgvector`, Redis 7 BullMQ, App Monolith Fastify/Next.js, Worker). | `apps/render-worker/eval/` |

### 1.2. Nguyên Tắc Bắt Buộc: Module-Level Evaluation (`eval/` per Module)

> 🎯 **NGUYÊN TẮC THIẾT KẾ ĐÁNH GIÁ LÕI:**
> **Mọi mô-đun/dịch vụ/gói trong dự án ChronoViet BẮT BUỘC phải đi kèm một thư mục `eval/` độc lập.**
> Mô-đun chỉ được coi là hoàn thiện (`DONE`) khi bộ công cụ đánh giá `eval/` tương ứng được viết xong, có khả năng chạy tự động và vượt qua ma trận KPI đã đề ra.

Cấu trúc chuẩn cho thư mục `eval/` ở từng mô-đun:
```
<module-root>/
├── src/                  # Mã nguồn chính của mô-đun
├── eval/                 # Bộ công cụ đánh giá dành riêng cho mô-đun
│   ├── README.md         # Tài liệu hướng dẫn chạy eval & định nghĩa tiêu chí KPI
│   ├── datasets/         # Bộ dữ liệu mẫu / Ground truth benchmark
│   ├── test-cases/       # Các kịch bản kiểm thử biên (edge cases)
│   ├── runner.ts         # Script thực thi benchmark & đo lường metrics
│   └── reports/          # Kết quả đánh giá xuất ra (JSON/Markdown)
```

### 1.3. Nhận Xét Lõi Cho Kế Hoạch Triển Khai
- **Điểm tựa vững chắc:** Remotion Render Engine đã hoàn thành 100% và hoạt động 100% **Data-Driven thông qua file JSON Schema v3.0/v3.2**.
- **Nhiệm vụ trọng tâm:** Xây dựng tầng "đầu vào AI" (RAG $\rightarrow$ Multi-Agent Scriptwriter $\rightarrow$ VLM Inspector & TTS $\rightarrow$ JSON Schema Packager) để nối tự động với Remotion Engine, song song với việc xây dựng bộ đánh giá `eval/` độc lập cho từng thành phần.

---

## 2. Phân Tích Khả Năng Triển Khai: Song Song (Parallel) vs Tuần Tự (Sequential)

Để tối ưu hóa thời gian phát triển và giảm thiểu điểm nghẽn (bottlenecks), các công việc được phân tích theo sơ đồ phụ thuộc (Dependency Tree) và chia thành các **Workstream (Dòng công việc)** độc lập kèm bộ eval tương ứng.

### 2.1. Sơ Đồ Phụ Thuộc Mã Nguồn & Dữ Liệu (Dependency Tree)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        REMOTION RENDER ENGINE (Đã hoàn thiện ✅)                       │
│                        Bộ đánh giá: packages/remotion-engine/eval/                     │
└────────────────────────────────────────▲───────────────────────────────────────────────┘
                                         │ (Nhận JSON Schema v3.2)
┌────────────────────────────────────────┴───────────────────────────────────────────────┐
│                     WORKSTREAM D: MULTI-AGENT ORCHESTRATOR                             │
│                  (LangGraph.js State Machine + Postgres Checkpoint)                    │
│                  Bộ đánh giá: packages/agent-orchestrator/eval/                        │
└───────▲────────────────────────────────▲────────────────────────────────▲──────────────┘
        │                                │                                │
┌───────┴──────────────┐ ┌───────────────┴──────────────┐ ┌───────────────┴──────────────┐
│  WORKSTREAM A: RAG   │ │  WORKSTREAM B: VIENEU TTS    │ │   WORKSTREAM C: VLM INSPECT  │
│  (Postgres pgvector  │ │  (ONNX Service +             │ │   (Crawl + License Filter    │
│   + Graph Schema)    │ │   Timestamp Alignment)       │ │    + Redis Dual Cache)        │
│  Bộ đánh giá:        │ │  Bộ đánh giá:                │ │  Bộ đánh giá:                │
│  .../rag-engine/eval/│ │  .../vieneu-tts/eval/        │ │  .../vlm-inspector/eval/     │
└──────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

### 2.2. Phân Tích Khả Năng Song Song Hóa (Parallelization Analysis)

| Workstream | Có thể chạy song song? | Phụ thuộc đầu vào (Inputs) | Tệp giao tiếp (Data Contract) | Thư mục Eval Độc Lập |
| :--- | :---: | :--- | :--- | :--- |
| **Workstream A: Chrono-RAG Engine** | **CÓ (100%)** | Nguồn tri thức (SGK, Đại Việt Sử Ký Toàn Thư). | Trả về `Verified Historical Context` + `Alias Table`. | `packages/rag-engine/eval/` |
| **Workstream B: VieNeu TTS Engine** | **CÓ (100%)** | Script text mẫu (String). | Trả về file `.wav` + `wordTimestamps` + `calculatedFrames`. | `services/vieneu-tts/eval/` |
| **Workstream C: VLM Inspector Sub-Agent** | **CÓ (100%)** | URL ảnh crawl + Từ khóa bối cảnh. | Trả về `VLM Score` + `License Metadata` + Verdict (`PASS`/`REJECT`). | `packages/vlm-inspector/eval/` |
| **Workstream D: Multi-Agent Orchestrator** | **TUẦN TỰ (Cần A,B,C)** | Output từ Workstream A, B, C để lắp ráp pipeline đầy đủ. | Đóng gói JSON Schema v3.2 truyền sang Remotion Render Tool. | `packages/agent-orchestrator/eval/` |

> 💡 **Kết Luận Kiến Trúc:** 
> Dự án triển khai song song 3 Workstream A, B, C ở giai đoạn đầu, trong đó mỗi Workstream **tự phát triển và tự chạy suite `eval/` của chính mình** trước khi hợp nhất vào Workstream D.

---

## 3. Lộ Trình Triển Khai Chi Tiết Theo Giai Đoạn (Phased Implementation Roadmap)

Tổng thời gian dự kiến: **7 Tuần** (chia làm 5 Giai đoạn).

```
Tuần 1 - 2 :  Phase 1 [Khởi tạo Hạ tầng & Workstream B (VieNeu TTS) + vieneu-tts/eval/]
Tuần 3 - 4 :  Phase 2 [Workstream A (Chrono-RAG) + rag-engine/eval/ & Workstream C (VLM Inspector) + vlm-inspector/eval/]
Tuần 5 - 6 :  Phase 3 [Workstream D (LangGraph.js Orchestrator) + agent-orchestrator/eval/ & Task Queues + render-worker/eval/]
Tuần 7     :  Phase 4 [End-to-End Tích hợp Pipeline & Remotion Coupling + remotion-engine/eval/]
Tuần 8     :  Phase 5 [Chạy Toàn Bộ Evaluation Suites, Benchmarking & Tối ưu Sản xuất]
```

---

### 🎨 Phase 1: Setup Hạ Tầng Monorepo & Dịch Vụ VieNeu TTS (Tuần 1 – Tuần 2)
**Mục tiêu:** Dựng khung Monorepo TypeScript, đưa hạ tầng Docker Compose lên môi trường dev, tích hợp hoàn chỉnh dịch vụ VieNeu TTS dạng standalone kèm suite đánh giá `services/vieneu-tts/eval/`.

#### 📋 Các công việc cụ thể:
1. **Thiết lập Monorepo (`pnpm workspace`):**
   - Khởi tạo thư mục gốc: `packages/shared-spec`, `packages/rag-engine`, `packages/agent-orchestrator`, `packages/vlm-inspector`, `packages/remotion-engine`, `services/vieneu-tts`, `apps/web`, `apps/render-worker`.
   - **Tạo sẵn thư mục `eval/` tại TẤT CẢ các package/service/app.**
2. **Khởi tạo Docker Compose Stack Dev:**
   - Container `postgres`: PostgreSQL 15+ cài sẵn `pgvector` extension.
   - Container `redis`: Redis 7 Alpine cấu hình `appendonly yes`.
   - Container `caddy`: Dynamic reverse proxy local.
3. **Triển khai VieNeu TTS Engine & Suite Đánh Giá (Workstream B):**
   - Đóng gói microservice `vieneu-tts-service` sử dụng `onnxruntime-node` đọc model VieNeu ONNX trên CPU.
   - Viết API `POST /api/v1/synthesize` trả về file `.wav` và mốc từ `wordTimestamps`.
   - Viết module utility `convertVieNeuTimestampsToCaptions()` quy đổi `ms` $\rightarrow$ `startFrame`/`endFrame` tại 30 FPS.
   - **Triển khai `services/vieneu-tts/eval/`:**
     - Xây dựng dataset 50 mẫu câu lịch sử tiếng Việt với âm tiết phức tạp (tên riêng, mốc năm, từ hán việt).
     - Viết `eval/runner.ts` đo lường:
       - Tốc độ sinh audio (Inference Real-Time Factor - RTF).
       - Độ chính xác mốc thời gian từ (`wordTimestamps` alignment error $< 50\text{ms}$).
       - Tỉ lệ khớp độ dài audio thực tế vs `calculatedFrames` (phải $< 1$ frame sai lệch).

---

### 🏛️ Phase 2: Phát Triển RAG Engine & VLM Inspector Sub-Agent (Tuần 3 – Tuần 4)
**Mục tiêu:** Xây dựng song song tầng dữ liệu tri thức lịch sử (Workstream A) và tầng kiểm định hình ảnh/bản quyền (Workstream C), đi kèm hai suite đánh giá `packages/rag-engine/eval/` và `packages/vlm-inspector/eval/`.

#### 📋 Công việc Workstream A (Chrono-RAG Engine & `rag-engine/eval/`):
1. **Khởi tạo Database Schema:**
   - Tạo bảng Postgres `document_chunks` với vector column `embedding vector(1024)` (`BAAI/bge-m3`). Cấu hình HNSW index.
   - Xây dựng bảng quan hệ đồ thị Relational Graph: `entities`, `relationships`, `entity_chunks`.
2. **Offline Ingestion Pipeline:**
   - Viết script chunking tài liệu SGK Lịch sử & Đại Việt Sử Ký Toàn Thư. Trích xuất bộ ba `(Entity - Relation - Entity)`.
3. **Online Local Search & Reranking:**
   - Viết thuật toán PostgreSQL Recursive CTEs (k-hop neighborhood $k=1,2$).
   - Kết nối Hybrid Search (RRF BM25 sparse + `bge-m3` dense) + `bge-reranker-v2-m3` chọn Top-3 context.
4. **Triển khai `packages/rag-engine/eval/`:**
   - Xây dựng bộ test benchmark **ChronoEval-1000** trong `packages/rag-engine/eval/datasets/`.
   - Viết runner đánh giá 3 chỉ số RAG cốt lõi:
     - **Fact Precision Score** (Độ chính xác dữ kiện $> 99.2\%$).
     - **Hallucination Rate** (Tỉ lệ bịa đặt/ảo giác $< 0.8\%$).
     - **Citation Traceability** (Khả năng truy xuất nguồn gốc 100%).

#### 📋 Công việc Workstream C (VLM Inspector Sub-Agent & `vlm-inspector/eval/`):
1. **Lớp 0 & Lớp 1 (License Filter & Redis Dual-Cache):**
   - Viết filter giấy phép Whitelisted (`Public Domain`, `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`).
   - Viết cache Redis 2 lớp: Check exact URL SHA-256 hash và pHash distance ($<5$).
2. **Lớp 2 & Lớp 3 (Technical & Hybrid VLM Scoring):**
   - Filter kỹ thuật: Resolution $\ge 600\times 600$, tỉ lệ khung hình hợp lệ.
   - Primary Scorer: Gọi Gemini 2.5 Flash API chấm điểm 3 tiêu chí (`historical_context_score`, `visual_noise_score`, `artistic_fit_score`).
   - Local Fallback: Circuit breaker switch sang Local CLIP ONNX Scorer khi rate limit.
   - Chiến lược 3+3 Candidates: Crawl đợt 1 (3 ảnh thô) $\rightarrow$ nếu $<60$đ $\rightarrow$ crawl đợt 2 $\rightarrow$ nếu vẫn $<60$đ $\rightarrow$ flag `PURE_CODE`.
3. **Triển khai `packages/vlm-inspector/eval/`:**
   - Tạo bộ 200 ảnh mẫu (gồm 100 ảnh đúng bối cảnh lịch sử Việt Nam, 50 ảnh nhiễu/hiện đại, 50 ảnh vi phạm bản quyền).
   - Viết script `packages/vlm-inspector/eval/runner.ts` đo lường:
     - **Visual Noise Free Rate** ($> 95\%$).
     - **Historical Context Match** ($> 90\%$).
     - **License Compliance Rate** ($100\%$).
     - **Gemini vs CLIP ONNX Agreement Matrix** (Độ tương đồng chấm điểm giữa Cloud & Local model).

---

### ⚙️ Phase 3: LangGraph.js Orchestrator & Task Queues (Tuần 5 – Tuần 6)
**Mục tiêu:** Xây dựng "Bộ não điều phối" Multi-Agent (Workstream D) quản lý máy trạng thái 12 bước, lưu vết Postgres Checkpointer, điều hành BullMQ, kèm hai suite đánh giá `packages/agent-orchestrator/eval/` và `apps/render-worker/eval/`.

#### 📋 Công việc Workstream D (Multi-Agent Orchestrator & `agent-orchestrator/eval/`):
1. **LangGraph.js State Machine & Postgres Checkpointer:**
   - Khởi tạo Graph State trong Node.js/TS với LangGraph.js. Kết nối `PostgresSaver`.
   - Cấu hình biến truyền văn phong `runningNarrativeState` giữ tone nhất quán qua các chương (Chapters).
2. **Quy trình 5 Script Micro-Steps:**
   - **Step 0:** Chaptering Agent.
   - **Micro-Step 1A:** Scriptwriter Agent.
   - **Micro-Step 1A-Audit:** Fact-Checker Agent (Duyệt Alias Table, Thang Escalation 4 Tầng).
   - **Micro-Step 1B:** Scene Segmenter.
   - **Micro-Step 1B-Reconcile:** Duration Reconciler (Đối soát thời lượng Audio VieNeu vs Target Chapter duration, Time-Stretch $\pm 10\%$).
   - **Micro-Step 1C:** Keyword Extractor.
3. **Triển khai `packages/agent-orchestrator/eval/`:**
   - Xây dựng 20 kịch bản lịch sử phức tạp (video 3 phút đến 15 phút).
   - Viết runner đánh giá:
     - **State Machine Reliability**: Tỉ lệ hoàn thành 12 bước trạng thái không bị kẹt loop (Target 100%).
     - **Pacing Reconciliation Error**: Sai lệch thời lượng tổng so với target (Target $< 5\%$).
     - **Fact-Checker Escalation Audit**: Khả năng phát hiện và chặn các câu sai lịch sử.
     - **Narrative Consistency Score**: Đánh giá độ mượt và văn phong nối giữa các Chapter bằng LLM-as-a-Judge.

#### 📋 Công việc Hạ tầng Worker & `apps/render-worker/eval/`:
1. **BullMQ Task Queues:**
   - Queue 1: `tts-gen-queue`. Queue 2: `vlm-inspect-queue`. Queue 3: `remotion-render-queue`.
2. **Triển khai `apps/render-worker/eval/`:**
   - Viết script stress test hàng đợi tác vụ với 50 jobs render đồng thời.
   - Đo lường khả năng cô lập tiến trình Puppeteer (Process Isolation) và khả năng khôi phục khi worker bị crash (Job Failover Recovery Rate 100%).

---

### 🔗 Phase 4: Tích Hợp End-to-End & Nối Remotion Engine (Tuần 7)
**Mục tiêu:** Kết nối hoàn chỉnh toàn bộ pipeline từ prompt người dùng $\rightarrow$ RAG $\rightarrow$ Agent $\rightarrow$ Worker $\rightarrow$ Remotion Render MP4, kiểm tra toàn diện bằng `packages/remotion-engine/eval/`.

#### 📋 Các công việc cụ thể:
1. **JSON Schema v3.2 Packager & Validation:**
   - Dùng Zod Schema (`schema.ts`) kiểm định 100% dữ liệu JSON trước khi đẩy xuống Render Worker.
2. **Render Worker Asset Pre-download & Isolation:**
   - Lắng nghe `remotion-render-queue`, tải trước asset về `/media/raw-assets/`, thực thi Chromium Isolation.
3. **WebSocket Progress Tracking:**
   - Push tiến độ real-time qua WebSocket channel `project_status:{projectId}` về Next.js Dashboard.
4. **Triển khai `packages/remotion-engine/eval/`:**
   - Đánh giá khả năng render 18 `LayoutMode` và 15 `TransitionType` với dữ liệu JSON thực tế từ Orchestrator.
   - Đo lường:
     - **Audio-Visual Sync Delay**: Mốc xuất hiện Karaoke Subtitle delay $< 1$ frame ($33\text{ ms}$).
     - **Render Speed Index**: Tỉ lệ thời gian render MP4 (Target $< 45\text{s}$ cho 60s video 1080p).
     - **Visual Regression Test**: Chụp snapshot từng frame chính để đảm bảo không bị tràn văn bản hay vỡ layout.

---

### 🧪 Phase 5: Tổng Hợp Đánh Giá (Aggregated Evaluation), Benchmarking & Hardening (Tuần 8)
**Mục tiêu:** Chạy đồng loạt toàn bộ các bộ eval (`packages/*/eval/` và `services/*/eval/`), kiểm thử tải hạ tầng VPS và tối ưu hóa hệ thống trước khi vận hành.

#### 📋 Các công việc cụ thể:
1. **Chạy Master Evaluation Runner:**
   - Viết script `pnpm eval:all` tại root Monorepo để kích hoạt tuần tự và tổng hợp báo cáo từ 5 bộ eval thành phần:
     - `pnpm --filter @chronoviet/rag-engine eval`
     - `pnpm --filter @chronoviet/vieneu-tts eval`
     - `pnpm --filter @chronoviet/vlm-inspector eval`
     - `pnpm --filter @chronoviet/agent-orchestrator eval`
     - `pnpm --filter @chronoviet/remotion-engine eval`
     - `pnpm --filter @chronoviet/render-worker eval`
2. **Load Test & Resource Audit Trên Single VPS:**
   - Giới hạn tài nguyên Docker Compose: Worker CPU max 2.0, RAM max 4GB.
   - Kiểm tra rò rỉ bộ nhớ (Memory Leak Audit): Chạy 100 jobs render liên tục, đảm bảo peak RAM $< 3.8\text{ GB}$ và dọn sạch temp file.

---

## 4. Ma Trận Đánh Giá Kỹ Thuật Tổng Hợp (Technical Evaluation Framework)

Ma trận dưới đây ánh xạ trực tiếp từng trục đánh giá kỹ thuật vào **thư mục `eval/` của mô-đun phụ trách**:

| Trục Đánh Giá | Chỉ Số Đo Lường (KPI / Metrics) | Mục Tiêu Đạt Chuẩn | Mô-đun & Đường Dẫn Thư Mục `eval/` |
| :--- | :--- | :---: | :--- |
| **1. Tính Chuẩn Xác Sử Liệu (RAG Accuracy)** | - Fact Precision Score<br>- Hallucination Rate<br>- Citation Traceability | **> 99.2%**<br>**< 0.8%**<br>**100%** | **Chrono-RAG Engine**<br>`file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/eval/` |
| **2. Chất Lượng Thị Giác & Bản Quyền (VLM Inspection)** | - Visual Noise Free Rate<br>- Historical Context Match<br>- Whitelisted License Compliance | **> 95%**<br>**> 90%**<br>**100%** | **VLM Inspector Sub-Agent**<br>`file:///d:/Persional_Projects/ChronoViet/packages/vlm-inspector/eval/` |
| **3. Chất Lượng Giọng Đọc & Đồng Bộ Audio** | - RTF Inference Speed<br>- Word Timestamp Alignment Error<br>- Duration Frame Calculation Error | **< 0.3x RTF**<br>**< 50ms**<br>**< 1 frame** | **VieNeu TTS Service**<br>`file:///d:/Persional_Projects/ChronoViet/services/vieneu-tts/eval/` |
| **4. Độ Tin Cậy Agent & Pacing Kịch Bản** | - State Machine Completion Rate<br>- Script Pacing Reconciliation Error<br>- Fact-Checker Escalation Trigger Rate | **100%**<br>**< 5%**<br>**100%** | **Multi-Agent Orchestrator**<br>`file:///d:/Persional_Projects/ChronoViet/packages/agent-orchestrator/eval/` |
| **5. Hiệu Năng Render & Chuẩn Visual** | - Remotion Render Time (1080p 60s)<br>- Karaoke Caption Frame Delay<br>- Visual Layout Regression Pass | **< 45s**<br>**< 1 frame (33ms)**<br>**100%** | **Remotion Render Engine**<br>`file:///d:/Persional_Projects/ChronoViet/packages/remotion-engine/eval/` |
| **6. An Toàn Hạ Tầng & Tải VPS** | - Max RAM Peak per Render Job<br>- Worker Process Memory Leak<br>- BullMQ Failover Recovery Rate | **< 3.8 GB RAM**<br>**0 MB leak**<br>**100%** | **Render Worker App**<br>`file:///d:/Persional_Projects/ChronoViet/apps/render-worker/eval/` |

---

## 5. Quản Trị Rủi Ro & Phương Án Dự Phòng (Risk Management & Fallback Strategy)

| Rủi Ro Phát Sinh | Mức Độ | Nguyên Nhân | Phương Án Khắc Phục & Kiểm Đỉnh Trong `eval/` |
| :--- | :---: | :--- | :--- |
| **1. Rate-Limit / Cloud VLM API Down** | Cao | Cloud API Gemini 2.5 Flash bị sập hoặc trả lỗi 429 quá 3 lần. | **Circuit Breaker Fallback sang Local CLIP ONNX Scorer.** Đã có test case giả lập 429 trong `packages/vlm-inspector/eval/`. |
| **2. Khởi tạo Kịch bản bị Lỗi Thời Lượng (>15%)** | Trung bình | VieNeu TTS đọc câu văn quá dài/ngắn so với dự tính của Script Agent. | **Duration Reconciler Step 1B:** Áp dụng Time-Stretch $\pm 10\%$. Nếu vẫn quá 15%, rewrite pacing. Test tự động trong `packages/agent-orchestrator/eval/`. |
| **3. Tự động Crawl Không Tìm Thấy Ảnh Phù Hợp** | Trung bình | Từ khóa hiếm, cả 6 ảnh (3+3 candidates) đều $< 60$ điểm VLM. | **PURE_CODE Layout Rotation:** Tự động switch scene sang các component thuần code (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`...). Kiểm thử trong `packages/remotion-engine/eval/`. |
| **4. Render Remotion Bị Out Of Memory (OOM)** | Cao | Chromium Puppeteer instance giữ lại RAM cũ sau nhiều job render. | **Chromium Process Isolation:** Cấu hình `--concurrency=1`, gọi `browser.close()` và dọn temp. Đã đưa vào benchmark `apps/render-worker/eval/`. |
| **5. LLM Bị Reset Tone Giữa Các Chương Video Dài** | Trung bình | Small LLM (Qwen 7B/14B) bị tràn context window khi sinh video 10-15 phút. | **Micro-Step 0 Chaptering:** Tách video dài thành $N$ Chapters 2-3 phút và truyền `runningNarrativeState`. Đo lường bằng LLM-as-a-Judge trong `packages/agent-orchestrator/eval/`. |

---

## 6. Tổng Kết & Các Bước Hành Động Tiếp Theo (Immediate Action Items)

Kế hoạch triển khai dự án ChronoViet được xây dựng dựa trên nguyên tắc **tối ưu hóa tài nguyên**, **triển khai mô-đun hóa nghiêm ngặt**, và **bắt buộc có thư mục đánh giá `eval/` cho từng mô-đun**.

### 🎯 Các bước cần thực hiện ngay (Next Immediate Steps):
1. **Khởi tạo thư mục `eval/` và file `README.md` hướng dẫn đánh giá** cho 6 mô-đun/gói trọng tâm:
   - `packages/rag-engine/eval/`
   - `services/vieneu-tts/eval/`
   - `packages/vlm-inspector/eval/`
   - `packages/agent-orchestrator/eval/`
   - `packages/remotion-engine/eval/`
   - `apps/render-worker/eval/`
2. **Cấu hình script tổng hợp `pnpm eval:all`** tại `package.json` gốc để có thể kích hoạt toàn bộ các bộ eval chỉ bằng một lệnh đơn.
3. **Tiến hành Workstream B (VieNeu TTS ONNX Service)** kèm script đánh giá `services/vieneu-tts/eval/runner.ts`.
4. **Cập nhật Trung tâm Tài liệu (`docs/README.md`)** để dẫn link tới tài liệu Kế hoạch Triển khai v1.1 này.
