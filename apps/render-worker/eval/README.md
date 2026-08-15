# Render Worker Application Evaluation Suite (`apps/render-worker/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Render Worker App** (BullMQ Task Queue + Chromium Isolation + Resource Management).

## 📊 Core Metrics & Targets (KPI)
- **Max RAM Peak per Render Job**: $< 3.8\text{ GB}$.
- **Worker Process Memory Leak**: $0\text{ MB}$ leak sau khi dọn dẹp browser instance.
- **Job Failover Recovery Rate**: $100\%$ khi worker bị ngắt đột ngột.

## 🚀 How to Run Evaluation
```bash
pnpm --filter @chronoviet/render-worker eval
```

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu **VieNeu Python ONNX TTS** (`VIENEU_PYTHON_URL`) không hoạt động — `processTTSJob` không được fallback sang word-timing heuristic hay synthetic WAV. Dev-mode: `EVAL_STRICT=false`.
