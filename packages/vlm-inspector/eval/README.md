# VLM Inspector Sub-Agent Evaluation Suite (`packages/vlm-inspector/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **VLM Inspector Sub-Agent** (Whitelisted License Filter + Dual-Layer Redis Cache + Gemini 2.5 Flash / Local CLIP ONNX Scorer).

## 📊 Core Metrics & Targets (KPI)
- **Visual Noise Free Rate**: $> 95\%$ (Tỉ lệ loại bỏ watermark, logo, chữ đè).
- **Historical Context Match**: $> 90\%$ (Độ chính xác bối cảnh lịch sử trang phục, kiến trúc).
- **License Compliance Rate**: $100\%$ (Tuân thủ bản quyền Public Domain / CC0 / CC-BY).

## 🚀 How to Run Evaluation
```bash
pnpm --filter @chronoviet/vlm-inspector eval
```
