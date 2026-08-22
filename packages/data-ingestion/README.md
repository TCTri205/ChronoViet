# `@chronoviet/data-ingestion`

> **ChronoViet Data Preprocessing & Ingestion Engine (Mô-đun 0)**  
> Gói mã nguồn chịu trách nhiệm cào tự động 15 thời kỳ lịch sử, làm sạch văn bản & khử nhập nhằng thực thể, phân đoạn văn bản đa cấp (Hierarchical Temporal Chunking), nạp dữ liệu tri thức song song (Dual-Branch Vector/Graph Seeder) vào PostgreSQL (pgvector & Knowledge Graph). Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/specs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v1.5.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/data-ingestion` đóng vai trò là Lớp Nạp Dữ Liệu Offline của hệ thống ChronoViet:

1. **Master Corpus Crawler (`crawl:all`):** Cào tự động tài liệu tri thức lịch sử từ Wikipedia/Wikisource phủ rộng qua **15 Thời Kỳ Lịch Sử Việt Nam** chuẩn hóa qua danh mục `master-corpus-catalog.ts`.
2. **Text Cleaning & Entity Normalization:** Bóc tách văn bản, làm sạch nhiễu OCR, chuẩn hóa từ ngữ Hán-Việt, ánh xạ địa danh qua các thời kỳ (`SAME_AS_LOCATION`) và khử nhập nhằng nhân vật (`ALIAS_OF`).
3. **Dual-Axis Epoch Assignment (1771–1777):** Tự động gán mảng `epoch_ids: ["EPOCH_09", "EPOCH_10"]` cho các sự kiện thuộc giai đoạn mốc giao thời Nam-Bắc Triều và Tây Sơn.
4. **Hierarchical Temporal Chunking:** Phân đoạn văn bản đa cấp (Parent 2000–3000 từ, Child 300–500 từ) đính kèm JSON Metadata chuẩn hóa.
5. **Dual-Branch Parallel Seeder & Concurrency Pool:** Tạo Dense Embedding BGE-M3 (1024d) + BM25 Sparse Index nạp vào PostgreSQL `document_chunks`, đồng thời trích xuất bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ thông qua hàng đợi xử lý song song ($N = \min(8, \max(2, \text{activeTargets})))$ kết hợp điều phối **Hierarchical 2-Level Interleaved Rotation** (`HybridInferenceDispatcher`), gom kết quả tất định trong Single Thread và nạp vào `entities` & `relationships`.
6. **Quarantine & Disambiguation Buffer:** Tự động cách ly các bộ ba nghi vấn (confidence < 0.85 hoặc quan hệ lơ lửng) vào `quarantine_triples`, và ghi nhận thực thể mới ngoài Master Ontology vào `unmapped_entities`.
7. **Re-Indexing & Audit Trail (`rag:re-resolve`):** Hợp giải nút thực thể trùng lặp và ghi nhật ký thay đổi append-only vào `entity_audit_logs`.
8. **Quality Diagnostics (`eval:diagnostic`):** Kiểm tra chất lượng phân đoạn, ánh xạ thực thể và phát hiện quan hệ bất thường trên kho văn bản thật.
9. **Fast Failover & Adaptive Timeouts:** Áp dụng timeout thích ứng 45s cho Local LLM và 35s cho Cloud API, cách ly 24h cho lỗi Quota/429 và 30s cho lỗi tạm thời/503/timeout, chuyển vùng tức thì mà không nghẽn pipeline.

---

## 🗄️ 2. Cấu Trúc 8 Bảng CSDL Chuẩn Hóa (Database Schema)

Module 0 quản lý và khởi tạo trực tiếp 8 bảng lưu trữ dữ liệu tri thức trên PostgreSQL:

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

---

## 🏗️ 3. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/data-ingestion/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index (db:init)
│   │   ├── crawl-corpus.ts            # CLI cào dữ liệu (--all, --epoch=EPOCH_XX, --topics)
│   │   ├── crawl-pdf-extracted.ts     # CLI xử lý corpus PDF đã trích xuất (crawl:pdf)
│   │   ├── extract-pdf-md.ts          # CLI chuyển đổi PDF scan sang Markdown (extract:pdf)
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (ingest:knowledge)
│   │   ├── ingest-diagnostic.ts       # CLI chẩn đoán chất lượng dữ liệu nạp (eval:diagnostic)
│   │   ├── quarantine-inspector.ts    # CLI kiểm toán & giải phóng vùng cách ly (db:audit-quarantine)
│   │   ├── re-resolve-cli.ts          # CLI hợp giải thực thể & ghi nhật ký entity_audit_logs
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/ (eval:seed)
│   │
│   ├── cache/                         # Checkpoint Disk Cache cho tiến trình trích xuất Triples
│   ├── crawler/                       # Master Corpus Catalog & Wiki/Web Scraper
│   ├── text/                          # OCR, Text Normalizer, Pure TS Historical NER Engine
│   ├── chunking/                      # Hierarchical Temporal Chunker & Metadata Enricher
│   ├── seeder/                        # Dual-Branch Vector/Graph Indexing Engine & DB Initializer
│   ├── diagnostics/                   # Diagnostic Types & Quality Analyzers
│   ├── pdf/                           # PDF Text Extractor (TCVN3, Zlib Stream)
│   ├── utils/                         # Text & Path Utilities (Frontmatter parser)
│   ├── triple-extractor.ts            # 2-Stage Triples Extractor (Stage 1 NER + Stage 2 LLM/Rule)
│   ├── ingest-pipeline.ts             # Orchestrator điều phối toàn trình Ingest Pipeline
│   ├── types.ts                       # Ingestion Data Types & Interfaces
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 0
│   ├── datasets/                      # Tập dữ liệu mẫu chuẩn (Disambiguation Benchmark)
│   ├── ner-runner.ts                  # Runner đánh giá Stage 1 Pure TS Historical NER (eval:ner)
│   ├── triples-runner.ts              # Runner đánh giá Stage 2 Triples Extractor (eval:triples)
│   ├── runner.ts                      # Master Benchmark Runner cho Mô-đun 0 (eval / eval:all)
│   ├── metrics.ts                     # Đo lường Disambiguation, Extraction, Chunk Quality
│   └── README.md                      # Tài liệu hướng dẫn đánh giá 2 Trụ Cột Thực Chiến
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 4. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi từ root monorepo hoặc trực tiếp trong package:

```bash
# 1. Khởi động hạ tầng CSDL PostgreSQL (pgvector HNSW) & Redis
pnpm stack:infra

