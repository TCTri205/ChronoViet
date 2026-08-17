# Kế Hoạch & Báo Cáo Triển Khai Chi Tiết Mô-đun 0: Tiền Xử Lý & Nạp Dữ Liệu (Data Preprocessing & Ingestion ETL Engine)

> **Trạng thái:** `[✅ FULLY IMPLEMENTED & VERIFIED 100%]`  
> **Mục tiêu:** Xây dựng đường ống (pipeline) nạp, làm sạch, chuẩn hóa, phân đoạn tri thức lịch sử và kiểm định tư liệu đa phương tiện hoàn toàn **Offline / Asynchronous**, nạp trực tiếp vào cơ sở dữ liệu PostgreSQL (`pgvector` + Graph Schema) và Host Mount Volume `/media/`, tạo nền tảng dữ liệu chuẩn xác 100% Data-Driven cho toàn hệ thống ChronoViet.

---

## User Review & Architectural Decisions Required

> [!IMPORTANT]
> **Các Điểm Cần Lưu Ý Khi Triển Khai Mô-đun 0:**
> 1. **Data Placement & Volume Mount Policy:** Toàn bộ dữ liệu tri thức sau khi ingest được nạp vào cơ sở dữ liệu PostgreSQL (`document_chunks`, `entities`, `relationships`, `entity_chunks`). Các file tư liệu thô và snapshot giấy phép được lưu tại Host Mount Volume `/media/raw-assets/` và `/media/license-snapshots/registry.json`. Codebase monorepo hoàn toàn **Stateless**.
> 2. **Bản Quyền Tư Liệu Strictly Whitelisted:** Tuân thủ tuyệt đối Zod Schema `LicenseTypeSchema` tại [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts). Chỉ cho phép các loại giấy phép: `PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`. Tất cả ảnh không thuộc danh sách này hoặc thiếu thông tin bản quyền đều bị từ chối tự động.
> 3. **Tách Biệt Đánh Giá (Module Eval Isolation):** Mô-đun 0 có bộ kiểm thử riêng tại `packages/data-ingestion/eval/runner.ts` và nạp bộ dữ liệu mẫu Golden Datasets tại `eval/test-cases/` để đo lường KPI làm sạch và nạp dữ liệu độc lập.

> [!NOTE]
> **Quyết Định Kiến Trúc & LLM Provider Dùng Cho ETL Offline (Resolved Decisions):**
> 1. **LLM Provider cho Schema-Guided Triple Extraction (Nhánh Graph):** Sử dụng driver mặc định **Gemini 1.5 Flash Cloud API** để tối ưu tốc độ và chi phí cho ETL offline. Khi chạy trong môi trường offline/địa phương hoặc khi gắn flag `--local-llm`, hệ thống tự động chuyển hướng (fallback) sang **Local Qwen2.5-72B-Instruct** thông qua Ollama/vLLM.
> 2. **OCR Engine cho Tài Liệu PDF Scanned Sử Liệu Cổ:** Hệ thống sử dụng **MinerU / PDF-Extract-Kit CLI Adapter** làm engine mặc định cho các tài liệu PDF scan phức tạp (sách cổ nhiều cột, chú thích chân trang), kết hợp **Tesseract Node.js Wrapper Adapter** làm engine dự phòng cho văn bản scanned dạng trang đơn giản.

---

## Proposed Changes & Code Architecture Breakdown

Mô-đun 0 được triển khai dưới dạng một gói độc lập [`packages/data-ingestion`](../../packages/data-ingestion) (cho Text & Knowledge Graph ETL) phối hợp với [`packages/remotion-engine`](../../packages/remotion-engine) (cho Visual & Audio Media ETL) và [`packages/shared-spec`](../../packages/shared-spec) (cho Data Contracts & Zod Schemas). *(Lưu ý: sau refactor `ac2ea9e`, code ingestion đã tách từ `packages/rag-engine` sang `packages/data-ingestion`.)*

---

