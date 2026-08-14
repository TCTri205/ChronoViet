# GIAO TIẾP HỆ THỐNG, MESSAGE QUEUES & TASK WORKERS
## (Communication Protocols, Message Broker & Task Queue Specification)

---

## 1. Phương Thức Giao Tiếp Giữa Các Dịch Vụ (Inter-Service Protocols)

Hệ thống kết hợp 3 phương thức giao tiếp tùy theo tính chất đồng bộ hay bất đồng bộ của tác vụ:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. RESTful API (HTTPS / JSON)                                                          │
│    - Client ➔ API Gateway ➔ User Service / Chatbot RAG / LangGraph.js Orchestrator (Node.js).│
│    - Orchestrator ➔ Gemini 2.5 Flash Cloud API (VLM Inspection Strategy 3+3 Candidates).│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. Server-Sent Events (SSE) / WebSockets                                               │
│    - SSE: Streaming câu trả lời từ RAG Chatbot real-time.                             │
│    - WebSocket: Push tiến độ render video (%) real-time từ Render Worker lên Frontend. │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. Asynchronous Message Broker (Redis BullMQ)                                          │
│    - Sử dụng cho các tác vụ nặng: Sinh Voiceover TTS (VieNeu), Remotion Rendering.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kiến Trúc Hàng Đợi Tác Vụ Nặng (Task Queue & Worker Pools)

Do quá trình tạo video bao gồm nhiều công đoạn xử lý tốn tài nguyên và thời gian (Long-Running Tasks), ChronoViet sử dụng **BullMQ (Node.js)** trên nền **Redis**.

### 2.1. Phân Loại Các Hàng Đợi (Queue Segmentation trên Unified Redis)

```
                            ┌───────────────────────────┐
                            │    Unified Redis (AOF)    │
                            └─────────────┬─────────────┘
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│   1. tts-gen-queue      │    │  2. vlm-inspect-queue   │    │  3. remotion-render-q  │
│ - Tác vụ: VieNeu ONNX   │    │ - Gemini 2.5 Flash API  │    │ - Remotion Local Render │
│ - Concurrency: 10 jobs  │    │ - Strategy 3+3 Candidates│    │ - Concurrency: 1 MAX    │
│ - Priority: High        │    │ - Priority: Medium      │    │ - Priority: Normal      │
└────────────┬────────────┘    └────────────┬────────────┘    └────────────┬────────────┘
             │                              │                              │
             ▼                              ▼                              ▼
  [TTS Worker Cluster]           [VLM Cloud Dispatcher]         [Render Worker Container]
```

### 2.2. Chi Tiết Các Queues:

1. **`tts-gen-queue` (Tạo Giọng Thuyết Minh VieNeu ONNX):**
   * *Nhiệm vụ:* Nhận kịch bản chữ từ Script Generation Pipeline, gọi mô hình **Self-Hosted VieNeu Neural TTS Engine** qua API `POST /api/v1/synthesize` để xuất file âm thanh `.wav` và mốc từ ngữ `wordTimestamps` cho từng scene.
   * *Priority:* Cao (Cần hoàn thành sớm để tính độ dài khung hình `durationInFrames` cho từng cảnh).
   * *Quy chuẩn Kỹ thuật:* Xem chi tiết tại [05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md](05_PRODUCTION_OPTIMIZATIONS_AND_VIENEU_TTS.md).

2. **`vlm-inspect-queue` (Thẩm Định Thị Giác, License Snapshot & Circuit Breaker):**
   * *Nhiệm vụ:* Đưa các đợt ảnh crawl qua Whitelisted License Filter (`Public Domain`, `CC0`, `CC-BY`), snapshot file ảnh + license metadata vào Host Volume `/media/license-snapshots/` và thực hiện chấm điểm qua **Gemini 2.5 Flash Cloud API** (kèm **Circuit Breaker** trip khi 3x HTTP 429 trong 5m ➔ auto failover sang **Local CLIP ONNX Scorer**).
   * *Caching:* Kiểm tra SHA-256 / pHash trong Unified Redis Cache (TTL 30 ngày). Nếu trùng ảnh cũ, trả về kết quả VLM Score trong 1ms mà không gọi API.
   * *Strategy 3+3 & Fallback Handling:* Thực hiện thẩm định theo chiến lược 3+3 Candidates. Nếu cả 6 ảnh < 60 điểm, tự động chuyển sang PURE_CODE Layout Rotation Engine.

3. **`remotion-render-queue` (Render Video MP4, Isolation & SSOT Verification):**
   * *Nhiệm vụ:* Nhận task từ Redis Queue mang `idempotency_key = md5(json_spec_v3)`, **query lại Postgres Checkpoint SSOT** để đảm bảo project chưa bị hủy, pre-download toàn bộ Audio (.wav) & Images về Host Volume `/media/raw-assets/`, chạy lệnh CLI `npx remotion render` với `CONCURRENCY=1` để xuất file `.mp4`.
   * *Process Isolation & Resource Limits:* Chromium process được giới hạn max 2.0 CPUs / 4GB RAM, giải phóng tuyệt đối process (`browser.close()`) và temp directory ngay sau từng render job.

---

## 3. Quản Lý Tiến Độ Real-time (Progress Tracking via WebSocket)

Người dùng cần biết video của mình đang ở công đoạn nào. Render Worker gửi event tiến độ liên tục:

```json
// Progress Payload phát qua WebSocket channel: `project_status:{project_id}`
{
  "projectId": "proj_1285_bach_dang",
  "status": "RENDERING",
  "step": "REMOTION_BUILD",
  "progressPercent": 68,
  "currentFrame": 450,
  "totalFrames": 1200,
  "estimatedTimeRemainingSeconds": 14,
  "timestamp": "2026-08-09T23:22:00Z"
}
```

---

## 4. Chiến Lược Thử Lại & Xử Lý Lỗi (Retry & Dead-Letter Queue - DLQ)

* **Exponential Backoff Retry:** Nếu API VieNeu TTS hoặc Gemini Flash bị rate-limit/timeout, worker tự động thử lại tối đa 3 lần với khoảng thời gian chờ tăng dần (2s, 4s, 8s).
* **Dead-Letter Queue (DLQ):** Nếu task rớt 3 lần liên tiếp, task sẽ được đẩy vào DLQ để kỹ sư kiểm tra log, đồng thời gửi thông báo lỗi cho người dùng kèm lý do cụ thể và hoàn lại token credit.

