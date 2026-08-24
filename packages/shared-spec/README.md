# `@chronoviet/shared-spec`

> **ChronoViet Single Source of Truth (SSOT) Data Contracts & Zod Schemas**  
> Gói mã nguồn trung tâm chứa toàn bộ các định nghĩa kiểu dữ liệu TypeScript, Zod Schemas, Enums và Interfaces dùng chung giữa tất cả các packages và services trong monorepo ChronoViet.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/shared-spec` đóng vai trò là **Hợp đồng Dữ liệu Duy nhất (Single Source of Truth - SSOT)** cho toàn bộ hệ thống:

* **Pure Data Contracts**: Không chứa runtime infrastructure client (Postgres pool, Redis connection, BullMQ, file system operations hay external API callers).
* **Strict Type-Safety**: Mọi Data Contract truyền nhận giữa RAG Engine, Multi-Agent Orchestrator, VLM Inspector, VieNeu TTS và Remotion Render Engine đều được định nghĩa tại đây.
* **Runtime Validation**: Sử dụng Zod để validate dữ liệu JSON đầu vào và đầu ra tại runtime.
* **Standardized Enums & Entities**: Quản lý 15 Historical Epochs (`HistoricalEpochEnum`), 7 Entity Taxonomy Types (`EntityTypeEnum`), Source Reliability Levels (`SourceReliabilityEnum`), Alias Types (`AliasTypeEnum`), Audit Action Types (`AuditActionTypeEnum`), v.v.

---

## 🏗️ 2. Các Schema & Entity Cốt Lõi (Key Schemas & Entities)

1. **RAG & Knowledge Data Governance Schemas:**
   * `EntityTypeEnum`: `HISTORICAL_PERSON`, `LOCATION`, `EVENT_BATTLE`, `DYNASTY_ERA`, `ORGANIZATION`, `ARTIFACT`, `DOCUMENT_CULTURE`.
   * `getCanonicalEntityIdPrefix`: Ánh xạ prefix id chuẩn (`person_`, `loc_`, `event_`, `dynasty_`, `org_`, `artifact_`, `doc_`).
   * `HistoricalEpochEnum`: 15 Epochs chuẩn hóa từ `EPOCH_01` tới `EPOCH_15`.
   * `ChunkMetadataSchema`: Metadata của các child chunk văn bản (đính kèm `epoch_ids`, `source_reliability`, `translation_variants`, `perspective_tag`, `has_modern_scholarly_override`).
   * `EntityAuditLogSchema`: Cấu trúc nhật ký ghi vết hợp nhất và chỉnh sửa thực thể.

2. **Remotion Render & Video Schemas:**
   * `VideoProjectSchema` / `ChronoVideoProps`: Schema kịch bản video v4.1 (Scene timeline, LayoutMode, TransitionType, FilterStyle, OverlayData, Audio).
   * `TimelineScene`: Schema của từng phân cảnh trong video.
   * `AssetLicenseRegistrySchema`: Schema đăng ký bản quyền tài nguyên hình ảnh/âm thanh (`PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`).

3. **Multi-Agent Orchestrator & Chat Schemas:**
   * `ConversationSchema` / `ConversationMessageSchema`: Schema quản lý phiên hội thoại NotebookLM và tin nhắn.
   * `ChatSupervisorBriefSchema`: Schema video brief trích xuất từ hội thoại lịch sử.
   * `VisualCandidateSchema`: Schema ứng viên hình ảnh lịch sử.

4. **TTS & Audio Schemas:**
   * `VieNeuTTSRequestSchema` & `VieNeuTTSResponseSchema`: Data contract giao tiếp với VieNeu TTS Engine.
   * `WordTimestamp`: Mốc thời gian bắt đầu/kết thúc (ms) của từng từ cho hiệu ứng Caption Karaoke.

5. **Environment Configuration Schema:**
   * `EnvSchema` & `EnvConfig`: Định nghĩa và parse toàn bộ biến môi trường của hệ thống.

---

## ⚡ 3. Hướng Dẫn Sử Dụng (Usage)

Import trực tiếp trong bất kỳ package nào trong monorepo:

```typescript
import {
  EntityTypeEnum,
  HistoricalEpochEnum,
  ChunkMetadataSchema,
  TimelineScene,
  getCanonicalEntityIdPrefix,
  EnvSchema,
} from '@chronoviet/shared-spec';

// Sử dụng Enum hoặc Helper
const prefix = getCanonicalEntityIdPrefix('HISTORICAL_PERSON'); // 'person_'

// Validate runtime data
const metadata = ChunkMetadataSchema.parse(rawData);
```

