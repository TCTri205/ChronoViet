# VLM Inspector Sub-Agent Evaluation Suite (`packages/vlm-inspector/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **VLM Inspector Sub-Agent** (Gemini 2.5 Flash Cloud + Local CLIP ONNX Fallback + Whitelisted License Filter + Redis Dual Cache).

## 📊 Core Metrics & Targets (KPI)
- **Visual Noise Free Rate**: $> 95\%$ (Tỉ lệ loại bỏ ảnh watermark, nhiễu, hiện đại).
- **Historical Context Match**: $> 90\%$ (Tỉ lệ phù hợp bối cảnh lịch sử Việt Nam).
- **Whitelisted License Compliance**: $100\%$ (Chỉ cho phép ảnh CC0/PD/CC-BY/CC-BY-SA).
- **Gemini vs CLIP ONNX Agreement**: $> 85\%$ (Tỉ lệ tương đồng chấm điểm giữa Cloud và Local Fallback).

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── datasets/         # Bộ 200 ảnh test mẫu (Lịch sử, Nhiễu, Sai bản quyền)
├── test-cases/       # Giả lập Rate Limit 429 để kiểm thử Circuit Breaker
├── runner.ts         # Script chấm điểm tự động & kiểm định giấy phép
└── reports/          # Báo cáo kết quả đánh giá (JSON / Markdown)
```

## 🚀 How to Run Evaluation
```bash
# Từ thư mục gốc monorepo:
pnpm --filter @chronoviet/vlm-inspector eval

# Hoặc chạy trực tiếp trong package:
cd packages/vlm-inspector
pnpm eval
```
