# Multi-Agent Orchestrator Evaluation Suite (`packages/agent-orchestrator/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Multi-Agent Orchestrator** (LangGraph.js State Machine + 5 Script Micro-Steps + Duration Reconciler + Alias Table Fact-Checker).

## 📊 Core Metrics & Targets (KPI)
- **State Machine Completion Rate**: $100\%$ (Quy trình 12 bước chạy mượt không kẹt loop).
- **Script Pacing Reconciliation Error**: $< 5\%$ (Sai lệch thời lượng tổng kịch bản vs audio VieNeu).
- **Fact-Checker Escalation Trigger Rate**: $100\%$ (Chặn tuyệt đối kịch bản chứa lỗi lịch sử).
- **Narrative Tone Consistency Score**: $> 9.0/10$ (Độ nhất quán văn phong giữa các Chapter).

## 📁 Directory Structure
```
eval/
├── README.md         # Tài liệu hướng dẫn này
├── test-cases/       # 20 kịch bản lịch sử phức tạp (video 3m đến 15m)
├── runner.ts         # Script đánh giá máy trạng thái & pacing reconciler
└── reports/          # Báo cáo kết quả đánh giá (JSON / Markdown)
```

## 🚀 How to Run Evaluation
```bash
# Từ thư mục gốc monorepo:
pnpm --filter @chronoviet/agent-orchestrator eval

# Hoặc chạy trực tiếp trong package:
cd packages/agent-orchestrator
pnpm eval
```
