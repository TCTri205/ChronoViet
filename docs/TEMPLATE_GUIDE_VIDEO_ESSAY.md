# HƯỚNG DẪN THIẾT KẾ TEMPLATE & QUY TRÌNH DỰNG VIDEO ESSAY (SPIDERUM FORMAT)

Tài liệu này quy định bộ chuẩn thiết kế Đồ họa (Design System), Cấu trúc Component Remotion và Quy trình Dựng video dạng **Video Essay / Phân tích Lịch sử chuyên sâu** theo phong cách Spiderum.

> **📌 TRẠNG THÁI TÀI LIỆU:** **[📐 DESIGN SPECIFICATION & INTERFACE GUIDELINE]**  
> Tài liệu này mô tả quy chuẩn giao diện và cấu trúc component dự kiến cho các mở rộng Video Essay phân tích dài trong tương lai. Các component ví dụ (`VideoEssayTitleCard`, `HistoricalQuoteCard`) đóng vai trò là giao thức thiết kế chuẩn, tuân thủ nguyên tắc không can thiệp hay ghi đè vào 13 UI Component cốt lõi đã hoàn thiện trong `packages/remotion-engine/src/components/`.

> **⚠️ NGUYÊN TẮC VÀNG:** Tất cả các mẫu Template mới phải được lưu thành file/component riêng biệt, tuyệt đối **KHÔNG** chỉnh sửa hoặc ghi đè lên các Component hiện có trong dự án (`packages/remotion-engine/src/`).