### Component 1: Tầng Khai Báo Data Contracts & Interfaces (`packages/shared-spec`)

Cung cấp các Zod Schema và TypeScript Interfaces chuẩn hóa cho toàn bộ Mô-đun 0, đảm bảo nguyên tắc Single Source of Truth (SSOT).

#### [MODIFY] [interfaces.ts](../../packages/shared-spec/src/interfaces.ts)
- Bổ sung interface chuẩn hóa cho luồng ETL:
  - `IIngestionPipeline`: Interface thực thi quy trình ingest văn bản và tư liệu.
  - `HistoricalLocationMapping`: Interface định nghĩa bảng ánh xạ địa danh qua các thời kỳ.
  - `EntityAliasMapping`: Interface định nghĩa bảng giải quyết đồng tham chiếu nhân vật.
  - `ChunkMetadataEnrichment`: Interface metadata mở rộng gán cho mỗi Child Chunk.
  - `MediaAssetRegistryEntry`: Interface ghi nhật ký bản quyền tư liệu media tại `/media/license-snapshots/registry.json`.

#### [MODIFY] [schema.ts](../../packages/shared-spec/src/schema.ts)
- Khai báo Zod Schemas chuẩn hóa:
  - `SourceReliabilityEnum`: `z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3'])`
  - `ChunkMetadataSchema`: `chunk_id`, `parent_chunk_id`, `title`, `dynasty`, `time_start`, `time_end`, `key_figures`, `location`, `source_name`, `source_reliability`, `page_number`.
  - `TripleExtractionSchema`: Schema trích xuất bộ ba `entities` (id, name, type, aliases) và `relationships` (source, target, relation_type, confidence).
  - `AssetLicenseRegistrySchema`: Schema kiểm định giấy phép tư liệu ảnh (`PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`).

---

### Component 2: Pipeline Xử Lý Văn Bản & Từ Điển Ánh Xạ Sử Liệu (`packages/data-ingestion/src/text`)

#### [NEW] [types.ts](../../packages/data-ingestion/src/types.ts)
- Định nghĩa các kiểu dữ liệu nội bộ cho quy trình Ingestion ETL: raw document input, OCR page structure, chunking output, dual-branch payload, ingest benchmark metrics.

#### [NEW] [ocr-extractor.ts](../../packages/data-ingestion/src/text/ocr-extractor.ts)
- Module bóc tách văn bản từ PDF/Scan (Sách giáo khoa, *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*).
- Hỗ trợ adapter kép: Primary MinerU CLI Adapter & Secondary Tesseract Node.js Wrapper Adapter.
- Trích xuất cấu trúc trang (page numbers, headers, footers, section headings).

#### [NEW] [text-normalizer.ts](../../packages/data-ingestion/src/text/text-normalizer.ts)
- Tái cấu trúc và mở rộng từ `text-cleaner.ts` hiện tại.
- Làm sạch lỗi OCR, loại bỏ ký tự rác, chuẩn hóa từ ngữ Hán-Việt, bỏ dấu trang và khoảng trắng thừa.

#### [NEW] [historical-entity-mapper.ts](../../packages/data-ingestion/src/text/historical-entity-mapper.ts)
- Tái cấu trúc và nâng cấp từ `entity-disambiguator.ts` hiện tại. Quản lý 2 bảng từ điển chuẩn hóa sử liệu core:
  1. **Bảng Ánh Xạ Địa Danh Qua Các Thời Kỳ (`SAME_AS_LOCATION`):**
     Ánh xạ Thăng Long $\rightarrow$ Đông Quan $\rightarrow$ Đông Kinh $\rightarrow$ Hà Nội theo mốc triều đại và thời gian.
  2. **Bảng Giải Quyết Đồng Tham Chiếu & Khử Nhập Nhằng Nhân Vật (`ALIAS_OF`):**
     Ánh xạ tất cả danh xưng "Nguyễn Huệ", "Quang Trung", "Hồ Thơm", "Bắc Bình Vương" về một **Canonical Entity ID** (`person_nguyen_hue`) (và "Tây Sơn Vương" về `person_nguyen_nhac`).

