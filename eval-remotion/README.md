# ChronoViet - Remotion Evaluation Engine (`eval-remotion`)

Mô-đun Remotion Render Engine độc lập thuộc hệ sinh thái **ChronoViet**. Nhiệm vụ chính của mô-đun là tiếp nhận dữ liệu kịch bản chuẩn hóa dạng JSON (từ RAG & Multi-Agent) và render thành các video ngắn/dài (Shorts/Reels 9:16, YouTube 16:9, Post 1:1) chất lượng cao với cấu trúc phân đoạn chuyên nghiệp ("Hoàng đế Quang Trung: Một huyền thoại BÁCH CHIẾN BÁCH THẮNG").

---

## 🏗️ Cấu trúc Thư mục

```text
eval-remotion/
├── public/                # Tài nguyên tĩnh (images, audio)
│   └── assets/
├── scripts/               # Scripts tiện ích (setup_assets, test audio generator)
├── src/
│   ├── components/        # Thư viện Component chuyên biệt theo chuẩn ChronoViet
│   │   ├── SlideImage.tsx     # Ken Burns + Blur Background & Sepia filter
│   │   ├── QuoteSlide.tsx     # Thẻ trích dẫn câu nói / thơ (Quote Card)
│   │   ├── ChapterTitle.tsx   # Thẻ phân đoạn chương (Chapter Subdivision Title Card)
│   │   ├── SpiderumIntro.tsx  # Intro Hook giao diện bài viết ChronoViet + Logo Animation
│   │   ├── SponsorSlide.tsx   # Giới thiệu chuyên mục Mid-roll Feature (ChronoViet Series)
│   │   ├── OutroSlide.tsx     # Đoạn kết trích thơ + End Card Like/Share/Subscribe ChronoViet
│   │   └── index.ts
│   ├── constants/         # Cấu hình màu sắc thương hiệu ChronoViet & kích thước canvas
│   ├── types/             # TypeScript interfaces cho Timeline & Compositions
│   ├── data/              # Dữ liệu kịch bản JSON (quangTrungTimeline.json)
│   ├── utils/             # Hàm toán học Ken Burns & Responsive Layout Math
│   ├── compositions/      # Composition React Components Remotion
│   │   ├── ChronoVideo.tsx
│   │   ├── HistorySlide.tsx
│   │   ├── SubtitleOverlay.tsx
│   │   ├── BioCardOverlay.tsx
│   │   └── HeaderBranding.tsx
│   ├── Root.tsx           # Remotion Root & Composition Registrations
│   └── index.ts           # Entry point
├── package.json
└── tsconfig.json
```

---

## 🎬 ChronoViet Video Template Architecture

Template được thiết kế theo cấu trúc phân đoạn chuyên nghiệp:

1. **Intro / Hook mở đầu (`ARTICLE_UI`):** Mô phỏng giao diện bài viết chuyên sâu trên cổng thông tin ChronoViet (`chronoviet.org`) cùng Logo Animation CV + Sound effect thương hiệu.
2. **Xử lý Ảnh Không Đồng Nhất (`BLUR_BG` & `HISTORICAL_FRAME`):** Lớp nền phóng to mờ (`blur(28px)` + `brightness(0.32)`), lớp foreground ở tâm giữ tỉ lệ gốc có viền rõ nét & filter sepia cổ kính.
3. **Phân đoạn theo Chương (`CHAPTER_CARD`):** Thẻ tiêu đề chương lớn (ví dụ: `I/ TÀI LUYỆN BINH`, `II/ TÀI CHỈ HUY CHIẾN TRẬN`), tạo điểm dừng thị giác mượt mà.
4. **Thẻ Trích Dẫn (`QUOTE_CANVAS`):** Nền tối sầm (`brightness(0.2)`), chữ in hoa đậm Serif căn giữa màu vàng/trắng nổi bật, hiệu ứng xuất hiện theo nhịp lồng tiếng.
5. **Giới thiệu Chuyên mục Mid-roll (`SPONSOR_UI`):** Khung giới thiệu tư liệu ChronoViet sáng và sắc nét, tách biệt với tone lịch sử trầm.
6. **Outro / End Card (`OUTRO_CARD`):** Trích đoạn thơ lắng đọng chuyển tiếp sang End Card ChronoViet kêu gọi Like/Share/Subscribe.

---

## 🚀 Hướng dẫn Sử dụng

### 1. Cài đặt Phụ thuộc
```bash
npm install
```

### 2. Xem trước Trực quan (Remotion Studio Preview)
```bash
npm start
```

### 3. Render Video Quang Trung
```bash
# Render video Quang Trung full HD 16:9
npm run render:quangtrung
```
