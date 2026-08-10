# VieNeu TTS Engine Evaluation Suite (`services/vieneu-tts/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **VieNeu TTS Service** (ONNX Runtime Synthesis + Subtitle Word Timestamps Alignment).

## 📊 Core Metrics & Targets (KPI)
- **Real-Time Factor (RTF)**: $< 0.3\text{x}$ (Tốc độ sinh âm thanh trên CPU).
- **Word Timestamp Alignment Error**: $< 50\text{ms}$ (Sai số giữa mốc từ phụ đề Karaoke và âm thanh).
- **Duration Frame Calculation Error**: $< 1$ frame ($33\text{ms}$) tại 30 FPS.

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── datasets/         # 50 câu test văn bản lịch sử tiếng Việt phức tạp
├── runner.ts         # Script đo lường RTF & timestamp alignment
└── reports/          # Báo cáo kết quả đánh giá (JSON / Markdown)
```

## 🚀 How to Run Evaluation (Chạy từ Root Monorepo)
```bash
# Thực thi từ root monorepo:
pnpm --filter @chronoviet/vieneu-tts eval
```
