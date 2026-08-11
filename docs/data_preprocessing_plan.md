# Kế Hoạch Triển Khai Chi Tiết Mô-đun 0: Tiền Xử Lý & Nạp Dữ Liệu (Data Preprocessing & Ingestion ETL Engine)

> **Mục tiêu:** Xây dựng đường ống (pipeline) nạp, làm sạch, chuẩn hóa, phân đoạn tri thức lịch sử và kiểm định tư liệu đa phương tiện hoàn toàn **Offline / Asynchronous**, nạp trực tiếp vào cơ sở dữ liệu PostgreSQL (`pgvector` + Graph Schema) và Host Mount Volume `/media/`, tạo nền tảng dữ liệu chuẩn xác 100% Data-Driven cho toàn hệ thống ChronoViet.

---

## User Review Required

> [!IMPORTANT]
> **Các Điểm Cần Lưu Ý Khi Triển Khai Mô-đun 0:**
> 1. **Data Placement & Volume Mount Policy:** Toàn bộ dữ liệu tri thức sau khi ingest được nạp vào cơ sở dữ liệu PostgreSQL (`document_chunks`, `entities`, `relationships`, `entity_chunks`). Các file tư liệu thô và snapshot giấy phép được lưu tại Host Mount Volume `/media/raw-assets/` và `/media/license-snapshots/registry.json`. Codebase monorepo hoàn toàn **Stateless**.
> 2. **Bản Quyền Tư Liệu Strictly Whitelisted:** Chỉ cho phép 4 loại giấy phép: `PUBLIC_DOMAIN`, `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`. Tất cả ảnh không thuộc danh sách này hoặc thiếu thông tin bản quyền đều bị từ chối tự động.
> 3. **Tách Biệt Đánh Giá (Module Eval Isolation):** Mô-đun 0 có bộ kiểm thử riêng tại `packages/rag-engine/eval/ingest-runner.ts` và tạo bộ dữ liệu mẫu Golden Datasets tại `eval/test-cases/` để đo lường KPI làm sạch và nạp dữ liệu.

---

## Open Questions

> [!NOTE]
> **Các Câu Hỏi Làm Rõ Về Cấu Hình & LLM Provider Dùng Cho ETL Offline:**
> 1. **LLM Provider cho Schema-Guided Triple Extraction (Nhánh Graph):** Khi chạy CLI `ingest:knowledge`, hệ thống ưu tiên gọi Gemini 1.5 Flash Cloud API hay Local Qwen2.5-72B-Instruct qua Ollama/vLLM? (Mặc định sẽ cung cấp driver cho cả Gemini API với fallback sang Local LLM).
> 2. **OCR Engine cho Tài Liệu PDF Scanned Sử Liệu Cổ:** Hệ thống sử dụng Tesseract OCR chuẩn hay MinerU/PDF-Extract-Kit làm engine mặc định? (Mặc định sẽ xây dựng adapter hỗ trợ cả Tesseract Node.js wrapper và MinerU CLI).

---

## Proposed Changes

