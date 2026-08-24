# CHRONOVIET SYSTEM ARCHITECTURE & INFRASTRUCTURE SPECIFICATION

Trung tâm Tài liệu Kiến trúc Hệ thống, Công nghệ Hạ tầng & Mô hình Vận hành của dự án **ChronoViet**.

---

## 🗂️ Danh Mục Tài Liệu Kiến Trúc & Hạ Tầng

| Chủ Đề Kỹ Thuật | File Tài Liệu | Nội Dung Trọng Tâm |
| :--- | :--- | :--- |
| **Kiểu Kiến Trúc & Topology** | [01_ARCHITECTURAL_STYLE.md](01_ARCHITECTURAL_STYLE.md) | Single-Language TypeScript Monorepo, Streamlined Single-Host VPS Topology (5 Containers). |
| **Giao Tiếp Inter-Service & Queues** | [02_COMMUNICATION_AND_QUEUES.md](02_COMMUNICATION_AND_QUEUES.md) | REST, SSE, WebSocket qua Caddy, BullMQ Task Queues trên Unified Redis (AOF), Gemini VLM Circuit Breaker, Worker Pool. |
| **Cơ Sở Dữ Liệu & Caching** | [03_DATA_STORAGE_AND_CACHE.md](03_DATA_STORAGE_AND_CACHE.md) | PostgreSQL + pgvector SSOT (Relational Data + Checkpoints + Vector Search), Unified Redis, Host Volume Storage (/media). |
| **Quản Lý State & Deploy Topology** | [04_STATE_MANAGEMENT_AND_DEPLOY.md](04_STATE_MANAGEMENT_AND_DEPLOY.md) | LangGraph.js 15 Trạng Thái với Postgres Checkpointer SSOT, VPS Docker Compose Caddy File Spec. |
| **Giải Pháp Tối Ưu & VieNeu TTS** | [05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md](05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md) | Pre-download Host Volume Media Assets, Chromium Isolation, Hybrid Cloud VLM + Circuit Breaker, License Snapshotting, VieNeu ONNX Engine. |
| **Observability & Logging** | [06_OBSERVABILITY_AND_LOGGING.md](06_OBSERVABILITY_AND_LOGGING.md) | Unified Structured Logger (`@chronoviet/infra`), correlation ID, event names, truy vết log bằng `jq`. |
| **Sơ Đồ Kiến Trúc & Spec Tổng Thể** | [CHRONOVIET_ARCHITECTURE_DIAGRAMS.md](CHRONOVIET_ARCHITECTURE_DIAGRAMS.md) | Tổng hợp Mermaid Diagrams v4.0 cho Topology Single-VPS Caddy, Sequence Flow, Persistence, State Machine & Matrix Vận Hành. |

---

## 🏗️ Sơ Đồ Kiến Trúc Hệ Thống Tổng Thể (Streamlined VPS Topology v4.0)

```
                                     ┌───────────────────────────┐
                                     │    CLIENT / FRONTEND      │
                                     │ (Next.js / TS Dashboard)  │
                                     └─────────────┬─────────────┘
                                                   │ (HTTPS / WS / SSE + Trace ID)
                                                   ▼
                                     ┌───────────────────────────┐
                                     │      CADDY GATEWAY        │
                                     │   (Reverse Proxy & SSL)   │
                                     └─────────────┬─────────────┘
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                     ▼
         ┌─────────────────────────────┐                       ┌─────────────────────────────┐
         │     APP MONOLITH SERVER     │                       │     RENDER WORKER POOL      │
         │   (Next.js / Fastify Core)  ├──────────────────────►│ (Remotion / Chromium Engine)│
         └──────────────┬──────────────┘       BullMQ Task     └──────────────┬──────────────┘
                        │                        Queue                        │
                        ▼                                                     ▼
         ┌─────────────────────────────┐                       ┌─────────────────────────────┐
         │ POSTGRESQL + PGVECTOR / REDIS│                       │ Host Volume Storage (/media)│
         │ (Entities, Vectors, Cache)  │                       │ (Raw Assets, License Snaps, │
         └─────────────────────────────┘                       │  & Rendered MP4 Output)     │
                                                               └─────────────────────────────┘
```
