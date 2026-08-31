# `@chronoviet/data-ingestion`

> **ChronoViet Data Preprocessing & Ingestion Engine (Mô-đun 0)**  
> Gói mã nguồn chịu trách nhiệm cào tự động 15 thời kỳ lịch sử, làm sạch văn bản & khử nhập nhằng thực thể, phân đoạn văn bản đa cấp (Hierarchical Temporal Chunking), nạp dữ liệu tri thức song song (Dual-Branch Vector/Graph Seeder) vào PostgreSQL (pgvector & Knowledge Graph). Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) & [00_DATA_PREPROCESSING_AND_INGESTION.md](../../docs/modules/00_DATA_PREPROCESSING_AND_INGESTION.md).

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/data-ingestion` đóng vai trò là Lớp Nạp Dữ Liệu Ngoại Tuyến (Offline Data Ingestion Layer) của hệ thống ChronoViet:

* **Layer 0 Preprocessor & Corpus Sanitizer (`corpus:clean`):** Tiền xử lý kho ngữ liệu thô (`data/raw_corpus` $\to$ `data/processed_corpus`), chuẩn hóa Unicode NFC, 3-token lookahead syllable healer (~6,500 âm tiết chuẩn tiếng Việt), bảo vệ từ đơn (`a bảo`, `y như`), strict mộc bản regex bảo tồn 100% 924 năm dương lịch `[40]`, lọc rác giải thưởng ngoại lai (Nobel/Oscar) trong các bài wiki sự kiện năm `1954.md`/`1973.md`.
* **Master Corpus Crawler (`crawl:all` / `crawl:corpus`):** Cào tự động tài liệu tri thức lịch sử từ Wikipedia và Wikisource phủ rộng qua **15 Thời Kỳ Lịch Sử Việt Nam** theo danh mục định sẵn `master-corpus-catalog.ts`.
* **Dual-Syntax Heading-Aware Chunking:** Phân đoạn văn bản đa cấp (Markdown `#` + MediaWiki `==`) với cửa sổ kích thước động $[300, 500]$ từ, kế thừa triều đại (Dynasty Inheritance), loại trừ pseudo-headings (`##### Sư nói:`), và tự động bơm macro-context banners.
* **SLM Triples Extractor (Qwen 4B) & Write-Through Disk Cache:** Trích xuất quan hệ chính xác, loại bỏ heuristics 200 ký tự giả, cô lập 2,360+ khối lời bình sử gia (`isHistorianCommentary: true`), và giải mã Can Chi 3 tầng (Reign Era $\to$ Heading Bounds $\to$ Sliding Anchor Reset).
* **Dual-Branch Parallel Seeder & Concurrency Pool:** Tạo Dense Embedding BGE-M3 (1024d) nạp vào PostgreSQL `document_chunks`, đồng thời nạp thực thể và bộ ba quan hệ chuẩn hóa vào `entities` & `relationships`.
* **Quarantine & Disambiguation Buffer:** Tự động cách ly các bộ ba nghi vấn vào `quarantine_triples` và ghi nhận thực thể mới ngoài Master Ontology vào `unmapped_entities`.
* **Re-Indexing & Audit Trail (`db:re-resolve`):** Hợp giải nút thực thể trùng lặp và ghi nhật ký thay đổi append-only vào `entity_audit_logs`.
* **Quality Diagnostics (`eval:diagnostic`):** Kiểm tra chất lượng phân đoạn, ánh xạ thực thể và phát hiện quan hệ bất thường trên kho văn bản thực tế.
* **Fast Failover & Adaptive Timeouts:** Áp dụng timeout thích ứng 45s cho Local LLM và 35s cho Cloud API, cách ly 24h cho lỗi Quota/429 và 30s cho lỗi tạm thời/503/timeout, chuyển vùng tức thì mà không gây nghẽn pipeline.

---

## 🗄️ 2. Cấu Trúc 11 Bảng CSDL Chuẩn Hóa & Materialized View (Database Schema)

Module 0 quản lý và khởi tạo trực tiếp 11 bảng lưu trữ dữ liệu tri thức và 1 Materialized View trên PostgreSQL:

