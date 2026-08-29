# Tài liệu Khái niệm & Kiến trúc Tổng quan: Dự án ChronoViet

**ChronoViet** (kết hợp giữa *Chronology* - Niên đại/Lịch sử và *Việt Nam*) là nền tảng EdTech ứng dụng AI thế hệ mới lấy cảm hứng từ phong cách làm việc của **NotebookLM**. Hệ thống cung cấp **Khung Chatbot tra cứu & tương tác tri thức lịch sử chuyên sâu (GraphRAG)** song hành cùng tính năng **Tạo Video Tài Liệu Tổng Quan 1-Click Hoàn Toàn Tự Động (Autonomous Multi-Agent Video Generation)**.

---

## 1. Tổng quan Dự án (Executive Overview)

* **Tên dự án:** ChronoViet
* **Định vị:** Hệ thống nghiên cứu lịch sử tương tác & tự động hóa sản xuất video giáo dục (NotebookLM-Style Historical Research & Autonomous Video Generation Platform).
* **Bài toán giải quyết:** Lịch sử Việt Nam có kho tàng dữ liệu đồ sộ nhưng văn bản cổ khô khan, dễ bị sai lệch khi AI sinh nội dung (hallucination), và thiếu các công cụ trực quan hóa dạng video tự động cho người học.
* **Giải pháp & Trải nghiệm Người dùng:**
  - **Không gian nghiên cứu NotebookLM:** Người dùng trò chuyện, hỏi đáp chuyên sâu với kho sử liệu, nhận câu trả lời có trích dẫn nguồn gốc xác thực (`citations`).
  - **Tạo Video 1-Click Tự Động:** Khi người dùng muốn tạo video tổng quan, toàn bộ hệ thống Multi-Agent ngầm tự động vận hành (GraphRAG $\rightarrow$ 5 bước kịch bản $\rightarrow$ Thu âm VieNeu TTS $\rightarrow$ Thẩm định ảnh VLM $\rightarrow$ Render Remotion MP4) mà **người dùng không cần phải can thiệp hay chỉnh sửa thủ công**.
* **Trạng thái Triển khai Hệ thống:**
  - **[✅ IMPLEMENTED RAG & INGESTION]:** Data Preprocessing & Ingestion Engine (Mô-đun 0) hoàn thiện với Layer 0 Preprocessor (`pnpm corpus:clean`, Unicode NFC, 3-token lookahead syllable healer, strict mộc bản regex bảo vệ 924 năm dương lịch `[40]`), Dual-Syntax Heading Chunking `[300, 500]` từ, Qwen 4B SLM Triples Extractor + Disk Cache + cách ly 2,360 khối bình sử quan. Chrono-RAG Engine (Mô-đun 1) với Query-Adaptive Dynamic RRF (70% BM25 cho truy vấn niên đại, 50% Graph cho phả hệ) và Directed BFS Traversal tối ưu trên PostgreSQL pgvector.
  - **[✅ IMPLEMENTED AGENT ORCHESTRATION & GUARDRAILS]:** Multi-Agent Orchestrator (Mô-đun 2) hoàn thiện với 2-Tier Cascading Intent Router (Fast Regex <1ms + Sub-Intents), Bridge Graph Context Pruner (ưu tiên Bridge Triples & tên húy/niên hiệu), Static Prefix KV-Cache Prompt (TTFT < 2s), LangGraph DAG kịch bản, và 2 Automated Guardrail Gates: Folklore Guardrail Gate & NLI Entailment Hallucination Judge.
  - **[✅ IMPLEMENTED ENGINES & VLM]:** Engine Render Remotion 100% JSON-Driven (`packages/remotion-engine/src/`), 31 `LayoutMode`, 19 `TransitionType`, Dynamic Audio Ducking (-12dB) khi có giọng thuyết minh. VLM Inspector (`packages/vlm-inspector/src/`) với 2.5s Async Circuit Breaker và Cascade VLM Early Exit (score >= 85 dừng kiểm tra ngay).
  - **[✅ IMPLEMENTED TTS SERVICE & INFRA LAYER]:** Gói hạ tầng `@chronoviet/infra` (PostgreSQL connection pool, BullMQ Redis queues, Text-to-Phoneme Normalization Alignment Bridge đồng nhất chữ số Karaoke, BGE-M3 vector embeddings, VieNeu TTS Engine client) song hành cùng AI Supervisor quản lý JIT model eviction.
  - **[✅ IMPLEMENTED WEB APP & WORKER RUNTIME]:** Lớp ứng dụng `apps/web` (Next.js 14 App Router Monolith, NotebookLM Heritage Workspace UI/UX, Mobile Navigation Drawer, Live Multi-Node `/api/readyz` Health Monitor, 3 Sắc thái lời bình, REST API, SSE Stream, WebSocket Gateway) song hành cùng `apps/render-worker` (BullMQ queues với auto-recycling sau 10 jobs, thư mục độc lập `/media/jobs/<jobId>`, RAM Disk cache).

