# `@chronoviet/data-ingestion`

> **ChronoViet Data Preprocessing & Ingestion Engine (Mô-đun 0)**  
> Gói mã nguồn chịu trách nhiệm cào tự động 15 thời kỳ lịch sử, làm sạch văn bản & khử nhập nhằng thực thể, phân đoạn văn bản đa cấp (Hierarchical Temporal Chunking), nạp dữ liệu tri thức song song (Dual-Branch Vector/Graph Seeder) và xử lý tài nguyên đa phương tiện (Media/Audio ETL). Tuân thủ 100% Quy chuẩn [KNOWLEDGE_DATA_GOVERNANCE_SPEC.md](../../docs/KNOWLEDGE_DATA_GOVERNANCE_SPEC.md) v1.5.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/data-ingestion` đóng vai trò là Lớp Nạp Dữ Liệu Offline của hệ thống ChronoViet:

1. **Master Corpus Crawler (`crawl:all`):** Cào tự động 100% tài liệu tri thức lịch sử từ Wikipedia/Wikisource phủ rộng qua **15 Thời Kỳ Lịch Sử Việt Nam** chuẩn hóa qua danh mục `master-corpus-catalog.ts`.
2. **Text Cleaning & Entity Normalization:** Bóc tách văn bản, làm sạch nhiễu OCR, chuẩn hóa từ ngữ Hán-Việt, ánh xạ địa danh qua các thời kỳ (`SAME_AS_LOCATION`) và khử nhập nhằng nhân vật (`ALIAS_OF`).
3. **Dual-Axis Epoch Assignment (1771–1777):** Tự động gán mảng `epoch_ids: ["EPOCH_09", "EPOCH_10"]` cho các sự kiện thuộc giai đoạn mốc giao thời Nam-Bắc Triều và Tây Sơn.
4. **Hierarchical Temporal Chunking:** Phân đoạn văn bản đa cấp (Child 300–500 từ) đính kèm JSON Metadata chuẩn hóa.
5. **Dual-Branch Seeder:** Tạo Dense Embedding BGE-M3 (1024d) + BM25 Sparse Index nạp vào PostgreSQL `document_chunks`, đồng thời trích xuất bộ ba $(Entity \rightarrow Relationship \rightarrow Entity)$ nạp vào `entities` & `relationships`.
6. **Re-Indexing & Audit Trail (`rag:re-resolve`):** Hợp giải nút thực thể trùng lặp và ghi nhật ký thay đổi append-only vào `entity_audit_logs`.
7. **Media ETL & License Audit:** Lọc chất lượng ảnh ($\ge 600 \times 600\text{ px}$), kiểm định bản quyền Whitelisted License lưu vào `/media/raw-assets/`. Chuẩn hóa âm lượng EBU R128 (-14 LUFS BGM, -6 LUFS Peak SFX).

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/data-ingestion/
├── src/
│   ├── cli/                           # Bộ lệnh CLI Seeders & Khởi tạo
│   │   ├── init-db.ts                 # CLI khởi tạo SQL Schema & HNSW index
│   │   ├── crawl-corpus.ts            # CLI cào dữ liệu (--all, --epoch=EPOCH_XX, --topics)
│   │   ├── ingest-knowledge.ts        # CLI nạp & làm sạch văn bản lịch sử (Text ETL)
│   │   ├── re-resolve-cli.ts          # CLI hợp giải thực thể & ghi nhật ký entity_audit_logs
│   │   ├── setup-assets.ts            # CLI kiểm định & nạp media assets (Media ETL)
│   │   └── seed-eval.ts               # CLI nạp 5 tập Golden Datasets vào eval/
│   │
│   ├── crawler/                       # Master Corpus Catalog & Wiki/Web Scraper
│   ├── text/                          # OCR, Text Normalizer, Historical Entity Mapper
│   ├── chunking/                      # Hierarchical Chunker & Metadata Enricher
│   ├── seeder/                        # Dual-Branch Vector/Graph Indexing Engine & DB Initializer
│   ├── media/                         # Visual Asset Ingestor & Audio Asset Ingestor (LUFS)
│   ├── pdf/                           # PDF Text Extractor
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 0
│   ├── datasets/                      # Tập dữ liệu mẫu chuẩn (Golden Datasets)
│   ├── runner.ts                      # Benchmark Runner cho Mô-đun 0 (KPI 1-3)
│   └── metrics.ts                     # Đo lường Disambiguation Accuracy, License Audit Compliance
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

Tất cả các lệnh có thể thực thi từ root monorepo:

```bash
# 1. Khởi tạo SQL Schema & chỉ mục HNSW vector trên PostgreSQL
pnpm --filter @chronoviet/data-ingestion db:init

# 2. Cào TỰ ĐỘNG TOÀN BỘ 15 Thời kỳ Lịch sử Việt Nam (Master Corpus Crawl)
pnpm crawl:all

# Hoặc cào riêng 1 Epoch:
pnpm --filter @chronoviet/data-ingestion crawl:corpus --epoch=EPOCH_05

# 3. Chạy đường ống làm sạch & nạp kho tri thức văn bản (Text Ingestion ETL)
pnpm --filter @chronoviet/data-ingestion ingest:knowledge --input=data/raw_corpus/

# 4. Hợp giải mâu thuẫn thực thể & ghi vết nhật ký audit log
pnpm --filter @chronoviet/data-ingestion rag:re-resolve

# 5. Chạy đường ống nạp & kiểm định bản quyền tài nguyên media (Media ETL)
pnpm setup-assets

# 6. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 0 (Data Ingestion)
pnpm --filter @chronoviet/data-ingestion eval
```

---

## 📄 4. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.
