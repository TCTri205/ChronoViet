# QUẢN LÝ STATE, KHẢ NĂNG CHỊU LỖI & TOPOLOGY TRIỂN KHAI
## (State Management, Workflow Engine & Deployment Topology Specification)

---

## 1. Quản Lý State Máy Trạng Thái (State Machine Lifecycle)

Vòng đời từ khi người dùng nhập yêu cầu cho đến khi nhận video hoàn chỉnh được quản lý nghiêm ngặt qua **LangGraph với Postgres Checkpointer SSOT** (gồm Micro-Step 0 Chaptering và 5 Micro-Steps kịch bản + Guardrails):

```
 [INIT] ──► [RAG_RETRIEVED] ──► [OUTLINE_CHAPTERED] ──► [CHAPTER_SCRIPT_GENERATED]
                                                               │
                                                               ▼
 [RESEARCH_COMPLETED] ◄─── [SCENES_SEGMENTED] ◄─── [CHAPTER_FACT_CHECKED]
       │
       ▼
 [TTS_SYNTHESIZED] ──► [DURATION_RECONCILED] ──► [KEYWORDS_EXTRACTED]
                                                        │
                                                        ▼
 [COMPLETED] ◄─── [PACKAGED] ◄─── [ASSETS_AUDITED] ◄────┘
      │               │                  │
   [FAILED] ◄─────────┴──────────────────┴── (Max Retry Exceeded)
      ▲
      └───────────────────────────────────── [NEEDS_HUMAN_REVIEW]
```

### Chi tiết các trạng thái (15 Canonical Operational States):

| State | Mô tả trạng thái | Xử lý Idempotency & Compensation (Phục hồi lỗi) |
| :--- | :--- | :--- |
| `INIT` | Khởi tạo session dự án video từ prompt người dùng. | Tạo `projectId` duy nhất (UUIDv4). |
| `RAG_RETRIEVED` | Lấy xong trích dẫn sử liệu chuẩn từ PostgreSQL (`pgvector` + Graph). | Checkpoint state vào PostgreSQL, cache context vào Redis. |
| `OUTLINE_CHAPTERED` | Micro-Step 0 chia video thành $N$ Chapters (2-3 min/Chap). | Checkpoint danh sách Chapter Outlines & `runningNarrativeState`. |
| `CHAPTER_SCRIPT_GENERATED` | Micro-Step 1A sinh lời thoại voiceover truyền `narrativeContext`. | Checkpoint voiceover text của từng Chapter. |
| `CHAPTER_FACT_CHECKED` | Micro-Step 1B Dual Guardrails (Folklore Regex + NLI Entailment Judge $\ge 0.80$). | Thang Escalation: Safe Auto-Fix ➔ Retry $\le 2$ ➔ Flag `NEEDS_HUMAN_REVIEW` (Resume trực tiếp `segmenter` không lặp node). |
| `SCENES_SEGMENTED` | Phân đoạn kịch bản thành các scene chi tiết theo timing và visual cue. | Checkpoint danh sách các scene cần tìm tài nguyên. |
| `RESEARCH_COMPLETED` | Micro-Step 1C Research Agent tìm kiếm tư liệu lịch sử tương ứng. | Thu thập provenance, license candidates cho từng scene. |
| `TTS_SYNTHESIZED` | VieNeu TTS sinh file audio và word-level timestamps cho từng scene. | Lưu audio vào Host Volume `/media/audio-cache/`, fallback `SyntheticTTSFallbackEngine` (sine 480Hz) khi service Python chưa sẵn sàng (dev). |
| `DURATION_RECONCILED` | Micro-Step 2 Pacing Reconcile cân bằng thời lượng thoại và hình ảnh. | Time-Stretch ±10%, reconcile frame timings. |
| `KEYWORDS_EXTRACTED` | Micro-Step 3 Trích xuất từ khóa, thực thể & typography tags. | Checkpoint overlay metadata cho Remotion rendering. |
| `ASSETS_AUDITED` | VLM Inspector kiểm định bản quyền & chất lượng ảnh (`PD`, `CC0`, `CC-BY`). | Tự động fallback Pure Code Layout nếu ảnh < 60 điểm. |
| `PACKAGED` | Micro-Step 4 Đóng gói toàn diện thành `ChronoVideoScriptSchema` v4.1. | Validate 100% Zod Schema v4.1 trước khi đưa vào Render Queue. |
| `COMPLETED` | Video MP4 đã render xuất xưởng thành công vào `/media/projects/:projectId/output/video.mp4`. | Trả link phát/tải MP4 (`/api/v1/projects/:id/video`), dọn dẹp temp files & Chrome processes. |
| `NEEDS_HUMAN_REVIEW` | Fact-Check hoặc Asset Audit không thể tự giải quyết sau retry. | Gửi Alert Webhook/UI để biên tập viên duyệt/sửa tay, không sập pipeline. |
| `FAILED` | Dự án bị lỗi nghiêm trọng không thể khắc phục sau toàn bộ escalation. | Ghi lại traceback log, giải phóng job queue và hoàn token. |

---

## 2. Tính Nhất Quán & Idempotency (Idempotency Control)

* **Idempotent Job Submission:**
  Mọi tác vụ render đều mang một `idempotency_key` dạng `md5(json_spec_v4_content)`. Nếu người dùng ấn nút Render nhiều lần liên tiếp, worker sẽ nhận diện key trùng lặp và không render lại.
