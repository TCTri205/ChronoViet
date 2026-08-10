# CHRONOVIET SYSTEM ARCHITECTURE & INFRASTRUCTURE SPECIFICATION

Trung tâm Tài liệu Kiến trúc Hệ thống, Công nghệ Hạ tầng & Mô hình Vận hành của dự án **ChronoViet**.

---

## 🗂️ Danh Mục Tài Liệu Kiến Trúc & Hạ Tầng

| Chủ Đề Kỹ Thuật | File Tài Liệu | Nội Dung Trọng Tâm |
| :--- | :--- | :--- |
| **Kiểu Kiến Trúc & Topology** | [01_ARCHITECTURAL_STYLE.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/01_ARCHITECTURAL_STYLE.md) | Event-Driven Microservices, Decoupled Agentic Pipeline, Single-Host Docker Compose MVP + Gemini Flash VLM API. |
| **Giao Tiếp Inter-Service & Queues** | [02_COMMUNICATION_AND_QUEUES.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/02_COMMUNICATION_AND_QUEUES.md) | REST, SSE, WebSocket, BullMQ Task Worker cho VieNeu TTS (ONNX), Gemini VLM API, Remotion Local Render. |
| **Cơ Sở Dữ Liệu & Caching** | [03_DATA_STORAGE_AND_CACHE.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/03_DATA_STORAGE_AND_CACHE.md) | Polyglot Persistence: Qdrant VectorDB, Neo4j GraphDB, PostgreSQL (Metadata & Checkpoint), Redis, MinIO/S3. |
| **Quản Lý State & Deploy Topology** | [04_STATE_MANAGEMENT_AND_DEPLOY.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/04_STATE_MANAGEMENT_AND_DEPLOY.md) | LangGraph State Machine với Postgres Checkpointer, Idempotency, Docker Compose MVP File Spec. |
| **Giải Pháp Tối Ưu & VieNeu TTS** | [05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md) | Pre-download Local Media Assets, Chromium Isolation, Hybrid Cloud VLM, VieNeu ONNX Engine Integration. |
| **Sơ Đồ Kiến Trúc & Spec Tổng Thể** | [CHRONOVIET_ARCHITECTURE_DIAGRAMS.md](file:///D:/Persional_Projects/ChronoViet/docs/architecture/CHRONOVIET_ARCHITECTURE_DIAGRAMS.md) | Tổng hợp Mermaid Diagrams cho Topology 7 Tầng, Sequence Flow, Polyglot Persistence & Verification Matrix. |

---

## 🏗️ Sơ Đồ Kiến Trúc Hệ Thống Tổng Thể (System Topology MVP)

```
                                    ┌───────────────────────────┐
                                    │    CLIENT / FRONTEND      │
                                    │ (Web App / Mobile App)    │
                                    └─────────────┬─────────────┘
                                                  │ (HTTPS / WS / SSE)
                                                  ▼
                                    ┌───────────────────────────┐
                                    │   API GATEWAY (Nginx)     │
                                    └─────────────┬─────────────┘
                                                  │
             ┌────────────────────────────────────┼────────────────────────────────────┐
             ▼                                    ▼                                    ▼
┌─────────────────────────┐          ┌─────────────────────────┐          ┌─────────────────────────┐
│ Hybrid GraphRAG Service │          │  Agentic Orchestrator   │          │ User & Asset Service    │
│ (FastAPI / Python)      │          │ (LangGraph.js / Node.js)│          │ (NestJS / Node.js)      │
└────────────┬────────────┘          └────────────┬────────────┘          └────────────┬────────────┘
             │                                    │                                    │
             │                      ┌─────────────┼─────────────┐                      │
             │                      ▼             ▼             ▼                      │
             │             ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐    │
             │             │   Redis Cache   │ │Gemini 2.5 API│ │ BullMQ Broker   │    │
             │             │ (Context/Session│ │(VLM Cloud)   │ │ (Task Queues)   │    │
             │             └─────────────────┘ └──────────────┘ └────────┬────────┘    │
             │                                                           │             │
             ▼                                                           ▼             ▼
┌─────────────────────────┐                            ┌──────────────────────────────────┐
│ Qdrant Vector & Neo4j   │                            │ WORKER CONTAINERS                │
│ (Knowledge Persistence) │                            │ 1. VieNeu TTS Worker (ONNX)      │
│ PostgreSQL Checkpointer │                            │ 2. Remotion Render Worker (CLI)  │
└─────────────────────────┘                            └────────────────┬─────────────────┘
                                                                        │
                                                                        ▼
                                                       ┌──────────────────────────────────┐
                                                       │ MinIO / S3 Object Storage        │
                                                       │ (Media Assets & Final MP4 Videos)│
                                                       └──────────────────────────────────┘
```

