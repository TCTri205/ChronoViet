# @chronoviet/web — Web Application, API & Realtime Gateway

Ứng dụng Web chính (App Monolith) của nền tảng **ChronoViet**. Kết hợp giao diện người dùng **NotebookLM Heritage Workspace** (Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui) và Tầng điều phối Backend (RESTful API, Server-Sent Events SSE, WebSocket Gateway kết nối Redis PubSub, BullMQ Job Producer).

---

## 🏛️ 1. Triết Lý & Không Gian Làm Việc (Workspace Experience)

ChronoViet kết hợp chiều sâu học thuật của **Google NotebookLM** với sức mạnh tự động hóa của **Xưởng Phim AI Tự Động (1-Click Video Generator)**:

1. **Khung Tra Cứu Sử Liệu (Chrono-RAG Chat Hub)**:
   - Truy vấn sử liệu chính thống (*Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*) qua GraphRAG.
   - Stream câu trả lời theo thời gian thực kèm các trích dẫn tương tác `[1]`, `[2]` mở **Cuộn Thư Sử Liệu Gốc (Parchment Sheet)**.
   - Nút **"⚡ Tạo Video từ chủ đề này"** tự động chuyển giao dữ liệu sang Xưởng phim.
2. **Xưởng Phim Tự Động 1-Click (Autonomous Video Studio)**:
   - Người dùng chỉ cần nhập chủ đề, chọn Thời lượng (`1p`, `3p★`, `5p`) và Tỷ lệ (`16:9`, `9:16`).
   - **Zero Manual Intervention**: Không cần kéo thả timeline, không sửa frame thủ công.
   - **Live Agent Stepper (6 Giai đoạn $\leftrightarrow$ 12 Node LangGraph)**: Theo dõi tiến độ GraphRAG, Kịch bản, Thẩm định lịch sử, Thu âm VieNeu, Kiểm định bản quyền VLM, và Render Remotion.
   - **Render Progress Bar**: Cập nhật % và frame counter `tabular-nums` realtime qua WebSocket `/ws/projects/:id`.
3. **Trình Chiếu Rạp Hát & Kê Khai Bản Quyền (Floating Theater Dock)**:
   - Trượt mở êm dịu khi video kết xuất hoàn tất (1080p MP4).
   - Phụ đề **Karaoke Subtitles** phát sáng vàng hoàng kim (`--gold-imperial-300`) đồng bộ chính xác từng mili-giây (`wordTimestamps`).
   - Khai báo bắt buộc `playsInline` / `webkit-playsinline` chống chiếm quyền trên iOS Safari.
   - Bảng kê khai bản quyền minh bạch tư liệu cổ (`CC0`, `Public Domain`, `CC-BY-4.0`).

---

## 🎨 2. Hệ Thống Design Tokens (Heritage Dark Theme)

Toàn bộ giao diện áp dụng bảng màu Di Sản Sơn Mài & Hoàng Kim:

| CSS Token | Giá trị Hex / HSL | Mục đích |
| :--- | :--- | :--- |
| `--bg-lacquer-deep` | `#08090B` | Nền canvas sơn mài đen sâu (kèm vi hạt `bg-lacquer-grain`) |
| `--bg-lacquer-surface` | `#111418` | Nền thẻ, panel, chat hub, studio |
| `--bg-lacquer-elevated` | `#1A1F26` | Nền popover, modal, input hover |
| `--gold-imperial-500` | `#D4AF37` | Màu chủ đạo: Nút CTA 1-Click, key icon, focus ring |
| `--gold-imperial-300` | `#F3E5AB` | Tiêu đề di sản quan trọng, Karaoke highlight |
| `--border-bronze-subtle` | `rgba(212, 175, 55, 0.12)` | Đường viền mảnh đồng hun hairline |
| `--vermilion-accent` | `#C0392B` | Điểm xuyết son đỏ: Triện ấn, cảnh báo, lỗi |
| `--emerald-jade` | `#1B4D3E` | Trạng thái hoàn tất thành công |

**Typography Chuẩn Việt**:
- Display & Tiêu đề: `Playfair Display` (Serif di sản, uy nghiêm)
- Giao diện & Nội dung: `Be Vietnam Pro` (Sans-serif chuẩn dấu tiếng Việt)
- Metadata & Bộ đếm: `JetBrains Mono` (`tabular-nums` chống rung màn hình)

---

## 🔌 3. Kiến Trúc Backend API & Realtime Gateway

```
Client (Browser)
   │
   ├── [POST] /api/v1/chat ───────────► Chrono-RAG Engine (Stream tokens & Citations)
   ├── [POST] /api/v1/projects ───────► LangGraph Orchestrator (12 Node State Machine)
   ├── [GET]  /api/v1/projects/:id ────► Load Project Schema v4.1 & Metadata
   ├── [GET]  /api/v1/projects/:id/stream ──► SSE Stream (12 Node status events)
   ├── [POST] /api/v1/projects/:id/render ──► BullMQ Producer (queue.add -> remotion-render-queue)
   ├── [GET]  /api/v1/projects/:id/video ───► HTTP Range Stream (video.mp4)
   └── [WS]   /ws/projects/:id ◄────── Redis PubSub Gateway (project_events:${projectId})
```

---

## 📁 4. Cấu Trúc Thư Mục

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── globals.css                # Heritage Dark Theme, Noise Overlay & shadcn variables
│   │   ├── layout.tsx                 # Root Layout, Next Google Fonts, Toaster
│   │   ├── page.tsx                   # Master Workspace (Resizable Split, Tabs, Floating Dock)
│   │   └── api/v1/                    # RESTful & SSE API Endpoints
│   │       ├── chat/route.ts          # RAG Chat Stream
│   │       └── projects/              # Projects CRUD, Stream, Render & Video endpoints
│   ├── components/
│   │   ├── ui/                        # shadcn/ui Primitives (button, card, dialog, sheet...)
│   │   ├── layout/                    # Header (Multi-Node Health), Sidebar (Project History)
│   │   ├── chat/                      # ChatContainer, ChatMessage, CitationBadge, SourceModal
│   │   ├── video/                     # VideoGeneratorPanel, LiveAgentStepper, RenderProgressBar
│   │   └── player/                    # VideoPlayer, KaraokeSubtitles, AttributionDrawer
│   ├── lib/
│   │   ├── queues.ts                  # BullMQ Producer (remotion-render-queue)
│   │   ├── redis.ts                   # IORedis Client instance
│   │   └── utils.ts                   # cn tailwind helper
│   ├── server/
│   │   └── ws-gateway.ts              # WebSocket Gateway listening to Redis PubSub
│   ├── server.ts                      # Custom HTTP/WS Next.js Server Entry
│   └── __tests__/                     # Unit & E2E Integration Tests (Vitest)
├── eval/                              # Module Evaluation Suite
│   ├── runner.ts                      # Web Latency & Throughput Benchmark Runner
│   └── __tests__/                     # Eval Metric Tests
└── package.json
```

---

## 🚀 5. Lệnh Phát Triển & Kiểm Thử

```bash
# Chạy Dev Server (Next.js + Custom WS Server)
pnpm --filter @chronoviet/web dev

# Kiểm tra TypeScript (0 lỗi)
pnpm --filter @chronoviet/web typecheck

# Chạy Unit & Integration Tests (18 tests)
pnpm --filter @chronoviet/web test

# Chạy Eval Metric Tests
pnpm --filter @chronoviet/web test:eval

# Chạy Web Eval Benchmark Runner
pnpm --filter @chronoviet/web eval

# Build Production
pnpm --filter @chronoviet/web build
```
