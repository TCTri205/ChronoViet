# Multi-Agent Orchestrator Evaluation Suite (`packages/agent-orchestrator/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Multi-Agent Orchestrator** (LangGraph.js State Machine + Postgres Checkpointer + 5 Script Micro-Steps + Research Agent Micro-Step 1C).

## 📊 Core Metrics & Targets (KPI)
- **State Machine Completion Rate**: $100\%$ (Không bị kẹt loop qua 12 trạng thái).
- **Script Pacing Reconciliation Error**: $< 5\%$ (Sai lệch thời lượng kịch bản vs target).
- **Fact-Checker Escalation Trigger Rate**: $100\%$ (Phát hiện và vỡ mốc sai sử liệu).
- **Research Agent (eval:research)**:
  - **License Compliance Rate** $= 100\%$ (mọi candidate thuộc whitelist: `PUBLIC_DOMAIN`/`CC0`/`CC_BY_4_0`/`CC_BY_SA_4_0`).
  - **Topics Resolved** $= 100\%$ (mọi chủ đề golden đều có $\ge 1$ candidate).
  - Ghi **provenance** (provider nào trả candidate, số lượng, latency).

## 🚀 How to Run Evaluation
```bash
# Eval tổng thể orchestrator
pnpm --filter @chronoviet/agent-orchestrator eval

# Eval riêng Research Agent (image candidate resolution)
pnpm --filter @chronoviet/agent-orchestrator eval:research
```

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu LLM server (`LLM_BASE_URL`) hoặc embedding server (`EMBEDDING_API_URL`) không hoạt động; Postgres phải khả dụng cho RAG (`ChronoRagEngine.search`). Không dùng Agnes cloud, pseudo-random vector, văn mẫu deterministic hay offline context. Dev-mode: `EVAL_STRICT=false` (KHÔNG hợp lệ làm benchmark).
>
> ℹ️ **Research eval** (`eval:research`) KHÔNG yêu cầu key online bắt buộc: khi thiếu `SERPAPI_API_KEY`/`TAVILY_API_KEY`/`BRAVE_API_KEY`, chain tự fallback sang Wikimedia + curated catalog và báo rõ trong report (provenance).