| Bảng CSDL | Loại Dữ Liệu | Mục Đích Lưu Trữ |
| :--- | :--- | :--- |
| `document_chunks` | Chunks & Dense Vector (1024d) | Lưu trữ các đoạn văn bản phân cấp (Parent/Child), embedding HNSW, và FTS tsvector |
| `entities` | Knowledge Graph Nodes | Lưu trữ thực thể lịch sử đã chuẩn hóa, danh xưng canonical, và danh sách bí danh (aliases) |
| `relationships` | Knowledge Graph Edges | Lưu trữ quan hệ thực thể $(S \rightarrow P \rightarrow O)$ có độ tin cậy $\ge 0.85$ |
| `entity_chunks` | Junction Table | Bảng liên kết chéo $N - N$ giữa thực thể và các văn bản chunk chứa thực thể |
| `entity_audit_logs` | Audit Trail | Ghi nhật ký thay đổi append-only khi hợp giải, sáp nhập hoặc cập nhật thực thể |
| `quarantine_triples` | Quarantine Buffer | Lưu trữ tạm các bộ ba quan hệ nghi vấn (confidence < 0.85, dangling context) chờ rà soát |
| `unmapped_entities` | Triage Buffer | Lưu trữ các thực thể mới xuất hiện trong văn bản chưa có trong Master Ontology |
| `orchestrator_checkpoints` | LangGraph Persistence | Lưu trữ state checkpoints phục vụ điều phối Multi-Agent |
| `conversations` | Chat Conversations | Quản lý phiên hội thoại lịch sử đa lượt của Web Chatbot Supervisor |
| `conversation_messages` | Chat Messages & Citations | Lưu trữ chi tiết từng tin nhắn chat, intent classification và trích dẫn citations |
| `video_briefs` | Compiled Video Briefs | Lưu trữ hồ sơ brief làm video đã biên soạn từ chat hội thoại |
| `mv_dynasty_lineage_paths` | Materialized View | Phả hệ dòng tộc triều đại tiền tính toán (Precomputed lineage paths) tối ưu hóa truy vấn BFS/CTE |

---

## 🏗️ 3. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/data-ingestion/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── clean-corpus.ts            # CLI làm sạch kho ngữ liệu thô (corpus:clean)
│   │   ├── crawl-corpus.ts            # CLI cào dữ liệu (--all, --epoch=EPOCH_XX, --topics)
│   │   ├── crawl-pdf-extracted.ts     # CLI xử lý corpus PDF đã trích xuất (crawl:pdf-extracted)
│   │   ├── extract-pdf-md.ts          # CLI chuyển đổi PDF scan sang Markdown (extract:pdf)
│   │   ├── ingest-diagnostic.ts       # CLI chẩn đoán chất lượng dữ liệu nạp (eval:diagnostic)
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (ingest:knowledge)
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index (db:init)
│   │   ├── quarantine-inspector.ts    # CLI kiểm toán & giải phóng vùng cách ly (db:audit-quarantine)
│   │   ├── re-resolve-cli.ts          # CLI hợp giải thực thể & ghi nhật ký entity_audit_logs (db:re-resolve)
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/ (eval:seed)
│   │
│   ├── cache/                         # Checkpoint Disk Cache cho tiến trình trích xuất Triples
│   ├── chunking/                      # Hierarchical Temporal Chunker & Metadata Enricher
│   ├── crawler/                       # Master Corpus Catalog & Wiki/Web Scraper
│   ├── diagnostics/                   # Diagnostic Types & Quality Analyzers
│   ├── pdf/                           # PDF Text Extractor (TCVN3, Zlib Stream)
│   ├── seeder/                        # Dual-Branch Vector/Graph Indexing Engine & DB Initializer
│   ├── text/                          # OCR, Text Normalizer, Pure TS Historical NER Engine
│   ├── utils/                         # Text & Path Utilities (Frontmatter parser)
│   ├── ingest-pipeline.ts             # Orchestrator điều phối toàn trình Ingest Pipeline
│   ├── triple-extractor.ts            # 2-Stage Triples Extractor (Stage 1 NER/Rule + Stage 2 LLM)
│   ├── types.ts                       # Ingestion Data Types & Interfaces
│   ├── index.ts                       # Entrypoint export public APIs
│   └── __tests__/                     # Unit Tests Suite độc lập cho CI/CD Gate
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 0
│   ├── datasets/                      # 5 Tập benchmark datasets chuẩn
│   ├── reports/                       # Báo cáo kết quả benchmark JSON & Markdown
│   ├── chunk-runner.ts                # Runner đánh giá trích xuất trên chunk văn bản
│   ├── graph-eval-runner.ts           # Runner đánh giá cấu trúc Knowledge Graph & Ma trận hướng
│   ├── metrics.ts                     # Đo lường Disambiguation, Extraction, Chunk Quality
│   ├── ner-diagnostic.ts              # Chẩn đoán chi tiết chất lượng NER
│   ├── ner-runner.ts                  # Runner đánh giá Stage 1 Pure TS Historical NER (eval:ner)
│   ├── runner.ts                      # Master Benchmark Runner cho Mô-đun 0 (eval / eval:ingest)
│   ├── triples-runner.ts              # Runner đánh giá Stage 2 Triples Extractor (eval:triples)
│   ├── vector-eval-runner.ts          # Runner đánh giá 100 câu hỏi Vector Retrieval HNSW (eval:vector)
│   └── README.md                      # Tài liệu hướng dẫn đánh giá 2 Trụ Cột Thực Chiến
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 4. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi trực tiếp từ thư mục gốc monorepo hoặc qua package script:

