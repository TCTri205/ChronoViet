# VLM Inspector Sub-Agent Evaluation Suite (`packages/vlm-inspector/eval/`)

## 📌 Overview
Bộ công cụ đánh giá dành riêng cho **VLM Inspector Sub-Agent** (Whitelisted License Filter + Dual-Layer Redis Cache + Local Unified Multimodal VLM `qwen3.5-9b-instruct-q4_k_m` / Gemini 3.6 Flash / Local CLIP ONNX Scorer). Nhận candidate pool từ **Research Agent** (`packages/agent-orchestrator/src/research/` — SerpAPI/Tavily/Brave/Wikimedia/Catalog provider chain, domain whitelist).

## 📊 Core Metrics & Targets (KPI)
- **Visual Noise Free Rate**: $> 95\%$ (Tỉ lệ loại bỏ watermark, logo, chữ đè).
- **Historical Context Match**: $> 90\%$ (Độ chính xác bối cảnh lịch sử trang phục, kiến trúc).
- **License Compliance Rate**: $100\%$ (Tuân thủ bản quyền Public Domain / CC0 / CC-BY).
- **Image Search Providers** (unit tests tại `packages/agent-orchestrator/src/__tests__/search-providers.test.ts`): domain whitelist đúng, license inference đúng, mapping từng provider (SerpAPI `images_results[].original`, Tavily `images[]`, Brave `results[].properties.url`).

## 📁 Directory Structure
```text
eval/
├── datasets/          # 200 ảnh mẫu lịch sử (100 đúng bối cảnh, 50 nhiễu, 50 bản quyền)
│   └── vlm_200_images.json
├── reports/           # Báo cáo kết quả kiểm định JSON & Markdown
│   ├── vlm-inspector-report.json
│   └── vlm-inspector-report.md
├── scripts/           # Scripts hỗ trợ chuẩn bị dữ liệu kiểm thử
├── __tests__/         # Metric Unit Tests
├── runner.ts          # Evaluator runner chính (Scoring & Quality Gate)
└── README.md          # Tài liệu hướng dẫn đánh giá này
```

---

## ⚡ Preflight Infrastructure & AI Models

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu **Local Unified VLM** (`qwen3.5-9b-instruct-q4_k_m` qua llama-server tại `LLM_BASE_URL` - Cổng `8092`) không hoạt động.

```bash
# 0. Khởi động Local VLM (Port 8092 - Qwen 3.5 9B) & Redis:
pnpm stack:infra
pnpm ai:llm
# hoặc kiểm tra trạng thái:
pnpm ai:status
```

## 🚀 How to Run Evaluation

```bash
# 1. Eval VLM Inspector (offline image scoring, candidate pool mock)
pnpm eval:vlm
# hoặc trong package:
pnpm --filter @chronoviet/vlm-inspector eval

# 2. Chạy Eval Metric Tests
pnpm --filter @chronoviet/vlm-inspector test:eval

# 3. Unit tests của VLM Inspector (License Filter, Clip Scorer, Quality Gate)
pnpm test:vlm
# hoặc trong package:
pnpm --filter @chronoviet/vlm-inspector test

# 4. Tắt AI sau khi hoàn tất:
pnpm ai:stop
```
