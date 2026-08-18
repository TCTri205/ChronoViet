# Web Application Evaluation Suite (`apps/web/eval/`)

## 📌 Overview
Bộ công cụ đánh giá chuyên biệt dành cho **Web Application & Realtime Gateway** (`@chronoviet/web`), đo lường độ trễ REST API, thông lượng sự kiện WebSocket Realtime qua Redis PubSub và tính hợp lệ giao diện UI/UX NotebookLM Heritage Workspace.

## 📊 Core Metrics & Targets (KPI)
- **API Response Latency**: $< 50\text{ ms}$ (Endpoints `/api/v1/projects`, `/api/v1/chat`).
- **WebSocket Throughput**: $> 100\text{ events/sec}$ (Event streaming qua Redis PubSub).
- **UI Render Integrity Score**: $100\%$ (Khớp design tokens và không lỗi hydration).

## 🚀 How to Run Evaluation
```bash
# 1. Chạy Benchmark Runner Web App
pnpm --filter @chronoviet/web eval

# 2. Chạy Eval Metric Tests (Vitest trên thư mục eval/)
pnpm --filter @chronoviet/web test:eval

# 3. Chạy Unit & Integration Tests (Vitest trên thư mục src/)
pnpm --filter @chronoviet/web test
```

Báo cáo chi tiết được ghi tự động vào `apps/web/eval/reports/web-eval-report.json`.
