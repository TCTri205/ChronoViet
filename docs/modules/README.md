# CHRONOVIET PIPELINE MODULES SPECIFICATION

Trung tâm Tài liệu Mô-đun Chức năng trong Pipeline sinh video tự động của dự án **ChronoViet**.

---

## 🗂️ Danh Mục Tài Liệu 5 Mô-Đun Chức Năng

| Mô-đun | File Tài Liệu | Trạng Thái | Mô Tả Tóm Tắt |
| :--- | :--- | :---: | :--- |
| **Mô-đun 0: Data Preprocessing** | [00_DATA_PREPROCESSING_AND_INGESTION.md](00_DATA_PREPROCESSING_AND_INGESTION.md) | **[✅ IMPLEMENTED]** | Data Preprocessing & Ingestion Engine (Lớp nạp dữ liệu offline): Cào tự động 15 thời kỳ lịch sử (`pnpm crawl:all`), làm sạch sử liệu, chuẩn hóa địa danh/nhân vật, Hierarchical Chunking, Dual-Branch Indexing (Graph + Vector `bge-m3`), LUFS Normalization, License Audit & Audit Trail (`entity_audit_logs`). |
| **Mô-đun 1: Knowledge Retrieval** | [01_CHRONO_RAG_ENGINE.md](01_CHRONO_RAG_ENGINE.md) | **[✅ IMPLEMENTED]** | Chrono-RAG Engine (PostgreSQL `pgvector` Dense Embedding BGE-M3 + Hybrid GraphRAG + BM25 FTS + RRF) đảm bảo 100% tính chính xác lịch sử. |
| **Mô-đun 2: Content Orchestration** | [02_MULTI_AGENT_ORCHESTRATOR.md](02_MULTI_AGENT_ORCHESTRATOR.md) | **[✅ IMPLEMENTED]** | LangGraph.js Multi-Agent Pipeline: Phân chia phân cảnh kịch bản v4.1, tích hợp Folklore Guardrail Gate (`folklore-validator.ts` Regex Pattern Matching) và NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts`). |
| **Mô-đun 3: Visual Quality Control** | [03_VLM_INSPECTOR_AGENT.md](03_VLM_INSPECTOR_AGENT.md) | **[📐 ROADMAP]** | Sub-Agent thẩm định ảnh bằng Gemini 2.5 Flash Cloud API + Local CLIP ONNX Fallback + Whitelisted License Filter + Unified Redis Cache & Chiến lược 3+3 Crawl Candidates. |
| **Mô-đun 4: Video Render Tool** | [04_REMOTION_RENDER_ENGINE.md](04_REMOTION_RENDER_ENGINE.md) | **[✅ IMPLEMENTED]** | Tool render video React + Remotion v4 100% Data-Driven (Pre-download Host Volume assets `/media` & Chromium isolation), nhận JSON v4.1. |

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
│  ├─ Scene-Level Parallel Execution: VieNeu TTS Engine & Whitelisted Asset Crawler       │
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
