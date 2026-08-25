# ChronoViet - Remotion Evaluation & Render Engine (`@chronoviet/remotion-engine`)

Mô-đun Remotion Render Engine thuần túy (**Pure Render Engine**) thuộc hệ sinh thái **ChronoViet**. Nhiệm vụ chính của mô-đun là tiếp nhận dữ liệu kịch bản chuẩn hóa dạng JSON (từ RAG & Multi-Agent Orchestrator) và render thành các video ngắn/dài (Shorts/Reels 9:16, YouTube 16:9, Post 1:1) chất lượng cao với cấu trúc phân đoạn chuyên nghiệp.

Engine tuân thủ nguyên tắc **100% Data-Driven**, không hardcode kịch bản hay business logic của RAG/Agent trong component code. Mọi thông tin (phân cảnh, hiệu ứng, transition, typography, audio) được nạp trực tiếp qua JSON Schema v4.1.

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
│   ├── test-cases/        # Scenario test cases JSON v4.1
│   ├── public/            # Mock Static Assets cho Studio Preview & Eval (`eval/public/assets`)
│   ├── scripts/           # Scripts tải & tạo mock assets (WAV audio, images) cho eval
│   ├── reports/           # Báo cáo JSON & Markdown kết quả kiểm định tự động
│   └── out/               # Kết quả render thực tế khi dùng `--render-stills`
├── src/                   # Mã nguồn Pure Render Engine
│   ├── cli.ts             # Bộ CLI chính cho remotion-engine (render, still, inspect, eval)
│   ├── components/        # Thư viện Component chuyên biệt theo chuẩn ChronoViet
│   │   ├── SlideImage.tsx     # Ken Burns + Blur Background & 4 chuyên biệt (Archive, Grid, 3D, Pure)
│   │   ├── QuoteSlide.tsx     # Thẻ trích dẫn câu nói / thơ (Quote Card)
│   │   ├── ChapterTitle.tsx   # Thẻ phân đoạn chương (Chapter Subdivision Title Card)
│   │   ├── OutroSlide.tsx     # Đoạn kết trích thơ + End Card Like/Share/Subscribe ChronoViet
│   │   ├── StatCard.tsx       # Thẻ chỉ số nhân vật/trận đánh (Stat Card)
│   │   ├── VersusCard.tsx     # Thẻ so sánh tương quan lực lượng (Versus Card)
│   │   ├── BulletHighlight.tsx# Thẻ diễn biến điểm nhấn (Bullet Highlight)
│   │   ├── MuseumTag.tsx      # Thẻ tư liệu bảo tàng (Museum Tag)
│   │   ├── SplitTheory.tsx    # Thẻ phân tích giả thuyết (Split Theory)
│   │   ├── SponsorSlide.tsx   # Thẻ giới thiệu chuyên mục (Sponsor Slide)
│   │   ├── ChronoIntro.tsx    # Giao diện bài viết tư liệu chuyên sâu (Article Intro UI)
│   │   ├── TimelineChrono.tsx # Trục niên đại sự kiện ngang 16:9 (Horizontal Timeline)
│   │   ├── RoyalDecree.tsx    # Chiếu Cần Vương / Sắc Phong hoàng gia (Imperial Scroll)
│   │   ├── MapTactical.tsx    # Sa bàn bản đồ trận đánh & chú giải (Battle Map UI)
│   │   ├── CharacterProfile.tsx # Hồ sơ danh nhân / tướng lĩnh dạng Dual-Column 16:9
│   │   ├── ArtifactInspect.tsx  # Giao diện thẩm định bảo vật quốc gia 16:9 kèm 4 Hotspot tags
│   │   ├── PoemReciting.tsx     # Giao diện ngâm thơ lịch sử / tuyên ngôn độc lập 16:9
│   │   ├── HeroSpotlight.tsx    # Điểm sáng danh nhân lịch sử (Hero Spotlight)
│   │   └── ArmyStrength.tsx     # So sánh tương quan quân sự & thanh tỉ lệ (Army Strength)
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
| `--correlation-id` | `-k` | Mã correlation ID cho distributed structured logging | `undefined` |
| `--project-id` | `-p` | Mã dự án project ID gắn vào log context | `undefined` |
| `--no-overwrite` | - | Không ghi đè file đầu ra đã tồn tại | `false` |
| `--verbose` | `-v` | In log chi tiết quá trình render | `false` |

---

## 📊 Evaluation Suite (`eval/`)

Thư mục [`eval/`](eval) cung cấp bộ công cụ tự động kiểm định 31 LayoutModes và 19 Transitions, đồng thời mở Remotion Studio cho Human trực tiếp đánh giá (Tất cả lệnh chạy tại **Root Monorepo**):

```bash
# Chạy suite đánh giá tự động -> Tự động mở Remotion Studio GUI (giữ eval/out sạch 100%)
pnpm --filter @chronoviet/remotion-engine eval

# Chạy đánh giá ở chế độ headless trong CI/CD (tắt mở Studio GUI)
pnpm --filter @chronoviet/remotion-engine eval -- --no-studio
```

---

## 🚀 Lệnh Thường Dùng Cho Developer

```bash
# 1. Xem trực quan giao diện (Remotion Studio GUI Port 9876)
pnpm remotion:studio
# hoặc trong package:
pnpm --filter @chronoviet/remotion-engine start

# 2. Render video từ file JSON kịch bản
pnpm remotion:render
# hoặc render các kịch bản mẫu:
pnpm --filter @chronoviet/remotion-engine render:quangtrung
pnpm --filter @chronoviet/remotion-engine render:haibatrung
pnpm --filter @chronoviet/remotion-engine render:mongolviet2

# 3. Đánh giá Render Fidelity
pnpm eval:remotion
# hoặc trong package:
pnpm --filter @chronoviet/remotion-engine eval

# 4. Chạy bộ unit tests xác định (Tier 4 Verification - 37 tests)
pnpm test:remotion
# hoặc trong package:
pnpm --filter @chronoviet/remotion-engine test

# 5. Kiểm tra TypeScript
pnpm typecheck:remotion
# hoặc trong package:
pnpm --filter @chronoviet/remotion-engine typecheck

# 6. Setup mock assets cho Remotion Engine
pnpm --filter @chronoviet/remotion-engine setup-assets
```