```bash
# 0. Khởi động hạ tầng AI Models cục bộ (Port 8090 & 8094)
pnpm ai:lite                                    # Bật cặp nhẹ BGE-M3 (8090) + Qwen-4B (8094) (~3.1 GB RAM)
# hoặc bật riêng lẻ:
# pnpm ai:emb                                   # Chỉ bật Embedding Server Port 8090 (BGE-M3)
# pnpm ai:extract                               # Chỉ bật Extraction LLM Port 8094 (Qwen-4B)
# Hoặc kiểm tra trạng thái: pnpm ai:status

# 1. Khởi động hạ tầng CSDL PostgreSQL (pgvector HNSW) & Redis
pnpm stack:infra

# 2. Khởi tạo SQL Schema & xác nhận các bảng trên PostgreSQL
pnpm db:init

# 3. Thu thập & Tiền xử lý dữ liệu Lịch sử (Crawler & Layer 0 Sanitizer)
pnpm crawl:all                                  # Cào tự động TOÀN BỘ 15 Thời kỳ Lịch sử từ catalog
pnpm crawl:corpus --epoch=EPOCH_05              # Hoặc cào riêng 1 Epoch cụ thể (vd: Nhà Trần)
pnpm corpus:clean                               # Tiền xử lý & làm sạch văn bản (raw_corpus -> processed_corpus)

# (Tùy chọn: Xử lý kho sử liệu cổ PDF)
# pnpm extract:pdf                              # Trích xuất PDF scan sang Markdown thô
# pnpm crawl:pdf-extracted                      # Cào bổ sung toàn văn cho các bộ cổ sử PDF

# 4. Nạp kho tri thức vào CSDL thật (Stage-by-Stage Dual-Branch Ingestion)
pnpm ingest:vector                              # Stage 1: Nạp Chunks & Vector Store (BGE-M3 1024d) + Fast NER
pnpm ingest:graph                               # Stage 2: Nạp Knowledge Graph Triples bằng LLM & Re-resolve
pnpm ingest:knowledge                           # Nạp trọn gói cả 2 Stage liên hoàn (mặc định strict mode)
pnpm ingest:knowledge --no-strict               # Nạp với chế độ lenient (cho phép fallback khi thiếu model)
pnpm ingest:knowledge --offline                 # Nạp nhanh offline (Regex + Fallback, không cần LLM)
pnpm ingest:knowledge --force                   # Nạp mới từ đầu (xóa cache checkpoint & truncate DB)

# 5. Quy Trình Làm Sạch & Chuẩn Hóa Dữ Liệu Sau Ingestion (Post-Ingestion Data Governance)
pnpm db:clean                                   # Xóa self-loops, duplicate edges, dangling relations & tái lập index
pnpm db:health                                  # Audit sức khỏe CSDL (yêu cầu PERFECTLY STABLE & HEALTHY)
pnpm db:audit-quarantine                        # Xem danh sách pending review trong quarantine buffer
pnpm db:audit-quarantine --accept-all-high-conf --threshold=0.85 # Thăng cấp quan hệ chất lượng cao
pnpm db:audit-quarantine --purge-spurious       # Thanh lọc quan hệ rác & unmapped noise
pnpm db:re-resolve                              # Hợp giải thực thể về Canonical ID & ghi entity_audit_logs

# 6. Đánh Giá & Benchmark Bổ Sung (Evaluation & Testing)
pnpm eval:ingest                                # Master Benchmark Module 0: Đo lường 4 KPI chất lượng
pnpm eval:vector                                # Benchmark Vector Retrieval trên pgvector HNSW thật
pnpm eval:graph                                 # Đánh giá Knowledge Graph Triples & Connectivity
pnpm eval:ner                                   # Benchmark Stage 1 Pure TS Historical NER (411 thực thể)
pnpm eval:triples                               # Benchmark Stage 2 Triples Extractor với Qwen-4B
pnpm eval:diagnostic                            # Chẩn đoán độ phủ, mật độ graph trên kho văn bản
pnpm eval:seed                                  # Nạp 5 tập Golden Ground-Truth Datasets vào DB
pnpm test:ingest                                # Chạy deterministic unit tests
pnpm typecheck:ingest                           # Kiểm tra TypeScript package

# 7. Tắt AI giải phóng RAM sau khi hoàn tất:
pnpm ai:stop
```

