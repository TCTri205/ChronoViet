# 06. Observability, Metrics & Unified Structured Logging

## Mục đích

Tài liệu này mô tả toàn diện hệ thống **Observability** của ChronoViet bao gồm 4 trục: **Unified Structured Logging** (SSOT zero-dep tại `@chronoviet/shared-spec`), **Prometheus Metrics (RED & USE)** (`prom-client`), **Healthcheck Probes** (`/healthz`, `/readyz`), và **End-to-End Correlation ID Tracing** liên thông từ Web API → Agent Orchestrator → BullMQ Task Queues → Render Workers → VieNeu TTS Microservice.

**Mục tiêu thiết kế:** On-call engineer có thể trả lời 4 câu hỏi từ hệ thống giám sát:

1. **Chuyện gì đã xảy ra trong request/run này?** → Log có cấu trúc + `correlationId` liên thông toàn chuỗi (`select(.correlationId == "...")`)
2. **Hệ thống có đang xuống cấp / nghẽn không?** → Level filter đúng + event name ổn định + Circuit Breaker metrics + BullMQ queue depth
3. **Hiệu năng và độ trễ (Latency, Error Rate, Throughput) như thế nào?** → Prometheus RED metrics & Histograms trên `/api/metrics`
4. **Lỗi này xảy ra ở đâu, tại sao?** → `service`, `event`, error serializer đầy đủ `name/message/stack/cause`

---

## 1. Kiến Trúc Tổng Thể

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    @chronoviet/shared-spec  (SSOT, Telemetry)                │
│                                                                               │
│  createLogger({ service, correlationId?, baseFields? })                       │
│    ├── level filter  ← envConfig.LOG_LEVEL (debug|info|warn|error)            │
│    ├── JSON Lines ở production / test; Pretty-print ở development             │
│    ├── sanitizePayload() — redact secrets & truncateSnippet() bảo vệ PII      │
│    └── serializeError() — name + message + stack + cause                      │
│                                                                               │
│  Prometheus Metrics Registry (RED & USE)                                      │
│    ├── HTTP: chronoviet_http_requests_total, duration_seconds                 │
│    ├── LLM Gateway: requests_total, duration_seconds, circuit_breaker_state   │
│    ├── BullMQ: chronoviet_bullmq_queue_jobs (waiting, active, failed...)      │
│    ├── Realtime: chronoviet_websocket_active_connections                      │
│    └── TTS & Render: chronoviet_render_duration_seconds, tts_synthesis...     │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │
   ┌────────────┼────────────┬─────────────────────┬──────────────────┐
   ▼            ▼            ▼                     ▼                  ▼
apps/web    apps/render-  services/vieneu-tts   agent-orchestrator  rag-engine
(Middleware   worker      (FastAPI + ONNX,      (LangGraph with     (CTE Search,
 + Health     (BullMQ +   /healthz, /metrics)   State correlationId) Ingestion)
 + Metrics)   Probe Srv)
```

### Đặc điểm chính

| Thuộc tính | Giá trị |
|---|---|
| **Logging Format** | `JSON Lines` (1 record = 1 dòng JSON) khi `NODE_ENV=production` hoặc `LOG_FORMAT=json`; pretty-print khi dev |
| **Level filter** | `LOG_LEVEL` trong `.env` (`debug`, `info`, `warn`, `error`) — tôn trọng nghiêm ngặt, cảnh báo fallback/lỗi mạng ở `warn` |
| **Correlation ID** | Sinh/nhận từ Client HTTP `x-request-id` → Middleware Next.js → LangGraph State → BullMQ Job data → Worker child logger |
| **Child logger** | `log.child({ correlationId?, fields? })` — gắn context (`projectId`, `jobId`, `sceneId`) mà không làm ô nhiễm log gốc |
| **Metrics Engine** | `prom-client` chuẩn Prometheus với guard chống cardinality bomb (chỉ dùng bounded labels: route template, status class) |
| **Health Probes** | `/api/healthz` (liveness), `/api/readyz` (readiness kiểm tra PG + Redis), worker probe port 3001, Docker `HEALTHCHECK` |
| **Security & PII** | `sanitizePayload()` redact secret keys (`token`, `api_key`); `truncateSnippet()` cắt ngắn prompt/topic tránh lộ PII |

---

## 2. Liên Thông Correlation ID (End-to-End Tracing)

Chuỗi truy vết một yêu cầu sinh video từ lúc người dùng submit:

```
[Client / Caddy]  ──(x-request-id: abc-123)──►  [apps/web Middleware]
                                                        │
                                                        ▼ (log.child({ correlationId }))
                                                [POST /api/v1/projects]
                                                        │
                                                        ▼ (state.correlationId)
                                             [Agent Orchestrator Pipeline]
                                                        │
                                                        ▼ (enqueueRenderJob payload)
                                                [BullMQ Render Queue]
                                                        │
                                                        ▼ (job.data.correlationId)
                                              [apps/render-worker]
                                                        │
                                                        ▼ (HTTP x-request-id)
                                             [services/vieneu-tts]
