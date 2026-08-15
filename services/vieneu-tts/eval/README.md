# VieNeu TTS Engine Evaluation Suite (`services/vieneu-tts/eval/`)

## 📌 Overview
Bộ công cụ đánh giá chuyên biệt dành cho **VieNeu TTS Service** (NeuCodec ONNX Runtime Synthesis + Subtitle Word Timestamps Alignment). Đảm bảo chất lượng giọng đọc thuyết minh lịch sử Tiếng Việt, tốc độ xử lý âm thanh thực tế, và độ chính xác tuyệt đối khi quy đổi mốc từ sang khung hình phụ đề Remotion Karaoke.

---

## 📊 Core Metrics & Targets (KPI Benchmark)

1. **Real-Time Factor (RTF)**: $< 0.3\text{x}$ (Thời gian tổng hợp âm thanh / Thời lượng Audio thực tế trên CPU).
2. **Word Timestamp Alignment Error**: $< 50\text{ms}$ (Không có hiện tượng đảo mốc thời gian `startMs > endMs` hoặc nén từ).
3. **Duration Frame Calculation Error**: $< 1.0$ frame ($33.3\text{ms}$ tại 30 FPS) khi áp dụng công thức:
   $$\text{calculatedFrames} = \left\lceil \frac{\text{audioDurationMs} + 300}{1000} \times 30 \right\rceil$$

---

## 📁 Directory Structure & File Map

```
eval/
├── README.md                           # Tài liệu hướng dẫn này
├── runner.ts                           # Main Eval Runner đo lường RTF, alignment & frame error (hỗ trợ --fresh, --clean)
├── datasets/
│   ├── historical_50_sentences.json    # Dataset 50 câu văn bản lịch sử tiếng Việt phức tạp
│   └── remotion_script_sentences.json  # Dataset câu thoại trích xuất từ kịch bản Remotion thực tế
├── scripts/
│   └── extract_remotion_dataset.ts     # Tool trích xuất dataset từ file testcases kịch bản JSON
└── reports/
    ├── report_generator.ts             # Module tổng hợp báo cáo & xuất định dạng JSON/Markdown
    ├── report.json                     # Kết quả báo cáo chi tiết dạng JSON
    └── report.md                       # Báo cáo đánh giá tổng quan dạng GFM Markdown
```

---

## 🚀 How to Run Evaluation & Extract Datasets

### 1. Chạy Evaluation Suite (từ Root Monorepo)
```bash
# Thực thi qua pnpm workspace filter:
pnpm --filter @chronoviet/vieneu-tts eval

# Chạy với chế độ làm sạch báo cáo & audio rác trước khi eval:
pnpm --filter @chronoviet/vieneu-tts eval -- --fresh
```

### 2. Chạy với ngưỡng RTF tùy chỉnh qua biến môi trường
```bash
EVAL_MAX_RTF=0.4 pnpm --filter @chronoviet/vieneu-tts eval
```

### 3. Trích xuất Dataset kịch bản Remotion mới
```bash
npx tsx services/vieneu-tts/eval/scripts/extract_remotion_dataset.ts
```

---

## 📈 Engine Detection & Dual-Layer Mode
Khi thực thi `runner.ts`, bộ đánh giá tự động nhận diện chế độ engine đang hoạt động:
* 🤖 **REAL_NEURAL_ONNX**: Kết nối trực tiếp Python FastAPI Microservice (`app.py`, 24kHz NeuCodec ONNX).
* ⚙️ **SYNTHETIC_FALLBACK_TONE**: Chỉ xuất hiện khi `EVAL_STRICT=false` (dev) — microservice Python chưa bật, dùng Sine Wave Generator.

> ⚠️ **Preflight bắt buộc (Eval Integrity):** Khi `EVAL_STRICT=true` (mặc định), eval fail-fast nếu **VieNeu Python ONNX service** (`VIENEU_PYTHON_URL`, endpoint `GET /health`) không hoạt động — không dùng sine-wave giả. Report JSON ghi rõ `preflight` + `engineType`. Dev-mode: `EVAL_STRICT=false` (KHÔNG hợp lệ làm benchmark).