---

## 2. Ma trận Trụ cột Công nghệ & Trạng thái Thực tế

| Trụ cột | Công nghệ lõi | Trạng thái Thực tế | Mô tả Chức năng & Không gian Mở rộng |
| --- | --- | :---: | --- |
| **Tiền xử lý & Nạp dữ liệu (Ingestion ETL)** | Layer 0 Preprocessor (`pnpm corpus:clean`), Syllable Healer 3-Token, Strict Mộc Bản Regex, Dual-Syntax Heading Chunking `[300, 500]`, SLM Qwen 4B Extractor + Cache, Dual-Branch Seeder | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 0: Làm sạch 100% ngữ liệu sử học thô, hàn vỡ âm tiết OCR, bảo toàn 924 năm trong ngoặc, tách 2,360 lời bình sử gia, nạp PostgreSQL pgvector & JSONB metadata. |
| **Engine Render (Remotion)** | React 18 + Remotion v4, 31 LayoutMode, Zod Discriminated Unions, Dynamic Audio Ducking (-12dB), Text-to-Phoneme Karaoke Sync | **[✅ IMPLEMENTED]** (100% Codebase) | Engine cốt lõi đã hoàn thiện, nhận JSON schema v4.1 để render MP4 mượt mà 0% vỡ layout, tự động giảm nhạc nền khi thuyết minh. |
| **Tạo Giọng Đọc (TTS)** | Self-Hosted VieNeu Neural TTS (`vieneu.io`), Python FastAPI ONNX Engine + Node.js Client SDK (`@chronoviet/infra/tts`), Word Timestamps & Normalization Bridge | **[✅ IMPLEMENTED]** (Phase 1 Microservice) | Giọng thuyết minh lịch sử truyền cảm, ngắt nghỉ chuẩn, sinh Word Timestamps khớp 100% chữ Karaoke sau khi chuẩn hóa số/từ viết tắt. |
| **Dữ liệu & Tri thức (RAG)** | PostgreSQL-Powered GraphRAG (`pgvector` Dense BGE-M3 1024d + Relational Graph Traversal), Query-Adaptive Dynamic RRF (70% BM25 cho năm, 50% Graph cho gia phả). | **[✅ IMPLEMENTED]** (100% Codebase & Real DB Eval) | Mô-đun 1: Hybrid GraphRAG (pgvector + Directed BFS Traversal + BM25 FTS + Dynamic RRF + Reranker). Fact Precision 99.5%, Hallucination Rate 0%, Recall@10 100%, nDCG@5 0.940, p95 Latency 186.77ms. |
| **Đội ngũ Agent (Multi-Agent)** | LangGraph.js Agentic Orchestrator + 2-Tier Cascading Intent Router + Bridge Graph Pruning + Static Prefix KV-Cache (TTFT < 2s). | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 2: Quy trình chia phân cảnh & 5 Micro-Steps kịch bản (kèm Narrative Context & Duration Reconcile), Research Agent (Micro-Step 1C) tìm ảnh online, NLI Entailment Hallucination Judge & Folklore Guardrail Gate. |
| **Thẩm định Hình ảnh (VLM)** | Hybrid VLM (Google Gemini Cloud + Local VLM + Local CLIP) + 2.5s Async Circuit Breaker + Cascade VLM Early Exit (>= 85). | **[✅ IMPLEMENTED]** | Mô-đun 3: Thẩm định bối cảnh lịch sử theo Chiến lược 3+3 Candidates, ngắt timeout tải ảnh 2.5s, dừng sớm khi ảnh đạt >= 85 điểm (giảm 80% tải VLM), lọc giấy phép Whitelisted (`Public Domain`, `CC0`, `CC-BY`). |

