# CHRONOVIET PIPELINE MODULES SPECIFICATION

Trung tâm Tài liệu Mô-đun Chức năng trong Pipeline sinh video tự động của dự án **ChronoViet**.

---

## 🗂️ Danh Mục Tài Liệu 5 Mô-Đun Chức Năng

| Mô-đun | File Tài Liệu | Trạng Thái | Mô Tả Tóm Tắt |
| :--- | :--- | :---: | :--- |
| **Mô-đun 0: Data Preprocessing** | [00_DATA_PREPROCESSING_AND_INGESTION.md](00_DATA_PREPROCESSING_AND_INGESTION.md) | **[✅ IMPLEMENTED]** | Data Preprocessing & Ingestion Engine (Lớp nạp dữ liệu offline): 2-Stage Knowledge Extraction (Stage 1 Pure TS NER + Stage 2 Port 8094 LLM), Cào tự động 15 thời kỳ lịch sử (`pnpm crawl:all`), làm sạch sử liệu, chuẩn hóa địa danh/nhân vật, Hierarchical Chunking, Dual-Branch Indexing (Graph + Vector `bge-m3`), Quarantine Inspector (`pnpm db:audit-quarantine`), LUFS Normalization, License Audit & Audit Trail (`entity_audit_logs`). |
| **Mô-đun 1: Knowledge Retrieval** | [01_CHRONO_RAG_ENGINE.md](01_CHRONO_RAG_ENGINE.md) | **[✅ IMPLEMENTED]** | Chrono-RAG Engine v2.3 (PostgreSQL `pgvector` Dense BGE-M3 + Directed BFS Graph Traversal — Global Visited-Set, Node Budget 50, Timeout 40ms, Edge-Type Filter — + Lexical FTS Vietnamese Stopword Sanitization + Graph Score & Co-Retrieval Boost $+0.05\times\text{graphScore}$ + In-Memory LRU Embedding Cache + Pure Local Cross-Encoder Reranker Port 8096) đảm bảo 100% tính chính xác lịch sử. |
| **Mô-đun 2: Content Orchestration** | [02_MULTI_AGENT_ORCHESTRATOR.md](02_MULTI_AGENT_ORCHESTRATOR.md) | **[✅ IMPLEMENTED]** | LangGraph.js Multi-Agent Pipeline: Phân chia phân cảnh kịch bản v4.1, Keyword Extractor + Research Agent (Micro-Step 1C) tìm ảnh online qua SerpAPI/Tavily/Brave/Wikimedia/Catalog, tích hợp Folklore Guardrail Gate (`folklore-validator.ts` Regex Pattern Matching) và NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts`). |
| **Mô-đun 3: Visual Quality Control** | [03_VLM_INSPECTOR_AGENT.md](03_VLM_INSPECTOR_AGENT.md) | **[✅ IMPLEMENTED]** | Sub-Agent thẩm định ảnh bằng Local Unified VLM (strict) / Gemini 3.6 Flash Cloud API + Local CLIP Fallback + Whitelisted License Filter + Unified Redis Cache & Chiến lược 3+3 Candidates (nhận candidate pool từ Research Agent + domain whitelist). |
| **Mô-đun 4: Video Render Tool** | [04_REMOTION_RENDER_ENGINE.md](04_REMOTION_RENDER_ENGINE.md) | **[✅ IMPLEMENTED]** | Tool render video React + Remotion v4 100% Data-Driven (Pre-download Host Volume assets `/media` & Chromium isolation), nhận JSON v4.1. |

---

## 🛡️ Eval Integrity Gates (Bắt buộc khi chạy Evaluation)

**Nguyên tắc: Eval đo CHẤT LƯỢNG hệ thống, không phải xem hệ thống có "sống" hay không (đó là test).**

Từ khi kích hoạt `EVAL_STRICT=true` (mặc định), mọi eval runner sẽ:
1. **Preflight fail-fast**: Kiểm tra health của LLM server (`LLM_BASE_URL`), Embedding server (`EMBEDDING_API_URL`), VieNeu Python ONNX TTS (`VIENEU_PYTHON_URL`), và VLM local (`EVAL_VLM_MODEL` qua llama-server). Service nào down → **dừng ngay**, không chạy eval.
2. **Cấm cloud fallback**: `ENABLE_CLOUD_FALLBACK` (Agnes) không được dùng trong eval. Local LLM down → eval FAIL, không lặng lẽ gọi cloud.
3. **Cấm fallback giả** (khi strict):
   - Embedding server down → **FAIL** (không dùng pseudo-random vector).
   - Python TTS down → **FAIL** (không dùng sine-wave 480Hz).
   - VLM không có local model → **FAIL** (không dùng CLIP heuristic).
   - RAG DB search fail → **FAIL** (không dùng offline context nhồi sẵn).
   - LLM fail trong chaptering/scriptwriter → **FAIL** (không dùng văn mẫu deterministic).
   - Triple extraction LLM fail → **FAIL** (không dùng regex fallback).
4. **Ghi provenance**: Report ghi rõ provider thực tế (`LOCAL_LLM`, `REAL_EMBEDDING_SERVER`, `REAL_NEURAL_ONNX`, `LOCAL_VLM`...) và kết quả preflight.

**Service bắt buộc khi chạy eval (strict):**

| Service | Cấu hình | Lệnh khởi động gợi ý |
| :--- | :--- | :--- |
| LLM & Unified VLM Server | `LLM_BASE_URL` (vd `http://localhost:8092`) | `llama-server -m models/qwen3.5-9b-instruct-q4_k_m.gguf --mmproj models/qwen3.5-9b-mmproj.gguf --port 8092` |
| Stage 2 Extraction LLM | `LOCAL_LLM_EXTRACTION_BASE_URL` (vd `http://localhost:8094`) | `pnpm ai:extract` hoặc `llama-server -m models/qwen3.5-4b-instruct-q4_k_m.gguf --port 8094 --ctx-size 8192 --parallel 4 --threads 6 --cont-batching` |
| Embedding Server | `EMBEDDING_API_URL` (vd `http://localhost:8090/v1/embeddings`) | Serve model `bge-m3` (1024 dimensions) trên Port 8090 |
| VieNeu Python TTS | `VIENEU_PYTHON_URL` (vd `http://localhost:8080`) | `python app.py` trong `services/vieneu-tts/` |
| VLM Local Inspector | `EVAL_VLM_MODEL` (mặc định `qwen3.5-9b-instruct-q4_k_m`) | llama-server unified multimodal endpoint (Port 8092) |
| PostgreSQL pgvector | `DATABASE_URL` | `pnpm stack:infra` |

