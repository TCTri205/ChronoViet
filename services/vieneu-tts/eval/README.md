# VieNeu TTS Evaluation (`services/vieneu-tts/eval/`)

## 📌 Overview
Bộ đánh giá chất lượng cho **VieNeu TTS Microservice** (Python FastAPI ONNX Runtime Synthesis + Subtitle Word Timestamps Alignment). Nhằm bảo đảm chất lượng giọng đọc thuyết minh lịch sử Tiếng Việt, đo độ trễ xử lý, và kiểm tra tính đầy đủ của `wordTimestamps` / audio trả về từ endpoint hoạt động (thay vì file giả).

Benchmark được viết thuần **Python** tại [`eval.py`](eval.py) và chạy qua HTTP request tới `/api/v1/synthesize` — được điều phối bằng script `pnpm eval:tts` (hoặc chạy trực tiếp `python3 services/vieneu-tts/eval/eval.py`).

> **Kiến trúc v4.0:** Toàn bộ Node.js Client SDK (`VieNeuEngine`, `convertVieNeuTimestampsToCaptions`, `calculateSceneDurationInFrames`) đã được chuyển về `packages/infra/src/tts/` và export từ `@chronoviet/infra`. Thư mục `services/vieneu-tts` chỉ còn là microservice Python thuần túy.

---

## 📊 Core Metrics & Targets (KPI Benchmark)

1. **Real-Time Factor (RTF)**: $< 0.3\text{x}$ (Thời gian tổng hợp âm thanh / Thời lượng Audio thực tế trên CPU).
2. **Word Timestamp Alignment**: `wordTimestamps` phải trả về đầy đủ, không đảo mốc thời gian (`startMs > endMs` hoặc nén từ).
3. **Duration Frame Calculation**: $< 1.0$ frame ($33.3\text{ms}$ tại 30 FPS) khi áp dụng công thức:
   $$\text{calculatedFrames} = \left\lceil \frac{\text{audioDurationMs} + 300}{1000} \times 30 \right\rceil$$

---

## 📁 Directory Structure & File Map

```
eval/
├── README.md             # Tài liệu hướng dẫn này
├── eval.py               # Python Benchmark: gọi HTTP /synthesize, đo latency & timestamps
├── datasets/             # Bộ dữ liệu câu tiếng Việt lịch sử phục vụ benchmark
└── reports/              # Nơi lưu báo cáo kết quả đánh giá (JSON/Markdown)
```

---

## 🚀 How to Run Evaluation

### 1. Chạy Benchmark (từ Root Monorepo)
```bash
# Chạy qua script chuẩn hóa của monorepo
pnpm eval:tts

# Hoặc chạy trực tiếp script Python
python3 services/vieneu-tts/eval/eval.py
```

### 2. Cấu hình endpoint
Biến môi trường `VIENEU_TTS_API_URL` trỏ tới endpoint synthesize (mặc định `http://localhost:8080/api/v1/synthesize`):
```bash
VIENEU_TTS_API_URL=http://localhost:8080/api/v1/synthesize python3 services/vieneu-tts/eval/eval.py
```

### 3. Preflight bắt buộc (Eval Integrity)
Khi chạy eval, microservice Python ONNX phải đang hoạt động tại `VIENEU_PYTHON_URL` (endpoint `GET /health`). Nếu service offline, benchmark sẽ báo `SKIPPED` cho từng mẫu — **không dùng sine-wave giả** để lấy điểm pass.

---

## 📈 Engine Detection & Mode
* 🤖 **REAL_NEURAL_ONNX**: Kết nối Python FastAPI Microservice (`app.py`, 24kHz NeuCodec ONNX) — chế độ hợp lệ làm benchmark.
* ⚙️ **SYNTHETIC_FALLBACK_TONE**: Chỉ dùng trong dev khi `EVAL_STRICT=false` — Node.js fallback tại `@chronoviet/infra/src/tts/` sinh sine wave 480Hz (KHÔNG hợp lệ làm benchmark).