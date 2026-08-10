# KIỂU KIẾN TRÚC HỆ THỐNG & TOPOLOGY
## (Architectural Style & System Topology Specification)

---

## 1. Loại Kiến Trúc (Architectural Style)

Dự án **ChronoViet** áp dụng kết hợp 3 mẫu kiến trúc hiện đại:

1. **Event-Driven Microservices (Kiến trúc vi dịch vụ hướng sự kiện):**
   * Các mô-đun trong hệ thống được tách rời (Decoupled), không gọi trực tiếp đồng bộ (Synchronous Blocking) gây tắc nghẽn.
   * Quá trình sinh kịch bản, kiểm định ảnh VLM và render video Remotion diễn ra bất đồng bộ (Asynchronous) thông qua Redis BullMQ Message Queues.

2. **Decoupled Agentic Pipeline (Kiến trúc đường ống Agent độc lập):**
   * Tầng biên tập nội dung AI (LangGraph) và Tầng dựng video React-Remotion giao tiếp với nhau duy nhất qua một **Data Contract chuẩn hóa (JSON Schema v3.2)**.
   * Sự thay đổi về mô hình AI (chuyển đổi giữa Gemini, GPT-4o hay Qwen) không ảnh hưởng bất kỳ dòng code nào của Remotion Engine.

3. **Hexagonal Architecture / Clean Architecture (Cấp độ Microservice):**
   * Phân tách rõ ràng giữa Core Business Logic (Luồng xử lý video, RAG retrieval) và Adapters bên ngoài (Database, LLM APIs, Storage).

---

## 2. Phân Rã Dịch Vụ & Boundaries (Service Topology)

Hệ thống được chia thành 5 dịch vụ chính và 1 Hybrid VLM Layer:

```
                                    ┌───────────────────────────┐
                                    │      API GATEWAY          │
                                    │  (Nginx Reverse Proxy)    │
                                    └─────────────┬─────────────┘
                                                  │
       ┌───────────────────────┬──────────────────┴──────────────────┬───────────────────────┐
       ▼                       ▼                                     ▼                       ▼
┌───────────────┐     ┌────────────────┐                   ┌──────────────────┐    ┌─────────────────┐
│ RAG Service   │     │ Orchestrator   │                   │ Rendering Worker │    │ User & Asset    │
│ (Python/Fast) │     │ Service        │                   │ Service          │    │ Service         │
│ - Vector Qdrant│    │ (Node.js/Lang  │                   │ (Remotion CLI /  │    │ (NestJS)        │
│ - Neo4j Graph │     │  Graph.js)     │                   │  BullMQ)         │    │ - Auth, Profile │
│ - Chunking    │     │ - Postgres Checkpoint              │ - Pre-fetch Local│    │ - Projects CRUD │
└───────────────┘     └───────┬────────┘                   └──────────────────┘    └─────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ Hybrid VLM Layer │
                     │ (Gemini / CLIP)  │
                     └──────────────────┘
```

### Chi tiết nhiệm vụ từng dịch vụ:

| Dịch vụ | Công nghệ chính | Trách nhiệm chính | Môi trường triển khai |
| :--- | :--- | :--- | :--- |
| **API Gateway** | Nginx | Route request, Authenticate JWT, Rate Limiting, CORS, SSL termination. | Docker Container |
| **RAG & Knowledge Service** | Python (FastAPI, Qdrant Client, Neo4j Driver) | Ingest tài liệu, vector search, hybrid retrieval, GraphRAG queries, trả về context lịch sử chuẩn xác. | Docker Container |
| **Agentic Orchestrator Service** | Node.js / TypeScript (LangGraph.js + Zod + Postgres Checkpointer) | Điều phối quy trình Chaptering & 5 Script Micro-Steps (kèm Narrative Context & Duration Reconcile), Hybrid Fact-Checker (Alias Table & 4-Tier Escalation Path), Whitelisted Asset Crawling, PURE_CODE Layout Rotation, đóng gói JSON v3.2 Zod Schema. | Docker Container |
| **VLM Inspector Service** | Hybrid (Cloud Gemini 2.5 Flash API + Local CLIP ONNX Fallback) | Thẩm định bối cảnh ảnh, lọc giấy phép Whitelisted (`Public Domain`, `CC0`, `CC-BY`) và lọc nhiễu lịch sử với độ trễ sub-second. | Cloud API / Local ONNX |
| **VieNeu TTS Service** | Python FastAPI (ONNX Runtime Engine) | Sinh giọng đọc thuyết minh tiếng Việt chuẩn vùng miền kèm word timestamps cho phụ đề Karaoke. | Docker Container (CPU/GPU nhẹ) |
| **Rendering Worker Service** | Node.js (Remotion CLI, Headless Chrome) | Lắng nghe task queue, pre-download media về MinIO/Local, parse JSON Zod Schema, render MP4 và dọn dẹp Chromium process. | Docker Container |
| **User & Asset Service** | Node.js (NestJS + PostgreSQL) | Quản lý tài khoản người dùng, lịch sử render, danh sách dự án video, asset caching. | Docker Container |

---

## 3. Khả Năng Mở Rộng & Chiến Lược Triển Khai Theo Giai Đoạn

* **Giai đoạn MVP / Phase 1 (Single-Host Docker Compose):**
  * Toàn bộ các containers (Gateway, User Service, RAG Service, Orchestrator, VieNeu TTS ONNX, Remotion Render Worker, Postgres, Qdrant, Neo4j, Redis, MinIO) được đóng gói và vận hành trên 1 Server/VPS duy nhất.
  * Tác vụ VLM được offload 100% sang Gemini 2.5 Flash Cloud API, giảm gánh nặng tài nguyên hardware.
* **Giai đoạn Mở rộng / Phase 2 (Docker Compose Worker Scaling):**
  * Khi lưu lượng đạt cao, tách Rendering Worker Service thành các Worker Containers riêng biệt tự động scale dựa trên queue depth của BullMQ trong Redis.
* **Fault Isolation (Cách ly sự cố):**
  * Nếu mô-đun Rendering Engine gặp lỗi crash RAM, dịch vụ Chatbot RAG và User Service vẫn hoạt động bình thường nhờ cơ chế cách ly container (Zero Single Point of Failure).

