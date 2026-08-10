# Render Worker Evaluation Suite (`apps/render-worker/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Render Worker & BullMQ Queue Infrastructure** (Job Concurrency, Puppeteer Memory Leak Audit, Task Queue Stability).

## 📊 Core Metrics & Targets (KPI)
- **Max RAM Peak per Render Job**: $< 3.8\text{ GB}$.
- **Worker Memory Leak**: $0\text{ MB}$ rò rỉ bộ nhớ sau 100 jobs render liên tục.
- **BullMQ Failover Recovery Rate**: $100\%$ (Khôi phục thành công job nếu worker bị ngắt đột ngột).

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── stress-test.ts    # Script giả lập 50 jobs render đồng thời vào BullMQ Queue
└── reports/          # Báo cáo theo dõi RAM / CPU / Failover (JSON / Markdown)
```

## 🚀 How to Run Evaluation
```bash
# Từ thư mục gốc monorepo:
pnpm --filter @chronoviet/render-worker eval

# Hoặc chạy trực tiếp trong app:
cd apps/render-worker
pnpm eval
```