# 2. Khởi tạo SQL Schema & xác nhận đủ 7 bảng trên PostgreSQL
pnpm db:init

# 3. Thu thập dữ liệu Lịch sử (Crawler Pipeline)
pnpm crawl:all                                  # Cào tự động TOÀN BỘ 15 Thời kỳ Lịch sử Việt Nam
pnpm crawl:corpus --epoch=EPOCH_05              # Hoặc cào riêng 1 Epoch cụ thể
pnpm extract:pdf                                # Trích xuất PDF scan sử liệu sang Markdown
pnpm crawl:pdf                                  # Nạp dữ liệu Markdown đã trích xuất từ PDF vào catalog

# 4. Nạp kho tri thức vào CSDL thật (Stage-by-Stage Dual-Branch Ingestion)
pnpm ingest:vector                              # Stage 1: Nạp Chunks & Vector Store (BGE-M3 1024d) + Fast NER
pnpm ingest:graph                               # Stage 2: Nạp Knowledge Graph Triples bằng LLM & Re-resolve
pnpm ingest:knowledge                           # Nạp trọn gói cả 2 Stage liên hoàn
pnpm ingest:knowledge --strict                  # Nạp với chế độ STRICT (kiểm soát chặt chẽ AI Gateway)
pnpm ingest:knowledge --offline                 # Nạp nhanh offline (Regex + Fallback, không cần LLM)
pnpm ingest:knowledge --force                   # Nạp mới từ đầu (xóa cache checkpoint & truncate DB)

# 5. Quy Trình Làm Sạch & Chuẩn Hóa Dữ Liệu Sau Ingestion (Post-Ingestion Data Governance)
# Sau khi chạy ingest:vector & ingest:graph, thực thi chuỗi lệnh sau để bảo vệ và hoàn thiện kho tri thức:
# Bước 0: Tạo Snapshot Sao Lưu Dự Phòng Theo Phiên Bản
pnpm db:backup --name post_ingest_v1            # Tạo snapshot nhị phân backups/post_ingest_v1.dump bảo vệ dữ liệu

# Bước 1: Sanitization & Health Check
pnpm db:clean                                   # Xóa self-loops, duplicate edges, dangling relations & tái lập unique index
pnpm db:health                                  # Audit sức khỏe CSDL (yêu cầu PERFECTLY STABLE & HEALTHY)

# Bước 2: Quarantine Triage & Promotion
pnpm db:audit-quarantine                        # Xem danh sách pending review trong quarantine buffer
pnpm db:audit-quarantine --accept-all-high-conf --threshold=0.85 # Thăng cấp quan hệ chất lượng cao (>= 0.85) vào Graph
pnpm db:audit-quarantine --purge-spurious       # Thanh lọc quan hệ rác, spurious edges & thực thể nhiễu

