# ChronoViet - Remotion Evaluation & Render Engine (`@chronoviet/remotion-engine`)

Mô-đun Remotion Render Engine thuần túy (**Pure Render Engine**) thuộc hệ sinh thái **ChronoViet**. Nhiệm vụ chính của mô-đun là tiếp nhận dữ liệu kịch bản chuẩn hóa dạng JSON (từ RAG & Multi-Agent Orchestrator) và render thành các video ngắn/dài (Shorts/Reels 9:16, YouTube 16:9, Post 1:1) chất lượng cao với cấu trúc phân đoạn chuyên nghiệp.

Engine tuân thủ nguyên tắc **100% Data-Driven**, không hardcode kịch bản hay business logic của RAG/Agent trong component code. Mọi thông tin (phân cảnh, hiệu ứng, transition, typography, audio) được nạp trực tiếp qua JSON Schema v3.0 / v3.2.

> [!NOTE]
> **Về tài nguyên tĩnh & Mock Assets:**
> * Trong môi trường vận hành thực tế (Production Video Pipeline), toàn bộ hình ảnh và audio được truyền dưới dạng URL hoặc đường dẫn tuyệt đối trực tiếp từ RAG/Agent/Worker trong JSON payload.
> * Các file trong thư mục `eval/public/assets` và `eval/scripts/` **chỉ phục vụ riêng cho bộ công cụ đánh giá `eval/` và xem trước giao diện Remotion Studio (`pnpm start`)**, hoàn toàn độc lập với luồng render thực tế. Cấu hình vị trí asset được khai báo chuẩn trong `remotion.config.ts`.

---

## 🏗️ Cấu trúc Thư mục

```text
packages/remotion-engine/
├── eval/                  # Thư mục Đánh giá Độc lập (Evaluation Suite & Mock Assets)
│   ├── README.md          # Tài liệu hướng dẫn đánh giá
│   ├── runner.ts          # Evaluator runner script (hỗ trợ CLI parameters)
│   ├── test-cases/        # Scenario test cases JSON v3.2
│   ├── public/            # Mock Static Assets cho Studio Preview & Eval (`eval/public/assets`)
│   ├── scripts/           # Scripts tải & tạo mock assets (WAV audio, images) cho eval
│   ├── reports/           # Báo cáo JSON & Markdown kết quả kiểm định tự động
│   └── out/               # Kết quả render thực tế khi dùng `--render-stills`
├── src/                   # Mã nguồn Pure Render Engine
│   ├── cli.ts             # Bộ CLI chính cho remotion-engine (render, still, inspect, eval)
│   ├── components/        # Thư viện Component chuyên biệt theo chuẩn ChronoViet
│   │   ├── SlideImage.tsx     # Ken Burns + Blur Background & Sepia filter
│   │   ├── QuoteSlide.tsx     # Thẻ trích dẫn câu nói / thơ (Quote Card)
│   │   ├── ChapterTitle.tsx   # Thẻ phân đoạn chương (Chapter Subdivision Title Card)
│   │   ├── OutroSlide.tsx     # Đoạn kết trích thơ + End Card Like/Share/Subscribe ChronoViet
│   │   ├── StatCard.tsx       # Thẻ chỉ số nhân vật/trận đánh (Stat Card)
│   │   ├── VersusCard.tsx     # Thẻ so sánh tương quan lực lượng (Versus Card)
│   │   ├── BulletHighlight.tsx# Thẻ diễn biến điểm nhấn (Bullet Highlight)
│   │   ├── MuseumTag.tsx      # Thẻ tư liệu bảo tàng (Museum Tag)
│   │   ├── SplitTheory.tsx    # Thẻ phân tích giả thuyết (Split Theory)
│   │   └── SponsorSlide.tsx   # Thẻ giới thiệu chuyên mục (Sponsor Slide)
│   ├── constants/         # Cấu hình màu sắc thương hiệu ChronoViet & kích thước canvas
│   ├── types/             # TypeScript interfaces & Zod schemas cho Timeline & Compositions
│   ├── data/              # Dữ liệu kịch bản JSON mẫu cho Studio Preview
│   ├── utils/             # Hàm toán học Ken Burns, responsive layout & theme presets
│   ├── compositions/      # Composition React Components Remotion (ChronoVideo.tsx)
│   ├── Root.tsx           # Remotion Root & Composition Registrations (ChronoVideo)
│   └── index.ts           # Package entry point
├── remotion.config.ts     # Cấu hình Remotion Public Directory trỏ tới ./eval/public
├── package.json
└── tsconfig.json
```

---

## 🎬 ChronoViet Video Template Architecture

Template được thiết kế theo cấu trúc phân đoạn chuyên nghiệp, tự động thích ứng theo `layoutMode` trong JSON:

