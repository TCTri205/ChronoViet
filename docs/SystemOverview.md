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
  - **[✅ IMPLEMENTED RAG & INGESTION]:** Data Preprocessing & Ingestion Engine (Mô-đun 0) hoàn thiện 100% codebase & eval tại `packages/data-ingestion/src/`; Chrono-RAG Engine (Mô-đun 1) tại `packages/rag-engine/src/`. Cào tự động 100% 15 thời kỳ (`pnpm crawl:all`), Hybrid GraphRAG PostgreSQL pgvector + Relational Graph CTEs k=1,2 + BM25 FTS + RRF + Append-Only Audit Trail (`entity_audit_logs`). Tuân thủ Specification v1.5.
  - **[✅ IMPLEMENTED AGENT ORCHESTRATION & GUARDRAILS]:** Multi-Agent Orchestrator (Mô-đun 2) hoàn thiện với LangGraph.js, Zod Schema v4.1, và 2 Automated Guardrail Gates: Folklore Guardrail Gate (`folklore-validator.ts` Regex Pattern Matching) & NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts` Entailment Score $\ge 0.80$).
  - **[✅ IMPLEMENTED ENGINES & VLM]:** Engine Render Remotion 100% JSON-Driven (`packages/remotion-engine/src/`), 31 `LayoutMode`, 19 `TransitionType`, Zod Schema v4.1 runtime validation (`packages/shared-spec/src/schema.ts`). VLM Inspector Dual Scorer (`packages/vlm-inspector/src/`) lọc giấy phép bản quyền CC0, CC-BY, Public Domain và auto-fallback PURE_CODE.
  - **[✅ IMPLEMENTED TTS SERVICE]:** VieNeu TTS Dual-Layer Microservice (`VieNeuEngine` + `SyntheticTTSFallbackEngine`), Python FastAPI ONNX Engine (`app.py`), Zod Schema Validation, `wordTimestamps` → Caption Frame Converter, Eval Suite (`services/vieneu-tts/eval/`).
  - **[✅ IMPLEMENTED WEB APP & WORKER RUNTIME]:** Lớp ứng dụng `apps/web` (Next.js 14 App Router Monolith, NotebookLM Heritage Workspace UI/UX, REST API `/api/v1/chat`, `/api/v1/projects`, SSE Stream, WebSocket Gateway forward Redis PubSub `project_events:${projectId}`) song hành cùng `apps/render-worker` (BullMQ queues, Asset pre-download `/media`, process isolation `CONCURRENCY=1`).

---

## 2. Ma trận Trụ cột Công nghệ & Trạng thái Thực tế

| Trụ cột | Công nghệ lõi | Trạng thái Thực tế | Mô tả Chức năng & Không gian Mở rộng |
| --- | --- | :---: | --- |
| **Tiền xử lý & Nạp dữ liệu (Ingestion ETL)** | Master Crawler (`pnpm crawl:all`), OCR, Normalization (`SAME_AS_LOCATION`, `ALIAS_OF`), Dynamic Hierarchical Chunking, Dual-Branch Vector/Graph Seeder, Visual & Audio Media ETL, Copyright License Audit, LUFS Normalization | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 0: Lớp nạp dữ liệu offline làm sạch sử liệu cổ & SGK, cào 15 Thời kỳ Lịch sử, nạp PostgreSQL pgvector & Host Mount Volume `/media`, ghi nhật ký `entity_audit_logs`. |
| **Engine Render (Remotion)** | React 18 + Remotion v4, Ken Burns, 31 LayoutMode, Zod Discriminated Unions, Audio-Driven Timing, Fallback Overlay Data, Karaoke Sync | **[✅ IMPLEMENTED]** (100% Codebase) | Engine cốt lõi đã hoàn thiện, nhận JSON schema v4.1 để render MP4 mượt mà 0% vỡ layout. |
| **Tạo Giọng Đọc (TTS)** | Self-Hosted VieNeu Neural TTS (`vieneu.io`), FastAPI Python ONNX Engine + Node.js Dual-Layer Fallback, Word Timestamps | **[✅ IMPLEMENTED]** (Phase 1 Microservice & Eval Suite) | Giọng thuyết minh lịch sử truyền cảm, ngắt nghỉ chuẩn, sinh Word Timestamps cho chữ Karaoke, kèm bộ kiểm thử `services/vieneu-tts/eval/`. |
| **Dữ liệu & Tri thức (RAG)** | PostgreSQL-Powered GraphRAG (`pgvector` Dense BGE-M3 1024d + Relational Graph CTEs), SGK & Sử liệu cổ. | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 1: Hybrid GraphRAG (pgvector + Relational Graph CTEs k=1,2 + BM25 FTS + RRF). Đã vượt KPI: Fact Precision 100%, Hallucination Rate 0%, Citation Traceability 100%. |
| **Đội ngũ Agent (Multi-Agent)** | LangGraph.js Agentic Orchestrator (Node.js/TS) + PostgreSQL State Checkpointer + Automated Guardrails + Research Agent (online image search). | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 2: Quy trình chia phân cảnh & 5 Micro-Steps kịch bản (kèm Narrative Context & Duration Reconcile), Research Agent (Micro-Step 1C) dùng provider chain SerpAPI/Tavily/Brave/Wikimedia/Catalog để tìm ảnh, NLI Entailment Hallucination Judge & Folklore Guardrail Gate. |
| **Thẩm định Hình ảnh (VLM)** | Hybrid VLM (Google Gemini 3.6 Flash Cloud + Local CLIP ONNX Fallback) + Dual-Layer Cache + Research Agent candidate pool. | **[✅ IMPLEMENTED]** | Mô-đun 3: Thẩm định bối cảnh lịch sử theo Chiến lược 3+3 Candidates (nhận candidate từ Research Agent), lọc giấy phép Whitelisted (`Public Domain`, `CC0`, `CC-BY`), tự động chọn Fallback Pure Code Layout Rotation. |

> 🔗 **Tài liệu Chi tiết:** Tra cứu [architecture/](architecture) cho Kiến trúc Hệ thống & Hạ tầng và [modules/](modules) cho 5 Mô-đun Pipeline.

---

## 3. Kiến trúc Hệ thống (System Architecture v3.4)

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

Để giải quyết triệt để vấn đề lấy sai ảnh lịch sử (ví dụ: crawl nhầm ảnh phim cổ trang Trung Quốc hoặc ảnh sai thời kỳ), Agent VLM hoạt động theo cơ chế 3 lớp kết hợp Chiến lược 3+3 Candidates. **Trước đó, Research Agent (Micro-Step 1C)** đã tìm candidate pool online qua provider chain (SerpAPI/Tavily/Brave/Wikimedia/Catalog) với **domain whitelist** — nên VLM chỉ nhận ảnh đã an toàn nguồn gốc:

1. **Lớp 0: Nhận candidate từ Research Agent** — `researchResults[sceneId]` (kèm provenance provider/latency). Fallback gọi `resolveImageCandidates` inline nếu chưa có.
2. **Lớp 1: Filter kỹ thuật sơ cấp (Metadata Filter)**
   - Kiểm tra độ phân giải, tỉ lệ khung hình (> 600×600), định dạng hợp lệ.

3. **Lớp 2: Phân tích Thị giác bằng VLM (Gemini 3.6 Flash Cloud API) & Chiến lược 3+3 Candidates**
   - *Đầu vào:* Hình ảnh crawl được + Từ khóa sự kiện + Mô tả bối cảnh từ RAG.
   - *Tiêu chí chấm điểm (Score 0–100):*
     - **Historical Context Score:** Trang phục, kiến trúc có đúng bối cảnh Việt Nam không? (Loại bỏ ảnh có cờ, trang phục triều đại phong kiến Trung Quốc/Triều Tiên).
     - **Visual Noise Score:** Ảnh có bị dính watermark, logo kênh truyền hình, chữ viết đè quá nhiều không?
     - **Artistic Fit Score:** Ảnh chụp thật, tranh vẽ lịch sử hay sơ đồ địa hình?
   - *Bộ đệm 2 lớp (Redis Dual-Layer Cache):* Hash SHA-256 và Perceptual Hash (pHash) trong Redis (TTL 30 ngày) giúp lấy kết quả audit trong 1ms đối với ảnh trùng lặp.

4. **Lớp 3: Phương án Dự phòng (Fallback Mechanism)**
   - Nguồn ảnh trong ChronoViet là **100% Crawl từ Internet/Kho tư liệu** (không dùng Generative AI).
   - Nếu điểm VLM < 60: Tự động chuyển hướng sang Re-crawl tìm **Sơ đồ trận đánh / Bản đồ cổ / Ảnh di tích cổ**, hoặc tự động fallback sang các **Pure Code LayoutMode** (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`...) để đảm bảo video render thành công 100% không bị hỏng layout.

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

