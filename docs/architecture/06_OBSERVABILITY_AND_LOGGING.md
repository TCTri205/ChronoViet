# 06. Observability & Unified Structured Logging

## Mục đích

Tài liệu này mô tả hệ thống **Unified Structured Logging** của ChronoViet — một logger dùng chung, zero-dependency, đặt tại `@chronoviet/shared-spec`, được toàn bộ monorepo (6 packages, 2 apps, 1 service) sử dụng để phát ra log có cấu trúc, máy đọc được, có correlation ID.

**Mục tiêu thiết kế:** On-call engineer có thể trả lời 3 câu hỏi từ log:

1. **Chuyện gì đã xảy ra trong request/run này?** → Log có cấu trúc + `correlationId`
2. **Hệ thống có đang xuống cấp không?** → Level filter đúng + event name ổn định, filter/grep được
3. **Lỗi này xảy ra ở đâu, tại sao?** → `service`, `event`, error serializer đầy đủ `name/message/stack/cause`

---

## 1. Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│  @chronoviet/shared-spec/src/logger.ts  (SSOT, zero-dep)   │
│                                                             │
│  createLogger({ service, correlationId?, baseFields? })     │
│    ├── level filter  ← envConfig.LOG_LEVEL (debug|info|warn|error)
│    ├── JSON Lines ở production / test                       │
│    ├── Pretty-print ở development                           │
│    ├── sanitizePayload() — redact secrets (password/token/  │
│    │   api_key/authorization...)                            │
│    └── serializeError() — name + message + stack + cause    │
│                                                             │
│  log.child({ fields }) → logger có context bổ sung          │
│                                                             │
│  logFallbackAlert() → JSON event system.fallback_activated  │
└──────────────┬──────────────────────────────────────────────┘
               │  mọi package/app/service phụ thuộc shared-spec
   ┌───────────┼───────────┬───────────┬───────────┐
   ▼           ▼           ▼           ▼           ▼
data-ingestion rag-engine remotion-engine vlm-inspector agent-orchestrator
apps/web apps/render-worker services/vieneu-tts
```

### Đặc điểm chính

| Thuộc tính | Giá trị |
|---|---|
| **Output** | `JSON Lines` (1 record = 1 dòng JSON) khi `NODE_ENV=production` hoặc `LOG_FORMAT=json`; pretty-print khi dev |
| **Level filter** | `LOG_LEVEL` trong `.env` (`debug`, `info`, `warn`, `error`) — **giờ được tôn trọng thực sự** (trước đây là config chết) |
| **Kênh output** | `error`/`warn` → stderr; `debug`/`info` → stdout. Test mode → stderr |
| **Correlation ID** | `createLogger({ correlationId })` — thread qua toàn bộ request/run |
| **Child logger** | `log.child({ fields })` — gắn context (projectId, runId, entityId...) mà không cần tạo sink mới |
| **Security** | `sanitizePayload()` redact secret keys; không bao giờ log mật khẩu/token/API key |

### Cấu trúc 1 log record

```json
{
  "time": "2026-08-13T10:15:30.123Z",
  "level": "info",
  "service": "vieneu-tts",
  "event": "tts.synthesize_started",
  "msg": "TTS synthesis request received",
  "correlationId": "a1b2c3d4-...",
  "text": "Trần Hưng Đạo...",
  "sampleRate": 24000
}
```

### Quy ước event name

Mỗi log record **bắt buộc** có `event` — chuỗi phân cấp `subsystem.hành_động.kết_quả`, dùng dot notation:

| Subsystem | Ví dụ event |
|---|---|
| `db` | `db.pg_connected`, `db.pg_unavailable`, `db.schema_migration_failed` |
| `llm` | `llm.request_started`, `llm.local_failed`, `llm.cloud_success`, `llm.all_providers_failed` |
| `embedding` | `embedding.api_unconfigured`, `embedding.api_failed` |
| `ingest` | `ingest.started`, `ingest.completed`, `ingest.failed` |
| `crawl` | `crawl.item_succeeded`, `crawl.item_skipped`, `crawl.item_failed` |
| `seeder` | `seeder.document_ingested`, `seeder.batch_completed` |
| `rag` | `rag.search_started`, `rag.search_completed`, `rag.graph_search_done`, `rag.hybrid_search_done` |
| `tts` | `tts.server_started`, `tts.synthesize_started`, `tts.synthesize_failed`, `tts.python_engine_failed` |
| `render` | `render.video_started`, `render.video_failed`, `render.schema_invalid` |
| `orchestrator` | `orchestrator.started`, `orchestrator.completed` |
| `ops` | `ops.db_health_started`, `ops.db_health_completed`, `ops.db_cleanup_started`, `ops.self_loops_removed`, `ops.duplicates_removed` |
| `eval` | `eval.module_failed`, `eval.chain_failed`, `eval.unknown_chain`, `eval.fatal_error` |
| `system` | `system.fallback_activated` (logFallbackAlert) |

### Mức log — dùng nhất quán

| Level | Ý nghĩa | Hành động on-call |
|---|---|---|
| `error` | Invariant bị phá vỡ; ai đó có thể phải hành động | Điều tra |
| `warn` | Xuống cấp nhưng đã xử lý (retry thành công, fallback được dùng) | Theo dõi xu hướng |
| `info` | Sự kiện kinh doanh quan trọng (đơn đặt hàng, job hoàn thành) | Không cần hành động |
| `debug` | Chi tiết chẩn đoán | Tắt ở production theo mặc định |

---

## 2. Cách Sử Dụng

### Import

```ts
import { createLogger } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'rag-engine' });

