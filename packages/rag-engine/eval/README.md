# Chrono-RAG Engine Evaluation Suite (`packages/rag-engine/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Chrono-RAG Engine** (GraphRAG PostgreSQL + `pgvector` Dense Embedding + CTE Relational Graph Search + `bge-reranker-v2-m3`).

## 📊 Core Metrics & Targets (KPI)
- **Fact Precision Score**: $> 99.2\%$ (Độ chính xác dữ kiện lịch sử từ SGK & Sử liệu chuẩn).
- **Hallucination Rate**: $< 0.8\%$ (Tỉ lệ ảo giác/bị đặt câu trả lời).
- **Citation Traceability**: $100\%$ (Khả năng truy xuất nguồn gốc đoạn trích văn bản).

## 🚀 How to Run Evaluation
```bash
pnpm --filter @chronoviet/rag-engine eval
```