## 6. Định hướng Mở rộng Tương lai (Future Scope & Scalability)

Dự án **ChronoViet** được thiết kế với kiến trúc Mô-đun (Modular), cho phép mở rộng các tính năng nâng cao trong các giai đoạn sau:

* **Chrono-Gamification:** Dựa trên video vừa render, RAG tự động tạo ra bộ câu hỏi trắc nghiệm tương tác (Quiz) để người học ôn luyện ngay sau khi xem.
* **Multi-language Global Heritage:** Mở rộng RAG để dịch kịch bản và phát âm TTS đa ngôn ngữ (Tiếng Anh, Tiếng Pháp, Tiếng Nhật...), biến ChronoViet thành công cụ quảng bá lịch sử/du lịch Việt Nam ra thế giới.
* **Interactive Storytelling (Video nhánh):** Người dùng có thể chọn các quyết định lịch sử trong khi xem video (Ví dụ: *"Nếu nhà Hồ không xây thành Tây Đô thì sao?"*) và RAG sẽ simulate ra kịch bản giả định (Alternate History) dạng video.
* **Chrono-Map (Bản đồ tri thức theo thời gian):** Tích hợp bản đồ địa lý tương tác (Mapbox/Leaflet), hiển thị các video được ghim trực tiếp lên mốc tọa độ địa lý thực tế trên bản đồ Việt Nam.