1. **Intro / Hook mở đầu (`ARTICLE_UI`):** Mô phỏng giao diện bài viết chuyên sâu trên cổng thông tin ChronoViet (`chronoviet.org`) cùng Logo Animation CV + Sound effect thương hiệu.
2. **Xử lý Ảnh Không Đồng Nhất (`BLUR_BG` & `HISTORICAL_FRAME`):** Lớp nền phóng to mờ (`blur(28px)` + `brightness(0.32)`), lớp foreground ở tâm giữ tỉ lệ gốc có viền rõ nét & filter sepia cổ kính.
3. **Phân đoạn theo Chương (`CHAPTER_CARD`):** Thẻ tiêu đề chương lớn, tạo điểm dừng thị giác mượt mà.
4. **Thẻ Trích Dẫn (`QUOTE_CANVAS`):** Nền tối sầm, chữ in hoa đậm Serif căn giữa màu vàng/trắng nổi bật.
5. **Thẻ Chỉ Số & Tương Quan (`STAT_CARD`, `VERSUS_CARD`):** Hiển thị quân số, năm, thành tựu hoặc so sánh hai lực lượng.
6. **Thẻ Điểm Nhấn & Bảo Tàng (`BULLET_HIGHLIGHT`, `MUSEUM_TAG`, `SPLIT_THEORY`):** Phân tích tư liệu, hiện vật và giả thuyết lịch sử.
7. **Outro / End Card (`OUTRO_CARD`):** Trích đoạn thơ lắng đọng chuyển tiếp sang End Card ChronoViet kêu gọi Like/Share/Subscribe.

---

## 🛠️ Hướng dẫn Sử dụng CLI (`remotion-engine`)

Package cung cấp công cụ CLI linh hoạt nhận tham số đầu vào/đầu ra và vị trí thư mục (Tất cả lệnh bên dưới đều thực thi từ **Root Monorepo**):

### Cú pháp Lệnh CLI (Chạy tại Root Monorepo)

```bash
# Render MP4 video từ file JSON kịch bản
pnpm --filter @chronoviet/remotion-engine cli render -i <input.json> [-o <output.mp4>] [-c <composition>]

# Render ảnh tĩnh snapshot (Still frame PNG)
pnpm --filter @chronoviet/remotion-engine cli still -i <input.json> [-o <output.png>] [-f <frame_number>]

# Kiểm tra hợp lệ JSON Schema (Schema Inspector)
pnpm --filter @chronoviet/remotion-engine cli inspect -i <input.json>

# Chạy Evaluation Suite (đánh giá tự động & mở Remotion Studio GUI)
pnpm --filter @chronoviet/remotion-engine eval [-t <testCasesDir>] [-o <outDir>] [-r <reportsDir>]
```

### Các Tham Số CLI:

| Tham số | Viết tắt | Ý nghĩa | Mặc định |
| :--- | :--- | :--- | :--- |
| `--input` | `-i` | Đường dẫn file JSON kịch bản đầu vào (Required) | - |
| `--output` | `-o` | Đường dẫn file đầu ra (MP4 hoặc PNG) | `./out/<name>.[mp4\|png]` |
| `--outDir` | `-d` | Thư mục đầu ra nếu `--output` là tương đối | `./out` |
| `--composition` | `-c` | Remotion Composition ID | `ChronoVideo` |
| `--frame` | `-f` | Khung hình để chụp ảnh snapshot `still` | `45` |
| `--no-overwrite` | - | Không ghi đè file đầu ra đã tồn tại | `false` |
| `--verbose` | `-v` | In log chi tiết quá trình render | `false` |

---

## 📊 Evaluation Suite (`eval/`)

Thư mục [`eval/`](file:///D:/Persional_Projects/ChronoViet/packages/remotion-engine/eval) cung cấp bộ công cụ tự động kiểm định 18 LayoutModes và 15 Transitions, đồng thời mở Remotion Studio cho Human trực tiếp đánh giá (Tất cả lệnh chạy tại **Root Monorepo**):

```bash
# Chạy suite đánh giá tự động -> Tự động mở Remotion Studio GUI (giữ eval/out sạch 100%)
pnpm --filter @chronoviet/remotion-engine eval

# Chạy đánh giá ở chế độ headless trong CI/CD (tắt mở Studio GUI)
pnpm --filter @chronoviet/remotion-engine eval -- --no-studio
```

---

## 🚀 Lệnh Thường Dùng Cho Developer (Chạy tại Root Monorepo)

```bash
# Kiểm tra TypeScript trên toàn monorepo (0 lỗi)
pnpm typecheck

# Xem trực quan giao diện (Remotion Studio GUI)
pnpm remotion:studio

# Setup mock assets cho Remotion Engine
pnpm --filter @chronoviet/remotion-engine setup-assets
```
