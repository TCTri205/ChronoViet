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

## 🗄️ 2. Cấu Trúc 7 Bảng CSDL Chuẩn Hóa (Database Schema)

Module 0 quản lý và khởi tạo trực tiếp 7 bảng lưu trữ dữ liệu tri thức trên PostgreSQL:

| Bảng CSDL | Loại Dữ Liệu | Mục Đích Lưu Trữ |
| :--- | :--- | :--- |
| `document_chunks` | Chunks & Dense Vector (1024d) | Lưu trữ các đoạn văn bản phân cấp (Parent/Child), embedding HNSW, và FTS tsvector |
| `entities` | Knowledge Graph Nodes | Lưu trữ thực thể lịch sử đã chuẩn hóa, danh xưng canonical, và danh sách bí danh (aliases) |
| `relationships` | Knowledge Graph Edges | Lưu trữ quan hệ thực thể $(S \rightarrow P \rightarrow O)$ có độ tin cậy $\ge 0.85$ |
| `entity_chunks` | Junction Table | Bảng liên kết chéo $N - N$ giữa thực thể và các văn bản chunk chứa thực thể |
| `entity_audit_logs` | Audit Trail | Ghi nhật ký thay đổi append-only khi hợp giải, sáp nhập hoặc cập nhật thực thể |
| `quarantine_triples` | Quarantine Buffer | Lưu trữ tạm các bộ ba quan hệ nghi vấn (confidence < 0.85, dangling context) chờ rà soát |
| `unmapped_entities` | Triage Buffer | Lưu trữ các thực thể mới xuất hiện trong văn bản chưa có trong Master Ontology |

---

## 🏗️ 3. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/data-ingestion/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index (db:init)
│   │   ├── crawl-corpus.ts            # CLI cào dữ liệu (--all, --epoch=EPOCH_XX, --topics)
│   │   ├── crawl-pdf-extracted.ts     # CLI xử lý corpus PDF đã trích xuất
│   │   ├── extract-pdf-md.ts          # CLI chuyển đổi PDF sang Markdown
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (Text ETL)
│   │   ├── ingest-diagnostic.ts       # CLI chẩn đoán chất lượng dữ liệu nạp
│   │   ├── re-resolve-cli.ts          # CLI hợp giải thực thể & ghi nhật ký entity_audit_logs
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/
│   │
│   ├── crawler/                       # Master Corpus Catalog & Wiki/Web Scraper
│   ├── text/                          # OCR, Text Normalizer, Historical Entity Mapper
│   ├── chunking/                      # Hierarchical Chunker & Metadata Enricher
│   ├── seeder/                        # Dual-Branch Vector/Graph Indexing Engine & DB Initializer
│   ├── diagnostics/                   # Diagnostic Types & Quality Analyzers
│   ├── pdf/                           # PDF Text Extractor (TCVN3, Zlib Stream)
│   ├── utils/                         # Text & Path Utilities (Frontmatter parser)
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 0
│   ├── datasets/                      # Tập dữ liệu mẫu chuẩn (Disambiguation Benchmark)
│   ├── runner.ts                      # Benchmark Runner cho Mô-đun 0 (KPI 1-4)
│   ├── metrics.ts                     # Đo lường Disambiguation, Extraction, Chunk Quality
│   └── README.md                      # Tài liệu hướng dẫn đánh giá 2 Trụ Cột Thực Chiến
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 4. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi từ root monorepo:

```bash
# 1. Khởi động hạ tầng CSDL PostgreSQL (pgvector HNSW) & Redis
docker compose up -d postgres redis

# 2. Khởi tạo SQL Schema & xác nhận đủ 7 bảng trên PostgreSQL
pnpm --filter @chronoviet/data-ingestion db:init

# 3. Cào TỰ ĐỘNG TOÀN BỘ 15 Thời kỳ Lịch sử Việt Nam (Master Corpus Crawl)
pnpm crawl:all
# Hoặc cào riêng 1 Epoch:
pnpm --filter @chronoviet/data-ingestion crawl:corpus --epoch=EPOCH_05

# 4. Nạp kho tri thức vào CSDL thật (Text & Graph ETL với chế độ STRICT kiểm soát AI Gateway)
pnpm ingest:knowledge --strict
# Hoặc nạp nhanh offline / regex:
pnpm --filter @chronoviet/data-ingestion ingest:knowledge --offline

# 5. Hợp giải mâu thuẫn thực thể & ghi vết nhật ký audit log
pnpm --filter @chronoviet/data-ingestion rag:re-resolve

# 6. Chẩn đoán chất lượng dữ liệu kho văn bản thật (Trụ Cột 1)
pnpm eval:ingest:diagnostic

# 7. Chạy bộ kiểm thử Benchmark đo lường 4 KPI cục bộ Mô-đun 0 (In-memory Fast Check)
pnpm --filter @chronoviet/data-ingestion eval

# 8. Đánh giá chất lượng tri thức toàn diện trên CSDL thật (Trụ Cột 2 - E2E RAG Search Chain)
pnpm eval --chain ingest-rag
```

### 📋 Bảng Tham Số & Cờ Tùy Chọn CLI (CLI Flags & Options):

#### 1. `ingest:knowledge` (Nạp kho tri thức):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
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

---

## 📄 5. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.