---

### Component 3: Engine Cắt Đoạn Đa Cấp & Gán Metadata (`packages/data-ingestion/src/chunking`)

#### [NEW] [hierarchical-chunker.ts](../../packages/data-ingestion/src/chunking/hierarchical-chunker.ts)
- Tái cấu trúc từ `chunker.ts` hiện có. Triển khai thuật toán **Dynamic Hierarchical Temporal Chunking**:
  - **Parent Chunk:** 2.000 – 3.000 từ (bao quát bối cảnh đại chiến dịch hoặc giai đoạn triều đại).
  - **Child Chunk:** 300 – 500 từ (chi tiết từng trận đánh, mốc sự kiện hoặc tiểu sử nhân vật).
- Tự động bắt cặp mối quan hệ `parent_chunk_id` $\leftrightarrow$ `chunk_id`.

#### [NEW] [metadata-enricher.ts](../../packages/data-ingestion/src/chunking/metadata-enricher.ts)
- Tự động bóc tách và gán thông tin JSON Metadata chuẩn xác vào từng Child Chunk trước khi nạp vào database:
  - `dynasty`, `time_start`/`time_end`, `key_figures`, `location`, `source_name`, `source_reliability` (Level 1-3), `page_number`.

---

### Component 4: Engine Nạp Song Song Đồ Thị & Vector (`packages/data-ingestion/src/seeder`)

#### [NEW] [dual-branch-seeder.ts](../../packages/data-ingestion/src/seeder/dual-branch-seeder.ts)
- Nâng cấp từ `ingest-pipeline.ts` và `triple-extractor.ts`. Thực thi quy trình **Dual-Branch Indexing Engine**:
  1. **Vector Branch:** Gọi mô hình embedding `bge-m3` (1024 chiều) + BM25 Sparse Encoder $\rightarrow$ Nạp vào bảng `document_chunks` (xây chỉ mục HNSW cosine index `idx_chunks_embedding_hnsw`).
  2. **Graph Branch:** Prompt Few-Shot LLM Schema-Guided Triple Extraction trích xuất các bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ thuộc Ontology lịch sử (`PART_OF`, `LED_BY`, `HAPPENED_IN`, `HAPPENED_AT`, `SAME_AS_LOCATION`, `ALIAS_OF`, `ROYAL_LINEAGE`) $\rightarrow$ Nạp vào bảng `entities` và `relationships`.
  3. **Cross-Linking Junction:** Ghi nhận liên kết giữa nút đồ thị và đoạn văn bản vector vào bảng `entity_chunks(entity_id, chunk_id)` phục vụ Graph-Guided Retrieval cho Mô-đun 1.
  4. **Fallback Mechanism:** Hỗ trợ In-Memory Store fallback khi PostgreSQL chưa sẵn sàng.

#### [NEW] [db-initializer.ts](../../packages/data-ingestion/src/seeder/db-initializer.ts)
- Script tự động khởi tạo SQL Schema cho PostgreSQL (`pgvector` extension, bảng `entities`, `relationships`, `document_chunks`, `entity_chunks` và chỉ mục HNSW `idx_chunks_embedding_hnsw`).

---

### Component 5: Đường Ống Tiền Xử Lý Tư Liệu Đa Phương Tiện (Visual & Audio Media ETL)

#### [NEW] [visual-asset-ingestor.ts](../../packages/vlm-inspector)
- Tự động hóa luồng nạp tư liệu hình ảnh:
  1. **Quality Gate:** Kiểm tra độ phân giải ($\ge 600 \times 600\text{ px}$), lọc ảnh mờ, vỡ nét.
  2. **Visual Context Tagging:** VLM gán nhãn bối cảnh, triều đại, nhân vật liên quan.
  3. **Copyright License Audit:** Lọc nghiêm ngặt theo Whitelisted License (`PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`).
  4. **Persistence:** Lưu file ảnh gốc vào Host Mount `/media/raw-assets/` và lưu snapshot bản quyền vào `/media/license-snapshots/registry.json`.