# Bước 3: Master Canonical Re-Resolution
pnpm rag:re-resolve                             # Ánh xạ entities về Canonical ID, ghi nhật ký entity_audit_logs

# (Tùy chọn) Phục hồi nếu xảy ra sự cố hỏng dữ liệu trong quá trình dọn dẹp:
# pnpm db:restore --file backups/post_ingest_v1.dump # Khôi phục từ file phiên bản v1
# pnpm db:restore                                    # Hoặc khôi phục nhanh từ snapshot mới nhất

# Bước 4: Quality Diagnostics & Benchmarking
pnpm eval:ingest:diagnostic                     # Chẩn đoán độ phủ, mật độ graph, unmapped entities
pnpm eval:ingest                                # Master Benchmark Module 0: Đo lường 4 KPI chất lượng

# 6. Đánh Giá & Benchmark Bổ Sung (Granular Evaluation Commands)
pnpm eval:ingest:vector                         # Đánh giá nhanh Stage 1 (Vector & Chunk Store vừa nạp trên DB thật)
pnpm eval:ingest:graph                          # Đánh giá Stage 2 (Knowledge Graph Triples, Connectivity, Quarantine)
pnpm --filter @chronoviet/data-ingestion eval:ner      # Benchmark Stage 1 Pure TS Historical NER (40 test cases)
pnpm --filter @chronoviet/data-ingestion eval:triples  # Benchmark Stage 2 Triples Extractor
pnpm eval --chain ingest-rag                    # Benchmark chuỗi E2E Ingest-RAG Chain (MRR, nDCG@5, Fact Precision)
```

### 📋 Bảng Tham Số & Cờ Tùy Chọn CLI (CLI Flags & Options):

#### 1. `ingest:knowledge` (Nạp kho tri thức):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--stage=vector` / `--stage=1` | Chỉ chạy Stage 1 (Chunking + Vector Embeddings + Fast NER) | `all` |
| `--stage=graph` / `--stage=2` | Chỉ chạy Stage 2 (LLM Triples Extraction + Graph Sync + Re-resolve) | `all` |
| `--stage=all` | Chạy trọn gói liên hoàn cả Stage 1 và Stage 2 | `all` |
| `--input=<path>` | Đường dẫn thư mục hoặc file tài liệu nguồn (`.txt`, `.md`, `.json`, `.pdf`) | `data/raw_corpus` |
| `--force` / `--fresh` / `--clean` | Chế độ nạp mới từ đầu: Xóa sạch cache checkpoint (`.cache/extraction_triples/`) và `TRUNCATE CASCADE` database | `false` |
| `--resume` / `--append` | Giữ nguyên chế độ tiếp tục (Resume), tái sử dụng kết quả trích xuất chunk đã có | `true` (Mặc định tự động bật Resume) |
| `--strict` | Bật chế độ Preflight nghiêm ngặt: dừng ngay nếu Postgres, Embedding Server hoặc LLM Gateway offline | `false` |
| `--regex-only` / `--regex` | Bỏ qua LLM trích xuất, chỉ sử dụng bộ từ điển quy tắc Regex | `false` |
| `--allow-fallback` / `--fallback` | Cho phép tự động fallback sang Regex nếu LLM Gateway bị timeout / offline | `false` |
| `--offline` / `--fast` | Chạy nhanh hoàn toàn offline (tương đương `--regex-only --allow-fallback`) | `false` |

#### 2. `crawl:corpus` (Thu thập dữ liệu lịch sử):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--all` / `--full` | Cào tự động toàn bộ 15 Thời kỳ Lịch sử Việt Nam từ catalog | `false` |
| `--epoch=EPOCH_XX` | Chỉ định thời kỳ cụ thể cần cào (ví dụ: `EPOCH_04`, `EPOCH_05`...) | - |
| `--topics="A,B"` | Danh sách chủ đề/từ khóa cách nhau bằng dấu phẩy | - |
| `--urls="url1,url2"`| Danh sách link Wikisource/Wikipedia cụ thể | - |
| `--output=<path>` | Thư mục lưu tệp văn bản thô sau khi cào | `data/raw_corpus` |
| `--min-words=<n>` | Số từ tối thiểu cho mỗi bài cào về | `150` |

#### 3. `eval:diagnostic` (Chẩn đoán chất lượng nạp):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--input=<path>` | Thư mục hoặc file văn bản cần chẩn đoán | `data/raw_corpus` |
| `--output=<path>` / `--out=<path>` | Đường dẫn file JSON kết quả | `packages/data-ingestion/eval/reports/ingest-diagnostic-report.json` |
| `--limit=<n>` | Giới hạn số lượng tài liệu phân tích | Toàn bộ |
| `--regex-only` / `--fast` | Chạy nhanh với bộ quy tắc từ điển Regex | `false` |
| `--allow-fallback` | Cho phép fallback Regex nếu LLM offline | `false` |
| `--offline` | Chạy hoàn toàn offline (Regex + Fallback) | `false` |
| `--strict` | Báo cáo chi tiết các trường hợp chạm ngưỡng chất lượng | `false` |

