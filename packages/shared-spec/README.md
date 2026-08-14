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
   * `logFallbackAlert(payload)` — event `system.fallback_activated` (level warn) cho các fallback hệ thống.
   * Chi tiết: [docs/architecture/06_OBSERVABILITY_AND_LOGGING.md](../../docs/architecture/06_OBSERVABILITY_AND_LOGGING.md).

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
} from '@chronoviet/shared-spec';

// Sử dụng Enum hoặc Helper
const prefix = getCanonicalEntityIdPrefix('HISTORICAL_PERSON'); // 'person_'

// Validate runtime data
const metadata = ChunkMetadataSchema.parse(rawData);
```