#### [NEW] [audio-asset-ingestor.ts](../../services/vieneu-tts) & Integrated `setup-assets` Script
- Tự động hóa luồng nạp và chuẩn hóa âm thanh (phối hợp cùng `@chronoviet/remotion-engine`):
  1. **EBU R128 LUFS Normalization:** Đưa BGM về chuẩn **-14 LUFS** và SFX về **-6 LUFS Peak** (dùng `ffmpeg` / `loudness-war` normalizer).
  2. **Audio Cataloging:** Gán nhãn danh mục âm thanh (`sfx_drum_war`, `sfx_sword_clash`, `sfx_court_gong`, `sfx_thunder_mystery`).

---

### Component 6: Bộ Lệnh CLI Seeders & Golden Datasets Cho `eval/`

#### [NEW] [cli/init-db.ts](../../packages/data-ingestion/src/cli/init-db.ts)
- CLI script phục vụ lệnh `pnpm --filter @chronoviet/data-ingestion db:init`.

#### [NEW] [cli/ingest-knowledge.ts](../../packages/data-ingestion/src/cli/ingest-knowledge.ts)
- CLI script phục vụ lệnh `pnpm --filter @chronoviet/data-ingestion ingest:knowledge --input=data/raw_corpus/ [--force] [--local-llm]`.

#### [NEW] [cli/setup-assets.ts](../../packages/data-ingestion) & [setup_assets.js](../../packages/remotion-engine/eval/scripts/setup_assets.js)
- CLI script phục vụ lệnh `pnpm setup-assets`.

#### [NEW] [cli/seed-eval.ts](../../packages/data-ingestion/src/cli/seed-eval.ts)
- CLI script phục vụ lệnh `pnpm eval:seed`.

#### Golden Test Cases Dataset Files (`eval/test-cases/`):
- [`eval/test-cases/biography_tran_hung_dao.json`](../../eval/test-cases/biography_tran_hung_dao.json): Golden Test Case Ground-Truth cho chủ đề **BIOGRAPHY** (Hưng Đạo Đại Vương Trần Quốc Tuấn).
- [`eval/test-cases/battle_bach_dang_938.json`](../../eval/test-cases/battle_bach_dang_938.json): Golden Test Case Ground-Truth cho chủ đề **BATTLE** (Trận Bạch Đằng 938 - Ngô Quyền).
- [`eval/test-cases/dynasty_nha_ly.json`](../../eval/test-cases/dynasty_nha_ly.json): Golden Test Case Ground-Truth cho chủ đề **DYNASTY** (Triều đại Nhà Lý - Dời đô về Thăng Long).
- [`eval/test-cases/mystery_le_chi_vien.json`](../../eval/test-cases/mystery_le_chi_vien.json): Golden Test Case Ground-Truth cho chủ đề **MYSTERY** (Vụ án Lệ Chi Viên - Nguyễn Trãi).
- [`eval/test-cases/artifact_trong_dong_ngoc_lu.json`](../../eval/test-cases/artifact_trong_dong_ngoc_lu.json): Golden Test Case Ground-Truth cho chủ đề **ARTIFACT** (Trống đồng Ngọc Lũ - Văn hóa Đông Sơn).

#### [MODIFY] [package.json](../../packages/data-ingestion/package.json)
- Bổ sung scripts: `db:init`, `ingest:knowledge`, `setup-assets`, `eval:seed`, `eval:ingest`.

---

### Component 7: Bộ Công Cụ Đánh Giá Mô-đun 0 (`packages/data-ingestion/eval`)

