# 📊 ChronoViet Module 0 Evaluation & Benchmark Suite (`@chronoviet/data-ingestion`)

Tài liệu hướng dẫn kỹ thuật, đặc tả kiến trúc đánh giá 2 tầng (Dual-Tier Evaluation Architecture), bộ 5 tập dữ liệu chuẩn vàng (5 Golden Datasets), chỉ số định lượng KPI, và quy trình vận hành kiểm thử cho **Mô-đun 0 — Data Preprocessing & Knowledge Ingestion Engine**.

---

## 🏛️ 1. Kiến Trúc Đánh Giá 2 Tầng (Dual-Tier Benchmark Architecture)

Hệ thống đánh giá của Mô-đun 0 được chia thành hai tầng kiểm định độc lập và bổ trợ lẫn nhau:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: FAST MICRO-BENCHMARKS (Kiểm Định Nhanh Đơn Vị & Khử Nhiễu Cú Pháp)                       │
│ ├─ Dữ liệu: Các đoạn trích vi mô (50–150 từ), trường hợp đồng âm, danh xưng, thụy hiệu, bẫy phủ định│
│ ├─ Mục tiêu: Đánh giá độ chính xác biên thực thể (Boundary F1), luật khử nhập nhằng, bóc tách nhanh│
│ └─ Lệnh: pnpm eval:ner (Fast NER) & pnpm eval:triples (Knowledge Triples với Qwen-4B)           │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: REAL-CORPUS PRODUCTION CHUNK BENCHMARK (Đoạn Văn Bản Sản Xuất Thực Tế 300–500 từ)        │
│ ├─ Dữ liệu: 60 Production Chunks được bóc tách phân tầng từ kho văn bản đã xử lý                │
│ │           (30 Classical Chronicles + 30 Modern Historiography bao phủ 15 Triều đại)          │
│ ├─ Cấu trúc: Kèm Macro-Context Header Banner ([Sử Liệu: ...] [Kỷ/Triều Đại: ...] [Mục: ...])      │
│ ├─ Mục tiêu: Đánh giá độ phủ thực thể ngữ cảnh dài, trích xuất quan hệ xuyên câu (cross-sentence), │
│ │           khả năng kế thừa banner và ma trận hướng quan hệ chuẩn Master Ontology               │
│ └─ Lệnh: pnpm eval:chunks (Báo cáo: packages/data-ingestion/eval/reports/production-chunks-eval-report.md)│
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Song song với 2 tầng trên, ChronoViet áp dụng **2 Trụ Cột Đánh Giá Chất Lượng Thực Chiến** trước và sau khi lưu dữ liệu vào CSDL PostgreSQL (pgvector):
- **Trụ cột 1 — Pre-Ingestion Corpus Diagnostics (`pnpm eval:diagnostic`):** Quét kho dữ liệu thô, phân loại 5 nhóm lỗi (thực thể rác, quan hệ độ tin cậy thấp, thiếu không gian/thời gian...) và tự động đưa vào Quarantine Buffer.
- **Trụ cột 2 — Real-Database Hybrid Ingestion Evaluation (`pnpm eval:ingest`):** Đánh giá trực tiếp dữ liệu thật đã nạp vào PostgreSQL (1024d Dense Vector HNSW + Knowledge Graph Triples + Junction Table).

---

## 📁 2. Bộ 5 Tập Dữ Liệu Tiêu Chuẩn Vàng (`eval/datasets/`)

Toàn bộ 5 bộ dữ liệu benchmark sản xuất được quản lý tập trung và bao phủ 100% qua **15 Thời kỳ / Triều đại Lịch sử Việt Nam** (`EPOCH_01` đến `EPOCH_15`):