log.info('rag.search_started', 'RAG search started', {
  query: queryText,
  rerankTopK: 5,
});
```

### Correlation ID cho HTTP server

`services/vieneu-tts/src/server.ts` — chấp nhận `x-request-id` từ client hoặc sinh mới, propagate vào response:

```ts
const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
res.setHeader('x-request-id', requestId);
const log = createLogger({ service: 'vieneu-tts', correlationId: requestId });
```

Python side (`app.py`) đọc `x-request-id` từ header và ghi vào log của nó, nối liền trace giữa Node wrapper và Python ONNX engine.

### Child logger

```ts
const pipelineLog = log.child({ fields: { projectId: initialState.projectId } });
pipelineLog.info('orchestrator.started', 'Pipeline started');
```

### Log lỗi

Luôn truyền Error object vào field `error` — logger tự serialize `name/message/stack/cause`:

```ts
} catch (err) {
  log.error('ingest.failed', 'Ingestion Pipeline Error', { error: err });
  process.exit(1);
}
```

---

## 3. Phạm Vi Triển Khai

### Đã migrate từ `console.*` → structured logger

| Package / App | File chính | Số điểm log |
|---|---|---|
| `shared-spec` | `db/client.ts`, `llm-client.ts`, `embeddings.ts` | ~12 |
| `data-ingestion` | `cli/*` (8 file), `seeder/*`, `media/*`, `triple-extractor.ts` | ~50 |
| `rag-engine` | `rag-engine.ts`, `retrieval/*` (mới — trước đây câm lặng), `cli/chat-cli.ts` | ~10 |
| `remotion-engine` | `cli.ts` | ~12 |
| `vlm-inspector` | `gemini-scorer.ts` | ~2 |
| `agent-orchestrator` | `graph/orchestrator.ts` (mới) | ~2 |
| `apps/web`, `apps/render-worker` | `src/index.ts` | ~2 |
| `services/vieneu-tts` | `server.ts`, `engine.ts`, `app.py` | ~12 |
| `scripts/` (ops) | `verify-db-health.ts`, `clean-db-duplicates.ts` | ~6 |
| `eval/` (root runner) | `runner.ts` (fail paths + fatal error) | ~5 |

### Các lớp library mới có logging (trước đây silent)

- **`rag-engine` retrieval layer**: `graph-cte-search.ts` (số triples, pg/memory mode), `vector-search.ts` (dense/FTS hits), `rag-engine.ts` (pipeline 5 bước)
- **`agent-orchestrator`**: pipeline lifecycle với `correlationId = projectId`

### Silent error paths đã được vá

| Trước | Sau |
|---|---|
| `db/client.ts` PG fallback — **im lặng** | `log.warn('db.pg_unavailable', ...)` + `db.pg_forced_offline` |
| `vieneu-tts/server.ts` HTTP 500 — **im lặng** (lỗi chỉ nằm trong response body) | `log.error('tts.synthesize_failed', ...)` |
| `crawler` catch trả về result object — không log | `log.debug('crawl_pdf.wiki_fetch_failed', ...)` |
| `triple-extractor` JSON parse fail — **nuốt lỗi** | `log.warn('seeder.json_parse_fallback', ...)` |

### `logFallbackAlert` — giữ API, đổi output

Function cũ phát ra banner ASCII emoji không parse được → giờ phát **JSON event `system.fallback_activated`** (level warn, stderr). Call sites không đổi: `llm-client.ts`, `embeddings.ts`, `triple-extractor.ts`, `gemini-scorer.ts`, `vieneu-tts/engine.ts`.

```json
{"time":"...","level":"warn","service":"system","event":"system.fallback_activated","msg":"LLM_GATEWAY fallback activated","subsystem":"LLM_GATEWAY","primaryTarget":"Local LLM (...)","fallbackTarget":"Agnes 2.0 Flash Cloud API [...]","reason":"..."}
```

### Giữ nguyên `console.*` (có chủ đích)

| File | Lý do giữ |
|---|---|
| `shared-spec/src/config.ts:124` | Error bootstrap config xảy ra *trước khi* logger sẵn sàng (logger import config) |
| `remotion-engine/src/cli.ts` help text | Output chuẩn của CLI `--help` |
| `rag-engine/src/cli/chat-cli.ts` (35 calls) | Terminal UI tương tác (hiển thị câu trả lời, prompt, menu); sự kiện lifecycle + lỗi đã dùng logger |
| `**/eval/**` (runners, chains, benchmarks) | Output báo cáo benchmark dạng bảng (UI có chủ đích); các fail path trong `eval/runner.ts` root đã dùng logger |

---

## 4. Hướng Dẫn Truy Vết (Debugging Guide)

### 4.1. Dev — pretty print

```bash
pnpm rag:chat                       # pretty log + terminal UI
pnpm ingest:knowledge --force      # ingest pipeline, pretty log
```

### 4.2. Production — JSON Lines

```bash
# Chạy với JSON output
NODE_ENV=production pnpm --filter @chronoviet/vieneu-tts start

# hoặc ép format bất kể env
LOG_FORMAT=json pnpm --filter @chronoviet/vieneu-tts start
```

### 4.3. Lọc theo service / event / level

```bash
# Toàn bộ log của TTS
docker compose logs vieneu-tts-service | jq -c 'select(.service == "vieneu-tts")'

# Lỗi và fallback trên toàn hệ thống
docker compose logs | jq -c 'select(.level == "error" or .level == "warn")'

# Theo dõi một request cụ thể end-to-end (Node → Python)
docker compose logs | jq -c 'select(.correlationId == "<x-request-id>")'

# Fallback activated
docker compose logs | jq -c 'select(.event == "system.fallback_activated")'

# Chỉ xem RAG pipeline
docker compose logs | jq -c 'select(.service == "rag-engine")'
```

### 4.4. Level filter

```bash
# Debug chi tiết (chunk-level, query-level)
LOG_LEVEL=debug pnpm rag:chat

# Im lặng nhất có thể — chỉ error
LOG_LEVEL=error pnpm ingest:knowledge
```

### 4.5. Typecheck eval/ + scripts/ (ngoài pnpm workspace)

`eval/` và `scripts/` không thuộc pnpm workspace, nên trước đây không được CI typecheck — điều này từng che giấu lỗi schema cũ (xem §7). Giờ có script riêng:

```bash
pnpm typecheck:extras   # tsc --noEmit -p tsconfig.extras.json (bao phủ toàn bộ eval/**/*.ts và scripts/**/*.ts)
```

---

## 5. Checklist Observability (Theo Skill Observability)

- [x] Mọi log output đều **có cấu trúc** (JSON Lines ở production, pretty ở dev), event name ổn định
- [x] **Correlation ID** trên mọi log record — TTS server `x-request-id`, CLI run id, orchestrator `projectId`
- [x] Không có secret/token/PII trong log — `sanitizePayload()` redact `password|secret|token|api_key|authorization`
- [x] Mọi external dependency có log lifecycle: LLM (`llm.*`), Embedding (`embedding.*`), PostgreSQL (`db.*`), TTS Python (`tts.*`), crawlers (`crawl.*`)
- [x] Silent error paths đã được vá (PG fallback, TTS 500, JSON parse fail)
- [ ] **Chưa có** metric (RED/USE) và tracing (OpenTelemetry) — roadmap tương lai (xem §6)

---

## 6. Roadmap Tương Lai

| Việc | Trạng thái |
|---|---|
| Metric RED/USE cho TTS server, LLM gateway, embedding server (prom-client hoặc OpenTelemetry) | 📐 Thiết kế |
| Distributed tracing (OpenTelemetry) qua Node → Python boundary | 📐 Thiết kế |
| Structured logging cho Python `app.py` (hiện đang `logging` chuẩn + format text, chưa JSON) | 📐 Thiết kế |
| Alerting symptom-based trên error rate / fallback rate | 📐 Thiết kế |

---

## 7. Bugs Pre-existing Phát Hiện & Đã Sửa Nhờ Audit

Trong quá trình đối chiếu toàn diện (lần 2), các lỗi sau được phát hiện ở vùng **không được CI typecheck** (`eval/`, `scripts/`) — trước đây chỉ lộ ra khi chạy runtime:

| File | Lỗi | Fix |
|---|---|---|
| `eval/chains/ingest-rag.ts` | `isPgMode` dùng nhưng **không khai báo** → ReferenceError khi chain chạy | Thêm `let isPgMode = false;` |
| `eval/chains/ingest-rag.ts` | `ragEngine.search()` thiếu `maxTokens` (schema hiện tại bắt buộc) | Thêm `maxTokens: 512` |
| `eval/chains/vieneu-remotion.ts` | Đọc `scene.audioOverlay`/`scene.overlay` — field đã bị xóa khỏi `ChronoVideoProps` schema | Đổi sang `scene.text`/`scene.overlayData` (schema hiện tại) |
| `eval/chains/vieneu-remotion.ts` | Ghi `scene.audioOverlay` — field không tồn tại trong schema | Bỏ (đã có `sceneAudioUrl` + `captions`) |
| `eval/chains/vieneu-remotion.ts` | `ttsEngine.synthesize()` thiếu `speakerId/speedRatio/sampleRate` (bắt buộc) | Thêm đầy đủ params |
| `eval/runner.ts` | Import `IntegratedIngestRagReport` — **type không tồn tại** | Đổi sang `ProductionRagQualityReport` (type thực tế) |
| `eval/runner.ts` | `chainReports` typed sai → không gán được `ProductionRagQualityReport` | Sửa union type |

**Bài học:** `eval/` và `scripts/` nằm ngoài pnpm workspace nên không được typecheck — giờ có `pnpm typecheck:extras` (§4.5) để CI bao phủ, ngăn tái phát. Đây chính là ví dụ cho thấy observability/audit giúp phát hiện vấn đề ẩn mà logging đơn thuần không thấy được.