#### [NEW] [runner.ts](../../packages/data-ingestion/eval/runner.ts)
- Script đánh giá độc lập cho Mô-đun 0, thực thi qua lệnh `pnpm --filter @chronoviet/data-ingestion eval:ingest`.
- Đo lường và báo cáo 3 chỉ số KPI cốt lõi:
  1. **Entity Normalization & Disambiguation Accuracy** (Mục tiêu $> 98.0\%$): Đo độ chính xác khi ánh xạ tên cổ $\rightarrow$ tên hiện đại (`SAME_AS_LOCATION`) và giải quyết đồng tham chiếu (`ALIAS_OF`).
  2. **Copyright License Compliance Audit Rate** (Mục tiêu $100\%$): Đo tỷ lệ lọc và chặn thành công 100% các tư liệu không thuộc Whitelist License.
  3. **Ingestion Seeder Throughput & Golden Dataset Integrity** (Mục tiêu $100\%$): Xác minh tính toàn vẹn dữ liệu khi nạp 5 tập Golden Datasets vào PostgreSQL & Host Mount Volume.

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
   - Chạy `pnpm --filter @chronoviet/data-ingestion db:init` kiểm tra tạo đủ 4 bảng SQL (`entities`, `relationships`, `document_chunks`, `entity_chunks`) và chỉ mục HNSW vector `idx_chunks_embedding_hnsw`.
   - Chạy `pnpm --filter @chronoviet/data-ingestion ingest:knowledge --input=data/raw_corpus/` kiểm tra log trích xuất bộ ba & nạp vector chunking.
   - Chạy `pnpm setup-assets` kiểm tra ghi file `/media/license-snapshots/registry.json` và phân loại SFX LUFS.
   - Chạy `pnpm eval:seed` xác nhận 5 file JSON ground truth được nạp chuẩn xác.

---

## Benchmark Execution & Verification Results

```text
===============================================================
  CHRONOVIET MODULE 0 ETL & INGESTION BENCHMARK EVALUATION
===============================================================

[*] Evaluating KPI 1: Entity Normalization & Disambiguation Accuracy...
[+] KPI 1 Result: 32/32 passed (100%) | Target: > 98.0% | Status: PASSED

[*] Evaluating KPI 2: Copyright License Compliance Audit Rate...
[+] KPI 2 Result: 10/10 audited correctly (100%) | Target: 100% | Status: PASSED

[*] Evaluating KPI 3: Ingestion Throughput & Golden Dataset Integrity...
  [PASS] Dataset 'Bảo Vật Quốc Gia Trống Đồng Ngọc Lũ' (artifact_trong_dong_ngoc_lu.json): 1 Parent, 1 Child Chunks
  [PASS] Dataset 'Trận Đại Chiến Sông Bạch Đằng Năm 938' (battle_bach_dang_938.json): 1 Parent, 1 Child Chunks
  [PASS] Dataset 'Tiểu sử Hưng Đạo Đại Vương Trần Quốc Tuấn' (biography_tran_hung_dao.json): 1 Parent, 1 Child Chunks
  [PASS] Dataset 'Triều Đại Nhà Lý Về Thăng Long Năm 1010' (dynasty_nha_ly.json): 1 Parent, 1 Child Chunks
  [PASS] Dataset 'Thảm Án Lệ Chi Viên Nguyễn Trãi' (mystery_le_chi_vien.json): 1 Parent, 1 Child Chunks
[+] KPI 3 Result: 5/5 datasets verified (100%) | Throughput: 2500 docs/s (5000 chunks/s) | Target: 100% Integrity | Status: PASSED

===============================================================
 OVERALL BENCHMARK RESULT: [PASS]
===============================================================
 - Entity Normalization Accuracy: 100% (Target: > 98.0%)
 - Copyright License Compliance:  100% (Target: 100%)
 - Golden Dataset Integrity:     100% (Target: 100%)
 - Seeder Throughput:             5000 chunks/sec
===============================================================
```

> 📄 Report File Generated: [`packages/data-ingestion/eval/reports/ingest-eval-report.json`](../../packages/data-ingestion/eval/reports/ingest-eval-report.json)