### 📋 Bảng Tham Số & Cờ Tùy Chọn CLI (CLI Flags & Options)

#### 1. `ingest:knowledge` (Nạp kho tri thức)

| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--stage=vector` / `--stage=1` | Chỉ chạy Stage 1 (Chunking + Vector Embeddings + Fast NER) | `all` |
| `--stage=graph` / `--stage=2` | Chỉ chạy Stage 2 (LLM Triples Extraction + Graph Sync + Re-resolve) | `all` |
| `--stage=all` | Chạy trọn gói liên hoàn cả Stage 1 và Stage 2 | `all` |
| `--input=<path>` | Đường dẫn thư mục hoặc file tài liệu nguồn (`.txt`, `.md`, `.json`, `.pdf`) | `data/processed_corpus` |
| `--force` / `--fresh` / `--clean` | Chế độ nạp mới từ đầu: Xóa sạch cache checkpoint (`.cache/extraction_triples/`) và `TRUNCATE CASCADE` database | `false` |
| `--resume` / `--append` | Giữ nguyên chế độ tiếp tục (Resume), tái sử dụng kết quả trích xuất chunk đã có | `true` |
| `--strict` | Bật chế độ Preflight nghiêm ngặt: dừng ngay nếu Postgres, Embedding Server hoặc LLM Gateway offline | `true` |
| `--no-strict` / `--lenient` | Tắt chế độ nghiêm ngặt, cho phép nạp ngay cả khi một số dịch vụ AI chưa sẵn sàng | `false` |
| `--regex-only` / `--regex` | Bỏ qua LLM trích xuất, chỉ sử dụng bộ từ điển quy tắc Regex | `false` |
| `--allow-fallback` / `--fallback` | Cho phép tự động fallback sang Regex nếu LLM Gateway bị timeout / offline | `false` |
| `--offline` / `--fast` | Chạy nhanh hoàn toàn offline (tương đương `--regex-only --allow-fallback`) | `false` |

#### 2. `crawl:corpus` (Thu thập dữ liệu lịch sử)

| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--all` / `--full` | Cào tự động toàn bộ 15 Thời kỳ Lịch sử Việt Nam từ catalog | `false` |
| `--epoch=EPOCH_XX` | Chỉ định thời kỳ cụ thể cần cào (ví dụ: `EPOCH_04`, `EPOCH_05`...) | - |
| `--topics="A,B"` | Danh sách chủ đề/từ khóa cách nhau bằng dấu phẩy | - |
| `--urls="url1,url2"` | Danh sách link Wikisource/Wikipedia cụ thể | - |
| `--output=<path>` | Thư mục lưu tệp văn bản thô sau khi cào | `data/raw_corpus` |
| `--min-words=<n>` | Số từ tối thiểu cho mỗi bài cào về | `150` |

#### 3. `eval:diagnostic` (Chẩn đoán chất lượng nạp)

| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--input=<path>` | Thư mục hoặc file văn bản cần chẩn đoán | `data/raw_corpus` |
| `--output=<path>` / `--out=<path>` | Đường dẫn file JSON kết quả | `packages/data-ingestion/eval/reports/ingest-diagnostic-report.json` |
| `--limit=<n>` | Giới hạn số lượng tài liệu phân tích | Toàn bộ |
| `--regex-only` / `--fast` | Chạy nhanh với bộ quy tắc từ điển Regex | `false` |
| `--allow-fallback` | Cho phép fallback Regex nếu LLM offline | `false` |
| `--offline` | Chạy hoàn toàn offline (Regex + Fallback) | `false` |
| `--strict` | Báo cáo chi tiết các trường hợp chạm ngưỡng chất lượng | `false` |

#### 4. `db:audit-quarantine` (Kiểm toán & Quản trị Vùng Cách Ly)

| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--threshold=<n>` | Ngưỡng độ tin cậy tối thiểu để thẩm định/thăng cấp quan hệ | `0.85` |
| `--accept-all-high-conf` | Tự động thăng cấp các bộ ba có `confidence >= threshold` và thực thể nguồn/đích hợp lệ vào bảng `relationships`, đổi trạng thái thành `APPROVED` và ghi nhật ký `entity_audit_logs` | `false` |
| `--purge-spurious` | Xóa bỏ các quan hệ tự trỏ (self-loops), các cạnh bị từ chối (`REJECTED`) hoặc độ tin cậy rác (< 0.25) trong `quarantine_triples`, và thực thể rác (`DISCARDED_AS_NOISE`) trong `unmapped_entities` | `false` |
| `--promote-unmapped` | Tự động thăng cấp các thực thể unmapped có tần suất xuất hiện cao | `false` |
| `--min-occurrences=<n>` | Số lần xuất hiện tối thiểu để thăng cấp thực thể unmapped | `3` |
| `--dry-run` | Chạy mô phỏng kiểm tra, xuất báo cáo danh sách cạnh/thực thể bị tác động mà không thay đổi CSDL | `false` |

