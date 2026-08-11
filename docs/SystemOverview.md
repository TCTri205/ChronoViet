# Tài liệu Khái niệm & Kiến trúc Tổng quan: Dự án ChronoViet

**ChronoViet** (kết hợp giữa *Chronology* - Niên đại/Lịch sử và *Việt Nam*) là nền tảng EdTech ứng dụng AI thế hệ mới, biến nguồn tri thức lịch sử Việt Nam dạng văn bản thành các **Video tóm tắt trực quan tự động** kết hợp **Hệ thống Chatbot RAG tương tác hai chiều**.

---

## 1. Tổng quan Dự án (Executive Overview)

* **Tên dự án:** ChronoViet
* **Định vị:** Hệ thống tự động hóa nội dung giáo dục lịch sử (Automated Historical EdTech Platform).
* **Bài toán giải quyết:** Lịch sử Việt Nam có kho tàng dữ liệu đồ sộ nhưng văn bản khô khan, dễ bị sai lệch khi AI sinh nội dung (hallucination), và thiếu các công cụ trực quan hóa dạng video ngắn cho thế hệ trẻ.
* **Giải pháp:** Sử dụng **Data Preprocessing & Ingestion Engine (Mô-đun 0)** để làm sạch, chuẩn hóa địa danh/nhân vật và nạp dữ liệu offline $\rightarrow$ **Hybrid GraphRAG (Mô-đun 1)** để đảm bảo tính chuẩn xác sử liệu $\rightarrow$ **Multi-Agent Orchestrator (Mô-đun 2)** chia nhỏ kịch bản & chọn layout $\rightarrow$ **VLM Inspector (Mô-đun 3)** kiểm định hình ảnh & bản quyền $\rightarrow$ **Remotion Engine (Mô-đun 4)** render video tự động từ file JSON.
* **Trạng thái Triển khai Hệ thống:**
  - **[✅ IMPLEMENTED ENGINES]:** Engine Render Remotion 100% JSON-Driven (`packages/remotion-engine/src/`), 31 `LayoutMode` (tối ưu 16:9), 19 `TransitionType`, Zod Schema runtime validation (`packages/shared-spec/src/schema.ts`), 19 UI Components, 11 Compositions đã đăng ký (`Root.tsx`), 9 file kịch bản JSON dữ liệu mẫu v4.1.
  - **[✅ IMPLEMENTED RAG & INGESTION]:** Data Preprocessing & Ingestion Engine (Mô-đun 0) và Chrono-RAG Engine (Mô-đun 1) hoàn thiện 100% codebase & eval (`packages/rag-engine/src/`, `eval/`). Hybrid GraphRAG PostgreSQL pgvector + Relational Graph CTEs k=1,2 + BM25 FTS + RRF.
  - **[✅ IMPLEMENTED TTS SERVICE]:** VieNeu TTS Dual-Layer Microservice (`VieNeuEngine` + `SyntheticTTSFallbackEngine`), Python FastAPI ONNX Engine (`app.py`), Zod Schema Validation, `wordTimestamps` → Caption Frame Converter, Eval Suite (`services/vieneu-tts/eval/`).

---

## 2. Ma trận Trụ cột Công nghệ & Trạng thái Thực tế

| Trụ cột | Công nghệ lõi | Trạng thái Thực tế | Mô tả Chức năng & Không gian Mở rộng |
| --- | --- | :---: | --- |
| **Tiền xử lý & Nạp dữ liệu (Ingestion ETL)** | OCR, Normalization (`SAME_AS_LOCATION`, `ALIAS_OF`), Dynamic Hierarchical Chunking, Dual-Branch Vector/Graph Seeder, Visual & Audio Media ETL, Copyright License Audit, LUFS Normalization | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 0: Lớp nạp dữ liệu offline làm sạch sử liệu cổ & SGK, nạp PostgreSQL pgvector & Host Mount Volume `/media`, tạo tập Golden Datasets cho `eval/`. |
| **Engine Render (Remotion)** | React 18 + Remotion v4, Ken Burns, 31 LayoutMode, Zod Discriminated Unions, Audio-Driven Timing, Fallback Overlay Data, Karaoke Sync | **[✅ IMPLEMENTED]** (100% Codebase) | Engine cốt lõi đã hoàn thiện, nhận JSON schema v4.1 để render MP4 mượt mà 0% vỡ layout. |
| **Tạo Giọng Đọc (TTS)** | Self-Hosted VieNeu Neural TTS (`vieneu.io`), FastAPI Python ONNX Engine + Node.js Dual-Layer Fallback, Word Timestamps | **[✅ IMPLEMENTED]** (Phase 1 Microservice & Eval Suite) | Giọng thuyết minh lịch sử truyền cảm, ngắt nghỉ chuẩn, sinh Word Timestamps cho chữ Karaoke, kèm bộ kiểm thử `services/vieneu-tts/eval/`. |
| **Dữ liệu & Tri thức (RAG)** | PostgreSQL-Powered GraphRAG (`pgvector` Dense BGE-M3 1024d + Relational Graph CTEs), SGK & Sử liệu cổ. | **[✅ IMPLEMENTED]** (100% Codebase & Eval) | Mô-đun 1: Hybrid GraphRAG (pgvector + Relational Graph CTEs k=1,2 + BM25 FTS + RRF). Đã vượt KPI: Fact Precision 100%, Hallucination Rate 0%, Citation Traceability 100%. |
| **Đội ngũ Agent (Multi-Agent)** | LangGraph.js Agentic Orchestrator (Node.js/TS) + PostgreSQL State Checkpointer. | **[📐 ARCHITECTURE DESIGN]** (v3.2 Spec) | Mô-đun 2: Quy trình Chaptering & 5 Micro-Steps kịch bản (kèm Narrative Context & Duration Reconcile), Hybrid Fact-Checker (Alias Table & 4-Tier Escalation Path), Whitelisted License & Postgres Checkpoint. |
| **Thẩm định Hình ảnh (VLM)** | Hybrid VLM (Google Gemini 2.5 Flash Cloud + Local CLIP ONNX Fallback) + Dual-Layer Cache. | **[📐 ARCHITECTURE DESIGN]** (v3.2 Spec) | Mô-đun 3: Thẩm định bối cảnh lịch sử theo Chiến lược 3+3 Candidates, lọc giấy phép Whitelisted (`Public Domain`, `CC0`, `CC-BY`), tự động chọn Fallback Pure Code Layout Rotation. |

