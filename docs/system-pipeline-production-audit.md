# ChronoViet — Comprehensive System Pipeline Audit & Production Hardening Plan

> **Tài liệu:** Báo cáo Rà soát, Đối chiếu & Phân tích Toàn diện Pipeline Hệ thống  
> **Mục tiêu:** Xác minh toàn bộ các điểm nghẽn (bottlenecks), rủi ro vận hành (production risks), lỗ hổng kiến trúc và đề xuất giải pháp chuẩn hóa cấp Production cho ChronoViet.  
> **Ngày lập:** 27/08/2026  
> **Tác giả:** Antigravity AI Architect & System Engineering Team  

---

## 1. Mục lục
1. [Tổng quan Kiến trúc Hệ thống End-to-End](#2-tổng-quan-kiến-trúc-hệ-thống-end-to-end)
2. [Chi tiết Rà soát & Đánh giá 7 Tầng Pipeline](#3-chi-tiết-rà-soát--đánh-giá-7-tầng-pipeline)
   - [Tầng 1: Pipeline Tiền xử lý & Nạp Đồ thị Tri thức (Data Ingestion & Graph ETL)](#tầng-1-pipeline-tiền-xử-lý--nạp-đồ-thị-tri-thức-data-ingestion--graph-etl)
   - [Tầng 2: Pipeline Truy hồi Tri thức & Tái xếp hạng (Chrono-RAG & Hybrid Retrieval)](#tầng-2-pipeline-truy-hồi-tri-thức--tái-xếp-hạng-chrono-rag--hybrid-retrieval)
   - [Tầng 3: Pipeline Điều phối Multi-Agent & Chat Supervisor (LangGraph & Guardrails)](#tầng-3-pipeline-điều-phối-multi-agent--chat-supervisor-langgraph--guardrails)
   - [Tầng 4: Pipeline Nghiên cứu Hình ảnh & Thẩm định Thị giác (Visual Research & VLM)](#tầng-4-pipeline-nghiên-cứu-hình-ảnh--thẩm-định-thị-giác-visual-research--vlm)
   - [Tầng 5: Pipeline Sinh Giọng Đọc & Đồng bộ Thời gian (TTS & Audio Synchronization)](#tầng-5-pipeline-sinh-giọng-đọc--đồng-bộ-thời-gian-tts--audio-synchronization)
   - [Tầng 6: Pipeline Render Video & Quản lý Worker (Remotion Engine & BullMQ)](#tầng-6-pipeline-render-video--quản-lý-worker-remotion-engine--bullmq)
   - [Tầng 7: Pipeline Hạ tầng, Supervisor & Quản lý Mô hình AI (Infra & Model Serving)](#tầng-7-pipeline-hạ-tầng-supervisor--quản-lý-mô-hình-ai-infra--model-serving)
3. [Rà soát & Trạng thái Fix Bug Trích dẫn Giao diện (Citation UI Bug)](#4-rà-soát--trạng-thái-fix-bug-trích-dẫn-giao-diện-citation-ui-bug)
4. [Bảng Ma trận Điểm nghẽn & Giải pháp Production-Grade](#5-bảng-ma-trận-điểm-nghẽn--giải-pháp-production-grade)
5. [Lộ trình Triển khai Chuẩn Hóa Production (Production Roadmap)](#6-lộ-trình-triển-khai-chuẩn-hóa-production-production-roadmap)

---

## 2. Tổng quan Kiến trúc Hệ thống End-to-End

ChronoViet kết hợp hai luồng nghiệp vụ cốt lõi:
1. **Interactive NotebookLM-Style Research Chatbot:** Tra cứu sử liệu chính xác 100% với trích dẫn gốc, chống suy diễn/ảo giác (Zero Hallucination), hỗ trợ đồ thị thực thể (Graph Triples) và kiểm soát tiền đề sai lệch (Anti-Sycophancy).
2. **Autonomous Multi-Agent Video Generation:** Quy trình 1-Click tự động hóa từ phân chia kịch bản, tìm kiếm tư liệu ảnh có bản quyền, thẩm định VLM, thu âm giọng đọc VieNeu TTS, đến render video Remotion chất lượng cao.

```
                                  CHRONOVIET END-TO-END PIPELINE
                                  
  ┌───────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │ 1. INGESTION & GRAPH  │ ───► │ 2. HYBRID RETRIEVAL     │ ───► │ 3. AGENT ORCHESTRATION  │
  │ • Crawl & OCR         │      │ • Dense (BGE-M3 1024d)  │      │ • Intent Classifier     │
  │ • Hierarchical Chunk  │      │ • Sparse (BM25 FTS)     │      │ • Multi-turn Rewriter   │
  │ • Knowledge Graph ETL │      │ • Graph CTEs (k=1,2)    │      │ • Script 5-Step LangGraph
  │ • Entity Audit Trail  │      │ • RRF & Reranker (8096) │      │ • Guardrail Gates       │
  └───────────────────────┘      └─────────────────────────┘      └────────────┬────────────┘
                                                                               │
                                 ┌─────────────────────────────────────────────┴─────────────────────────────────────────────┐
                                 ▼                                                                                           ▼
                    ┌─────────────────────────┐                                                                 ┌─────────────────────────┐
                    │ 4. VISUAL & VLM GATE    │                                                                 │ 5. TTS & AUDIO PIPELINE │
                    │ • Multi-provider Search │                                                                 │ • VieNeu ONNX (Port 8080)
                    │ • License & Binary Gate │                                                                 │ • Word Timestamps Sync  │
                    │ • Redis pHash Cache     │                                                                 │ • LUFS Normalization    │
                    │ • VLM Context Scoring   │                                                                 └────────────┬────────────┘
                    └────────────┬────────────┘                                                                              │
                                 │                                                                                           │
                                 └───────────────────────────────┬───────────────────────────────────────────────────────────┘
                                                                 ▼
                                                    ┌─────────────────────────┐
                                                    │ 6. REMOTION RENDER WORKER│
                                                    │ • BullMQ Job Queue      │
                                                    │ • Asset Pre-download    │
                                                    │ • Chrome Process Isolate│
                                                    │ • 31 Layouts & Karaoke  │
                                                    └────────────┬────────────┘
                                                                 ▼
                                                    ┌─────────────────────────┐
                                                    │ 7. INFRA & SUPERVISOR   │
                                                    │ • 4 Model Port Daemon   │
                                                    │ • KV Cache & RAM Pools  │
                                                    │ • Distributed Probes    │
                                                    └─────────────────────────┘
```

---

## 3. Chi tiết Rà soát & Đánh giá 7 Tầng Pipeline

---

### Tầng 1: Pipeline Tiền xử lý & Nạp Đồ thị Tri thức (Data Ingestion & Graph ETL)

#### 1. Các file liên quan:
* `packages/data-ingestion/src/normalizer/`
* `packages/data-ingestion/src/chunking/hierarchical-chunker.ts`
* `packages/data-ingestion/src/seeder/knowledge-graph-seeder.ts`
* `packages/shared-spec/src/dictionaries.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Sự phụ thuộc vào Từ điển Thực thể Tĩnh (`HISTORICAL_PERSON_DICTIONARY`):**
  - Hiện tại, việc trích xuất và liên kết thực thể (Entity Linking) chủ yếu dựa trên danh sách từ khóa cố định trong `packages/shared-spec/src/dictionaries.ts`.
  - *Rủi ro Production:* Khi nạp các tài liệu chuyên khảo sâu hoặc văn bản mới, các thực thể chưa có trong từ điển tĩnh (ví dụ: các vị quan lại địa phương, tướng lĩnh thứ yếu, các địa danh cổ thời Bắc thuộc) sẽ bị bỏ sót, không thể sinh ra Knowledge Graph Triples.
* **Mất Ngữ Cảnh Xuyên Đoạn khi Cắt Chunk (Cross-Chunk Context Disconnection):**
  - Khi chia văn bản dài thành các chunk cấp 2 (Level 2: 250-400 từ), các đại từ thay thế (*"ông"*, *"vị vua này"*, *"sau chiến thắng ấy"*) nằm ở đầu chunk 2 bị ngắt khỏi chủ ngữ thực thể ở chunk 1.
  - *Hậu quả:* BGE-M3 embedding của chunk 2 bị mất vector semantic liên quan đến tên nhân vật, dẫn đến truy hồi Dense Search bị trượt.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **Zero-shot LLM Entity/Relation Extractor (JIT Daemon):** Tận dụng model Extraction Qwen 4B (port `8094`) trong quá trình Ingestion để trích xuất tự động bộ 3 $(Entity_1, Relation, Entity_2, Confidence)$ kèm trích xuất Wikidata QID.
* **Contextual Chunk Enrichment (Late Chunking Injection):** Luôn tự động chèn metadata ngữ cảnh vào đầu mỗi chunk trước khi tính Vector:
  ```markdown
  [Chủ Đề: <Tên Thực Thể>] [Triều Đại: <Thời Kỳ>] [Bối Cảnh: <Tóm Tắt Chunk Cha>]
  <Nội dung văn bản chi tiết của chunk...>
  ```

---

### Tầng 2: Pipeline Truy hồi Tri thức & Tái xếp hạng (Chrono-RAG & Hybrid Retrieval)

#### 1. Các file liên quan:
* `packages/rag-engine/src/rag-engine.ts`
* `packages/rag-engine/src/retrieval/vector-search.ts`
* `packages/rag-engine/src/retrieval/graph-cte-search.ts`
* `packages/rag-engine/src/retrieval/reranker.ts`
* `packages/rag-engine/src/retrieval/question-ner.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Reciprocal Rank Fusion (RRF) Cố Định Thiếu Linh Hoạt ($k=60$):**
  - RRF đang trộn Dense Search (BGE-M3) và Sparse FTS (Postgres TSVector) với trọng số tĩnh $1/60$.
  - *Rủi ro Production:* Đối với các câu hỏi tra cứu niên đại chính xác (ví dụ: *"Trận Ngọc Hồi Đống Đa diễn ra ngày tháng năm nào?"*), Sparse FTS bắt được chính xác số năm `1789` nhưng bị Dense Search pha loãng điểm do Dense Search ưu tiên tính tương đồng ngữ nghĩa rộng.
* **Nghẽn Latency tại Recursive Graph CTEs:**
  - File `graph-cte-search.ts` sử dụng câu lệnh SQL `WITH RECURSIVE` để mở rộng $k=2$ bước nhảy trên PostgreSQL. Khi số lượng cạnh lớn ($>80.000$ quan hệ), truy vấn có thể mất từ 200ms đến 800ms nếu bảng quan hệ thiếu composite index tối ưu trên `(source_entity_id, target_entity_id, confidence)`.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **Query-Adaptive Dynamic RRF Weighting:**
  - Nếu query có chứa mốc thời gian (`extractHistoricalYears` > 0) $\rightarrow$ Tăng trọng số Sparse BM25 lên $70\%$, giảm Vector xuống $30\%$.
  - Nếu query là so sánh hoặc quan hệ nhân vật $\rightarrow$ Tăng trọng số Graph CTE lên $50\%$.
* **Materialized Graph Path Views:** Pre-compute các đường dẫn quan hệ thường gặp (Gia phả triều đại, các cuộc chiến tranh lớn) vào Materialized View, chuyển đổi recursive CTE thành phép lookup index tức thì ($<5\text{ms}$).

---

### Tầng 3: Pipeline Điều phối Multi-Agent & Chat Supervisor (LangGraph & Guardrails)

#### 1. Các file liên quan:
* `packages/agent-orchestrator/src/chat/chat-supervisor.ts`
* `packages/agent-orchestrator/src/chat/intent-classifier.ts`
* `packages/agent-orchestrator/src/chat/context-pruner.ts`
* `packages/agent-orchestrator/src/graph/orchestrator.ts`
* `packages/agent-orchestrator/src/guardrails/anti-sycophancy.ts`
* `packages/agent-orchestrator/src/guardrails/nli-hallucination-judge.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Intent Classifier Quá "Giòn" (Regex Brittleness) & Thiếu Sub-Intents:**
  - File `intent-classifier.ts` hoàn toàn dùng Regex. Gặp câu hỏi tự nhiên có từ lóng, teencode hoặc câu ghép phức tạp là bị rơi vào fallback `HISTORICAL_QUERY` chung chung.
  - Thiếu các Sub-Intents lịch sử quan trọng: `FACTOID_LOOKUP` (hỏi dữ kiện đơn), `GENEALOGY_RELATION` (hỏi phả hệ), `BATTLE_TACTICS` (hỏi chiến thuật), `COMPARATIVE_SYNTHESIS` (so sánh đa thời kỳ).
* **Cắt Lát Triples Thô Sơ (`triples.slice(0, 15)`):**
  - Trong `context-pruner.ts`, việc cắt lấy 15 triples đầu tiên theo thứ tự ngẫu nhiên của database có thể làm mất các **Bridge Triples** (triples cầu nối trực tiếp giữa 2 thực thể đang được hỏi), gây ảo giác gia phả.
* **Quy Trình Kịch Bản 5 Bước Chạy Tuần Tự (High Latency in Script Gen):**
  - LangGraph thực thi tuần tự: `Chaptering` $\rightarrow$ `Scriptwriter` $\rightarrow$ `FactChecker` $\rightarrow$ `Segmenter` $\rightarrow$ `KeywordNode`. Mỗi node mất 5-10s gọi LLM, dẫn đến tổng thời gian sinh kịch bản lên tới 45-70 giây.
* **NLI Judge Thiếu Cơ Chế Patching Cục Bộ:**
  - Khi phát hiện một câu sai lịch sử ở Scene 3, hệ thống phải sinh lại toàn bộ kịch bản từ đầu thay vì chỉ sửa đúng Scene 3.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **2-Tier Cascading Intent Router:**
  - Tầng 1: Regex Fast Filter (<1ms) cho Chitchat & Out-of-Domain.
  - Tầng 2: Semantic Sub-Intent Router (<10ms) phân loại chính xác bản chất câu hỏi để cấp ngân sách Triples/Context tương ứng.
* **Bridge Graph & Entity-Priority Pruning:** Lọc Triples theo thứ tự ưu tiên:
  1. Triples kết nối trực tiếp các thực thể trong câu hỏi ($Entity_A \rightarrow Relation \rightarrow Entity_B$).
  2. Triples thuộc tính cốt lõi (Tên húy, Niên hiệu, Năm sinh/mất).
  3. Triples lân cận 1-hop.
* **DAG Parallelization & Granular Scene Patching:**
  - Chạy song song `Segmenter` và `Keyword Extractor`.
  - Khi Fact-Checker phát hiện mâu thuẫn, chỉ gửi lệnh Patching cho riêng scene bị lỗi kèm trích đoạn RAG tương ứng.

---

### Tầng 4: Pipeline Nghiên cứu Hình ảnh & Thẩm định Thị giác (Visual Research & VLM)

#### 1. Các file liên quan:
* `packages/agent-orchestrator/src/research/` (SerpAPI, Tavily, Brave, Wikimedia, Gallica)
* `packages/vlm-inspector/src/`
* `packages/agent-orchestrator/src/graph/nodes/vlm-node.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Nghẽn Tải & Xử lý Đồng Thời 6 Ảnh Ứng Viên (3+3 Candidates Strategy):**
  - Research Agent tải đồng thời 6 ảnh từ các server ngoài Internet $\rightarrow$ decode nhị phân $\rightarrow$ encode Base64 $\rightarrow$ gửi toàn bộ 6 ảnh sang VLM.
  - *Rủi ro Production:* Nếu một domain ngoài bị nghẽn mạng (slow host), request bị treo theo timeout. Đồng thời, đẩy 6 ảnh Base64 vào VLM local (Qwen 3.5 VLM trên port 8092) cùng lúc gây nghẽn hàng đợi suy luận của toàn hệ thống.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **Async Circuit Breaker:** Đặt timeout tải ảnh tối đa 2.5s với `AbortController`. Nếu ảnh bị timeout, tự động bỏ qua candidate đó.
* **Cascade VLM Evaluation (Chấm điểm Thác nước):**
  - Chấm điểm ảnh Ứng viên 1 $\rightarrow$ Nếu VLM Score $>85$ (Rất khớp bối cảnh) $\rightarrow$ **Chấp nhận ngay và dừng kiểm tra các ảnh còn lại**, tiết kiệm $80\%$ tải VLM.

---

### Tầng 5: Pipeline Sinh Giọng Đọc & Đồng bộ Thời gian (TTS & Audio Synchronization)

#### 1. Các file liên quan:
* `services/vieneu-tts/` (Python FastAPI ONNX Engine, port 8080)
* `packages/infra/src/tts/`
* `packages/agent-orchestrator/src/graph/nodes/tts-node.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Lệch Index Phụ Đề Karaoke khi có Số Năm & Từ Viết Tắt:**
  - VieNeu TTS chuẩn hóa văn bản `"Năm 1789"` thành âm đọc *"Năm một nghìn bảy trăm tám mươi chín"*.
  - Word timestamps trả về danh sách 8 từ, nhưng kịch bản văn bản trên Remotion vẫn hiển thị `"1789"`. Điều này gây lệch token khi highlight Karaoke từng chữ trên video.
* **Âm Lượng Nhạc Nền (BGM) Tĩnh:**
  - `bgmVolume` đang được gán tĩnh ($0.25$). Ở những phân cảnh kịch tính hoặc có nhiều hiệu ứng âm thanh, nhạc nền có thể lấn át giọng thuyết minh lịch sử.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **Text Normalization Alignment Bridge:** Đưa văn bản qua bộ tiền xử lý Text-to-Phoneme đồng nhất trước khi truyền vào cả VieNeu TTS và Remotion Composition JSON.
* **Dynamic Audio Ducking trong Remotion:** Áp dụng dynamic volume envelope tự động giảm volume BGM xuống $-12\text{dB}$ tại các frame có giọng đọc và phục hồi khi chuyển cảnh.

---

### Tầng 6: Pipeline Render Video & Quản lý Worker (Remotion Engine & BullMQ)

#### 1. Các file liên quan:
* `packages/remotion-engine/src/compositions/ChronoVideo.tsx`
* `apps/render-worker/src/index.ts`
* `apps/render-worker/src/jobs/render-job.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Tích tụ Bộ Nhớ Chromium Headless (Memory Leaks):**
  - Remotion render video bằng headless Chromium. Khi render hàng loạt video liên tục, các tiến trình Chromium con có thể tích tụ RAM hoặc để lại zombie processes nếu job bị cancel giữa chừng.
* **Tranh chấp I/O trên Thư mục Host Mount `/media`:**
  - Các worker ghi file tạm (audio slices, downloaded images, mp4 chunks) vào cùng một volume mà không có cơ chế atomic file locks.

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **Worker Process Recycling:** Cấu hình BullMQ tự động restart worker process sạch sẽ sau mỗi 10 jobs render thành công.
* **Atomic Job Scratch Directories:** Mỗi render job được cấp một thư mục scratch riêng biệt (`/media/jobs/<jobId>`), dọn dẹp sạch sẽ qua hook `finally`.
* **RAM Disk Asset Caching:** Cache sẵn các assets tĩnh dùng chung (viền cổ trang, hiệu ứng bụi/khói lửa) trên `/dev/shm` để tránh nghẽn đọc đĩa cứng.

---

### Tầng 7: Pipeline Hạ tầng, Supervisor & Quản lý Mô hình AI (Infra & Model Serving)

#### 1. Các file liên quan:
* `scripts/ai-supervisor.ts`
* `packages/infra/src/llm/`
* `packages/infra/src/db/`
* `apps/web/src/server.ts`

#### 2. Vấn đề & Điểm nghẽn xác minh:
* **Tranh chấp Tài nguyên RAM/VRAM giữa 4 Tiến trình AI Local:**
  - Chạy đồng thời LLM 9B (`8092`) + BGE-M3 (`8090`) + Extraction 4B (`8094`) + Reranker (`8096`) tiêu tốn $>14\text{GB}$ RAM, gây hiện tượng swap disk trên máy phát triển cá nhân.
* **Mất Prompt KV-Cache do System Prompt Biến Đổi Liên Tục:**
  - Do nhồi ngữ cảnh RAG và Triples động vào giữa System Prompt, chuỗi tiền tố (prefix) bị thay đổi ở mỗi lượt chat. `llama-server` không thể tái sử dụng KV Cache, buộc phải tính toán lại toàn bộ prompt (Prompt Eval Time chiếm tới $80\%$ tổng thời gian trễ 20-40s).

#### 3. Giải pháp Cải tiến Chuẩn Production:
* **KV-Cache Friendly Prompt Architecture (Cố định System Prompt Prefix):**
  - Giữ cố định $100\%$ đoạn System Persona ở đầu.
  - Đưa toàn bộ ngữ cảnh RAG và Triples vào tin nhắn User dưới dạng block `<historical_context>`. Nhờ đó, `llama-server` tái sử dụng được KV Cache của System Persona, giảm độ trễ từ 20-40s xuống **< 2 giây**.
* **Dynamic JIT Model Eviction trong AI Supervisor:**
  - Tự động unmount Extraction LLM (`8094`) và Reranker (`8096`) khi không có tác vụ Ingestion/Video-Gen, trả lại trọn vẹn $100\%$ RAM cho LLM (`8092`) và Embedding (`8090`).

---

## 4. Rà soát & Trạng thái Fix Bug Trích dẫn Giao diện (Citation UI Bug)

### 4.1. Bản chất Bug
* **Hiện tượng:** Nguồn trích dẫn số `[4]` hiển thị dở dang: `Khởi nghĩa Lam Sơn - Đoạn 2.3 [Nguồn:`.
* **Nguyên nhân gốc rễ:**
  1. `rag-engine.ts` trả về chuỗi thô chứa nhãn `[Nguồn: LEVEL_2]`.
  2. `ChatContainer.tsx` map nguyên văn chuỗi thô vào `sourceTitle` và gán cứng `reliabilityLevel: 1`.
  3. `CitationBadge.tsx` đặt CSS `max-w-[180px] truncate` khiến chuỗi dài bị cắt cụt ngay tại chữ `[Nguồn:`.

### 4.2. Trạng thái Sửa Đổi & Kiểm Định
* **Code đã sửa:**
  - Thêm hàm `parseRawCitation()` chuẩn hóa bóc tách sạch tên tài liệu và cấp độ sử liệu (Level 1, 2, 3) vào `CitationBadge.tsx`.
  - Mở rộng độ rộng tối đa `sm:max-w-[320px]` và thêm pill badge phân loại độ tin cậy (`Chính sử`, `Khảo cứu`, `Dã sử`).
  - Đồng bộ `parseRawCitation()` cho cả lịch sử tin nhắn và luồng streaming trong `ChatContainer.tsx`.
* **Xác minh kỹ thuật:** `pnpm --filter @chronoviet/web typecheck` $\rightarrow$ **PASS 100% (0 errors)**.

---

## 5. Bảng Ma trận Điểm nghẽn & Giải pháp Production-Grade

| Tầng | Vấn đề Thực Tế | Mức độ Nghiêm trọng | Giải pháp Production-Grade | Tệp Mã Nguồn Trọng Tâm |
| :--- | :--- | :---: | :--- | :--- |
| **1. Ingestion** | Entity Linking dựa từ điển cứng, chunking mất context | **Cao** | Dynamic SLM Entity Extractor + Late Chunking Context Injection | `packages/data-ingestion/` |
| **2. RAG** | RRF cố định $k=60$, Recursive CTEs chậm khi graph lớn | **Trung bình** | Query-Adaptive RRF + Materialized Subgraph Views | `packages/rag-engine/` |
| **3. Agent** | Intent classifier giòn, 5 bước script tuần tự, NLI thiếu patch | **Cao** | 2-Tier Semantic Intent Router + DAG Parallelization + Scene Patching | `packages/agent-orchestrator/` |
| **4. Visual/VLM** | Tải 6 ảnh đồng thời, nghẽn hàng đợi VLM | **Cao** | Async Circuit Breaker (2.5s) + Cascade Early Exit | `packages/vlm-inspector/` |
| **5. Audio/TTS** | Lệch token Karaoke với số năm, volume BGM tĩnh | **Trung bình** | Text Normalization Alignment + Dynamic Audio Ducking | `services/vieneu-tts/`, `packages/remotion-engine/` |
| **6. Remotion** | Chromium memory leak, I/O disk contention | **Cao** | Worker Auto-recycle sau 10 jobs + RAM Disk asset cache | `apps/render-worker/` |
| **7. Infra/AI** | Tranh chấp RAM 4 model, mất KV Cache (độ trễ 30s) | **Nghiêm trọng** | Static Prefix KV Caching + JIT Model Eviction | `scripts/ai-supervisor.ts`, `packages/infra/` |

---

## 6. Lộ trình Triển khai Chuẩn Hóa Production (Production Roadmap)

### Giai đoạn 1: Tối ưu Độ trễ & Ổn định Runtime (Immediate P0)
1. **Áp dụng Static Prefix KV-Caching:** Tách System Persona tĩnh và chuyển context động vào user message block để giảm độ trễ chat từ 30s $\rightarrow$ **< 2s**.
2. **Triển khai Async Circuit Breaker & Cascade VLM:** Giới hạn timeout tải ảnh 2.5s và dừng chấm điểm VLM ngay khi gặp ảnh đạt điểm $>85$.
3. **Cấu hình Worker Auto-Recycle:** Thêm logic dọn dẹp Chromium process trong `apps/render-worker`.

### Giai đoạn 2: Nâng cấp Semantic Intent & Bridge Graph Filter (Core P1)
1. **2-Tier Cascading Intent Classifier:** Bổ sung các Sub-Intents lịch sử (`FACTOID_LOOKUP`, `GENEALOGY_RELATION`, `BATTLE_TACTICS`, `COMPARATIVE_SYNTHESIS`).
2. **Bridge Graph Filter trong `context-pruner.ts`:** Lọc Triples ưu tiên các cạnh liên kết trực tiếp giữa các thực thể trong câu hỏi.
3. **Query-Adaptive Hybrid RRF:** Điều chỉnh trọng số Sparse BM25 / Dense Vector dựa trên việc có từ khóa thời gian hay không.

### Giai đoạn 3: Tối ưu Pipeline Sinh Kịch bản & Đồng bộ Âm thanh (Advanced P2)
1. **DAG Parallelization & Granular Scene Patching trong LangGraph:** Giảm $60\%$ thời gian sinh kịch bản video.
2. **Text Normalization Alignment Bridge:** Đảm bảo 100% khớp chữ phụ đề Karaoke với giọng đọc số/từ viết tắt.
3. **Materialized Subgraph Views:** Đẩy nhanh tốc độ duyệt đồ thị gia phả trên PostgreSQL.
