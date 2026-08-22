# CHI TIẾT MÔ-ĐUN 0: DATA PREPROCESSING & INGESTION ENGINE
## (Lớp Tiền Xử Lý, Chuẩn Hóa & Nạp Dữ Liệu Offline)

> **Trạng thái:** `[✅ FULLY IMPLEMENTED & VERIFIED 100% — 2-STAGE KNOWLEDGE EXTRACTION & DATA GOVERNANCE SPEC v2.0]`
> **Kiến trúc:** 2-Stage Knowledge Extraction (Stage 1: Pure TS Historical NER Engine, F1: 97.04%, Latency: 0.37ms + Stage 2: Port 8094 Qwen3.5-4B-Instruct LLM Extractor & Constrained JSON Schema), 8 Canonical Relations, Directionality Validation Matrix ($S \to R \to O$), và Database Quarantine Inspector CLI (`pnpm db:audit-quarantine`).

---

## 1. Mục Đích & Ranh Giới Kiến Trúc (Architecture Boundary)

Mô-đun **Data Preprocessing & Ingestion Engine** (Mô-đun 0) đóng vai trò là **"Lớp Nạp Dữ Liệu Đầu Nguồn"** của nền tảng ChronoViet. Khác với 4 mô-đun vận hành thời gian thực (Runtime System Operations), Mô-đun 0 hoàn toàn chạy ở chế độ **Offline / Asynchronous Pipeline** nhằm thu thập, làm sạch, chuẩn hóa, phân tích cú pháp và nạp dữ liệu tri thức cũng như tư liệu đa phương tiện vào cơ sở dữ liệu trước khi hệ thống đi vào phục vụ người dùng.

```
==================================================================================================
CHRONOVIET DATA LIFECYCLE BOUNDARY
==================================================================================================

  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │ MÔ-ĐUN 0: DATA PREPROCESSING & INGESTION ENGINE (OFFLINE PIPELINE)                        │
  │ Raw Knowledge (PDFs, Books) & Raw Assets (Images, SFX)                                    │
  │   │                                                                                        │
  │   ├─► Text Cleaning, Historical Entity Normalization & Hierarchical Chunking               │
  │   ├─► Dual-Branch Indexing (Dense/Sparse Embeddings + LLM Triple Extraction)               │
  │   └─► Asset Metadata Tagging, LUFS Normalization & Copyright License Audit                 │
  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                │
                                                ▼ (Seed / Ingest into Storage Layer)
  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │ PERSISTENT DATA STORAGE LAYER (Stateless Monorepo & Host Mount Volume)                     │
  │   - PostgreSQL Database (pgvector HNSW, entities, relationships, document_chunks)        │
  │   - Host Volume /media/ (/media/projects/:id/, /media/raw-assets/, /media/audio-cache/)  │
  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                │
                                                ▼ (Read-Only Context & Asset Lookup)
  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │ RUNTIME OPERATIONAL SYSTEM (ONLINE PIPELINE - MÔ-ĐUN 1 ──► 2 ──► 3 ──► 4)                  │
  │ Chrono-RAG Retrieval ──► LangGraph Orchestration ──► VLM Inspector ──► Remotion Render MP4 │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Triết Lý Thiết Kế Cốt Lõi:
1. **Monorepo Stateless & 100% Data-Driven**: Codebase của ChronoViet không chứa dữ liệu kịch bản hay media hardcode. Toàn bộ tri thức và tư liệu phải được nạp thông qua Mô-đun 0 vào PostgreSQL và Host Mount Volume `/media`.
2. **Historical Precision First (Chính Xác Sử Liệu Là Ưu Tiên Số 1)**: Xử lý triệt để các rủi ro hallucination bằng cách làm sạch mâu thuẫn tên nhân vật, địa danh thay đổi qua các triều đại và phân cấp độ tin cậy của tài liệu gốc trước khi đưa vào cơ sở dữ liệu.
3. **Multi-Modal Asset Integrity**: Chuẩn hóa không chỉ văn bản RAG mà còn cả tư liệu ảnh (kiểm định bản quyền, bối cảnh lịch sử, độ phân giải) và âm thanh (chuẩn hóa âm lượng LUFS, phân loại SFX).

---

## 2. Luồng Thu Thập & Chuẩn Hóa Văn Bản Lịch Sử (Text Parsing & Historical Normalization)

### 2.1. Phân Cấp Dữ Liệu Đầu Vào (Knowledge Corpus Tiers)
Nguồn dữ liệu đầu vào của ChronoViet được thu thập từ 3 cấp độ tài liệu:

| Cấp Độ (Tier) | Tên Phân Loại | Nguồn Tài Liệu Tiêu Biểu | Độ Tin Cậy (`source_reliability`) |
| :--- | :--- | :--- | :--- |
| **LEVEL 1** | Primary Sources (Sử liệu chính thống cổ/trung đại) | *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*, *Việt Sử Lược*, *Lam Sơn Thực Lục*, các bài hịch/bình. | **1.0 (Tuyệt đối)** |
| **LEVEL 2** | Educational Standards (Chuẩn giáo dục) | Sách giáo khoa Lịch sử & Địa lý (Chương trình GDPT mới 2018), Giáo trình Lịch sử ĐH Sư phạm / ĐH KHXH&NV. | **0.95 (Chuẩn hóa)** |
| **LEVEL 3** | Secondary Research (Nghiên cứu chuyên khảo) | Các công trình nghiên cứu của Viện Sử học Việt Nam, tạp chí khoa học sử học đã thẩm định, tài liệu khảo cổ học. | **0.85 (Mở rộng)** |

### 2.2. Tiến Trình Làm Sạch & Chuẩn Hóa Sử Liệu (Normalization Pipeline)

```
 [Raw Text / PDF / Scan Books]
               │
               ▼
 ┌───────────────────────────┐
 │ 1. OCR & Structural Extract│ ──► Sử dụng Tesseract / MinerU trích xuất văn bản từ PDF/Scan
 └─────────────┬─────────────┘
               │
               ▼
 ┌───────────────────────────┐
 │ 2. Text Normalization     │ ──► Sửa lỗi OCR, loại bỏ trang sách/header/footer, chuẩn hóa Hán-Việt
 └─────────────┬─────────────┘
               │
               ▼
 ┌───────────────────────────┐
 │ 3. Location Mapping Table │ ──► Ánh xạ tên địa danh cổ ──► địa danh hiện đại (SAME_AS_LOCATION)
 └─────────────┬─────────────┘
               │
               ▼
 ┌───────────────────────────┐
 │ 4. Entity Disambiguation  │ ──► Đồng nhất nhân vật: Nguyễn Huệ = Quang Trung (ALIAS_OF)
 └───────────────────────────┘
