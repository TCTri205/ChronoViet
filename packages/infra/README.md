# `@chronoviet/infra`

> **ChronoViet Infrastructure Runtime Layer & Clients**  
> Gói hạ tầng tập trung cung cấp các runtime clients kết nối cơ sở dữ liệu, hàng đợi BullMQ Redis, bộ suy luận LLM đa tầng, mô hình nhúng Dense Vector (BGE-M3), Reranker cross-encoder, VieNeu TTS Client, Telemetry Prometheus và Distributed Locks.

---

## 📌 1. Tổng Quan Kiến Trúc (Package Overview)

Gói `@chronoviet/infra` đóng gói toàn bộ các tài nguyên runtime và stateful clients của hệ thống ChronoViet:

1. **Database Client (`db/`):**
   - PostgreSQL connection pool (`pg.Pool`) tích hợp pgvector cho truy vấn hybrid search và đồ thị quan hệ.
   - Transaction helper `withTransaction()` và Audit logging helper `logEntityAuditAction()`.
2. **Unified Structured Logger (`logger.ts`):**
   - Ghi log JSON Lines chuẩn ở production, Pretty formatting ở dev.
   - Tự động redaction các bí mật (API Keys, Token) và hỗ trợ Child Logger kế thừa context (`correlationId`, `projectId`).
3. **Multi-Provider LLM Client & Key Rotator (`llm-client.ts`, `api-key-rotator.ts`):**
   - `HybridInferenceDispatcher`: Quản lý luân chuyển phân cấp 2 tầng (Level 1: Provider Round-Robin $\to$ Level 2: API Key per Provider) giữa Local LLM (`llama-server`) và Cloud Fallback (Agnes, Gemini, OpenAI, OpenRouter).
   - `ApiKeyRotator`: Quản lý pool API keys độc lập cho từng Cloud Provider, tự động cách ly 24h khi gặp mã lỗi 429/Quota, cách ly 30s khi gặp 503/timeout, và hỗ trợ Fast Failover Retry tức thì.
4. **Dense Vector Embeddings & LRU Cache (`embeddings.ts`):**
   - Chuẩn hóa không gian vector dense 1024 chiều BGE-M3 phục vụ GraphRAG và Semantic Search.
   - Quản lý `embeddingCache` với cơ chế evict 20% bản ghi cũ nhất khi đạt ngưỡng.
5. **Local Cross-Encoder Reranker Client (`reranker-client.ts`):**
   - Gửi request trực tiếp qua HTTP `POST /v1/rerank` tới `llama-server` (Port 8096, `Qwen3-Reranker-0.6B` / `bge-reranker-v2-m3`).
6. **VieNeu TTS Engine Client & Text Normalizer (`tts/`):**
   - `normalizeVietnameseTextForTTS`: Chuẩn hóa phát âm chữ số, năm dương lịch, tỷ lệ và từ viết tắt sang dạng văn bản mở rộng hoàn chỉnh trước khi gửi đến TTS và Remotion.
   - `VieNeuEngine`: Client gọi Python FastAPI Microservice qua HTTP (Port 8080), tự động fallback sang `createSyntheticWavBuffer` khi service offline.
   - Bộ tiện ích tính toán mốc thời gian phụ đề Remotion: `convertVieNeuTimestampsToCaptions` và `calculateSceneDurationInFrames`.
7. **Resource Sentinel & Distributed Render Mutex (`resource-sentinel.ts`):**
   - Giám sát RAM (`MEMORY_PRESSURE_THRESHOLD_PCT`) và quản lý Redis Distributed Lock điều phối tài nguyên render video.
8. **Fault Tolerance Circuit Breakers (`circuit-breaker.ts`):**
   - Quản lý trạng thái chịu lỗi 3 phân hệ: `localLlmCircuit`, `cloudFallbackCircuit`, `embeddingCircuit`.