**Tắt strict (dev-only, KHÔNG hợp lệ làm benchmark):** đặt `EVAL_STRICT=false` trong `.env` — khi đó các fallback cũ được phép dùng lại.

---

## 🔄 Sơ Đồ Luồng Dữ Liệu Inter-Module (v4.1)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 0: DATA PREPROCESSING & INGESTION ENGINE (Offline Data Ingestion Pipeline)       │
│ Raw Corpus & Media ──> Text Cleaning, Dual-Branch Indexing, Asset Audit & LUFS Normalization │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │ (Ingest & Seed Data)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STORAGE LAYER: PostgreSQL pgvector (entities, chunks) & Host Mount Volume (/media/)     │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼ (Read-Only Context)
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 1: CHRONO-RAG ENGINE (Knowledge Base & PostgreSQL pgvector Search)               │
│ Query ──> Dense BGE-M3 + Graph Local Search ──> Verified Historical Context             │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 2: MULTI-AGENT ORCHESTRATOR (LangGraph.js State Machine & Postgres Checkpointer)│
│ Step 0: Chaptering Agent (Tách video dài thành N Chapters kèm runningNarrativeState)     │
│  ├─ 5 Script Micro-Steps: Writer ──> Fact-Checker ──> Segmenter ──> Reconcile ──> Kw Ext │
│  ├─ Micro-Step 1C: Keyword Extractor ──> Research Agent (SerpAPI/Tavily/Brave/Wikimedia) │
│  ├─ Scene-Level Parallel Execution: VieNeu TTS Engine & VLM Inspector (candidate pool)   │
│  ├─ Gọi MÔ-ĐUN 3: VLM INSPECTOR SUB-AGENT (Gemini Cloud + Local CLIP Fallback + License)  │
│  ├─ Code Rules Engine: PURE_CODE Layout Rotation & LangGraph.js Postgres Checkpoints    │
│  └─ Zod Schema v4.1 Validation Packager (kèm License & Attribution)                    │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │ (Final JSON Schema v4.1 Validated)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 4: REMOTION RENDER ENGINE (Agent Execution Tool)                                 │
│ Tool CLI ──> Host Volume Media (/media) ──> Isolated Chromium Process ──> MP4 Output    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
