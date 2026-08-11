# Multi-Agent Orchestrator Evaluation Suite (`packages/agent-orchestrator/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Multi-Agent Orchestrator** (LangGraph.js State Machine + Postgres Checkpointer + 5 Script Micro-Steps).

## 📊 Core Metrics & Targets (KPI)
- **State Machine Completion Rate**: $100\%$ (Không bị kẹt loop qua 12 trạng thái).
- **Script Pacing Reconciliation Error**: $< 5\%$ (Sai lệch thời lượng kịch bản vs target).
- **Fact-Checker Escalation Trigger Rate**: $100\%$ (Phát hiện và vỡ mốc sai sử liệu).

## 🚀 How to Run Evaluation
```bash
pnpm --filter @chronoviet/agent-orchestrator eval
```