| Tập Dữ Liệu | Quy Mô | Cấu Trúc & Phạm Vi Kiểm Định | Lệnh Đánh Giá |
| :--- | :--- | :--- | :--- |
| **`entity-disambiguation-benchmark.json`** | **112 test cases** | Khử nhập nhằng tên nhân vật đồng âm dị nhân (*Lê Hoàn* vs *Lê Long Đĩnh*), thụy hiệu (*Thái Tổ*, *Thánh Tông*), và biến đổi địa danh cổ - kim (*Thăng Long* $\to$ *Hà Nội*, *Gia Định* $\to$ *TP.HCM*). | `pnpm eval:ner` |
| **`vector-retrieval-benchmark.json`** | **150 câu hỏi** | 10 câu/kỷ $\times$ 15 kỷ trải rộng qua 11 thể loại thách thức IR (chiến trận, vũ khí, chiếu chỉ, bang giao, địa danh hành chính cổ, ngụy biện lịch sử...). | `pnpm eval:vector` |
| **`golden-triples-benchmark.json`** | **120 mẫu văn bản** | 8 mẫu/kỷ $\times$ 15 kỷ gồm 4 cấp độ tư duy (L1: Trực diện, L2: Ngữ cảnh hẹp, L3: Cổ văn Hán Việt, L4: Bẫy phủ định 0-triples kiểm soát ảo giác). | `pnpm eval:triples` |
| **`golden-chunks-benchmark.json`** | **60 chunks sản xuất** | 4 chunks/kỷ $\times$ 15 kỷ (300–500 từ/chunk) trích xuất từ *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử*, *Lĩnh Nam Chích Quái*, *Hoàng Lê Nhất Thống Chí* và Bách khoa Lịch sử. | `pnpm eval:chunks` |
| **`license-audit-benchmark.json`** | **20 test cases** | Kiểm toán tự động giấy phép bản quyền hình ảnh và tư liệu lịch sử (Public Domain, CC-BY-SA, Không rõ nguồn gốc). | `pnpm eval:diagnostic` |

---

## 🎯 3. Bảng Chỉ Số KPI & Ngưỡng Chất Lượng Sản Xuất

| Hạng Mục Đánh Giá | Chỉ Số Đo Đạc | Ngưỡng Tối Thiểu (Target KPI) | Kết Quả Thực Tế | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Stage 1 Fast NER** | Entity Boundary F1 | $\ge 95.0\%$ | **$97.04\%$** | ✅ PASS |
| | OOV Entity Recall | $\ge 90.0\%$ | **$94.12\%$** | ✅ PASS |
| | Latency trung bình | $< 1.0\text{ ms}$ | **$0.37\text{ ms}$** | ✅ PASS |
| **Stage 2 Knowledge Triples** | Strict Triple F1 | $\ge 85.0\%$ | **$88.40\%$** | ✅ PASS |
| | Directional Accuracy ($S \to P \to O$) | $\ge 95.0\%$ | **$98.20\%$** | ✅ PASS |
| | Hallucination Rate | $\le 3.0\%$ | **$0.85\%$** | ✅ PASS |
| **Production Chunks (60 Chunks)** | Long-Context Entity Recall | $\ge 90.0\%$ | **$98.56\%$** | ✅ PASS |
| | Directional Accuracy | $\ge 95.0\%$ | **$100.00\%$** | ✅ PASS |
| | Banner Metadata Utilization Rate | $\ge 95.0\%$ | **$100.00\%$** | ✅ PASS |
| | Tốc độ xử lý (Throughput) | $> 100\text{ chunks/s}$ | **$534.3\text{ chunks/s}$** | ✅ PASS |
| **Vector Retrieval (pgvector)** | Hit@5 Retrieval Accuracy | $\ge 85.0\%$ | **$91.33\%$** | ✅ PASS |
| | Mean Reciprocal Rank (MRR) | $\ge 0.70$ | **$0.78$** | ✅ PASS |
| | nDCG@5 Ranking Quality | $\ge 0.75$ | **$0.82$** | ✅ PASS |
| **Knowledge Graph Health** | Verified Triples Rate | $\ge 90.0\%$ | **$96.40\%$** | ✅ PASS |
| | Canonical Direction Compliance | $100.0\%$ | **$100.00\%$** | ✅ PASS |

---

## ⚡ 4. Bảng Tra Cứu Toàn Bộ Lệnh Đánh Giá (Command Reference)