```

#### Xử Lý Ánh Xạ Địa Danh Qua Các Thời Kỳ (`SAME_AS_LOCATION`):
Lịch sử Việt Nam chứng kiến sự thay đổi tên gọi địa danh liên tục qua các triều đại. Lớp tiền xử lý duy trì bảng ánh xạ từ điển địa danh nhằm nối các nút địa danh trên Đồ thị Tri thức:

```json
{
  "location_canonical": "Thăng Long",
  "historical_aliases": [
    { "name": "Đông Quan", "dynasty": "NHA_MINH_THUOC", "period": "1407-1427" },
    { "name": "Đông Kinh", "dynasty": "NHA_LE_SO", "period": "1428-1788" },
    { "name": "Hà Nội", "dynasty": "NHA_NGUYEN_MODERN", "period": "1831-Present" }
  ]
}
```

#### Giải Quyết Đồng Tham Chiếu & Đồng Nhất Nhân Vật (`ALIAS_OF`):
Khi nạp văn bản cổ, các đại từ hoặc tên hiệu như *"Bắc Bình Vương"*, *"Quang Trung"*, *"Nguyễn Huệ"*, *"Hồ Thơm"* đều được ánh xạ về một **Canonical Entity ID** (`person_nguyen_hue`) với thuộc tính `aliases = ["Quang Trung", "Nguyễn Huệ", "Hồ Thơm", "Bắc Bình Vương", "Long Nhượng Tướng Quân"]` (lưu ý danh xưng *"Tây Sơn Vương"* được ánh xạ riêng về **Nguyễn Nhạc** — `person_nguyen_nhac`).

---

## 3. Phân Đoạn Văn Bản Đa Cấp & Gán Metadata (Hierarchical Chunking & Metadata Enrichment)

Văn bản lịch sử sau khi làm sạch được cắt nhỏ theo phương pháp **Dynamic Hierarchical Temporal Chunking** để phục vụ cả việc truy vấn ngữ cảnh lớn (Parent Chunk) và từng sự kiện chi tiết (Child Chunk).

```
==================================================================================================
HIERARCHICAL CHUNKING STRUCTURE
==================================================================================================

 [ Parent Chunk: Chiến dịch Chi Lăng - Xương Giang 1427 (2,000 - 3,000 từ) ]
   │
   ├──► [ Child Chunk 1: Liễu Thăng tiến quân qua ải Chi Lăng (300 - 500 từ) ]
   ├──► [ Child Chunk 2: Trận phục kích tại núi Mã Yên & Liễu Thăng bị chém (300 - 500 từ) ]
   └──► [ Child Chunk 3: Mộc Thạnh rút quân & Hội thề Đông Quan (300 - 500 từ) ]