* **LangGraph Persistence Checkpointer:**
  Mọi bước chuyển trạng thái (State Transition) trong LangGraph đều được tự động lưu checkpoint dưới dạng serialized binary/json trong PostgreSQL. Khi server hoặc worker bị rớt hoặc restart, Orchestrator tự động khôi phục đúng biến trạng thái tại bước bị dừng mà không phải chạy lại RAG hay Script Agent từ đầu.

---

## 3. Kiến Trúc Triển Khai Linh Hoạt (Dual-Target Deployment Topology)

ChronoViet hỗ trợ đồng thời 2 môi trường phần cứng với cơ chế tối ưu riêng biệt:

### 3.1. Target 1: Local Dev trên macOS (Apple Silicon Metal & UMA)
- **Host Native AI Engines:** Do Docker Desktop trên macOS không hỗ trợ passthrough Metal GPU, các mô hình `llama-server` (LLM/VLM 8092 & BGE-M3 Embedding 8090) chạy trực tiếp trên Host OS thông qua `scripts/ai-supervisor.ts` nhằm khai thác 100% băng thông Unified Memory Architecture (UMA).
- **Containerized Auxiliary Services:** PostgreSQL (pgvector), Redis, và VieNeu TTS FastAPI ONNX chạy trong Docker Desktop (`docker compose --profile infra --profile tts up -d`).
- **Orchestration:** Khởi động toàn bộ stack chỉ với 1 lệnh `pnpm dev` (hoặc `pnpm dev:full` khi cần kèm AI Supervisor + VieNeu TTS).

### 3.2. Target 2: Production trên Linux Server (NVIDIA CUDA GPU)
- **100% Containerized:** Khai thác NVIDIA Container Toolkit, đóng gói toàn bộ hệ thống trong Docker Compose:
  - `local-ai-cuda-llm` (Port 8092): Qwen3.5-9B Instruct + Flash Attention + Continuous Batching + mmproj.
  - `local-ai-cuda-emb` (Port 8090): BGE-M3 (1024d Dense Vector Space) `--embedding`.
  - `vieneu-tts-service` (Port 8080): Python FastAPI ONNX Heritage TTS.
  - `postgres` (Port 5432) & `redis` (Port 6379).
  - `app` (Next.js Monolith API) & `worker` (Remotion Headless Chrome Render Worker).
  - `caddy` (Auto Let's Encrypt SSL/TLS & Media File Server).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             DUAL-TARGET TOPOLOGY: LOCAL MACOS DEV vs LINUX NVIDIA PROD                 │
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         CADDY REVERSE PROXY CONTAINER                              │ │
│ │          (Auto SSL/TLS Let's Encrypt - GitOps Caddyfile - WebSocket - Static Media)  │ │
│ └─────────────────────────────────────────┬──────────────────────────────────────────┘ │
│                                           │                                            │
│        ┌──────────────────────────────────┼──────────────────────────────────┐         │
│        ▼                                  ▼                                  ▼         │
│ ┌────────────────────────┐     ┌────────────────────────┐     ┌──────────────────────┐ │
│ │  PostgreSQL Container  │     │   App Monolith API     │     │   Redis Container    │ │
│ │ (Relational + Checkpoints│   │ (Next.js 14 App Router │     │ (BullMQ Job Queue &  │ │
│ │  + pgvector Embeddings)│     │  + LangGraph Node.js)  │     │  LRU Multi-Layer     │ │
│ └────────────────────────┘     └──────────┬─────────────┘     │  Cache & WS PubSub)  │ │
│                                           │                   └──────────┬───────────┘ │
│                                           └─────────────┬────────────────┘             │
│                                                         ▼                              │
│ ┌────────────────────────┐     ┌─────────────────────────────────────────────────────┐ │
│ │ local-ai-cuda-llm/emb  │     │             AI & RENDER WORKER CONTAINER            │ │
│ │ (Linux NVIDIA CUDA /   │◄────┤ (VieNeu TTS ONNX Engine & Remotion Headless Chrome) │ │
│ │  macOS Metal Host)     │     └─────────────────────────────────────────────────────┘ │
│ └────────────────────────┘                                                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. File Cấu Hình Triển Khai Thực Tế (Docker Compose Specs)

Hệ thống cung cấp file cấu hình `docker-compose.yml` phân tách theo profiles (`infra`, `tts`, `ai-cuda`, `prod`, `prod-all`):

```bash
# 1. macOS Dev: Chỉ bật Infra + TTS
pnpm stack:infra
pnpm stack:tts

# 2. Linux Production: Bật Full Stack (App + Worker + Caddy + DB + Redis + TTS)
pnpm stack:prod

# 3. Linux Production All-in-One (Bao gồm cả Local CUDA LLM & Embedding)
pnpm stack:prod:all
```

### 4.2. `Caddyfile` (Cấu hình Dynamic Domain & Reverse Proxy)

```caddyfile
{$APP_DOMAIN:localhost} {
    # 1. Block access to internal workspace schema & temp files, serve public media assets
    handle /media/* {
        @blocked path /media/projects/*/project_schema.json /media/projects/*/temp/*
        respond @blocked 403

        header Cache-Control "public, max-age=3600"
        header X-Content-Type-Options "nosniff"
        root * /app
        file_server
    }

    # 2. Forward API & Web Dashboard & WebSockets to Next.js App Monolith
    handle {
        reverse_proxy app:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # 3. HTTP Compression
    encode zstd gzip
}
```



