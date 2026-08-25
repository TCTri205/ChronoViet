# @chronoviet/render-worker — Background Job Worker & Render Pipeline

Tiến trình xử lý hàng đợi tác vụ nặng (Background Worker Cluster) của hệ thống **ChronoViet**. Chịu trách nhiệm tiêu thụ các tác vụ bất đồng bộ qua **BullMQ & Redis**, điều phối tổng hợp giọng nói VieNeu TTS, kiểm định tư liệu hình ảnh VLM và kết xuất video **Remotion MP4 1080p** với cơ chế cô lập tiến trình nghiêm ngặt (`CONCURRENCY=1`).

---

## 🏗️ 1. Kiến Trúc Hàng Đợi & Quản Lý Tác Vụ (Worker Cluster Architecture)

```
              ┌────────────────────────────────────────────────────────┐
              │                   Unified Redis DB                     │
              └───────────────┬────────────────┬───────────────────────┘
                              │                │
          ┌───────────────────┼────────────────┴───────────────────┐
          ▼                   ▼                                    ▼
┌───────────────────┐ ┌───────────────────┐              ┌───────────────────┐
│   tts-gen-queue   │ │ vlm-inspect-queue │              │ remotion-render-q │
└─────────┬─────────┘ └─────────┬─────────┘              └─────────┬─────────┘
          │                   │                                    │
          ▼                   ▼                                    ▼
  ┌───────────────┐   ┌───────────────┐                    ┌───────────────┐
  │  TTS Worker   │   │  VLM Worker   │                    │ Render Worker │
  │ (VieNeu ONNX) │   │ (Dual Scorer) │                    │(Remotion CLI) │
  └───────────────┘   └───────────────┘                    └───────┬───────┘
                                                                   │
                                                                   ▼
                                                       Redis PubSub Channel:
                                                    `project_events:${projectId}`
                                                                   │
                                                                   ▼
                                                          WebSocket Gateway
                                                           (apps/web Client)
```

---

## ⚙️ 2. Ba Hàng Đợi Xử Lý Chính (BullMQ Queues)

### 1. `tts-gen-queue` (TTS Worker):
- Tiêu thụ kịch bản từ Scriptwriting Pipeline, gọi `POST /api/v1/synthesize` tới dịch vụ **VieNeu TTS ONNX** (cổng 8080).
- Nhận file âm thanh `.wav` và tính toán mốc thời gian từ ngữ `wordTimestamps` cho phụ đề Karaoke.
- Tự động fallback sang `SyntheticTTSFallbackEngine` khi dịch vụ Python tạm thời gián đoạn.

### 2. `vlm-inspect-queue` (VLM Inspector Worker):
- Chấm điểm candidate pool do Research Agent cung cấp theo chiến lược **3+3 Candidates** (Local Unified VLM `qwen3.5-9b-instruct-q4_k_m` khi `EVAL_STRICT=true`; Google Gemini 3.6 Flash + Local CLIP fallback khi dev).
- Thẩm định giấy phép bản quyền Whitelisted (`CC0`, `Public Domain`, `CC-BY-4.0`).
- Tự động chuyển phân cảnh sang chế độ đồ họa thư pháp cổ (`PURE_CODE`) nếu điểm số VLM < 60.

### 3. `remotion-render-queue` (Remotion Render Worker):
- **Khóa Điều Phối Phân Tán (Distributed Render Mutex)**: Tự động gọi `ResourceSentinel.acquireRenderLock()` trước khi render để khóa tài nguyên và báo hiệu cho LLM Gateway offload tạm thời sang Cloud API, tự động giải phóng trong `finally`.
- **Tải trước tài nguyên (Asset Pre-download)**: Hàm `ensureProjectAssetsReady` tải toàn bộ ảnh và âm thanh từ xa về thư mục cục bộ `/media/projects/:id/assets/` trước khi gọi CLI render.
- **Cô Lập Tiến Trình (Process Isolation)**: Khởi chạy CLI `npx remotion render` với biến môi trường `RENDER_CONCURRENCY || CONCURRENCY || 1`, đảm bảo Chromium process được giải phóng 100% sau mỗi job render.
- **Phát Tiến Độ Real-time (PubSub Emitter)**: Đọc stdout của Remotion, trích xuất số frame/tiến độ và publish vào kênh Redis **`project_events:${projectId}`** (`RENDER_PROGRESS`, `RENDER_COMPLETED`, `RENDER_FAILED`).
- **Dọn dẹp tệp tạm**: Gọi `cleanProjectWorkspace(projectId, { cleanTempOnly: true })` giải phóng dung lượng đĩa.

---

## 📋 3. Hợp Đồng Sự Kiện Real-time (`RenderEventSchema`)

```typescript
// Sự kiện tiến trình kết xuất
export interface RenderProgressEvent {
  projectId: string;
  type: "RENDER_PROGRESS";
  status: "RENDERING";
  progressPercent: number;        // 0 - 100%
  currentFrame?: number;          // ví dụ: 650
  totalFrames?: number;            // ví dụ: 1000
  estimatedRemainingSec?: number;  // ví dụ: 15
  timestamp: string;
}

// Sự kiện hoàn tất kết xuất
export interface RenderCompletedEvent {
  projectId: string;
  type: "RENDER_COMPLETED";
  status: "COMPLETED";
  progressPercent: 100;
  outputPath: string;             // /media/projects/:id/output/video.mp4
  fileSizeBytes: number;
  durationMs: number;
  timestamp: string;
}
```

---

## 📁 4. Cấu Trúc Thư Mục

```text
apps/render-worker/
├── src/
│   ├── index.ts                       # Worker Cluster Bootstrap & BullMQ Setup
│   └── workers/
│       ├── tts-worker.ts              # VieNeu TTS Task Consumer
│       ├── vlm-worker.ts              # VLM Inspection Task Consumer
│       └── render-worker.ts           # Remotion MP4 Render & PubSub Emitter
├── eval/                              # Failover & Concurrency Evaluation Suite
│   ├── runner.ts                      # Worker Benchmark Runner
│   └── __tests__/                     # Failover Metric Tests
└── package.json
```

---

## 🚀 5. Lệnh Phát Triển & Vận Hành

```bash
# Khởi chạy Worker ở chế độ Development (Watch mode)
pnpm dev:worker
# hoặc trong app:
pnpm --filter @chronoviet/render-worker dev

# Kiểm tra TypeScript
pnpm typecheck:worker
# hoặc trong app:
pnpm --filter @chronoviet/render-worker typecheck

# Chạy Unit Tests
pnpm test:worker
# hoặc trong app:
pnpm --filter @chronoviet/render-worker test

# Chạy Eval Benchmark Suite
pnpm --filter @chronoviet/render-worker eval

# Build Production
pnpm --filter @chronoviet/render-worker build
```