Mô-đun 0 được triển khai dưới dạng một sub-system nằm trong gói [`packages/rag-engine`](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine) (cho Text & Knowledge Graph ETL) phối hợp với [`packages/remotion-engine`](file:///d:/Persional_Projects/ChronoViet/packages/remotion-engine) (cho Visual & Audio Media ETL) và [`packages/shared-spec`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec) (cho Data Contracts & Zod Schemas).

---

### Component 1: Tầng Khai Báo Data Contracts & Interfaces (`packages/shared-spec`)

Cung cấp các Zod Schema và TypeScript Interfaces chuẩn hóa cho toàn bộ mô-đun 0.

#### [MODIFY] [interfaces.ts](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec/src/interfaces.ts)
- Bổ sung interface `IIngestionPipeline`, `HistoricalLocationMapping`, `EntityAliasMapping`, `ChunkMetadataEnrichment`, `MediaAssetRegistryEntry`.

#### [MODIFY] [schema.ts](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec/src/schema.ts)
- Định nghĩa Zod Schemas cho:
  - `SourceReliabilityEnum`: `'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'`
  - `ChunkMetadataSchema`: `chunk_id`, `parent_chunk_id`, `title`, `dynasty`, `time_start`, `time_end`, `key_figures`, `location`, `source_name`, `source_reliability`, `page_number`.
  - `TripleExtractionSchema`: Schema trích xuất bộ ba `entities` và `relationships`.
  - `AssetLicenseRegistrySchema`: Metadata đăng ký giấy phép tư liệu ảnh tại `/media/license-snapshots/registry.json`.

---

### Component 2: Pipeline Xử Lý Văn Bản & Từ Điển Ánh Xạ Sử Liệu (`packages/rag-engine/src/ingestion/text`)

#### [NEW] [types.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/types.ts)
- Định nghĩa các kiểu dữ liệu nội bộ cho quy trình Ingestion ETL: raw document input, OCR page structure, chunking output, dual-branch payload, ingest benchmark metrics.

#### [NEW] [ocr-extractor.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/text/ocr-extractor.ts)
- Module bóc tách văn bản từ PDF/Scan (Sách giáo khoa, *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*).
- Hỗ trợ trích xuất cấu trúc trang (page numbers, headers, footers, section headings).

#### [NEW] [text-normalizer.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/text/text-normalizer.ts)
- Module làm sạch lỗi OCR, loại bỏ ký tự rác, chuẩn hóa từ ngữ Hán-Việt, bỏ dấu trang và khoảng trắng thừa.

#### [NEW] [historical-entity-mapper.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/text/historical-entity-mapper.ts)
- Quản lý 2 bảng từ điển chuẩn hóa sử liệu core:
  1. **Bảng Ánh Xạ Địa Danh Qua Các Thời Kỳ (`SAME_AS_LOCATION`):**
     Ánh xạ Thăng Long $\rightarrow$ Đông Quan $\rightarrow$ Đông Kinh $\rightarrow$ Hà Nội theo mốc triều đại và thời gian.
  2. **Bảng Giải Quyết Đồng Tham Chiếu & Khử Nhập Nhằng Nhân Vật (`ALIAS_OF`):**
     Ánh xạ tất cả danh xưng "Nguyễn Huệ", "Quang Trung", "Hồ Thơm", "Tây Sơn Vương" về một **Canonical Entity ID** (`person_nguyen_hue`).

---

### Component 3: Engine Cắt Đoạn Đa Cấp & Gán Metadata (`packages/rag-engine/src/ingestion/chunking`)

#### [NEW] [hierarchical-chunker.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/chunking/hierarchical-chunker.ts)
- Triển khai thuật toán **Dynamic Hierarchical Temporal Chunking**:
  - **Parent Chunk:** 2.000 – 3.000 từ (bao quát bối cảnh đại chiến dịch hoặc giai đoạn triều đại).
  - **Child Chunk:** 300 – 500 từ (chi tiết từng trận đánh, mốc sự kiện hoặc tiểu sử nhân vật).
- Tự động bắt cặp mối quan hệ `parent_chunk_id` $\leftrightarrow$ `chunk_id`.

#### [NEW] [metadata-enricher.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/chunking/metadata-enricher.ts)
- Tự động bóc tách và gán thông tin JSON Metadata chuẩn xác vào từng Child Chunk trước khi nạp vào database:
  - `dynasty`, `time_start`/`time_end`, `key_figures`, `location`, `source_name`, `source_reliability` (Level 1-3), `page_number`.

---

### Component 4: Engine Nạp Song Song Đồ Thị & Vector (`packages/rag-engine/src/ingestion/seeder`)

#### [NEW] [dual-branch-seeder.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/seeder/dual-branch-seeder.ts)
- Thực thi quy trình **Dual-Branch Indexing Engine**:
  1. **Vector Branch:** Gọi mô hình embedding `bge-m3` (1024 chiều) + BM25 Sparse Encoder $\rightarrow$ Nạp vào bảng `document_chunks` (xây chỉ mục HNSW cosine index `idx_chunks_embedding_hnsw`).
  2. **Graph Branch:** Prompt Few-Shot LLM Schema-Guided Triple Extraction trích xuất các bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ thuộc Ontology lịch sử (`PART_OF`, `LED_BY`, `HAPPENED_IN`, `HAPPENED_AT`, `SAME_AS_LOCATION`, `ALIAS_OF`, `ROYAL_LINEAGE`) $\rightarrow$ Nạp vào bảng `entities` và `relationships`.
  3. **Cross-Linking Junction:** Ghi nhận liên kết giữa nút đồ thị và đoạn văn bản vector vào bảng `entity_chunks(entity_id, chunk_id)` phục vụ Graph-Guided Retrieval cho Mô-đun 1.

#### [NEW] [db-initializer.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/seeder/db-initializer.ts)
- Script tự động khởi tạo SQL Schema cho PostgreSQL (`pgvector` extension, bảng `entities`, `relationships`, `document_chunks`, `entity_chunks` và các chỉ mục HNSW).

---

### Component 5: Đường Ống Tiền Xử Lý Tư Liệu Đa Phương Tiện (Visual & Audio Media ETL)

#### [NEW] [visual-asset-ingestor.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/media/visual-asset-ingestor.ts)
- Tự động hóa luồng nạp tư liệu hình ảnh:
  1. **Quality Gate:** Kiểm tra độ phân giải ($\ge 600 \times 600\text{ px}$), lọc ảnh mờ, vỡ nét.
  2. **Visual Context Tagging:** VLM gán nhãn bối cảnh, triều đại, nhân vật liên quan.
  3. **Copyright License Audit:** Lọc nghiêm ngặt theo Whitelisted License (`PUBLIC_DOMAIN`, `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`).
  4. **Persistence:** Lưu file ảnh gốc vào Host Mount `/media/raw-assets/` và lưu snapshot bản quyền vào `/media/license-snapshots/registry.json`.

#### [NEW] [audio-asset-ingestor.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/media/audio-asset-ingestor.ts)
- Tự động hóa luồng nạp và chuẩn hóa âm thanh:
  1. **EBU R128 LUFS Normalization:** Đưa BGM về chuẩn **-14 LUFS** và SFX về **-6 LUFS Peak** (dùng `ffmpeg` / `loudness-war` normalizer).
  2. **Audio Cataloging:** Gán nhãn danh mục âm thanh (`sfx_drum_war`, `sfx_sword_clash`, `sfx_court_gong`, `sfx_thunder_mystery`).

---

### Component 6: Bộ Lệnh CLI Seeders & Golden Datasets Cho `eval/`

#### [NEW] [cli/init-db.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/cli/init-db.ts)
- CLI script phục vụ lệnh `pnpm db:init`.

#### [NEW] [cli/ingest-knowledge.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/cli/ingest-knowledge.ts)
- CLI script phục vụ lệnh `pnpm ingest:knowledge --input=data/raw_corpus/`.

#### [NEW] [cli/setup-assets.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/cli/setup-assets.ts)
- CLI script phục vụ lệnh `pnpm setup-assets`.

#### [NEW] [cli/seed-eval.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/cli/seed-eval.ts)
- CLI script phục vụ lệnh `pnpm eval:seed`.

#### [NEW] [eval/test-cases/biography_tran_hung_dao.json](file:///d:/Persional_Projects/ChronoViet/eval/test-cases/biography_tran_hung_dao.json)
- Golden Test Case Ground-Truth cho chủ đề **BIOGRAPHY** (Hưng Đạo Đại Vương Trần Quốc Tuấn).

#### [NEW] [eval/test-cases/battle_bach_dang_938.json](file:///d:/Persional_Projects/ChronoViet/eval/test-cases/battle_bach_dang_938.json)
- Golden Test Case Ground-Truth cho chủ đề **BATTLE** (Trận Bạch Đằng 938 - Ngô Quyền).

#### [NEW] [eval/test-cases/dynasty_nha_ly.json](file:///d:/Persional_Projects/ChronoViet/eval/test-cases/dynasty_nha_ly.json)
- Golden Test Case Ground-Truth cho chủ đề **DYNASTY** (Triều đại Nhà Lý - Dời đô về Thăng Long).

#### [NEW] [eval/test-cases/mystery_le_chi_vien.json](file:///d:/Persional_Projects/ChronoViet/eval/test-cases/mystery_le_chi_vien.json)
- Golden Test Case Ground-Truth cho chủ đề **MYSTERY** (Vụ án Lệ Chi Viên - Nguyễn Trãi).

#### [NEW] [eval/test-cases/artifact_trong_dong_ngoc_lu.json](file:///d:/Persional_Projects/ChronoViet/eval/test-cases/artifact_trong_dong_ngoc_lu.json)
- Golden Test Case Ground-Truth cho chủ đề **ARTIFACT** (Trống đồng Ngọc Lũ - Văn hóa Đông Sơn).

#### [MODIFY] [package.json](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/package.json)
- Bổ sung scripts: `db:init`, `ingest:knowledge`, `setup-assets`, `eval:seed`, `eval:ingest`.

---

### Component 7: Bộ Công Cụ Đánh Giá Mô-đun 0 (`packages/rag-engine/eval`)

#### [NEW] [ingest-runner.ts](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/eval/ingest-runner.ts)
- Script đánh giá độc lập cho Mô-đun 0, thực thi qua lệnh `pnpm --filter @chronoviet/rag-engine eval`.
- Đo lường và báo cáo các chỉ số KPI:
  - **Entity Normalization & Disambiguation Accuracy** (Mục tiêu $> 98.0\%$).
  - **Copyright License Compliance Audit Rate** (Mục tiêu $100\%$).
  - **Ingestion Seeder Throughput & Golden Dataset Integrity** (Mục tiêu $100\%$).

---

## Verification Plan

### Automated Tests (Multi-Tier Protocol)

1. **Tier 1 - Monorepo TypeScript Verification:**
   ```bash
   pnpm typecheck
   ```
   *Yêu cầu: 0 lỗi TypeScript toàn monorepo.*

2. **Tier 2 - Shared Spec Zod Validation:**
   ```bash
   pnpm --filter @chronoviet/shared-spec typecheck
   ```
   *Yêu cầu: Khai báo đầy đủ Zod Schemas và Interfaces cho Mô-đun 0.*

3. **Tier 3 - Code Quality & Linting:**
   ```bash
   pnpm lint
   ```
   *Yêu cầu: Tuân thủ chuẩn định dạng mã nguồn monorepo.*

4. **Tier 4 - Module 0 Evaluation Suite & Benchmark Runner:**
   ```bash
   pnpm --filter @chronoviet/rag-engine eval -- --fresh
   ```
   *Yêu cầu:*
   - Đo lường thành công 3 chỉ số KPI của Mô-đun 0.
   - Seed thành công 5 tập dữ liệu mẫu Golden Datasets vào `eval/test-cases/`.

### Manual Verification Steps

1. **Thực thi bộ lệnh CLI Ingestion:**
   - Chạy `pnpm db:init` kiểm tra tạo đủ 4 bảng SQL (`entities`, `relationships`, `document_chunks`, `entity_chunks`) và chỉ mục HNSW vector.
   - Chạy `pnpm ingest:knowledge --input=data/raw_corpus/` kiểm tra log trích xuất bộ ba & nạp vector chunking.
   - Chạy `pnpm setup-assets` kiểm tra ghi file `/media/license-snapshots/registry.json` và phân loại SFX LUFS.
   - Chạy `pnpm eval:seed` xác nhận 5 file JSON ground truth được nạp chuẩn xác.