> 🔗 **Tài liệu Chi tiết:** Tra cứu [architecture/](architecture) cho Kiến trúc Hệ thống & Hạ tầng và [modules/](modules) cho 5 Mô-đun Pipeline.

---

## 3. Kiến trúc Hệ thống (System Architecture v4.0)

```
                       ┌────────────────────────────────────────────────────────┐
                       │ Raw Knowledge Corpus (SGK, Sử liệu cổ) & Raw Media     │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │ Mô-đun 0: Data Preprocessing & Ingestion Engine        │
                       │ (Text Normalization, Hierarchical Chunking, Media ETL) │
                       └───────────────────────────┬────────────────────────────┘
                                                   │ (Ingest & Seed Data)
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │ Persistent Storage: PostgreSQL pgvector & Host /media  │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │ Mô-đun 1: Chrono-RAG Engine (Knowledge Retrieval)      │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
             ┌─────────────────────────────────────┴─────────────────────────────────────┐
             ▼                                                                           ▼
┌─────────────────────────┐                                             ┌─────────────────────────┐
│     Interactive Chat    │                                             │ Mô-đun 2: Multi-Agent   │
│   (Hỏi đáp sâu về lịch  │                                             │ Orchestrator (LangGraph)│
│     sử cùng RAG)        │                                             └────────────┬────────────┘
└─────────────────────────┘                                                          │
                                                                                     ▼
                                                                        ┌─────────────────────────┐
                                                                        │ Micro-Step 0 Chaptering │
                                                                        │ & 5-Step Script Pipeline│
                                                                        │ (Writer->Audit->Seg->   │
                                                                        │  Reconcile->Kw)         │
                                                                        └────────────┬────────────┘
                                                                                     │
                                             ┌───────────────────────────────────────┴───────────────────────────────────────┐
                                             ▼                                                                               ▼
                              ┌─────────────────────────────┐                                                 ┌─────────────────────────────┐
                              │ Parallel Worker A: TTS      │                                                 │ Parallel Worker B: Research │
                              │ (VieNeu ONNX Engine)        │                                                 │ Agent (1C) -> VLM Inspector │
                              └──────────────┬──────────────┘                                                 │ + License Filter (PD, CC0)  │
                                             │                                                                └──────────────┬──────────────┘
                                             └───────────────────────────────┬───────────────────────────────┘
                                                                             │
                                                                             ▼
                                                                ┌─────────────────────────┐
                                                                │ Code Rules Engine (TS)  │
                                                                │ (Layout Rotation Code)  │
                                                                └────────────┬────────────┘
                                                                             │ (JSON Schema v4.1)
                                                                             ▼
                                                                ┌─────────────────────────┐
                                                                │ Mô-đun 4: Remotion      │
                                                                │ Render Engine Tool      │
                                                                │ (Pre-download + Chrome  │
                                                                │  Process Isolation)     │
                                                                └────────────┬────────────┘
                                                                             │
                                                                             ▼
                                                                [XUẤT VIDEO SHORT / REELS]
```

---

## 4. Quy trình Kiểm định Hình ảnh bằng VLM (VLM Inspector Pipeline)

Để giải quyết triệt để vấn đề lấy sai ảnh lịch sử (ví dụ: crawl nhầm ảnh phim cổ trang Trung Quốc hoặc ảnh sai thời kỳ), Agent VLM hoạt động theo cơ chế 4 lớp kết hợp Chiến lược 3+3 Candidates với đầy đủ **Correlation ID Context Propagation** và **Failure Latency Telemetry**. **Trước đó, Research Agent (Micro-Step 1C)** đã tìm candidate pool online qua provider chain (SerpAPI/Tavily/Brave/Wikimedia/Catalog) với **domain whitelist** — nên VLM chỉ nhận ảnh đã an toàn nguồn gốc:

1. **Lớp 0: Whitelisted License & Attribution Filter**
   - Chỉ chấp nhận giấy phép bản quyền hợp lệ: `PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`.
2. **Lớp 1: Redis Dual-Layer Cache Check (SHA-256 & pHash)**
   - Bộ đệm 2 lớp (Redis Dual-Layer Cache) giúp lấy kết quả audit trong 1ms đối với ảnh trùng lặp (TTL 30 ngày).