> 🔗 **Tài liệu Chi tiết:** Tra cứu [docs/architecture/](file:///D:/Persional_Projects/ChronoViet/docs/architecture) cho Kiến trúc Hệ thống & Hạ tầng và [docs/modules/](file:///D:/Persional_Projects/ChronoViet/docs/modules) cho 5 Mô-đun Pipeline.

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
                              │ Parallel Worker A: TTS      │                                                 │ Parallel Worker B: Crawler  │
                              │ (VieNeu ONNX Engine)        │                                                 │ + Mô-đun 3: Hybrid VLM      │
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

Để giải quyết triệt để vấn đề lấy sai ảnh lịch sử (ví dụ: crawl nhầm ảnh phim cổ trang Trung Quốc hoặc ảnh sai thời kỳ), Agent VLM hoạt động theo cơ chế 3 lớp kết hợp Chiến lược 3+3 Candidates:

1. **Lớp 1: Filter kỹ thuật sơ cấp (Metadata Filter)**
   - Kiểm tra độ phân giải, tỉ lệ khung hình (> 600×600), định dạng hợp lệ.

2. **Lớp 2: Phân tích Thị giác bằng VLM (Gemini 2.5 Flash Cloud API) & Chiến lược 3+3 Candidates**
   - *Đầu vào:* Hình ảnh crawl được + Từ khóa sự kiện + Mô tả bối cảnh từ RAG.
   - *Tiêu chí chấm điểm (Score 0–100):*
     - **Historical Context Score:** Trang phục, kiến trúc có đúng bối cảnh Việt Nam không? (Loại bỏ ảnh có cờ, trang phục triều đại phong kiến Trung Quốc/Triều Tiên).
     - **Visual Noise Score:** Ảnh có bị dính watermark, logo kênh truyền hình, chữ viết đè quá nhiều không?
     - **Artistic Fit Score:** Ảnh chụp thật, tranh vẽ lịch sử hay sơ đồ địa hình?
   - *Bộ đệm 2 lớp (Redis Dual-Layer Cache):* Hash SHA-256 và Perceptual Hash (pHash) trong Redis (TTL 30 ngày) giúp lấy kết quả audit trong 1ms đối với ảnh trùng lặp.

3. **Lớp 3: Phương án Dự phòng (Fallback Mechanism)**
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

> **Lưu ý thời lượng scene:** Dùng `"startTime"` + `"endTime"` (giây) **hoặc** `"durationInFrames"` (số frames). Engine tự xử lý cả hai. `durationInFrames` có độ ưu tiên cao hơn khi có cả hai.

👉 *Xem chi tiết quy chuẩn kỹ thuật đầy đủ tại:* [EVAL_REMOTION_TECHNICAL_SPEC.md](file:///D:/Persional_Projects/ChronoViet/docs/EVAL_REMOTION_TECHNICAL_SPEC.md)

---

## 6. Định hướng Mở rộng Tương lai (Future Scope & Scalability)

Dự án **ChronoViet** được thiết kế với kiến trúc Mô-đun (Modular), cho phép mở rộng các tính năng nâng cao trong các giai đoạn sau:

* **Chrono-Gamification:** Dựa trên video vừa render, RAG tự động tạo ra bộ câu hỏi trắc nghiệm tương tác (Quiz) để người học ôn luyện ngay sau khi xem.
* **Multi-language Global Heritage:** Mở rộng RAG để dịch kịch bản và phát âm TTS đa ngôn ngữ (Tiếng Anh, Tiếng Pháp, Tiếng Nhật...), biến ChronoViet thành công cụ quảng bá lịch sử/du lịch Việt Nam ra thế giới.
* **Interactive Storytelling (Video nhánh):** Người dùng có thể chọn các quyết định lịch sử trong khi xem video (Ví dụ: *"Nếu nhà Hồ không xây thành Tây Đô thì sao?"*) và RAG sẽ simulate ra kịch bản giả định (Alternate History) dạng video.
* **Chrono-Map (Bản đồ tri thức theo thời gian):** Tích hợp bản đồ địa lý tương tác (Mapbox/Leaflet), hiển thị các video được ghim trực tiếp lên mốc tọa độ địa lý thực tế trên bản đồ Việt Nam.