# `@chronoviet/shared-spec`

> **ChronoViet Single Source of Truth (SSOT) Data Contracts & Zod Schemas**  
> Gói mã nguồn chứa toàn bộ các định nghĩa kiểu TypeScript, Zod Data Schemas, Enums và Interfaces dùng chung giữa tất cả các packages và services trong monorepo ChronoViet.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/shared-spec` đóng vai trò là **Hợp đồng Dữ liệu Duy nhất (Single Source of Truth - SSOT)** cho toàn bộ hệ thống:

* **Strict Type-Safety**: Mọi Data Schema truyền nhận giữa RAG Engine, Multi-Agent Orchestrator, VLM Inspector, VieNeu TTS và Remotion Render Engine bắt buộc phải import từ gói này.
* **Runtime Validation**: Sử dụng Zod để validation dữ liệu JSON đầu vào và đầu ra tại runtime.
* **Standardized Enums**: Quản lý 15 Historical Epochs (`HistoricalEpochEnum`), 7 Entity Taxonomy Types (`EntityTypeEnum`), Source Reliability Levels (`SourceReliabilityEnum`), Alias Types (`AliasTypeEnum`), Audit Action Types (`AuditActionTypeEnum`), v.v.

---

## 🏗️ 2. Các Schema Cốt Lõi (Key Schemas)

1. **RAG & Knowledge Data Governance Schemas:**
   * `EntityTypeEnum`: `HISTORICAL_PERSON`, `LOCATION`, `EVENT_BATTLE`, `DYNASTY_ERA`, `ORGANIZATION`, `ARTIFACT`, `DOCUMENT_CULTURE`.
   * `getCanonicalEntityIdPrefix`: Ánh xạ prefix id chuẩn (`person_`, `loc_`, `event_`, `dynasty_`, `org_`, `artifact_`, `doc_`).
   * `HistoricalEpochEnum`: 15 Epochs chuẩn hóa từ `EPOCH_01` tới `EPOCH_15`.
   * `ChunkMetadataSchema`: Metadata của các child chunk văn bản (đính kèm `epoch_ids`, `source_reliability`, `translation_variants`, `perspective_tag`, `has_modern_scholarly_override`).
   * `EntityAuditLogSchema`: Cấu trúc nhật ký ghi vết hợp nhất và chỉnh sửa thực thể.

2. **Remotion Render & Script Schemas:**
   * `ChronoVideoScriptSchema`: Schema kịch bản video v4.1 (Scene timeline, LayoutMode, TransitionType, FilterStyle, OverlayData, Audio).
   * `TimelineSceneSchema`: Schema của từng phân cảnh trong video.
   * `AssetLicenseRegistrySchema`: Schema đăng ký bản quyền tài nguyên hình ảnh/âm thanh.

3. **Unified Structured Logger (`logger.ts`):**
   * `createLogger({ service, correlationId?, baseFields? })` — JSON Lines ở production, pretty ở dev, level filter qua `LOG_LEVEL`, redaction secrets tự động.
   * `log.child({ fields })` — logger có context bổ sung (projectId, runId, entityId...).
   * `serializeError(err)` / `sanitizePayload(value)` — serialize Error đầy đủ `name/message/stack/cause`, chặn secret key trước khi vào log stream.
4. **Hierarchical 2-Level Key Rotator & Hybrid Dispatcher (`api-key-rotator.ts`, `llm-client.ts`):**
   * `HybridInferenceDispatcher`: Quản lý luân chuyển phân cấp 2 tầng (Level 1: Provider Round-Robin $\to$ Level 2: API Key per Provider) giữa Local LLM (llama-server) và các Cloud Providers (Agnes, Gemini, OpenAI, OpenRouter).
   * `ApiKeyRotator`: Quản lý pool API keys độc lập cho từng Cloud Provider, tự động cách ly 24h khi gặp mã lỗi 429/Quota, cách ly 30s khi gặp 503/timeout, và hỗ trợ Fast Failover Retry tức thì.
   * `generateLLMCompletion`: Client suy luận tích hợp adaptive timeout (Local: 45s, Cloud default: 35s), ghi nhận telemetry và observability metadata (`targetId`, `targetProvider`).
5. **Resource Sentinel & Distributed Render Mutex (`resource-sentinel.ts`):**
   * `ResourceSentinel.getMemoryStatus()`: Giám sát tài nguyên RAM với cơ chế debounce 3s, cảnh báo áp suất RAM cao (`MEMORY_PRESSURE_THRESHOLD_PCT`).
   * `ResourceSentinel.acquireRenderLock()` & `releaseRenderLock()`: Khóa phân tán Redis Distributed Lock kết hợp In-Memory Fallback điều phối tài nguyên render video.
   * `ResourceSentinel.shouldOffloadToCloud()`: Tự động phát hiện xung đột tài nguyên để định tuyến request LLM sang Cloud API an toàn không phạt Circuit Breaker.
6. **Unified Circuit Breaker Subsystem (`circuit-breaker.ts`):**
   * Quản lý trạng thái chịu lỗi (Fault Tolerance) 3 phân hệ: `localLlmCircuit`, `cloudFallbackCircuit`, `embeddingCircuit`.
   * Tự động chuyển đổi `CLOSED` $\to$ `OPEN` khi đạt ngưỡng lỗi (threshold = 2), tự động sang `HALF_OPEN` (PROBE) sau cooldown 30s, đồng bộ trạng thái tới Prometheus gauges `{ subsystem }`.
7. **Dense Vector Embedding Service & Smooth Partial Cache Eviction (`embeddings.ts`):**
   * Chuẩn hóa không gian vector dense 1024 chiều BGE-M3 phục vụ GraphRAG và Semantic Search.
   * Tích hợp `embeddingCache` với thuật toán `evictOldestCacheEntries()` tự động giải phóng 20% bản ghi cũ nhất (FIFO/LRU) khi đầy dung lượng (`MAX_CACHE_SIZE = 5000`), giữ lại 80% warm cache chống Cache Stampede.
8. **Prometheus RED & USE Centralized Metrics (`telemetry/metrics.ts`):**
   * Cung cấp registry duy nhất `metricsRegistry` và bộ metrics RED/USE cho HTTP, LLM, TTS, Embedding, RAG Search, VLM Inspector, Remotion Render và BullMQ queues với guard chặn cardinality bomb.

---

## ⚡ 3. Hướng Dẫn Sử Dụng (Usage)

Import trực tiếp trong bất kỳ package nào trong monorepo:

```typescript
import {
  EntityTypeEnum,
  HistoricalEpochEnum,
  ChunkMetadataSchema,
  ChronoVideoScript,
  getCanonicalEntityIdPrefix,
  generateLLMCompletion,
  hybridInferenceDispatcher,
} from '@chronoviet/shared-spec';

// Sử dụng Enum hoặc Helper
const prefix = getCanonicalEntityIdPrefix('HISTORICAL_PERSON'); // 'person_'

// Validate runtime data
const metadata = ChunkMetadataSchema.parse(rawData);

// Gọi suy luận với Hierarchical 2-Level Rotation
const response = await generateLLMCompletion([
  { role: 'user', content: 'Tóm tắt trận Ngọc Hồi 1789' }
]);
console.log(`Executed via ${response.targetId} (Provider: ${response.targetProvider})`);
```
