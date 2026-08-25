# Render Worker Application Evaluation Suite (`apps/render-worker/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **Render Worker App** (BullMQ Task Queue + Chromium Isolation + Resource Management).

## 📊 Core Metrics & Targets (KPI)
- **Max RAM Peak per Render Job**: $< 3.8\text{ GB}$.
- **Worker Process Memory Leak**: $0\text{ MB}$ leak sau khi dọn dẹp browser instance.
- **Job Failover Recovery Rate**: $100\%$ khi worker bị ngắt đột ngột.

## ⚡ Preflight Infrastructure & AI Models

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu **VieNeu Python ONNX TTS** (`VIENEU_PYTHON_URL`) không hoạt động.

```bash
# 0. Khởi động hạ tầng Redis BullMQ & TTS Microservice:
pnpm stack:infra
pnpm ai:tts
```

## 🚀 How to Run Evaluation

```bash
# 1. Chạy Benchmark Runner Render Worker
pnpm --filter @chronoviet/render-worker eval

# 2. Chạy Unit Tests
pnpm test:worker
# hoặc trong app:
pnpm --filter @chronoviet/render-worker test

# 3. Kiểm tra TypeScript
pnpm typecheck:worker

# 4. Dừng AI sau khi hoàn tất:
pnpm ai:stop
```
