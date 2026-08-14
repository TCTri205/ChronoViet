# 🧪 BỘ CÔNG CỤ ĐÁNH GIÁ TỔNG THỂ & CHUỖI TÍCH HỢP (CHRONOVIET GLOBAL EVALUATION FRAMEWORK)

Thư mục `eval/` tại root monorepo là **Trung tâm quản lý & Đánh giá toàn bộ hệ thống ChronoViet**. 
Thư mục này hỗ trợ 3 chế độ đánh giá linh hoạt từ cấp độ Mô-đun đơn (Module-Level Eval) đến Chuỗi mô-đun liên tiếp (Multi-Module Integration Chains) và Đánh giá toàn bộ dự án (Global Monorepo Benchmark), đi kèm **Vòng đời Dọn dẹp Tự động (Monorepo-wide Clean Lifecycle)** giữa các lần chạy.

---

## 🎯 Các Chế Độ Đánh Giá Hỗ Trợ (Supported Eval Modes)

1. **Chế độ Chuỗi Tích Hợp (Integration Chains - Multi-Module Pipeline):**
   - Đánh giá luồng dữ liệu tự động nối giữa các mô-đun liên tiếp (ví dụ: `VieNeu TTS` sinh âm thanh & mốc từ thực tế $\rightarrow$ đẩy trực tiếp sang `Remotion Render Engine` để ghép video & kiểm định Audio-Visual sync).
   - Script: [`eval/chains/vieneu-remotion.ts`](chains/vieneu-remotion.ts)

2. **Chế độ Mô-đun Đơn (Isolated Module Evaluation):**
   - Thực thi runner eval độc lập của một gói cụ thể trong `packages/*/eval` hoặc `services/*/eval`.
   - Ví dụ: `--module vieneu-tts` hoặc `--module remotion-engine`.

3. **Chế độ Toàn Hệ Thống (Global Master Evaluation):**
   - Chạy đồng loạt toàn bộ các bộ eval đơn lập và chuỗi tích hợp, tổng hợp báo cáo KPI kỹ thuật chung của toàn bộ Monorepo.
   - Thường sử dụng trong CI/CD pipeline hoặc trước khi release.

---

## 🧹 Vòng Đời Dọn Dẹp Giữa Các Lần Chạy (Clean Lifecycle)

Toàn bộ hệ thống Eval được trang bị công cụ dọn dẹp tập trung [`eval/utils/cleaner.ts`](utils/cleaner.ts) giúp:
- **Xóa file audio `.wav` rác cũ** trong các thư mục cache và public của Remotion Engine.
- **Purge các file báo cáo JSON/MD cũ** (giữ an toàn các file mã nguồn `.ts` và `README.md`).
- **Xóa file JSON kịch bản trung gian** (`pipeline_generated_video.json`).
- **Xóa cache Webpack/Remotion** (`node_modules/.cache/webpack`).
- **Giải phóng Port Remotion Studio** (port 9876).

---

## 🚀 Hướng Dẫn Chạy (Quick Commands)

```bash
# 1. Dọn dẹp toàn bộ file tạm, audio rác, báo cáo cũ & port treo
pnpm eval:clean

# 2. Chạy tất cả các bộ Eval & Chuỗi Tích hợp kèm dọn dẹp sạch sẽ (Master Global Fresh Eval)
pnpm eval:all --fresh

# 3. Chạy riêng Chuỗi Tích Hợp 2 Mô-đun (VieNeu TTS -> Remotion Engine)
pnpm eval:chain

# 4. Chạy trực tiếp runner với các tham số CLI:
npx tsx eval/runner.ts --clean               # Chỉ chạy dọn dẹp rồi thoát
npx tsx eval/runner.ts --all --fresh         # Dọn dẹp sạch trước khi eval toàn dự án
npx tsx eval/runner.ts --chain vieneu-remotion
npx tsx eval/runner.ts --module remotion-engine --fresh
npx tsx eval/runner.ts --module vieneu-tts --fresh
```

---

## 📁 Cấu Trúc Thư Mục `eval/`

```
eval/
├── README.md                 # Tài liệu hướng dẫn & quy chuẩn đánh giá hệ thống
├── runner.ts                 # Main Global Runner CLI (điều phối --all, --chain, --module, --clean, --fresh)
├── utils/
│   └── cleaner.ts            # Utility dọn dẹp tập trung (audio, reports, out, caches, ports)
├── chains/                   # Các script đánh giá chuỗi tích hợp mô-đun liên tiếp
│   └── vieneu-remotion.ts    # Chuỗi 2 mô-đun: VieNeu TTS -> Remotion Render Engine
├── datasets/                 # Bộ dữ liệu mẫu dùng chung giữa các mô-đun
└── reports/                  # Thư mục chứa báo cáo đánh giá tự động (JSON / Markdown)
```

---

## 📊 Ma Trận Đánh Giá KPI Tích Hợp Chuỗi (`vieneu-remotion`)

| Chỉ số (Metric) | Đơn vị | Tiêu chuẩn Đạt (Target KPI) | Ý nghĩa Kỹ thuật |
| :--- | :---: | :---: | :--- |
| **TTS Synthesis RTF** | Ratio | $< 0.30\times$ | Tốc độ sinh voice tổng hợp so với độ dài real-time |
| **Timestamp Alignment Error** | ms | $< 50\text{ ms}$ | Độ lệch giữa mốc từ phát ra và frame karaoke tương ứng |
| **Audio-Visual Sync Frame Delay**| Frame | $< 1\text{ frame (33ms)}$ | Khung hình chữ Karaoke sáng lên đúng nhịp âm thanh |
| **Remotion Still Render Time** | ms | $< 1500\text{ ms}$ | Thời gian chụp snapshot 1 frame giao diện |
| **Schema Integrity Pass** | % | $100\%$ | Dữ liệu sinh ra từ TTS hoàn toàn khớp Zod Schema Remotion |
