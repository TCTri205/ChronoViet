# `@chronoviet/infra`

> **ChronoViet Infrastructure Runtime Layer & Clients**  
> Gói hạ tầng tập trung cung cấp các runtime clients kết nối cơ sở dữ liệu, hàng đợi BullMQ Redis, bộ suy luận LLM đa tầng, mô hình nhúng Dense Vector (BGE-M3), Reranker cross-encoder, VieNeu TTS Client, Telemetry Prometheus và Distributed Locks.

---

## 📌 1. Tổng Quan Kiến Trúc

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
6. **VieNeu TTS Engine Client (`tts/`):**
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

---

## ⚡ 2. Hướng Dẫn Sử Dụng (Usage)

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
