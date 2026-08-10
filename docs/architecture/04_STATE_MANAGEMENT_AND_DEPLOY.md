# QUẢN LÝ STATE, KHẢ NĂNG CHỊU LỖI & TOPOLOGY TRIỂN KHAI
## (State Management, Workflow Engine & Deployment Topology Specification)

---

## 1. Quản Lý State Máy Trạng Thái (State Machine Lifecycle)

Vòng đời từ khi người dùng nhập yêu cầu cho đến khi nhận video hoàn chỉnh trải qua 9 trạng thái quản lý nghiêm ngặt qua **LangGraph với Postgres Checkpointer**:

```
 [DRAFT] ──> [RAG_RETRIEVED] ──> [OUTLINE_CHAPTERED] ──> [CHAPTER_SCRIPT_GENERATED] 
                                                                  │
 [COMPLETED] <─── [RENDERING] <─── [ASSETS_AUDITED] <─── [RECONCILED] <─── [CHAPTER_FACT_CHECKED]
      │                                                       │
  [FAILED] <───────────────────────────── [NEEDS_HUMAN_REVIEW] ┘
```

### Chi tiết các trạng thái (v3.2):

| State | Mô tả trạng thái | Xử lý Idempotency & Compensation (Phục hồi lỗi) |
| :--- | :--- | :--- |
| `DRAFT` | Tạo bản nháp dự án video từ prompt người dùng. | Tạo `projectId` duy nhất (UUIDv4). |
| `RAG_RETRIEVED` | Lấy xong trích dẫn sử liệu chuẩn từ Qdrant + Neo4j. | Checkpoint state vào PostgreSQL, cache context vào Redis. |
| `OUTLINE_CHAPTERED` | Micro-Step 0 chia video thành $N$ Chapters (2-3 min/Chap). | Checkpoint danh sách Chapter Outlines & `runningNarrativeState`. |
| `CHAPTER_SCRIPT_GENERATED` | Scriptwriter Agent sinh xong lời thoại truyền `narrativeContext`. | Checkpoint voiceover text của từng Chapter. |
| `CHAPTER_FACT_CHECKED` | Hybrid Fact-Checker (Alias Table + Fuzzy Match) duyệt xong. | Áp dụng Thang Escalation 4 Tầng: Tier 0 Retry $\le 2$ ➔ Tier 1 Code Auto-Fix ➔ Tier 2 Cloud Model 72B ➔ Tier 3 Flag `NEEDS_HUMAN_REVIEW`. |
| `RECONCILED` | Step 1B-Reconcile đối soát tổng thời lượng Scene với Target Chapter. | Tự động cân bằng pacing/ghép scene nếu độ lệch $> 15\%$. |
| `ASSETS_AUDITED` | Audio VieNeu, Whitelisted License & Hybrid VLM Strategy 3+3 hoàn tất. | File JSON Production v3.2 chính thức được đóng gói và checkpoint vào PostgreSQL. |
| `RENDERING` | Render Worker pre-download media và chạy `npx remotion render`. | Cập nhật % tiến độ qua WebSocket. Nếu Worker sập giữa chừng, Re-queue task từ checkpoint gần nhất. |
| `NEEDS_HUMAN_REVIEW` | Fact-Check không thể tự xử lý sau 4 lần retry. | Gửi Alert Webhook/UI để biên tập viên duyệt/sửa tay, không làm sập pipeline. |
| `COMPLETED` | Video MP4 đã xuất thành công và tải lên Object Storage. | Trả link download MP4 cho client, dọn dẹp temp files & Chrome processes. |
| `FAILED` | Dự án bị lỗi rớt không thể khắc phục. | Ghi lại traceback log, hoàn lại token/credit cho người dùng. |

---

## 2. Tính Nhất Quán & Idempotency (Idempotency Control)

* **Idempotent Job Submission:**
  Mọi tác vụ render đều mang một `idempotency_key` dạng `md5(json_spec_v3_content)`. Nếu người dùng ấn nút Render nhiều lần liên tiếp, worker sẽ nhận diện key trùng lặp và không render lại.
* **LangGraph Persistence Checkpointer:**
  Mọi bước chuyển trạng thái (State Transition) trong LangGraph đều được tự động lưu checkpoint dưới dạng serialized binary/json trong PostgreSQL. Khi server hoặc worker bị rớt hoặc restart, Orchestrator tự động khôi phục đúng biến trạng thái tại bước bị dừng mà không phải chạy lại RAG hay Script Agent từ đầu.

---

## 3. Kiến Trúc Triển Khai (Deployment Topology)

Hệ thống được đóng gói 100% bằng **Docker Container** và triển khai linh hoạt theo 2 mô hình:

### 3.1. Giai Đoạn MVP (Single-Host Docker Compose Topology):
Toàn bộ hệ thống chạy tập trung trên 1 VPS/Server duy nhất với cấu hình Docker Compose tinh gọn:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SINGLE-HOST DOCKER COMPOSE MVP TOPOLOGY                         │
│                                                                                        │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │  API Gateway Container │  │  RAG Service Container │  │ Orchestrator (LangGraph)   │ │
│ │  (Nginx Proxy)         │  │  (FastAPI)             │  │ (Node.js/TS + Postgres Check)│ │
│ └────────────────────────┘  └────────────────────────┘  └────────────────────────────┘ │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │  Postgres, Qdrant DB   │  │  VieNeu TTS ONNX       │  │ Remotion Render Worker     │ │
│ │  Neo4j, Redis, MinIO   │  │  (CPU / Light GPU)     │  │ (BullMQ + Chrome Isolation)│ │
│ └────────────────────────┘  └────────────────────────┘  └────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Mở Rộng Hiệu Năng (Docker Compose Container Scaling Topology):
Khi lưu lượng render tăng cao, hệ thống mở rộng bằng cách scale thêm các Worker Container trong Docker Compose:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE CONTAINER SCALING TOPOLOGY                           │
│                                                                                        │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │  API Gateway Container │  │  Chatbot RAG Container │  │  Orchestrator Agent        │ │
│ │  (Nginx Proxy)         │  │  (FastAPI - 2 Replicas)│  │  (Node.js/TS - 2 Replicas) │ │
│ └────────────────────────┘  └────────────────────────┘  └────────────────────────────┘ │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │  PostgreSQL & Redis    │  │  VieNeu TTS Container  │  │  Remotion Render Workers   │ │
│ │  (State DB & Cache)    │  │  (ONNX Runtime Engine) │  │  (BullMQ Multi-Workers)    │ │
│ └────────────────────────┘  └────────────────────────┘  └────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Môi Trường Phát Triển Cục Bộ (Local Docker Compose File)

```yaml
version: '3.8'

services:
  nginx-gateway:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on: [user-service, rag-service, orchestrator-service]

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: chronoviet_db
      POSTGRES_USER: chronoviet
      POSTGRES_PASSWORD: secret_password
    ports: ["5432:5432"]

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]

  neo4j:
    image: neo4j:5.12-community
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/secret_password

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]

  vieneu-tts:
    image: chronoviet/vieneu-tts-onnx:latest
    ports: ["8080:8080"]

  remotion-worker:
    build: ./eval-remotion
    environment:
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
    volumes:
      - ./eval-remotion/out:/app/out
```