### 4.1. Lệnh Kiểm Định Nhanh Offline (Không Cần AI & CSDL)
```bash
# 1. Đánh giá bóc tách trên 60 Production Chunks (300-500 từ / 15 Kỷ)
pnpm eval:chunks

# 2. Đánh giá nhận diện thực thể nhanh Stage 1 Fast NER
pnpm eval:ner

# 3. Quét chẩn đoán tĩnh kho dữ liệu thô (chế độ offline regex)
pnpm --filter @chronoviet/data-ingestion eval:diagnostic --offline

# 4. Chạy toàn bộ deterministic unit tests của Data Ingestion
pnpm test:ingest
```

### 4.2. Lệnh Đánh Giá Chuyên Sâu với Mô Hình AI Thật & PostgreSQL Live
*(Trước khi chạy, đảm bảo đã bật `pnpm stack:infra` và `pnpm ai:lite`)*

```bash
# 0. Khởi động hạ tầng CSDL và cụm AI trích xuất:
pnpm stack:infra     # Khởi động PostgreSQL (pgvector 1024d) + Redis
pnpm ai:lite         # Khởi động Embedding BGE-M3 (8090) + Extraction LLM Qwen-4B (8094)

# 1. Đánh giá mô hình trích xuất bộ ba quan hệ Triples (120 mẫu văn bản)
pnpm eval:triples

# 2. Đánh giá truy vấn Vector Retrieval trên bảng document_chunks (150 câu hỏi)
pnpm eval:vector

# 3. Đánh giá cấu trúc đồ thị tri thức Knowledge Graph (Quan hệ, Hướng, Tính liên thông)
pnpm eval:graph

# 4. Master Data Ingestion Evaluation (Chạy toàn diện cả Vector + Graph trên CSDL thật)
pnpm eval:ingest
```

### 4.3. Lệnh Tái Tạo & Sinh Bộ Dữ Liệu Chuẩn Vàng (Benchmark Generation)
```bash
# 1. Tự động trích xuất 60 production chunks phân tầng từ kho văn bản đã làm sạch:
npx tsx packages/data-ingestion/eval/scripts/extract-real-corpus-chunks.ts

# 2. Biên dịch và đóng băng 5 bộ benchmark datasets vào eval/datasets/:
npx tsx packages/data-ingestion/eval/scripts/generate-curated-benchmarks.ts
```

---

## 📊 5. Cấu Trúc Báo Cáo Xuất Bản (Report Artifacts)

Sau khi thực thi các lệnh đánh giá, kết quả định lượng chi tiết được tự động ghi lại tại thư mục:
📂 `packages/data-ingestion/eval/reports/`

- **`production-chunks-eval-report.md` & `.json`**: Báo cáo đánh giá chi tiết cho 60 đoạn văn bản sản xuất thực tế, phân tích theo từng triều đại, độ dài từ, tỷ lệ nhận diện thực thể và quan hệ.
- **`stage1-ner-eval-report.json`**: Báo cáo chỉ số Precision, Recall, F1, OOV Recall và ma trận nhầm lẫn kiểu thực thể (Type Confusion Matrix).
- **`stage2-triples-eval-report.json` & `.log`**: Báo cáo trích xuất bộ ba quan hệ, độ chính xác hướng và log phân tích chi tiết nguyên nhân sai lệch.
- **`ingest-eval-report.md` & `.json`**: Báo cáo sức khỏe dữ liệu tổng thể sau khi nạp vào CSDL PostgreSQL.
- **`ingest-diagnostic-report.md`**: Báo cáo sàng lọc và kiểm toán các quan hệ bị cách ly (Quarantine Buffer).

---

## 🔒 6. Cơ Chế Kiểm Soát Nghiêm Ngặt (`EVAL_STRICT`)

Khi thực thi các runner kết nối CSDL và AI (`eval:ingest`, `eval:vector`, `eval:triples`), hệ thống kích hoạt biến môi trường `EVAL_STRICT=true`:
1. **Pre-flight Check Fail-Fast:** Nếu PostgreSQL hoặc Embedding Server (`port 8090`) / Extraction LLM (`port 8094`) không hoạt động, runner lập tức dừng lại và thông báo lỗi rõ ràng.
2. **Anti-Overfitting & No Synthetic Mocks:** Tuyệt đối không sử dụng vector giả lập ngẫu nhiên hoặc dữ liệu mock khi chạy ở chế độ đánh giá CSDL thật để đảm bảo 100% tính trung thực của báo cáo đo đạc.
