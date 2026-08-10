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
   * Tầng biên tập nội dung AI (LangGraph.js) và Tầng dựng video React-Remotion giao tiếp với nhau duy nhất qua một **Data Contract chuẩn hóa (JSON Schema v3.2 Zod SSOT)**.

3. **Hexagonal Architecture / Clean Monorepo Architecture:**
   * Phân tách rõ ràng trong pnpm Monorepo giữa các gói Core Business (`packages/agent-orchestrator`, `packages/rag-engine`, `packages/shared-spec`) và các Apps ứng dụng (`apps/web`, `apps/render-worker`).

---

## 2. Phân Rã Dịch Vụ & Boundaries (Streamlined Service Topology)

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
                                    │ - Web Dashboard & API     │
                                    │ - RAG Engine (pgvector)   │
                                    │ - LangGraph Orchestrator  │
                                    └─────────────┬─────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
      ┌────────────────────┐            ┌────────────────────┐          ┌────────────────────┐
      │   PostgreSQL DB    │            │ Unified Redis DB   │          │ AI & Render Worker │
      │  (Relational + SSOT│            │ (BullMQ Job Queues │          │ (VieNeu TTS ONNX & │
      │  + pgvector Search)│            │  + Multi-Cache)    │          │  Remotion Chrome)  │
      └────────────────────┘            └────────────────────┘          └────────────────────┘
```

### Chi tiết nhiệm vụ từng dịch vụ (Unified VPS Stack):

| Dịch vụ | Công nghệ chính | Trách nhiệm chính | Môi trường triển khai |
| :--- | :--- | :--- | :--- |
| **Caddy Gateway** | Caddy v2 Alpine | Route request, Auto-HTTPS/SSL Cert, Serve static `/media`, WebSocket forwarding, HTTP/2 & HTTP/3. | Docker Container (~30MB RAM) |
| **App Monolith** | TypeScript / Node.js (Next.js / Fastify) | Quản lý Auth/Users, Projects CRUD, RAG Engine (Postgres `pgvector`), LangGraph Orchestrator (12 trạng thái, Postgres Checkpointer SSOT), Gemini Cloud VLM Inspection. | Docker Container (Max 1.5 CPUs / 2.0GB RAM) |
| **Database Engine** | PostgreSQL 15+ (`pgvector`) | SSOT lưu trữ dữ liệu dự án, LangGraph state checkpoints, và Vector Embeddings (thay thế Qdrant/Neo4j để tiết kiệm tài nguyên). | Docker Container (Max 1.5 CPUs / 2.0GB RAM) |
| **Redis Engine** | Redis 7 Alpine | Đảm nhận cả BullMQ Job Queues (AOF persistence) lẫn LRU Caching & WebSocket PubSub trong 1 container duy nhất. | Docker Container (Max 0.5 CPU / 1.0GB RAM) |
| **AI & Render Worker** | TypeScript / Node.js (Remotion CLI, Headless Chrome, VieNeu TTS ONNX) | Lắng nghe job từ Redis Queue: Sinh giọng nói VieNeu TTS ONNX, pre-fetch media từ Host Volume `/media`, render MP4 video và dọn dẹp Chromium process (`CONCURRENCY=1`). | Docker Container (Max 2.0 CPUs / 4.0GB RAM) |

---

## 3. Khả Năng Mở Rộng & Chiến Lược Triển Khai Theo Giai Đoạn

* **Giai đoạn MVP / Single-Host VPS (Streamlined VPS Topology):**
  * Toàn bộ hệ thống vận hành trên **1 VPS duy nhất + Domain cá nhân** với 5 container Docker Compose: `caddy`, `postgres` (pgvector), `redis`, `app` (Monolith), `worker`.
  * Quản lý lưu trữ file media (Video MP4, Audio, License Snapshots) trực tiếp qua **Host Volume `/media`**, được Caddy serve static trực tiếp với hiệu năng cao.
* **Giai đoạn Mở rộng / Scale-Out (Phase 2 Worker Scaling):**
  * Khi lượng job render video tăng cao, dễ dàng tách riêng Worker Container sang một VPS chuyên dụng sở hữu GPU/CPU mạnh hơn, chỉ cần chỉ định URL kết nối tới Redis/Postgres của VPS gốc.
* **Fault Isolation (Cách ly sự cố):**
  * Tác vụ render Remotion ngốn CPU/RAM được bọc cứng trong `worker` container với `CONCURRENCY=1`, không làm sập API Monolith Server hay Caddy Gateway.