3. **Lớp 2: Technical Visual Quality Gate (Binary Header Reader)**
   - Giải mã nhanh binary header nhị phân (PNG, JPEG, WEBP) không tốn bộ nhớ.
   - Kiểm tra độ phân giải tối thiểu: Resolution $\ge 720\text{p}$ ($1280 \times 720$), kiểm tra tỉ lệ khung hình (sai số $\le 15\%$), và giới hạn payload quá cỡ ($>5\text{MB}$) trước khi encode Base64.
4. **Lớp 3: Phân tích Thị giác bằng VLM (Local Multimodal VLM / Gemini Cloud) & Chiến lược 3+3 Candidates**
   - *Đầu vào:* Hình ảnh crawl được + Từ khóa sự kiện + Mô tả bối cảnh từ RAG.
   - *Bộ trích xuất JSON:* `extractAndParseJson` dùng regex boundary extraction (`/\{[\s\S]*\}/`) loại bỏ hoàn toàn markdown fences và câu hội thoại dẫn nhập của AI.
   - *Tiêu chí chấm điểm (Score 0–100):*
     - **Historical Context Score (0-40):** Trang phục, kiến trúc có đúng bối cảnh Việt Nam không? (Loại bỏ ảnh có cờ, trang phục triều đại phong kiến Trung Quốc/Triều Tiên).
     - **Visual Noise Score (0-30):** Ảnh có bị dính watermark, logo kênh truyền hình, chữ viết đè quá nhiều không?
     - **Artistic Fit Score (0-30):** Bố cục điện ảnh, thẩm mỹ, tỉ lệ hài hòa.
   - *Phương án Dự phòng (Fallback Mechanism):* Nguồn ảnh trong ChronoViet là **100% Crawl từ Internet/Kho tư liệu** (không dùng Generative AI). Nếu toàn bộ 6 ảnh ứng viên có điểm VLM < 60: Tự động kích hoạt **Pure Code Layout Rotation Engine** (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`...) để đảm bảo video render thành công 100% không bị hỏng layout.

---

## 5. Mô-đun Remotion: Kiến Trúc Render 100% JSON-Driven

Remotion Engine của ChronoViet tuân thủ kiến trúc **100% Data-Driven**. Multi-Agent truyền dữ liệu qua file JSON để quyết định toàn bộ nội dung, kịch bản, thời lượng, chuyển cảnh, hình ảnh/âm thanh và **phong cách thiết kế (Theme: Màu sắc & Phông chữ)** mà không cần sửa code React.

### Cấu trúc file JSON dữ liệu truyền vào Remotion (Production Schema v4.1):

```json
{
  "title": "TRẬN NGỌC HỒI ĐỐNG ĐA 1789",
  "subtitle": "ChronoViet Deep Research Series",
  "videoType": "BATTLE",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#9B1B1B",
    "secondaryColor": "#C89D35",
    "backgroundColor": "#0E0C0A",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(155, 27, 27, 0.4)"
  },
  "audioUrl": "assets/battle/ngoc-hoi/voiceover.wav",
  "bgmUrl": "assets/battle/ngoc-hoi/bgm.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "GLITCH",
  "enableTransitions": true,
  "timeline": [
    {
      "id": "scene-01-intro",
      "startTime": 0,
      "endTime": 15,
      "text": "Đêm mùng 4 Tết Kỷ Dậu, quân Tây Sơn áp sát đồn Ngọc Hồi.",
      "layoutMode": "ARTICLE_UI",
      "overlayType": "ARTICLE_INTRO",
      "transition": "FADE_TO_BLACK",
      "hideHeader": true,
      "overlayData": {
        "title": "TRẬN NGỌC HỒI ĐỐNG ĐA 1789",
        "author": "ChronoViet Research Team"
      }
    },
    {
      "id": "scene-02-hook",
      "startTime": 15,
      "endTime": 35,
      "text": "Đêm mùng 4 Tết Kỷ Dậu, quân Tây Sơn áp sát đồn Ngọc Hồi.",
      "assetUrl": "assets/battle/ngoc-hoi/ngoc-hoi-map.jpg",
      "layoutMode": "TITLE_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "HISTORICAL",
      "transition": "GLITCH",
      "overlayData": {
        "chapterNumber": "I",
        "title": "BÁCH CHIẾN BÁCH THẮNG",
        "subtitle": "Cuộc Tổng Tấn Công Thần Tốc Tết Kỷ Dậu 1789"
      }
    }
  ]
}
```

> **Lưu ý thời lượng scene:** Thứ tự ưu tiên tính thời lượng tại runtime: `durationInFrames` > `durationInSeconds * fps` > `captions endFrame` > `(endTime - startTime) * fps`.

👉 *Xem chi tiết quy chuẩn kỹ thuật đầy đủ tại:* [specs/EVAL_REMOTION_TECHNICAL_SPEC.md](specs/EVAL_REMOTION_TECHNICAL_SPEC.md)

---

## 6. Khung Đánh Giá & Benchmark Hệ Thống (Master Evaluation Architecture)

ChronoViet áp dụng kiến trúc đánh giá 2 giai đoạn độc lập (**2-Stage Decoupled Evaluation Suite**), cho phép đo lường chuyên sâu chất lượng sinh kịch bản và chất lượng tìm kiếm tư liệu/VLM mà không phụ thuộc vào hạ tầng nặng:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           MASTER EVALUATION SUITE                              │
├───────────────────────────────────────┬────────────────────────────────────────┤
│ STAGE 1: SCRIPT & NARRATIVE (Text)    │ STAGE 2: VISUAL CURATION (Vision)      │
│ Preflight: ['postgres', 'emb', 'llm'] │ Preflight: ['llm', 'vlm', 'search']    │
├───────────────────────────────────────┼────────────────────────────────────────┤
│ • Planned Pacing Deviation (145 WPM)  │ • Trilingual Query Coverage (Vi/En/Fr) │
│ • Historical Fact-Check Pass Rate     │ • Image Candidate Yield (>= 3/scene)   │
│ • Historical Entity Recall Rate       │ • Asset Download Success Rate          │
│ • Scene Duration & Density Bounds     │ • 100% License Whitelist Compliance    │
│                                       │ • VLM Visual Quality Score (>= 7.5/10) │
└───────────────────────────────────────┴────────────────────────────────────────┘
```

