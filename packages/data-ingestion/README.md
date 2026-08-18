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
5. **Dual-Branch Seeder:** Tạo Dense Embedding BGE-M3 (1024d) + BM25 Sparse Index nạp vào PostgreSQL `document_chunks`, đồng thời trích xuất bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ nạp vào `entities` & `relationships`.
6. **Re-Indexing & Audit Trail (`rag:re-resolve`):** Hợp giải nút thực thể trùng lặp và ghi nhật ký thay đổi append-only vào `entity_audit_logs`.
7. **Quality Diagnostics (`eval:diagnostic`):** Kiểm tra chất lượng phân đoạn, ánh xạ thực thể và phát hiện quan hệ bất thường trên tập dữ liệu thực.

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/data-ingestion/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index
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
│   ├── datasets/                      # Tập dữ liệu mẫu chuẩn (Golden Datasets)
│   ├── runner.ts                      # Benchmark Runner cho Mô-đun 0 (KPI 1-4)
│   └── metrics.ts                     # Đo lường Disambiguation, Extraction, Chunk Quality
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi từ root monorepo:

```bash
# 1. Khởi động hạ tầng CSDL PostgreSQL (pgvector HNSW) & Redis
docker compose up -d postgres redis

# 2. Khởi tạo SQL Schema & chỉ mục HNSW vector trên PostgreSQL
pnpm --filter @chronoviet/data-ingestion db:init

# 3. Cào TỰ ĐỘNG TOÀN BỘ 15 Thời kỳ Lịch sử Việt Nam (Master Corpus Crawl)
pnpm crawl:all
# Hoặc cào riêng 1 Epoch:
pnpm --filter @chronoviet/data-ingestion crawl:corpus --epoch=EPOCH_05

# 4. Nạp kho tri thức vào CSDL thật (Text & Graph ETL với chế độ STRICT kiểm soát AI Gateway)
pnpm ingest:knowledge --strict
# Hoặc chỉ định thư mục nguồn:
pnpm --filter @chronoviet/data-ingestion ingest:knowledge --input=data/raw_corpus/ --strict

# 5. Hợp giải mâu thuẫn thực thể & ghi vết nhật ký audit log
pnpm --filter @chronoviet/data-ingestion rag:re-resolve

# 6. Chẩn đoán & kiểm tra chất lượng dữ liệu nạp thật (Chunks, Unmapped Entities, Quarantine Triples)
pnpm eval:ingest:diagnostic

# 7. Chạy bộ kiểm thử Benchmark đo lường KPI cục bộ Mô-đun 0 (In-memory Fast Check)
pnpm --filter @chronoviet/data-ingestion eval

# 8. Đánh giá chất lượng tri thức toàn diện trên CSDL thật (PostgreSQL + RAG Search Chain)
pnpm eval --chain ingest-rag
```

### 📋 Bảng Tham Số & Cờ Tùy Chọn CLI (CLI Flags & Options):

#### 1. `ingest:knowledge` (Nạp kho tri thức):
| Tham số / Flag | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `--input=<path>` | Đường dẫn thư mục hoặc file tài liệu nguồn (`.txt`, `.md`, `.json`, `.pdf`) | `data/raw_corpus` |
| `--strict` | Bật chế độ Preflight nghiêm ngặt: dừng ngay nếu Postgres, Embedding Server hoặc LLM Gateway offline | `false` |
| `--force` / `--clean` | Xóa sạch bảng (`TRUNCATE CASCADE`) trước khi nạp để đảm bảo tính tất định | `false` |
| `--regex-only` | Bỏ qua LLM trích xuất, chỉ sử dụng bộ từ điển quy tắc Regex | `false` |
| `--allow-fallback` | Cho phép tự động fallback sang Regex nếu LLM Gateway bị timeout / offline | `false` |

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
| `--limit=<n>` | Giới hạn số lượng tài liệu phân tích | Toàn bộ |
| `--regex-only` | Chạy nhanh với bộ quy tắc từ điển Regex | `false` |
| `--strict` | Báo cáo chi tiết các trường hợp chạm ngưỡng chất lượng | `false` |

---

## 📄 4. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.