> **💡 PHÂN BIỆT HAI PALETTE:**
> - **Palette này (Video Essay):** `#0EA5E9` Sky Blue — Dùng cho format phân tích chuyên sâu dài (Spiderum style).
> - **Palette Documentary (mặc định engine):** `#D4AF37` Vàng Kim — Dùng cho `HISTORICAL_DOCUMENTARY` template, xem tại [EVAL_REMOTION_TECHNICAL_SPEC.md §3](file:///D:/Persional_Projects/ChronoViet/docs/EVAL_REMOTION_TECHNICAL_SPEC.md).

---

## 🎨 1. BỘ NHẬN DIỆN THỊ GIÁC VIDEO ESSAY (VISUAL DESIGN SYSTEM)

### 1.1 Palette Màu sắc (Color Palette)

| Token | Hex | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Dark Background** | `#0F172A` (Slate 900) | Nền chính tối |
| **Mid Background** | `#1E293B` (Slate 800) | Nền card, panel |
| **Accent Primary** | `#0EA5E9` (Sky Blue) | Màu thương hiệu ChronoViet/Spiderum, highlight, underline |
| **Historical Red** | `#DC2626` (Red 600) | Sử liệu / Phe địch / Chiến tranh / Cảnh báo |
| **Imperial Gold** | `#F59E0B` (Amber 500) | Hoàng gia / Chiến thắng / Dẫn chứng quan trọng |
| **Card Glass** | `rgba(30, 41, 59, 0.85)` | Nền khung mờ glassmorphism |

**CSS glassmorphism chuẩn:**
```css
background: rgba(30, 41, 59, 0.85);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.08);
```

### 1.2 Font chữ & Kiểu chữ (Typography)

| Tên | Font | Trọng lượng | Dùng cho |
| :--- | :--- | :--- | :--- |
| **Title Heavy** | `Montserrat` | Bold, In hoa, `letter-spacing: 0.05em` | Tiêu đề video, tên chương, tên nhân vật |
| **Serif Quote** | `Playfair Display` hoặc `Merriweather` | Italic | Dẫn chứng trích dẫn cổ, câu hịch |
| **Body / Subtitles** | `Be Vietnam Pro` hoặc `Inter` | Regular/Medium | Lời thoại phụ đề, mô tả thông thường |

**Kích thước phụ đề (Subtitle bar):** `font-size: 28px–34px` tùy độ dài câu.

---

## 🧩 2. HỆ THỐNG COMPONENT ĐỒ HỌA TRONG REMOTION

Khi tích hợp vào Remotion, tạo thư mục độc lập tại `packages/remotion-engine/src/components/video-essay/` để không ảnh hưởng tới các component chuẩn hiện có.

### 2.1 `VideoEssayTitleCard.tsx`
- **Nhiệm vụ:** Hiển thị thẻ tiêu đề chính cho từng luận điểm (Luận điểm 1, 2, 3, 4).
- **Props interface:**
```typescript
export interface VideoEssayTitleCardProps {
  sectionNumber: string; // "LUẬN ĐIỂM 1"
  title: string;         // "THẾ CỜ GỌNG KÌM KÉP CỦA HỐT TẤT LIỆT"
  subtitle?: string;     // "Kẻ địch nguy hiểm Trấn Nam Vương Thoát Hoan"
}
```

### 2.2 `HistoricalQuoteCard.tsx`
- **Nhiệm vụ:** Hiển thị câu trích dẫn từ các bộ sử thư cổ (*Đại Việt Sử Ký Toàn Thư*, *Nguyên Sử*).
- **Props interface:**
```typescript
export interface HistoricalQuoteCardProps {
  quoteText: string;       // "Nếu muốn hàng, xin hãy chém đầu tôi trước đã!"
  source: string;          // "Trần Quốc Tuấn - Trích Đại Việt Sử Ký Toàn Thư"
  highlightColor?: string; // "#F59E0B"
}
```

### 2.3 `KenBurnsImage.tsx`
- **Nhiệm vụ:** Biến bức tranh lịch sử tĩnh thành chuyển động Zoom In/Pan mượt mà bằng Keyframe Remotion.
- **Lưu ý:** Trong engine chuẩn, chức năng này được xử lý bởi `SlideImage.tsx` qua `effect` prop. Component này chỉ dùng cho trường hợp cần tùy biến nâng cao (`customKenBurns`).
- **Props interface:**
```typescript
export interface KenBurnsImageProps {
  imageSrc: string;
  mode: 'ZOOM_IN' | 'ZOOM_OUT' | 'PAN_LEFT_RIGHT';
  durationInFrames: number;
}
```

---

## 🎬 3. QUY TRÌNH DỰNG VIDEO (PRODUCTION WORKFLOW)

### 3.1 Thu âm Voiceover

- Tần số lấy mẫu: **48kHz, 24-bit** (tiêu chuẩn broadcast).
- Xử lý bằng Noise Suppression + Hard Limiter **–1.5dB**.
- Xuất ra định dạng `.wav` (lossless) hoặc `.mp3` 320kbps.
- Lưu vào `assets/<domain>/<slug>/voiceover.wav`.

### 3.2 Dựng nhịp Sound Effects (SFX)

| Kịch bản | SFX gợi ý |
| :--- | :--- |
| Chuyển cảnh Ken Burns | "Swoosh / Wind" |
| Title Card xuất hiện | "Boom / Deep Impact" |
| Thẻ trích dẫn (Quote Card) | "Paper Flip / Book Open" |
| Cảnh chiến trận | "Sword Clash", "Drum War", "Crowd Battle" |
| Cảnh bí ẩn / Thảm án | "Suspense Sting", "Heartbeat", "Thunder" |
| Cảnh Cổ vật | "Museum Ambience", "Subtle Ping" |
| Cảnh Triều đại | "Imperial Fanfare", "Bell Temple" |

### 3.3 Tối ưu Hình ảnh (Asset Pipeline)

- Độ phân giải ảnh tối thiểu: **1920×1080** (Full HD).
- Ảnh Shorts (9:16): tối thiểu **1080×1920**.
- Chạy qua bộ lọc màu Cổ điển: Film Grain 5% + Vignette nhẹ 10% (nếu không dùng `filterStyle` của engine).
- Dùng `filterStyle: "HISTORICAL"` | `"SEPIA"` | `"VINTAGE"` trong JSON để engine tự xử lý.

### 3.4 Lưu Asset Đúng Convention

```
assets/
├── <domain>/              # biography, battle, dynasty, mystery, artifact
│   └── <slug>/            # tran-hung-dao, bach-dang-938...
│       ├── voiceover.wav
│       ├── bgm.wav
│       └── scene_01_*.jpg
└── video-essay/           # Cho format Video Essay dài (Spiderum style)
    └── <slug>/
```

---

## 🔒 4. QUY TRÌNH KIỂM THỬ KHÔNG GÂY LỖI CODE CŨ

1. **Không sửa đổi** `packages/remotion-engine/src/Root.tsx`, `ChronoVideo.tsx`, hay bất kỳ component chuẩn nào trong `src/components/`.
2. Tạo Composition độc lập mới trong `packages/remotion-engine/src/compositions/video-essay/` với `id` duy nhất (ví dụ: `"VideoEssay-MongolViet2"`).
3. Đăng ký Composition mới vào `Root.tsx` mà không xóa bất kỳ Composition cũ nào.
4. Chạy `pnpm typecheck` để kiểm tra type safety trước khi render.
5. Render thử nghiệm 30 frames trước khi render toàn bộ:
   ```bash
   pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/battle_mongol_viet_2.json -o out/test.mp4
   ```
