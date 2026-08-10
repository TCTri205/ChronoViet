# CHRONOVIET PIPELINE MODULES SPECIFICATION

Trung tâm Tài liệu Mô-đun Chức năng trong Pipeline sinh video tự động của dự án **ChronoViet**.

---

## 🗂️ Danh Mục Tài Liệu 4 Mô-đun Chức Năng

| Mô-đun | File Tài Liệu | Trạng Thái | Mô Tả Tóm Tắt |
| :--- | :--- | :---: | :--- |
| **Mô-đun 1: Knowledge Retrieval** | [01_CHRONO_RAG_ENGINE.md](file:///D:/Persional_Projects/ChronoViet/docs/modules/01_CHRONO_RAG_ENGINE.md) | **[📐 ROADMAP]** | Hybrid GraphRAG (Knowledge Graph Neo4j + Qdrant Vector BGE-M3 + Local Search 1-2 hop + Reranker v2) đảm bảo 100% tính chính xác lịch sử. |
| Mô-đun 2: Content Orchestration | [02_MULTI_AGENT_ORCHESTRATOR.md](file:///D:/Persional_Projects/ChronoViet/docs/modules/02_MULTI_AGENT_ORCHESTRATOR.md) | **[📐 ROADMAP]** | LangGraph.js (Node.js/TS) tối ưu Small LLM & Video dài (v3.2): Chaptering Agent, 5 Script Micro-Steps (kèm Narrative Context & Duration Reconcile), Hybrid Fact-Checker (Alias Table & 4-Tier Escalation Path), VieNeu TTS, Whitelisted License, Hybrid VLM (Gemini Cloud + Local CLIP), PURE_CODE Layout Rotation & Postgres Checkpointer. |
| **Mô-đun 3: Visual Quality Control** | [03_VLM_INSPECTOR_AGENT.md](file:///D:/Persional_Projects/ChronoViet/docs/modules/03_VLM_INSPECTOR_AGENT.md) | **[📐 ROADMAP]** | Sub-Agent thẩm định ảnh bằng Gemini 2.5 Flash Cloud API + Local CLIP ONNX Fallback + Whitelisted License Filter + Redis Dual Cache (SHA-256/pHash) & Chiến lược 3+3 Crawl Candidates. |
| **Mô-đun 4: Video Render Tool** | [04_REMOTION_RENDER_ENGINE.md](file:///D:/Persional_Projects/ChronoViet/docs/modules/04_REMOTION_RENDER_ENGINE.md) | **[✅ IMPLEMENTED]** | Tool render video React + Remotion v4 100% Data-Driven (Pre-download assets & Chromium isolation), nhận JSON v3.2. |

---

## 🔄 Sơ Đồ Luồng Dữ Liệu Inter-Module (v3.2)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 1: CHRONO-RAG ENGINE (Hybrid Knowledge Base & Local Search)                      │
│ SGK, Sử liệu ──> VectorDB (bge-m3 Dense+Sparse) + Neo4j Graph (k-Hop) ──> Verified Context │
│                   └───── Cross-linking via [MENTIONED_IN] ─────┘                        │
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
│  └─ Zod Schema v3.2 Validation Packager (kèm License & Attribution)                    │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │ (Final JSON Schema v3.2 Validated)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MÔ-ĐUN 4: REMOTION RENDER ENGINE (Agent Execution Tool)                                 │
│ Tool CLI ──> Local Media Pre-download ──> Isolated Chromium Process ──> MP4 Output      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

