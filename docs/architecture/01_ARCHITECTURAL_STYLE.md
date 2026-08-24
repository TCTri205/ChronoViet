# KIỂU KIẾN TRÚC HỆ THỐNG & TOPOLOGY
## (Architectural Style & System Topology Specification)

---

## 1. Loại Kiến Trúc (Architectural Style)

Dự án **ChronoViet** áp dụng kết hợp 3 mẫu kiến trúc hiện đại tối ưu cho môi trường **Single-Language TypeScript Monorepo MVP**:

1. **Unified TypeScript Stack (Kiến trúc 1 Ngôn ngữ Duy nhất):**
   * Toàn bộ các mô-đun từ Web Dashboard (Next.js), Agentic Orchestrator (LangGraph.js), RAG Engine (PostgreSQL `pgvector` Client), VieNeu TTS (ONNX Runtime Node.js) đến Render Engine (Remotion v4) đều được phát triển bằng **TypeScript**.
   * Đạt được tính đồng nhất tuyệt đối về môi trường (Node.js 20+), chia sẻ trực tiếp Zod Schemas giữa các gói mà không cần translation layer.

2. **Event-Driven Decoupled Pipeline (Đường ống xử lý hướng sự kiện):**
   * Các mô-đun trong hệ thống được tách rời (Decoupled), không gọi trực tiếp đồng bộ (Synchronous Blocking) gây tắc nghẽn.
   * Quá trình sinh kịch bản, kiểm định ảnh VLM và render video Remotion diễn ra bất đồng bộ (Asynchronous) thông qua Redis BullMQ Message Queues.
   * Tầng biên tập nội dung AI (LangGraph.js) và Tầng dựng video React-Remotion giao tiếp với nhau duy nhất qua một **Data Contract chuẩn hóa (ChronoVideoScriptSchema v4.1 Zod SSOT từ `@chronoviet/shared-spec`)**.

3. **Clean Monorepo & Pure Contract Boundary (Architecture v4.0):**
   * **`@chronoviet/shared-spec` (Pure Contract SSOT):** Gói chứa duy nhất Zod schemas, TypeScript types, constants, không phụ thuộc bất kỳ runtime backend hay Node native module (`fs`, `net`, `tls`). Phục vụ an toàn cho cả browser (Remotion preview) và Node runtime.
   * **`@chronoviet/infra` (Unified Runtime Infrastructure):** Gói hợp nhất chứa toàn bộ client hạ tầng Node.js (PostgreSQL pool, Redis BullMQ queues, Prometheus telemetry, structured logger, LLM rotator, BGE-M3 embedding caller, VieNeu TTS SDK).
   * **Domain Packages:** `packages/agent-orchestrator` (LangGraph multi-agent + research provider chain), `packages/rag-engine` (GraphRAG CTE + vector retrieval), `packages/data-ingestion` (ETL crawler & dual-branch seeder), `packages/vlm-inspector` (deterministic visual quality gate), `packages/remotion-engine` (pure React video engine).
   * **Applications:** `apps/web` (Next.js 14 Web App + WebSocket gateway) và `apps/render-worker` (BullMQ video rendering & background workers).
   * **Microservice:** `services/vieneu-tts` (Python FastAPI ONNX standalone microservice).

---

## 2. Phân Rã Dịch Vụ & Boundaries (Streamlined Service Topology v4.0)

Hệ thống được thiết kế dưới dạng TypeScript Monorepo tinh gọn cho môi trường **Single-Host VPS Deployment**:

```
                                    ┌───────────────────────────┐
                                    │   CADDY REVERSE PROXY     │
                                    │ (Auto SSL / HTTP2 / WS)   │
                                    └─────────────┬─────────────┘
                                                  │
                                                  ▼
                                     ┌───────────────────────────┐
                                     │    APP MONOLITH SERVER    │
                                     │ (Next.js / Fastify / TS)  │
                                     │ - NotebookLM Hub & API    │
                                     │ - RAG Engine (pgvector)   │
                                     │ - LangGraph Orchestrator  │
                                     └─────────────┬─────────────┘
                                                   │
                  ┌────────────────────────────────┼────────────────────────────────┐
                  ▼                                ▼                                ▼
       ┌────────────────────┐            ┌────────────────────┐          ┌────────────────────┐
       │   PostgreSQL DB    │            │ Unified Redis DB   │          │ AI & Render Worker │
       │  (Relational + SSOT│            │ (BullMQ Job Queues │          │ (Remotion Chrome & │
       │  + pgvector Search)│            │  + Multi-Cache)    │          │  TTS Client Infra) │
       └────────────────────┘            └────────────────────┘          └─────────┬──────────┘
                                                                                   │ (HTTP :8080)
                                                                                   ▼
                                                                         ┌────────────────────┐
                                                                         │ VieNeu TTS Service │
                                                                         │ (Python ONNX micro)│
                                                                         └────────────────────┘
```

### Chi tiết nhiệm vụ từng dịch vụ (Unified VPS Stack):

| Dịch vụ | Công nghệ chính | Trách nhiệm chính | Môi trường triển khai |
| :--- | :--- | :--- | :--- |
| **Caddy Gateway** | Caddy v2 Alpine | Route request, Auto-HTTPS/SSL Cert, Serve static `/media`, WebSocket forwarding, HTTP/2 & HTTP/3. | Docker Container (~30MB RAM) |
| **App Monolith** | Next.js 14 / TypeScript | Quản lý NotebookLM Workspace (RAG Chatbot + 1-Click Video Generator), Projects CRUD, RAG Engine (Postgres `pgvector`), LangGraph Orchestrator (Postgres Checkpointer SSOT). Sử dụng `@chronoviet/infra` và `@chronoviet/shared-spec`. | Docker Container (Max 1.5 CPUs / 2.0GB RAM) |
| **Database Engine** | PostgreSQL 15+ (`pgvector`) | SSOT lưu trữ dữ liệu dự án, LangGraph state checkpoints, và Vector Embeddings (1024d HNSW index). | Docker Container (Max 1.5 CPUs / 2.0GB RAM) |
| **Redis Engine** | Redis 7 Alpine | Đảm nhận cả BullMQ Job Queues (AOF persistence) lẫn LRU Caching & WebSocket PubSub trong 1 container duy nhất. | Docker Container (Max 0.5 CPU / 1.0GB RAM) |
| **Render Worker** | Node.js / TypeScript (Remotion CLI, Headless Chrome) | Lắng nghe job từ Redis Queue: pre-fetch media từ Host Volume `/media`, render MP4 video và dọn dẹp Chromium process (`CONCURRENCY=1`). | Docker Container (Max 2.0 CPUs / 4.0GB RAM) |
| **VieNeu TTS Service** | Python 3.11 / FastAPI / ONNX | Microservice độc lập sinh giọng thuyết minh tiếng Việt và wordTimestamps qua HTTP API Port 8080. | Docker Container (~1.0GB RAM) |

---

## 3. Khả Năng Mở Rộng & Chiến Lược Triển Khai Theo Giai Đoạn

* **Giai đoạn MVP / Single-Host VPS (Streamlined VPS Topology):**
  * Toàn bộ hệ thống vận hành trên **1 VPS duy nhất + Domain cá nhân** với 5 container Docker Compose: `caddy`, `postgres` (pgvector), `redis`, `app` (Monolith), `worker`.
  * Quản lý lưu trữ file media (Video MP4, Audio, License Snapshots) trực tiếp qua **Host Volume `/media`**, được Caddy serve static trực tiếp với hiệu năng cao.
* **Giai đoạn Mở rộng / Scale-Out (Phase 2 Worker Scaling):**
  * Khi lượng job render video tăng cao, dễ dàng tách riêng Worker Container sang một VPS chuyên dụng sở hữu GPU/CPU mạnh hơn, chỉ cần chỉ định URL kết nối tới Redis/Postgres của VPS gốc.
* **Fault Isolation (Cách ly sự cố):**
  * Tác vụ render Remotion ngốn CPU/RAM được bọc cứng trong `worker` container với `CONCURRENCY=1`, không làm sập API Monolith Server hay Caddy Gateway.