#### 5. Quản trị, Sao Lưu & Kiểm toán CSDL Hệ thống (Monorepo-level Database Scripts)

| Lệnh CLI | Mô tả & Chức năng |
| :--- | :--- |
| `pnpm db:init` | Khởi tạo PostgreSQL schema với pgvector extension (1024d HNSW index, BM25 FTS tsvector index, entities aliases GIN index) và các bảng CSDL phục vụ lưu trữ |
| `pnpm db:health` | Audit sức khỏe toàn diện CSDL: Đếm quan hệ, phát hiện self-loops, kiểm tra trùng lặp, phát hiện dangling references, kiểm tra độ phủ vector embeddings, xác minh các chỉ mục lõi (`idx_rel_unique`, `idx_chunks_embedding_hnsw`, `idx_chunks_fts`), và thống kê bộ đệm cách ly |
| `pnpm db:backup --name <version>` | Tạo snapshot CSDL có tên phiên bản cụ thể dưới dạng nhị phân (`.dump` qua `pg_dump -Fc`) lưu vào `backups/<version>.dump` và tự động cập nhật pointer `backups/db_latest.dump` |
| `pnpm db:restore --file <path>` | Khôi phục toàn diện CSDL từ file snapshot chỉ định (hoặc từ `db_latest.dump` nếu không truyền flag), tự động clean bảng và thực hiện kiểm định sức khỏe (`pnpm db:health`) |
| `pnpm db:clean` | Dọn dẹp bản ghi trùng lặp, xóa self-loops, thanh lọc quan hệ lơ lửng (dangling edges) trong giao dịch nguyên tử (`withTransaction`), tái lập unique index `idx_rel_unique` và ghi vết `entity_audit_logs` |
| `pnpm db:re-resolve` | Hợp giải các thực thể về Canonical ID, gộp aliases và cascade cập nhật references trong `entity_chunks` & `relationships` |

---

## 📊 5. Khả Năng Quan Sát & Đo Lường Hiệu Năng (Observability & Telemetry)

Module 0 được trang bị hệ thống Telemetry chuẩn hóa:

1. **Correlation ID Tracing:** Tự động sinh `correlationId` (hoặc truyền qua `IngestionOptions.correlationId`) gắn kết từ CLI qua Pipeline, Seeder, Crawler và từng worker trích xuất.
2. **RED Metrics & Stage Durations:** Thu thập chi tiết qua `IngestionMetricsCollector`:
   * `durations`: `chunkingMs`, `extractionMs`, `embeddingMs`, `dbInsertMs`, `totalDurationMs`.
   * `throughput`: `chunksPerSec`, `wordsPerSec`, `vectorsPerSec`.
   * `cacheStats`: `hits`, `misses`, `hitRate`.
   * `quarantineStats`: `totalQuarantined`, `reasons` (`LOW_CONFIDENCE`, `DANGLING_RELATION`).
3. **Sub-batched Vector Generation:** Chia nhỏ batch embedding thành các sub-batches cố định (64 chunks) kèm telemetry `embedding.batch_completed` giám sát tốc độ sinh vector ngăn ngừa quá tải VRAM / HTTP timeout.
4. **Detailed Cache Analytics:** Phương thức `extractionCache.getDetailedStats()` cung cấp thông tin dung lượng byte, số lượng mục và phân bố provider/model.

---

## 📄 6. Giấy Phép & Tài Liệu Liên Quan (License & References)

* **Giấy phép:** Gói thuộc sở hữu nội bộ của dự án **ChronoViet Monorepo**.
* **Đặc tả kỹ thuật:**
  * [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) — Quy chuẩn quản trị dữ liệu tri thức.
  * [00_DATA_PREPROCESSING_AND_INGESTION.md](../../docs/modules/00_DATA_PREPROCESSING_AND_INGESTION.md) — Kiến trúc chi tiết Mô-đun 0.
