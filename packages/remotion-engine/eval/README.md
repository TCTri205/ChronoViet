# Remotion Render Engine Evaluation Suite (`packages/remotion-engine/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Remotion Render Engine** (18 LayoutModes, 15 TransitionTypes, Data-Driven Render Pipeline).

## 📊 Core Metrics & Targets (KPI)
- **Audio-Visual Sync Delay**: $< 1$ frame ($33\text{ms}$) với Karaoke Captions.
- **Render Speed Index**: $< 45\text{s}$ cho 60s video Full HD 1080p.
- **Visual Regression Pass Rate**: $100\%$ (Không bị vỡ layout/tràn chữ ở bất kỳ LayoutMode nào).

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── test-cases/       # Kịch bản JSON v3.2 mẫu phủ 18 LayoutModes & 15 Transitions
├── runner.ts         # Script render thử nghiệm & chụp snapshot so sánh visual
└── reports/          # Báo cáo kết quả render & visual diff (JSON / Markdown)
```

## 🚀 How to Run Evaluation
```bash
# Từ thư mục gốc monorepo:
pnpm --filter @chronoviet/remotion-engine eval

# Hoặc chạy trực tiếp trong package:
cd packages/remotion-engine
pnpm eval
```
