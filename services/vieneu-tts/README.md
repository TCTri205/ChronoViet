# VieNeu TTS Microservice (Python FastAPI & ONNX)

Dịch vụ Tổng hợp Giọng đọc Tiếng Việt AI (Text-to-Speech) chuyên dụng cho hệ thống **ChronoViet**. Tích hợp mô hình thần kinh **VieNeu ONNX Engine / Piper ONNX** (24kHz PCM-16 / NeuCodec) kết hợp thuật toán tính toán mốc thời gian phụ đề (Word Timestamps Alignment) chính xác cho tiến trình dựng video tự động trong **Remotion**.

> 💡 **Lưu ý Kiến trúc:**
> - Toàn bộ Node.js Client Wrapper, Fallback Synthetic Audio Generator và hàm quy đổi timestamp sang Remotion frames nằm tập trung tại [`packages/infra/src/tts/`](../../packages/infra/src/tts/).
> - Thư mục này (`services/vieneu-tts`) chứa thuần túy **Python FastAPI Microservice** (cổng `8080`) và script benchmark Python [`eval/eval.py`](eval/eval.py).

---

## 🏗️ Kiến Trúc Tổng Thể

```mermaid
graph TD
    A[Remotion Render Engine / Agent Orchestrator] -->|VieNeuEngine Client| B["@chronoviet/infra/tts"]
    B -->|HTTP POST /api/v1/synthesize (port 8080)| C{Python TTS Service Online?}
    C -->|Có - HTTP 200| D[Python FastAPI - VieNeu ONNX Engine]
    C -->|Không / Timeout| E[SyntheticTTSFallbackEngine - Synthetic WAV Generator]
    D -->|24kHz WAV + Word Timestamps| F[Audio File & Remotion Captions]
    E -->|Synthetic Audio + Word Timestamps| F
```

1. **Primary Neural Engine (Python FastAPI)**: [`app.py`](app.py)
   - Tích hợp mô hình **Piper ONNX Vietnamese Voice** (`vi_VN-vivos-medium.onnx` + config) và **VieNeu-TTS ONNX** chuẩn **24 kHz (PCM 16-bit)** với cơ chế tự động tải model từ Hugging Face.
   - Thuật toán phân bổ timestamp từ ngữ linh hoạt theo số ký tự và khoảng dừng dấu câu (`.`, `,`, `?`, `!`, `;`, `:`).
   - Tích hợp access log filter loại bỏ log spam từ probe `/health`.
2. **Node.js Infrastructure Layer**: [`packages/infra/src/tts/`](../../packages/infra/src/tts/)
   - `VieNeuEngine`: Client gọi Python microservice qua HTTP, hỗ trợ failover sang `createSyntheticWavBuffer`.
   - `convertVieNeuTimestampsToCaptions`: Quy đổi word timestamps (ms) sang Remotion caption frames.
   - `calculateSceneDurationInFrames`: Tính tổng duration theo audio thực tế và padding.

---

## 📋 Data Contract & Zod Schemas (`@chronoviet/shared-spec`)

Tất cả dữ liệu đầu vào và đầu ra tuân thủ Zod Schema khai báo tại [`packages/shared-spec`](../../packages/shared-spec):

### Request Payload (`VieNeuTTSRequestSchema`)
```typescript
{
  text: string;                  // Nội dung câu cần đọc (bắt buộc)
  speakerId?: string;            // ID giọng đọc (mặc định: 'vi_historical_male_1')
  speedRatio?: number;           // Tốc độ đọc (mặc định: 1.0)
  sampleRate?: number;           // Tần số mẫu Hz (mặc định: 24000)
  paddingMs?: number;            // Thời gian lề âm thanh ms (mặc định: 300)
  fps?: number;                  // Khung hình/giây video Remotion (mặc định: 30)
}
```

### Response Payload (`VieNeuTTSResponseSchema`)
```typescript
{
  status: 'SUCCESS' | 'ERROR';
  audioUrl: string;                // Đường dẫn tĩnh tới file WAV (/static/audio/...)
  audioDurationMs: number;         // Tổng thời lượng âm thanh (ms)
  calculatedFramesAt30fps: number; // Số frames Remotion = ceil((audioDurationMs + paddingMs)/1000 * fps)
  wordTimestamps: Array<{          // Mốc thời gian từng từ cho Caption Karaoke
    word: string;
    startMs: number;
    endMs: number;
  }>;
  errorMsg?: string;               // Thông báo lỗi chi tiết (nếu status === 'ERROR')
  engineType?: string;             // Chế độ engine thực thi
}
```

---

## 🚀 Hướng Dẫn Khởi Chạy (Quickstart)

```bash
# Cách 1: Khởi chạy nhanh qua Unified AI CLI
pnpm ai:tts

# Cách 2: Khởi chạy qua Docker Compose
docker compose --profile tts up -d

# Kiểm tra trạng thái
pnpm ai:status
```

Service mở cổng `8080`, lưu cache file WAV tại `./media/audio-cache/` và cung cấp các endpoint:
- `GET /health` — Health check probe
- `POST /api/v1/synthesize` — Tổng hợp giọng đọc và sinh word timestamps
- `GET /static/audio/:filename` — Tải và stream file âm thanh WAV

---

## 🧪 Benchmark & Evaluation (`eval/eval.py`)

Chạy đánh giá độ trễ và khả năng sinh word timestamps bằng script Python:

```bash
pnpm eval:tts
# hoặc trực tiếp:
python3 services/vieneu-tts/eval/eval.py
```