9. **Prometheus Telemetry Registry (`telemetry/metrics.ts`):**
   - Quản lý toàn bộ metrics RED và USE của monorepo.
10. **BullMQ Queues (`queues.ts`):**
    - Đóng gói hàng đợi `renderQueue` và các helper enqueue job render video Remotion.
11. **Project Workspace & Media Storage (`workspace.ts`):**
    - Quản lý cấu trúc thư mục `/media/projects/:id/` (`assets/`, `audio/`, `captions/`, `temp/`, `output/video.mp4`).
12. **Realtime Pub/Sub Gateway Client (`realtime.ts`):**
    - Helper phát và đăng ký nhận sự kiện WebSocket qua Redis channel `project_events:${projectId}`.
13. **Audio Normalizer (`tts/audio-normalizer.ts`):**
    - Chuẩn hóa âm lượng BGM (-14 LUFS) và SFX Peak (-6 LUFS) cho Remotion Render Engine.
14. **Dynamic Concurrency Tuner (`config/concurrency-tuner.ts`):**
    - Tự động tối ưu hóa batch size và concurrency theo dung lượng RAM/CPU khả dụng của máy chủ.
15. **Preflight & Evaluation Helpers (`eval-preflight.ts`, `eval-cleaner.ts`):**
    - Kiểm tra sức khỏe kết nối đa dịch vụ trước benchmark và helper dọn dẹp dữ liệu kiểm thử.

---

## 📂 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/infra/
├── src/
│   ├── ai/                    # Hybrid LLM client, API key rotator, LLM judge
│   ├── config/                # Environment config loader, concurrency tuner
│   ├── db/                    # PostgreSQL connection pool, schema definitions, audit logging
│   ├── telemetry/             # Prometheus metrics registry, structured logger
│   ├── tts/                   # VieNeu TTS client, text normalizer, audio normalizer
│   ├── circuit-breaker.ts     # Multi-subsystem fault tolerance circuit breakers
│   ├── embeddings.ts          # Dense vector BGE-M3 embedding client & LRU cache
│   ├── eval-cleaner.ts        # Database cleanup helper for benchmarks
│   ├── eval-preflight.ts      # Multi-service health probe before evaluation
│   ├── image-search.ts        # External image search wrapper
│   ├── index.ts               # Package public exports entrypoint
│   ├── queues.ts              # BullMQ queue producer client
│   ├── realtime.ts            # Redis Pub/Sub realtime messaging helper
│   ├── reranker-client.ts     # Local cross-encoder reranker client (Port 8096)
│   ├── resource-sentinel.ts   # Distributed render mutex & memory pressure monitor
│   ├── workspace.ts           # Media storage & project workspace manager
│   └── __tests__/             # Infrastructure unit test suites (Vitest)
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng (Usage Example)

```typescript
import {
  query,
  createLogger,
  callLlm,
  generateDenseVectorEmbedding,
  VieNeuEngine,
} from '@chronoviet/infra';

const log = createLogger({ service: 'rag-engine' });

// Thực thi truy vấn SQL
const rows = await query('SELECT * FROM entities WHERE id = $1', ['person_ngo_quyen']);

// Suy luận LLM qua Hybrid Dispatcher
const response = await callLlm({
  messages: [{ role: 'user', content: 'Kể về chiến thắng Bạch Đằng 938' }],
  temperature: 0.3,
});
```

---

## ⚡ 4. Bộ Lệnh Kiểm Định & Phát Triển (CLI Commands)

```bash
# Kiểm tra TypeScript
pnpm --filter @chronoviet/infra typecheck
# hoặc từ root monorepo:
pnpm typecheck:infra

# Chạy Unit Tests (DB Pool, Circuit Breaker, Sentinel, Logger, Telemetry)
pnpm --filter @chronoviet/infra test
# hoặc từ root monorepo:
pnpm test:infra

# Build package
pnpm --filter @chronoviet/infra build
```

---

## 📄 5. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.