#### 4. `db:audit-quarantine` (Kiểm toán & Quản trị Vùng Cách Ly):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--threshold=<n>` | Ngưỡng độ tin cậy tối thiểu để thẩm định/thăng cấp quan hệ | `0.85` |
| `--accept-all-high-conf` | Tự động thăng cấp các bộ ba có `confidence >= threshold` và thực thể nguồn/đích hợp lệ vào bảng `relationships`, đổi trạng thái thành `APPROVED` và ghi nhật ký `entity_audit_logs` | `false` |
| `--purge-spurious` | Xóa bỏ các quan hệ tự trỏ (self-loops), các cạnh bị từ chối (`REJECTED`) hoặc độ tin cậy rác (< 0.25) trong `quarantine_triples`, và thực thể rác (`DISCARDED_AS_NOISE`) trong `unmapped_entities` | `false` |
| `--dry-run` | Chạy mô phỏng kiểm tra, xuất báo cáo danh sách cạnh/thực thể bị tác động mà không thay đổi CSDL | `false` |

#### 5. Quản trị, Sao Lưu & Kiểm toán CSDL Hệ thống:
| Lệnh CLI | Mô tả & Chức năng |
| :--- | :--- |
| `pnpm db:init` | Khởi tạo PostgreSQL schema với pgvector extension (1024d HNSW index, BM25 FTS tsvector index, entities aliases GIN index) và 8 bảng CSDL (`entities`, `relationships`, `document_chunks`, `entity_chunks`, `entity_audit_logs`, `orchestrator_checkpoints`, `quarantine_triples`, `unmapped_entities`) |
| `pnpm db:health` | Audit sức khỏe toàn diện CSDL: Đếm quan hệ, phát hiện self-loops, kiểm tra trùng lặp, phát hiện dangling references, kiểm tra độ phủ vector embeddings, xác minh 3 chỉ mục lõi (`idx_rel_unique`, `idx_chunks_embedding_hnsw`, `idx_chunks_fts`), và thống kê bộ đệm cách ly |
| `pnpm db:backup --name <version>` | Tạo snapshot CSDL có tên phiên bản cụ thể dưới dạng nhị phân (`.dump` qua `pg_dump -Fc`) lưu vào `backups/<version>.dump` và tự động cập nhật pointer `backups/db_latest.dump` |
| `pnpm db:restore --file <path>` | Khôi phục toàn diện CSDL từ file snapshot chỉ định (hoặc từ `db_latest.dump` nếu không truyền flag), tự động clean bảng và thực hiện kiểm định sức khỏe (`pnpm db:health`) |
| `pnpm db:clean` | Dọn dẹp bản ghi trùng lặp, xóa self-loops, thanh lọc quan hệ lơ lửng (dangling edges) trong giao dịch nguyên tử (`withTransaction`), tái lập unique index `idx_rel_unique` và ghi vết `entity_audit_logs` |

---

## 📊 5. Khả Năng Quan Sát & Đo Lường Hiệu Năng (Observability & Telemetry)

Module 0 được trang bị hệ thống Telemetry chuẩn hóa:
1. **Correlation ID Tracing:** Tự động sinh `correlationId` (hoặc truyền qua `IngestionOptions.correlationId`) gắn kết từ CLI qua Pipeline, Seeder, Crawler và từng worker trích xuất.
2. **RED Metrics & Stage Durations:** Thu thập chi tiết qua `IngestionMetricsCollector`:
   - `durations`: `chunkingMs`, `extractionMs`, `embeddingMs`, `dbInsertMs`, `totalDurationMs`.
   - `throughput`: `chunksPerSec`, `wordsPerSec`, `vectorsPerSec`.
   - `cacheStats`: `hits`, `misses`, `hitRate`.
   - `quarantineStats`: `totalQuarantined`, `reasons` (`LOW_CONFIDENCE`, `DANGLING_RELATION`).
3. **Sub-batched Vector Generation:** Chia nhỏ batch embedding thành các sub-batches cố định (64 chunks) kèm telemetry `embedding.batch_completed` giám sát tốc độ sinh vector ngăn ngừa quá tải VRAM / HTTP timeout.
4. **Detailed Cache Analytics:** Phương thức `extractionCache.getDetailedStats()` cung cấp thông tin dung lượng byte, số lượng mục và phân bố provider/model.

---

## 📄 6. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.