```

### 3.1. Metadata Schema Specification
Mỗi Child Chunk khi nạp vào bảng `document_chunks` của PostgreSQL bắt buộc chứa cấu trúc JSON Metadata sau:

```json
{
  "chunk_id": "hist_1427_chi_lang_ma_yen",
  "parent_chunk_id": "hist_1427_campaign_chi_lang_xuong_giang",
  "title": "Trận phục kích tại núi Mã Yên - Liễu Thăng đền tội",
  "dynasty": "NHA_LE_SO",
  "time_start": 1427,
  "time_end": 1427,
  "key_figures": ["Lê Lợi", "Nguyễn Trãi", "Lưu Nhân Chú", "Liễu Thăng"],
  "location": "Ải Chi Lăng, Núi Mã Yên, Lạng Sơn",
  "source_name": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Quyển X",
  "source_reliability": "LEVEL_1",
  "page_number": 42
}
```

---

## 4. Đường Ống Sinh Đồ Thị & Vector Index (Dual-Branch Generation Engine)

Sau công đoạn Chunking, dữ liệu được đẩy đồng thời qua **2 Nhánh Xử Lý Độc Lập** (Dual-Branch Indexing) trước khi liên kết chéo.

```
==================================================================================================
DUAL-BRANCH INDEXING PIPELINE
==================================================================================================

                            [ Child Document Chunk ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │      VECTOR BRANCH        │                 │       GRAPH BRANCH        │
  │ - BGE-M3 Dense (1024d)    │                 │ - Schema-Guided LLM Prompt│
  │ - BM25 Sparse Indexing    │                 │   (Triple Extraction)     │
  │ - Output: vector(1024)    │                 │ - Output: (Sub - Rel - Obj)│
  └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                │                                             │
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │ INSERT INTO               │                 │ INSERT INTO               │
  │ document_chunks           │                 │ entities & relationships  │
  └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │ CROSS-LINKING JUNCTION    │
                         │ INSERT INTO entity_chunks │
                         │ (entity_id, chunk_id)     │
                         └───────────────────────────┘
```

### 4.1. Nhánh 1: Vector Branch (Semantic Layer)
* **Dense Embedding**: Sử dụng mô hình `bge-m3` chuyển đổi nội dung `text_content` thành Vector 1024 chiều.
* **Sparse Encoding**: Trích xuất trọng số từ khóa theo thuật toán BM25 để hỗ trợ Keyword Exact Search.
* **Lưu trữ SQL**: Nạp vào bảng `document_chunks` và khởi tạo chỉ mục HNSW cosine index:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
  ON document_chunks USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);
  ```

### 4.2. Nhánh 2: Graph Branch (Structured Knowledge Layer & Hierarchical 2-Stage Extraction Engine)

Mô-đun 0 vận hành **Kiến trúc Trích Xuất Phân Tầng 2-Stage Tiên Tiến** để tối ưu hóa đồng thời độ chính xác, tốc độ và an toàn bộ nhớ ngữ cảnh:

* **Phân Tầng Trích Xuất theo Cấp Bậc Chunk (Hierarchical Extraction Routing):**
  * **Parent Chunks (2,000–3,000 từ):** Chạy trực tiếp qua **Stage 1 Fast-Path Pure TS NER & Rule-Based Matching** (< 1ms/chunk, 0% GPU). Đăng ký toàn bộ thực thể vào `entityMap` và bảng cầu nối `entity_chunks` (phục vụ đường dẫn duyệt đồ thị ngược về ngữ cảnh cha: Graph-to-Parent Traversal).
  * **Child Chunks (300–500 từ):** Chạy qua **Stage 2 LLM Extraction** với worker pool song song, bộ đệm persistent cache và graceful fallback.
* **Stage 1 (Pure TS Vietnamese Historical NER Candidate Extractor):**
  * Nhận diện thực thể ứng viên (Candidate Entity Spans) trực tiếp bằng mã nguồn thuần TypeScript trong bộ nhớ (< 1ms/câu, không tiêu tốn tài nguyên GPU).
  * Trả về danh sách candidate spans kèm vị trí ký tự chính xác (`startOffset`, `endOffset`) và ID chuẩn hóa đề xuất (`suggestedCanonicalId`).
* **Stage 2 (Lightweight Local LLM Extraction - Port 8094):**
  * Truyền Candidate Spans từ Stage 1 vào Prompt của mô hình ngôn ngữ nhẹ **Qwen3.5-4B-Instruct Q4_K_M** (chạy chuyên biệt trên Port 8094, cấu hình mặc định `--ctx-size 32768`, `--parallel 4`, `--threads 6`, `--cont-batching`, cấp phát $32,768 / 4 = 8,192$ tokens/slot) qua `generateLLMCompletion` với option `{ task: 'extraction' }`.
  * **Giới hạn trần ứng viên (Candidate Spans Capping):** Cắt trần tối đa `MAX_CANDIDATE_SPANS_IN_PROMPT = 30` thực thể ứng viên có độ ưu tiên cao nhất trong prompt nhằm triệt tiêu nguy cơ bùng nổ token (context overflow).
  * Ép kiểu đầu ra JSON strictly tuân thủ **8 Quan Hệ Chuẩn Hóa**: `LED_BY`, `PART_OF`, `HAPPENED_IN`, `HAPPENED_AT`, `SAME_AS_LOCATION`, `ALIAS_OF`, `ROYAL_LINEAGE`, `MENTIONED_IN`.
  * **Ma trận định hướng quan hệ (Directionality Validation Matrix):** Kiểm soát nghiêm ngặt chiều mũi tên $S \xrightarrow{R} O$ (ví dụ: `Event -[LED_BY]-> Person`, `Event -[HAPPENED_AT]-> Location`, `Event -[HAPPENED_IN]-> Dynasty`).
* **Cơ chế Fallback & Cách Ly (Quarantine Store):**
  * Khi LLM offline, hệ thống tự động fallback sang Stage 1 Candidate-Guided Rule Matcher.
  * Các cạnh có confidence $< 0.85$ hoặc chứa thực thể chưa định danh được đưa vào phân vùng cách ly (Quarantine Store) để thẩm định qua CLI `pnpm db:audit-quarantine`.

* **Prompt Chuẩn Hóa Trích Xuất Bộ Ba (2-Stage Triple Extraction Prompt)**:
  ```text
  Trích xuất các bộ ba quan hệ tri thức (Knowledge Triples) từ văn bản và danh sách thực thể ứng viên Stage 1 (tối đa 30 thực thể).
  8 loại quan hệ hợp lệ: LED_BY, PART_OF, HAPPENED_IN, HAPPENED_AT, SAME_AS_LOCATION, ALIAS_OF, ROYAL_LINEAGE, MENTIONED_IN.
  Trả về duy nhất định dạng JSON:
  {
    "triples": [
      {
        "sourceEntity": "...",
        "sourceEntityId": "...",
        "relationType": "LED_BY",
        "targetEntity": "...",
        "targetEntityId": "...",
        "confidence": 0.95
      }
    ]
  }
  ```
* **Lưu trữ SQL**: Nạp vào bảng `entities` và `relationships` tương thích với Schema tại [packages/shared-spec/src/db/schema.ts](../../packages/shared-spec/src/db/schema.ts).

### 4.4. Cơ Chế Xoay Vòng Phân Cấp 2 Tầng & Xử Lý Song Song (Hierarchical 2-Level Interleaved Rotation & Concurrency Pool)

Để tăng tốc tiến trình trích xuất đồ thị tri thức trên tập dữ liệu lớn mà không bị nghẽn (hang/stall) do quá tải phần cứng hay giới hạn tốc độ (rate limit), Mô-đun 0 ứng dụng cơ chế phối hợp 2 cấp độ:

```
                       [Inference Request / Chunk Extraction]
                                        │
                         Level 1: Provider Round-Robin Pointer
                   (local -> agnes -> gemini -> openai -> openrouter)
                                        │
                ┌───────────────┬───────┴───────┬───────────────┐
                ▼               ▼               ▼               ▼
            [ LOCAL ]       [ AGNES ]       [ GEMINI ]      [ OPENAI ]
            (Singleton)   (Key Rotator)   (Key Rotator)   (Key Rotator)
                │           ├── Key 1       ├── Key 1       ├── Key 1
                │           └── Key 2...    ├── Key 2       └── Key 2...
                │                           └── Key 3...
                ▼               ▼               ▼               ▼
             Local LLM      Agnes API       Gemini API      OpenAI API
```

1. **Hierarchical 2-Level Interleaved Rotation:**
   * **Level 1 (Provider Round-Robin):** Điều phối luân chuyển đều đặn qua các nhà cung cấp đang kích hoạt (`local -> agnes -> gemini -> openai -> openrouter -> local...`).
   * **Level 2 (Key Rotator per Provider):** Mỗi cloud provider sở hữu một pool API keys độc lập, tự động xoay vòng qua các key khả dụng và tự cách ly (Quarantine) độc lập từng key khi gặp sự cố.
   * **Chuỗi luân chuyển xen kẽ (Interleaved Sequence):** Đảm bảo không tập trung tải liên tục vào một provider duy nhất (ví dụ: `local -> agnes(k1) -> gemini(k1) -> local -> agnes(k2) -> gemini(k2)...`).

2. **Cơ Chế Phân Loại Lỗi & Cách Ly (Quarantine Policy):**
   * **Lỗi Hạn Mức / Quota (HTTP 429, 401, 403):** Cách ly đúng khóa API bị lỗi trong **24 Giờ (86,400,000 ms)**. Các khóa khác cùng provider và các provider khác vẫn hoạt động bình thường.
   * **Lỗi Quá Tải Tạm Thời / Timeout / Mạng (HTTP 502, 503, 504, AbortError):** Cách ly tạm thời trong **30 Giây (30,000 ms)** và tự động kích hoạt **Fast Failover Retry** sang target tiếp theo trong chu kỳ mà không làm gián đoạn pipeline.

3. **Adaptive Timeouts & Controlled Concurrency Pool:**
   * **Local LLM Timeout:** Ngưỡng tối đa **45 giây** cho các yêu cầu trích xuất cục bộ trên `llama-server`.
   * **Cloud Target Timeout:** Ngưỡng mặc định **35 giây** (`REMOTE_FALLBACK_TIMEOUT_MS=35000`) nhằm phát hiện sớm và chuyển vùng ngay lập tức khi mạng chậm.
   * **Controlled Concurrency Worker Pool:** Trong `DualBranchSeeder`, các đoạn văn bản (chunks) được xử lý đồng thời thông qua worker pool với số lượng luồng linh hoạt $N = \min(8, \max(2, \text{số active targets}))$. Kết quả trích xuất được gom về và tổng hợp tất định (deterministic) trong Single Thread của Node.js event loop trước khi thực hiện batch transaction vào PostgreSQL.

4. **Cơ Chế Checkpoint & Resume Cấp Độ Đoạn Văn Bản (Chunk-Level Extraction Cache):**
   * **Tự Động Lưu Tiến Độ (Persistent Disk Checkpoint):** Mỗi đoạn văn bản (chunk) sau khi trích xuất bộ ba tri thức thành công được băm SHA-256 (`sha256(chunk.textContent)`) và ghi ngay xuống đĩa tại `.cache/extraction_triples/<hash>.json` bằng cơ chế ghi an toàn nguyên tử (atomic write qua tmp file).
   * **Khôi Phục Tức Thì (Instant Resume):** Khi tiến trình nạp bị ngắt giữa chừng (`Ctrl + C`, mất điện, lỗi mạng) và chạy lại (`pnpm ingest:knowledge`), các đoạn văn bản đã trích xuất trước đó sẽ được tái sử dụng ngay lập tức ($0.0\text{s}$) mà không cần gọi lại LLM.
   * **Cờ Nạp Mới Toàn Diện (`--force`):** Khi cần nạp lại từ đầu với prompt hoặc mô hình mới, cờ `--force` sẽ tự động dọn sạch thư mục cache `.cache/extraction_triples/` và `TRUNCATE CASCADE` cơ sở dữ liệu để thực hiện trích xuất sạch 100%.

---

## 5. Đường Ống Tiền Xử Lý Media Assets (Visual & Audio Media ETL)

ChronoViet đòi hỏi tư liệu visual và audio cực kỳ nghiêm ngặt để đáp ứng tiêu chuẩn sản xuất video tự động chất lượng cao.

### 5.1. Visual Asset Ingestion & Copyright Audit Pipeline

```
 [ Crawl Images / Wikimedia / Upload Archive ]
                       │
                       ▼
 ┌──────────────────────────────────────────┐
 │ 1. Quality & Resolution Gate             │ ──► Loại bỏ ảnh < 600x600 px, ảnh vỡ/nhiễu mờ
 └─────────────────────┬────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────┐
 │ 2. Visual Context & Era Tagging          │ ──► LLM/VLM gán nhãn bối cảnh, triều đại, nhân vật
 └─────────────────────┬────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────┐
 │ 3. Copyright & License Audit Trail       │ ──► Kiểm định Whitelisted License: PUBLIC_DOMAIN,
 └─────────────────────┬────────────────────┘     CC0, CC-BY-4.0, CC-BY-SA-4.0
                       │
                       ▼
 ┌──────────────────────────────────────────┐
 │ 4. Persist to Host Volume & Registry     │ ──► Lưu file vào /media/raw-assets/ & ghi registry
 └──────────────────────────────────────────┘     tại /media/license-snapshots/registry.json
```

#### Quy Chuẩn Giấy Phép Bản Quyền (License Compliance Registry):
Mỗi ảnh nạp vào thư mục `/media/raw-assets/` bắt buộc đăng ký vào file registry `/media/license-snapshots/registry.json`:

```json
{
  "asset_id": "img_quang_trung_statue_go_dong_da",
  "local_path": "/media/raw-assets/quang_trung_statue.jpg",
  "source_url": "https://commons.wikimedia.org/wiki/File:Quang_Trung_Go_Dong_Da.jpg",
  "license_type": "PUBLIC_DOMAIN",
  "attribution_required": false,
  "author": "Wikimedia Commons Contributor",
  "historical_tags": {
    "dynasty": "NHA_TAY_SON",
    "figures": ["Quang Trung", "Nguyễn Huệ"],
    "event": "Trận Ngọc Hồi - Đống Đa 1789",
    "aspect_ratio": "16:9",
    "resolution": "1920x1080"
  }
}
```


### 5.2. Audio & Visual Asset Runtime Responsibilities
Theo kiến trúc chuẩn phân tách trách nhiệm (Separation of Concerns):
- **Tài nguyên thị giác (Visual Assets):** Kiểm định chất lượng (Quality Gate độ phân giải >= 720p, tỷ lệ khung hình, pHash) và kiểm toán bản quyền (License Audit) được xử lý trực tiếp trong quy trình Online Runtime tại [`packages/vlm-inspector`](../../packages/vlm-inspector) (`VisualQualityGate`).
- **Tài nguyên âm thanh (Audio Assets):** Chuẩn hóa âm lượng (-14 LUFS cho BGM, -6 LUFS Peak cho SFX) được xử lý trong quy trình Online Audio tại [`services/vieneu-tts`](../../services/vieneu-tts) (`AudioNormalizer`).
- **Mô-đun 0 (`packages/data-ingestion`):** Tập trung 100% vào tiền xử lý kho tri thức ngoại tuyến (Offline Knowledge Ingestion, Hierarchical Chunking, Knowledge Graph Triples, Vector Seeding).

---

## 6. Quy Chuẩn 7 Bảng CSDL, CLI Commands & Nạp Golden Datasets Cho `eval/`

Để tự động hóa hoàn toàn công đoạn nạp dữ liệu cho cả môi trường Dev, Staging và Production, Mô-đun 0 quản lý 7 bảng lưu trữ trên PostgreSQL và cung cấp bộ công cụ **CLI Commands** chạy từ root monorepo:

### 6.1. Cấu Trúc 7 Bảng CSDL Chuẩn Hóa Trên PostgreSQL

| Bảng CSDL | Loại Dữ Liệu | Mục Đích Lưu Trữ |
| :--- | :--- | :--- |
| `document_chunks` | Chunks & Dense Vector (1024d) | Lưu trữ các đoạn văn bản phân cấp (Parent 2000-3000 từ, Child 300-500 từ), embedding HNSW, và FTS tsvector |
| `entities` | Knowledge Graph Nodes | Lưu trữ thực thể lịch sử đã chuẩn hóa, danh xưng canonical, và danh sách bí danh (aliases) |
| `relationships` | Knowledge Graph Edges | Lưu trữ quan hệ thực thể $(S \rightarrow P \rightarrow O)$ có độ tin cậy $\ge 0.85$ |
| `entity_chunks` | Junction Table | Bảng liên kết chéo $N - N$ giữa thực thể và các văn bản chunk chứa thực thể |
| `entity_audit_logs` | Audit Trail | Ghi nhật ký thay đổi append-only khi hợp giải, sáp nhập hoặc cập nhật thực thể |
| `quarantine_triples` | Quarantine Buffer | Lưu trữ tạm các bộ ba quan hệ nghi vấn (confidence < 0.85, dangling context) chờ rà soát |
| `unmapped_entities` | Triage Buffer | Lưu trữ các thực thể mới xuất hiện trong văn bản chưa có trong Master Ontology |

### 6.2. Bộ Lệnh CLI Seeders & Kiểm Định Dữ Liệu Thật

```bash
# 0. Tải trọng số mô hình AI GGUF (BGE-M3 1024d & Qwen3.5-4B cho 2-Stage Triples Extraction)
pnpm models:download:lite     # Tải nhanh bộ đôi AI Lite (~2.4 GB)

# Khởi động môi trường AI phục vụ trích xuất & nạp tri thức:
pnpm dev:data                 # [Khuyến nghị] Bật Postgres + Redis + AI Lite (Embedding 8090 + Extraction 8094)
# Hoặc bật riêng rẽ:
# pnpm ai:extract             # Chỉ bật Extraction LLM (Port 8094) cho trích xuất quan hệ & eval:triples
# pnpm ai:emb                 # Chỉ bật Embedding Server (Port 8090) cho nạp vector

# 1. Khởi tạo SQL Schema chuẩn và xác nhận đủ 8 bảng trên PostgreSQL
pnpm --filter @chronoviet/data-ingestion db:init

# 2. Cào TỰ ĐỘNG 100% tài liệu 15 Thời kỳ Lịch sử Việt Nam (Master Corpus Crawl)
pnpm crawl:all # hoặc pnpm --filter @chronoviet/data-ingestion crawl:corpus --epoch=EPOCH_05

# 3. Chạy pipeline nạp & làm sạch dữ liệu tri thức văn bản (Dual-Branch ETL)
pnpm ingest:vector                              # Stage 1: Chunks & Vector Store (BGE-M3 1024d) + Fast NER
pnpm ingest:graph                               # Stage 2: Knowledge Graph Triples bằng LLM & Re-resolve
pnpm ingest:knowledge                           # Nạp trọn gói cả 2 Stage liên hoàn (Hỗ trợ Resume qua .cache/)
pnpm ingest:knowledge --force                   # Nạp mới từ đầu (xóa cache checkpoint & truncate database)
pnpm ingest:knowledge --strict                  # Nạp với chế độ Strict Quality Gate (bắt buộc LLM + Postgres + Embedding)
pnpm ingest:knowledge --offline                 # Nạp nhanh offline (Regex + Rule Matching, không dùng LLM)

# 4. SAO LƯU DỰ PHÒNG DỮ LIỆU SAU INGESTION (Database Snapshot Preservation):
# -----------------------------------------------------------------------------------
pnpm db:backup --name post_ingest_v1            # Tạo bản Snapshot có tên phiên bản (tạo backups/post_ingest_v1.dump & db_latest.dump)

# 5. QUY TRÌNH 4 BƯỚC LÀM SẠCH, CHUẨN HOÁ & NÂNG CAO CHẤT LƯỢNG HẬU INGESTION:
# -----------------------------------------------------------------------------------
# Bước 5.1: Sanitization & DB Health Check
pnpm db:clean                                   # Xóa self-loops, duplicate edges, dangling relations & tái lập unique index
pnpm db:health                                  # Audit 6 chiều toàn vẹn DB (yêu cầu PERFECTLY STABLE & HEALTHY)

# Bước 5.2: Quarantine Triage & Promotion
pnpm db:audit-quarantine                                        # Xem danh sách pending review trong quarantine buffer
pnpm db:audit-quarantine --accept-all-high-conf --threshold=0.85 # Thăng cấp quan hệ đạt chuẩn (>= 0.85) vào Graph chính thức
pnpm db:audit-quarantine --purge-spurious                       # Thanh lọc quan hệ rác, spurious edges & unmapped noise

# Bước 5.3: Master Entity Re-Resolution
pnpm --filter @chronoviet/data-ingestion rag:re-resolve         # Chuẩn hoá entities về Canonical ID & ghi entity_audit_logs

# (Tùy chọn) Phục hồi nếu quá trình làm sạch/hợp giải xảy ra sự cố hỏng dữ liệu:
# pnpm db:restore --file backups/post_ingest_v1.dump  # Khôi phục chính xác từ bản snapshot phiên bản v1
# pnpm db:restore                                    # Hoặc khôi phục nhanh từ bản snapshot mới nhất

# Bước 5.4: Quality Diagnostics & Benchmarking
pnpm eval:ingest:diagnostic                     # Chẩn đoán độ phủ, mật độ graph, unmapped entities trên kho văn bản
pnpm eval:seed                                  # Nạp Golden Datasets vào thư mục eval/ chuẩn bị cho Benchmark
pnpm eval:ingest                                # Master Benchmark Module 0: Đo lường toàn diện trên DB thật
pnpm eval:ingest:vector                         # Benchmark 100 câu hỏi Vector Retrieval trên pgvector HNSW
pnpm eval:ingest:graph                          # Đánh giá 82,849 quan hệ, ma trận hướng (99.5%) & độ kết nối
pnpm eval:ingest:triples                        # Đánh giá trích xuất bộ ba với Qwen-4B thật
pnpm eval:ingest:ner                            # Đánh giá bóc tách thực thể Stage 1 NER (F1: 97.04%)
pnpm eval --chain ingest-rag                    # Đánh giá chất lượng E2E chuỗi Ingest-RAG Chain (MRR, nDCG@5, Fact Precision)
```

### 6.3. Nạp Golden Datasets Cho Kiến Trúc Đánh Giá `eval/`
Mô-đun 0 chịu trách nhiệm nạp các tập **Golden Test Cases** vào thư mục `eval/test-cases/` để phục vụ E2E Pipeline Benchmark:

```
../eval/test-cases
├── biography_tran_hung_dao.json   [Golden Test-case cho Domain BIOGRAPHY]
├── battle_bach_dang_938.json      [Golden Test-case cho Domain BATTLE]
├── dynasty_nha_ly.json            [Golden Test-case cho Domain DYNASTY]
├── mystery_le_chi_vien.json       [Golden Test-case cho Domain MYSTERY]
└── artifact_trong_dong_ngoc_lu.json [Golden Test-case cho Domain ARTIFACT]
```

Bộ dữ liệu mẫu này giúp kiểm tra chất lượng kết quả đầu ra của RAG Engine, Multi-Agent Orchestrator và Remotion Render Engine ở mọi giai đoạn phát triển mà không bị phụ thuộc vào dữ liệu mạng bên ngoài.

---

## 7. Hai Trụ Cột Đánh Giá Thực Chiến & Chỉ Số KPI (Production Evaluation Pillars)

ChronoViet phân định rõ 2 Trụ Cột Đánh Giá Chất Lượng Thực Chiến song hành cùng Bộ Benchmark Cục Bộ:

### 7.1. Hai Trụ Cột Đánh Giá Thực Chiến (2 Production Pillars)

1. **Trụ Cột 1 (Pre-Ingestion Corpus Diagnostics):** Chạy `pnpm eval:ingest:diagnostic` quét trực tiếp trên toàn bộ kho văn bản thật `data/raw_corpus/` để phân tách Parent-Child Chunks, phát hiện và thống kê 5 nhóm lỗi (`GENERIC_OR_HALLUCINATED_ENTITY`, `UNMAPPED_ENTITY`, `LOW_CONFIDENCE_RELATION`, `TEMPORAL_SPATIAL_MISSING`, `DANGLING_RELATIONSHIP`), tự động cách ly vào Quarantine Buffer (`quarantine_triples`, `unmapped_entities`), đồng thời xuất báo cáo đa định dạng (`.json`, `.md`).
2. **Trụ Cột 2 (Real-Database Hybrid Ingestion & E2E RAG Evaluation):** Chạy `pnpm eval --chain ingest-rag` sau khi nạp CSDL bằng `pnpm ingest:knowledge --strict` để kiểm tra độ chính xác sự kiện (Fact Precision $\ge 85\%$), độ phủ đồ thị tri thức, minh bạch trích dẫn (Citation Traceability $= 100\%$) và khả năng từ chối câu hỏi sai lệch (Adversarial Rejection $= 100\%$) trên cơ sở dữ liệu PostgreSQL thật.

### 7.2. Bảng Chỉ Số KPI Đánh Giá Cục Bộ (Module 0 Isolated KPIs)

| Chỉ số KPI | Mô Tả & Phương Pháp Đánh Giá | Chỉ Số Mục Tiêu | Kết Quả Thực Tế | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **KPI 1: Entity Normalization & Disambiguation** | Đánh giá độ chính xác khi giải quyết đồng tham chiếu (`ALIAS_OF`) và ánh xạ địa danh qua các thời kỳ (`SAME_AS_LOCATION`). | **$> 98.0\%$** | **100%** (39/39 cases) | **PASSED** |
| **KPI 2: Triple Extraction Accuracy** | Đánh giá độ chính xác trích xuất bộ ba thực thể $(Entity_A \rightarrow Relation \rightarrow Entity_B)$ theo ngữ pháp và quan hệ lịch sử. | **$\ge 90.0\%$** | **100%** (3/3 cases) | **PASSED** |
| **KPI 3: Golden Dataset Integrity & Throughput** | Xác minh tính toàn vẹn 5 tập Golden Datasets theo `ground_truth_entities`/`ground_truth_triples` và đo tốc độ nạp dữ liệu. | **$100\%$ Integrity** | **100% Integrity** (5/5 datasets) | **PASSED** |
### 7.3. Kết Quả Kiểm Định Thực Tế Toàn Bộ Kho Dữ Liệu Lịch Sử (Full Real DB Verification)

Sau khi hoàn tất quy trình nạp dữ liệu từ 137 văn bản gốc trong `data/raw_corpus/`, toàn bộ hệ thống cơ sở dữ liệu thật đã được kiểm toán và đạt các thông số:

* **Tài liệu & Document Chunks:**
  * Tổng số văn bản nguồn: **137 documents**
  * Tổng số child chunks đã trích xuất & cache 100%: **8,129 chunks** (12.74 MB trên đĩa)
  * Tổng số document chunks đã được vector hóa trong PostgreSQL: **9,258 chunks** (100% Vectorized)
* **Đồ thị Tri thức (Knowledge Graph):**
  * Tổng số thực thể (Entities): **32,583 entities**
  * Tổng số quan hệ tri thức (Relationships): **82,849 relationships** (100% Unique Tuples)
  * Số liên kết tự lặp (Self-loops): **0** (✅ Đã làm sạch hoàn toàn)
  * Số tham chiếu mồ côi (Dangling References): **0** (✅ 100% toàn vẹn khóa ngoại)
  * Độ kết nối mạng đồ thị (Graph Connectivity): **99.8%** (32,502 / 32,583 nodes kết nối, Bậc trung bình: 5.09)
* **Kết Quả Đánh Giá Stage 1 (Vector Retrieval trên DB Thật - 100 queries):**
  * **Hit@5:** **89.33%** (Tăng lên **92.0%** với Hybrid Fusion)
  * **Hit@10:** **90.67%** (Tăng lên **94.67%** với Hybrid Fusion)
  * **Mean Reciprocal Rank (MRR):** **0.857**
  * **Độ trễ truy vấn trung bình:** **4.82 ms**
* **Kết Quả Đánh Giá Stage 2 (Knowledge Graph trên DB Thật):**
  * **Tỷ lệ quan hệ đạt chuẩn độ tin cậy ($\ge 0.85$):** **100%** (82,849 / 82,849)
  * **Tuân thủ ma trận định hướng ($S \to R \to O$):** **99.5%**
  * **Trạng thái tổng thể:** `[PASS ✅]`

> 📄 File Báo Cáo Chi Tiết: [`packages/data-ingestion/eval/reports/ingest-eval-report.json`](../../packages/data-ingestion/eval/reports/ingest-eval-report.json) và [`packages/data-ingestion/eval/reports/ingest-diagnostic-report.md`](../../packages/data-ingestion/eval/reports/ingest-diagnostic-report.md)