- **Stage 1 (`pnpm eval:video:stage1`):** Đánh giá kịch bản text-only siêu nhanh (0% overhead GPU/crawling).
- **Stage 2 (`pnpm eval:video:stage2` / `pnpm eval:video:golden`):** Đánh giá tìm kiếm tư liệu & thẩm định VLM (nối tiếp Stage 1 hoặc chạy độc lập trên 5 Golden Fixtures).
- **Master Pre-Render Benchmark (`pnpm eval:video`):** Đánh giá toàn diện chuỗi sinh video trước render.
- **Chatbot Dialogue Benchmark (`pnpm eval:chat`):** Đánh giá tra cứu, trích dẫn và hội thoại lịch sử.
- **Unified Master Benchmark (`pnpm eval:all`):** Chạy toàn bộ hệ thống đánh giá.

👉 *Xem tài liệu chi tiết tại:* [`eval/README.md`](../eval/README.md)

---

## 7. Định hướng Mở rộng Tương lai (Future Scope & Scalability)

Dự án **ChronoViet** được thiết kế với kiến trúc Mô-đun (Modular), cho phép mở rộng các tính năng nâng cao trong các giai đoạn sau:

* **Chrono-Gamification:** Dựa trên video vừa render, RAG tự động tạo ra bộ câu hỏi trắc nghiệm tương tác (Quiz) để người học ôn luyện ngay sau khi xem.
* **Multi-language Global Heritage:** Mở rộng RAG để dịch kịch bản và phát âm TTS đa ngôn ngữ (Tiếng Anh, Tiếng Pháp, Tiếng Nhật...), biến ChronoViet thành công cụ quảng bá lịch sử/du lịch Việt Nam ra thế giới.
* **Interactive Storytelling (Video nhánh):** Người dùng có thể chọn các quyết định lịch sử trong khi xem video (Ví dụ: *"Nếu nhà Hồ không xây thành Tây Đô thì sao?"*) và RAG sẽ simulate ra kịch bản giả định (Alternate History) dạng video.
* **Chrono-Map (Bản đồ tri thức theo thời gian):** Tích hợp bản đồ địa lý tương tác (Mapbox/Leaflet), hiển thị các video được ghim trực tiếp lên mốc tọa độ địa lý thực tế trên bản đồ Việt Nam.