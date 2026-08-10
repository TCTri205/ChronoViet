# Chrono-RAG Engine Evaluation Suite (`packages/rag-engine/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Chrono-RAG Engine** (Hybrid GraphRAG với PostgreSQL `pgvector` + Relational Graph CTEs + BGE Reranker v2).

## 📊 Core Metrics & Targets (KPI)
- **Fact Precision Score**: $> 99.2\%$ (Tỉ lệ dữ kiện lịch sử chính xác).
- **Hallucination Rate**: $< 0.8\%$ (Tỉ lệ câu trả lời bịa đặt/ảo giác).
- **Citation Traceability**: $100\%$ (Khả năng truy xuất nguồn tài liệu trích dẫn).

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── datasets/         # ChronoEval-1000 dataset (QA ground truth lịch sử)
├── test-cases/       # Edge cases (các mốc lịch sử nhạy cảm, tên nhân vật cổ)
├── runner.ts         # Script thực thi benchmark đánh giá
└── reports/          # Báo cáo kết quả đánh giá (JSON / Markdown)
```

## 🚀 How to Run Evaluation
```bash
# Từ thư mục gốc monorepo:
pnpm --filter @chronoviet/rag-engine eval

# Hoặc chạy trực tiếp trong package:
cd packages/rag-engine
pnpm eval
```