```

### Debug truy vết xuyên suốt bằng `jq`:

```bash
# Lọc toàn bộ hành trình của một request cụ thể qua tất cả services và workers:
docker compose logs | jq -c 'select(.correlationId == "a1b2c3d4-xxxx-yyyy")'
```

---

## 3. Prometheus Metrics & Exposition Endpoints

### 3.1. Danh mục Metrics cốt lõi (RED & USE)

| Tên Metric | Kiểu | Labels | Ý nghĩa |
|---|---|---|---|
| `chronoviet_http_requests_total` | Counter | `method`, `route`, `status_class` | Tổng số HTTP requests (Rate, Errors) |
| `chronoviet_http_request_duration_seconds` | Histogram | `method`, `route`, `status_class` | Phân phối độ trễ request (Duration, p95, p99) |
| `chronoviet_llm_requests_total` | Counter | `provider`, `model`, `status` | Tổng số gọi LLM nội bộ / Cloud fallback |
| `chronoviet_llm_request_duration_seconds` | Histogram | `provider`, `model` | Độ trễ suy luận mô hình LLM |
| `chronoviet_circuit_breaker_state` | Gauge | `subsystem` | Trạng thái Circuit Breaker (0 = CLOSED, 1 = OPEN) |
| `chronoviet_bullmq_queue_jobs` | Gauge | `queue`, `state` | Độ sâu hàng đợi BullMQ (`waiting`, `active`, `failed`...) |
| `chronoviet_websocket_active_connections` | Gauge | — | Số kết nối WebSocket client đang hoạt động |
| `chronoviet_render_duration_seconds` | Histogram | `status` | Thời gian render video MP4 qua Remotion Engine |
| `chronoviet_tts_synthesis_duration_seconds` | Histogram | `engine` | Thời gian tổng hợp âm thanh VieNeu TTS |

### 3.2. Endpoints thu thập Metrics (`/metrics`)

- **Web Application & Next.js API:** `http://localhost:3000/api/metrics`
- **Render Worker Probe Server:** `http://localhost:3001/metrics`
- **VieNeu TTS Microservice:** `http://localhost:8080/metrics`

---

## 4. Healthcheck & Liveness/Readiness Probes

| Dịch vụ | Endpoint / Lệnh kiểm tra | Loại Probe | Tiêu chí Ready |
|---|---|---|---|
| `apps/web` | `GET /api/healthz` | Liveness | HTTP Server đang chạy (200 OK) |
| `apps/web` | `GET /api/readyz` | Readiness | PostgreSQL ping OK + Redis ping OK (200 OK) |
| `apps/render-worker` | `GET http://localhost:3001/healthz` | Liveness | Worker process alive (200 OK) |
| `apps/render-worker` | `GET http://localhost:3001/readyz` | Readiness | Redis BullMQ connection OK (200 OK) |
| `services/vieneu-tts` | `GET http://localhost:8080/health` | Liveness/Readiness | HTTP & Python ONNX engine ready (200 OK) |

Tất cả container trong `docker-compose.yml` đều được trang bị `healthcheck` tự động tái khởi động nếu container bị treo hoặc mất kết nối phụ thuộc.

---

## 5. Checklist Observability (Đã hoàn thiện 100%)

- [x] Mọi log output đều **có cấu trúc** (JSON Lines ở production, pretty ở dev), event name phân cấp ổn định
- [x] **Correlation ID liên thông toàn hệ thống** — Web Middleware → API Routes → Orchestrator → BullMQ Job → Render Worker → TTS Server
- [x] **Bảo vệ Secret & PII** — `sanitizePayload()` redact mật khẩu/token; `truncateSnippet()` cắt ngắn prompt/topic người dùng
- [x] **Log level chính xác** — Lỗi kết nối Redis/Queue và sự kiện suy thoái/fallback LLM ghi ở mức `warn`
- [x] **Prometheus Metrics (RED & USE)** — Đo lường throughput, p95/p99 latency, queue depth, active sockets, circuit breakers
- [x] **Healthcheck Probes & Container Recovery** — `/healthz`, `/readyz` và Docker `HEALTHCHECK` trên mọi service
- [x] **Silent error paths đã vá** — PostgreSQL offline fallback, TTS 500, JSON parse error, streaming failures
