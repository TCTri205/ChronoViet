# TÀI LIỆU KIẾN TRÚC & QUY CHUẨN THIẾT KẾ: CHRONO-VIDEO GENERATOR PIPELINE

Tài liệu này đóng gói toàn bộ **Kiến trúc Tổng thể**, **Bộ Ranh giới An toàn cho AI**, **Ma trận Mapping 5 Dạng Nội dung Lịch sử**, và **Schema JSON Production v4.1 (Tối ưu Context Window, Discriminated Unions per Layout Mode, Field Consolidation, Relative Timing Standard durationInFrames/durationInSeconds, Extensible layoutProps, Asset Metadata Preloading & External Captions URL)** dành cho hệ thống tự động hóa video lịch sử **ChronoViet**.

> 🔗 **Nguồn sự thật duy nhất (Source of Truth):** [`packages/shared-spec/src/schema.ts`](file:///D:/Persional_Projects/ChronoViet/packages/shared-spec/src/schema.ts) + [`packages/remotion-engine/src/types/index.ts`](file:///D:/Persional_Projects/ChronoViet/packages/remotion-engine/src/types/index.ts)  
> 📄 **Template JSON chuẩn & Evaluation Test Cases:** [`packages/remotion-engine/eval/test-cases/`](file:///D:/Persional_Projects/ChronoViet/packages/remotion-engine/eval/test-cases/)

---

## I. TRIẾT LÝ THIẾT KẾ: KIẾN TRÚC TÁCH BIỆT (DETERMINISTIC ARCHITECTURE)

Để đảm bảo AI Agent có thể tạo ra hàng ngàn video tự động mà không bị vỡ layout, crash render hay tạo ra hình ảnh "ảo giác", hệ thống tuân thủ tuyệt đối quy tắc **Phân lập Trực quan (Visual Isolation)**:

> **Quy tắc 1 Scene = 1 Trạng thái:** Một khung cảnh (Scene) chỉ được phép là **Pure Image** (Ảnh tĩnh xử lý hiệu ứng Ken Burns & Color Filter) HOẶC **Pure Code** (Giao diện đồ họa sinh từ code React/Remotion hoàn toàn). Tuyệt đối không giao cho AI tính toán tọa độ để vẽ text/vector đè lên các vị trí cụ thể của một bức ảnh ngẫu nhiên.

### Cơ chế Fallback (Xử lý Lỗi RAG & Link Ảnh)
Nếu AI Agent không tìm thấy ảnh phù hợp hoặc link ảnh bị chết (404 / điểm VLM Inspector < 60), Scene đó tự động fallback (chuyển đổi) sang định dạng **Pure Code** (ví dụ: `TITLE_CARD`, `STAT_CARD`, `QUOTE_CANVAS`, `BULLET_HIGHLIGHT`) để đảm bảo tiến trình render của Remotion không bao giờ bị gãy.

---

## II. THƯ VIỆN COMPONENT & LAYOUT MODES (LEGO BLOCKS CHO AI AGENT)

AI Agent chỉ được phép xây dựng kịch bản dựa trên các "khối Lego" đã được lập trình sẵn trong Remotion Engine. Tất cả các giá trị `layoutMode` (18 Core Modes + 13 Extended Modes) đều được định nghĩa trong `LayoutModeSchema` tại [`packages/shared-spec/src/schema.ts`](file:///D:/Persional_Projects/ChronoViet/packages/shared-spec/src/schema.ts).

### 1. Nhóm Pure Image (11 Layout Modes)

Điều khiển qua các trường `layoutMode`, `effect` và `filterStyle` — tất cả render qua `SlideImage.tsx`:

| `layoutMode` | Mô tả & Công năng |
| :--- | :--- |
| `BLUR_BG` | Ảnh giữ nguyên tỉ lệ gốc (`contain`), căn giữa màn hình, viền phủ lớp mờ mượt đằng sau. **Phù hợp:** cổ vật, chân dung có kích thước dị biệt. |
| `HISTORICAL_FRAME` | Ảnh lịch sử với hiệu ứng vignette nhẹ, khung vintage cổ điển. **Phù hợp:** tư liệu thực tế, trang sách cổ. |
| `FULL_COVER` | Ảnh lấp đầy màn hình (`object-fit: cover`). **Phù hợp:** phong cảnh rộng, chiến trường toàn cảnh. |
| `FULL_CONTAIN` | Ảnh hiển thị đầy đủ (`contain`) trên nền tối, không crop. |
| `CENTER_SCALE` | Ảnh căn giữa có scale nhẹ, không blur nền. |
| `VIGNETTE_DARK` | Phủ lớp filter đen mờ 4 góc, giảm độ sáng 40%. **Phù hợp:** làm nền an toàn cho Phụ đề hoặc giọng đọc trầm lắng. |
| `SPLIT_COMPARE` | So sánh 2 ảnh cạnh nhau. Dùng `assetUrl` (trái) + `secondaryAssetUrl` (phải). |
| `PURE_IMAGE_FULL` | Render ảnh tĩnh full-bleed nâng cao không overlay text. |
| `DOCUMENTARY_GRID` | Lưới 2-4 ảnh phong cách phim tài liệu truyền hình. |
| `NEWSPAPER_ARCHIVE` | Mô phỏng ảnh báo chí lưu trữ cổ điển. |
| `GALLERY_3D` | Trình chiếu bộ sưu tập ảnh 3D chiều sâu. |

**Hiệu ứng chuyển động Ken Burns (`effect`):**
```
KEN_BURNS_ZOOM_IN | KEN_BURNS_ZOOM_OUT | KEN_BURNS_PAN_LEFT
KEN_BURNS_PAN_RIGHT | KEN_BURNS_PAN_UP | KEN_BURNS_PAN_DOWN | NONE
```

### 2. Nhóm Pure Code / Overlay UI (20 Layout Modes)

Mỗi layout mode kích hoạt một UI Component chuyên biệt trong `src/components/`:

| `layoutMode` | Component File | Mô tả & Công năng | `overlayData` key quan trọng |
| :--- | :--- | :--- | :--- |
| `TITLE_CARD` | `ChapterTitle.tsx` | Thẻ tiêu đề đầu video — nền màu/gradient, text lớn giữa, viền phát sáng. | `chapterNumber`, `title`, `subtitle` |
| `CHAPTER_CARD` | `ChapterTitle.tsx` | Thẻ tiêu đề chương — nhấn mạnh số chương Roman numeral lớn. | `chapterNumber`, `title`, `subtitle` |
| `STAT_CARD` | `StatCard.tsx` | Hồ sơ & Chỉ số Nhân vật / Sự kiện với staggered fade-in. | `title`, `name`, `role`, `statItems[]` |
| `VERSUS_CARD` | `VersusCard.tsx` | Thẻ Đối đầu — chia đôi màn hình so sánh lực lượng/chiến thuật. | `title`, `leftSide{}`, `rightSide{}` |
| `QUOTE_CANVAS` | `QuoteSlide.tsx` | Khung trích dẫn trang trọng với dấu ngoặc kép nghệ thuật. | `quoteText`, `author`, `subtitle` |
| `QUOTE_SLIDE` | `QuoteSlide.tsx` | Biến thể / Alias của QUOTE_CANVAS, render qua `QuoteSlide.tsx`. | `quoteText`, `author`, `subtitle` |
| `BULLET_HIGHLIGHT` | `BulletHighlight.tsx` | Danh sách thành tựu / mốc thời gian / diễn biến sáng từng dòng. | `title`, `bulletPoints[]` |
| `MUSEUM_TAG` | `MuseumTag.tsx` | Thẻ chú thích bảo tàng chuyên dụng cho Cổ vật. | `title`, `subtitle`, `artifactInfo{}` |
| `SPLIT_THEORY` | `SplitTheory.tsx` | So sánh 2–3 giả thuyết lịch sử với độ tin cậy %. | `title`, `theories[]` |
| `OUTRO_CARD` | `OutroSlide.tsx` | Màn hình Kết bài — tóm tắt di sản, thông điệp CTA. | `title`, `quoteText`, `ctaText`, `bulletPoints[]` |
| `ARTICLE_UI` | `ChronoIntro.tsx` | Màn hình mở đầu dạng báo chí / phim tài liệu chuyên sâu. | `title`, `author`, `seriesTitle` |
| `SPONSOR_UI` | `SponsorSlide.tsx` | Màn hình giới thiệu tài trợ / đồng hành sản xuất. | `sponsorTitle`, `sponsorDesc`, `ctaText` |
| `HERO_SPOTLIGHT` | Extended Layout | Màn hình tiêu điểm anh hùng dân tộc. | `name`, `title`, `details` |
| `TIMELINE_CHRONO` | Extended Layout | Trục thời gian diễn biến sự kiện lịch sử. | `title`, `bulletPoints[]` |
| `MAP_TACTICAL` | Extended Layout | Sơ đồ bản đồ tác chiến / hành quân. | `title`, `details` |
| `ARMY_STRENGTH` | Extended Layout | Biểu đồ quân số & tương quan lực lượng. | `title`, `statItems[]` |
| `CHARACTER_PROFILE` | Extended Layout | Hồ sơ chi tiết nhân vật lịch sử. | `name`, `role`, `details` |
| `ROYAL_DECREE` | Extended Layout | Khung văn bản chiếu dời đô / hịch / chiếu thư. | `title`, `quoteText` |
| `ARTIFACT_INSPECT` | Extended Layout | Giao diện soi chi tiết hoa văn cổ vật. | `title`, `artifactInfo{}` |
| `POEM_RECITING` | Extended Layout | Giao diện ngâm thơ / văn thơ cổ truyền. | `title`, `quoteText` |

**Overlays dùng chung (tự động trong mọi scene):**
- `DocumentaryHeader.tsx` — Thanh Header thương hiệu cố định phía trên (ẩn bằng `hideHeader: true`)
- `DocumentarySubtitle.tsx` — Phụ đề Karaoke word-level phía dưới (ẩn bằng `hideSubtitle: true`)

---

## III. BẢNG MAPPING 5 DẠNG NỘI DUNG LỊCH SỬ (DOMAINS)

Hệ thống RAG phân tích chủ đề và phân loại vào 1 trong 5 domain dưới đây để ép AI Agent sử dụng đúng tập hợp Component, Visual Vibe và Hiệu ứng Chuyển cảnh:

| Domain (`videoType`) | Trọng tâm RAG | Layout Flow BẮT BUỘC | Layout TÙY CHỌN | `defaultTransition` | `defaultFilterStyle` | SFX Preset |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`BIOGRAPHY`** | Chân dung, mốc sinh tử, quan điểm, di sản | `ARTICLE_UI` → `TITLE_CARD` → `STAT_CARD` → `BULLET_HIGHLIGHT` → `OUTRO_CARD` | `QUOTE_CANVAS` (trích dẫn), `VERSUS_CARD` (đối thủ/tướng địch) | `FADE_TO_BLACK` | `HISTORICAL` | `orchestral_swell`, `ambient_historical` |
| **`BATTLE`** | Tương quan lực lượng, diễn biến, thương vong, kết quả | `ARTICLE_UI` → `TITLE_CARD` → `VERSUS_CARD` → `BULLET_HIGHLIGHT` → `STAT_CARD` (kết quả) → `OUTRO_CARD` | `VIGNETTE_DARK` (căng thẳng), `QUOTE_CANVAS` (hịch/tuyên ngôn) | `GLITCH` | `HISTORICAL` | `sword_clash`, `drum_war`, `crowd_battle` |
| **`DYNASTY`** | Niên đại, kinh đô, bản đồ, thành tựu, ngoại giao | `ARTICLE_UI` → `TITLE_CARD` → `STAT_CARD` (thông số vương triều) → `BULLET_HIGHLIGHT` → `OUTRO_CARD` | `VERSUS_CARD` (so sánh triều đại), `QUOTE_CANVAS` (chiếu dời đô/hịch) | `SLIDE_LEFT` | `HISTORICAL` | `imperial_fanfare`, `bell_temple` |
| **`MYSTERY`** | Giả thuyết mâu thuẫn, hiện trường, thảm án, tranh luận | `ARTICLE_UI` → `TITLE_CARD` → `STAT_CARD` (hồ sơ vụ án) → `SPLIT_THEORY` → `OUTRO_CARD` | `VIGNETTE_DARK` (nền tối trinh thám), `QUOTE_CANVAS` (ý kiến sử gia) | `FADE_TO_BLACK` | `SEPIA` | `suspense_sting`, `heartbeat`, `thunder` |
| **`ARTIFACT`** | Niên đại khai quật, thông số, chất liệu, nơi lưu giữ | `ARTICLE_UI` → `TITLE_CARD` → `MUSEUM_TAG` → `STAT_CARD` (tỷ lệ hợp kim) → `OUTRO_CARD` | `SPLIT_THEORY` (tranh luận nguồn gốc), `BULLET_HIGHLIGHT` (hoa văn chi tiết) | `CROSS_ZOOM` | `VINTAGE` | `museum_ambience`, `subtle_ping` |

### Quy tắc Nhận diện Domain (Domain Detection Rules cho AI Agent)
AI Agent tự động xếp loại prompt của người dùng theo các tín hiệu (keywords):
- **`BIOGRAPHY`:** Tên nhân vật lịch sử + năm sinh/mất + danh hiệu/tước hiệu.
- **`BATTLE`:** "trận", "chiến", "đánh", "thủy chiến", "khởi nghĩa" + tên địa danh/năm.
- **`DYNASTY`:** "triều đại", "vương triều", "nhà [Lý/Trần/Lê...]", "kinh đô", số năm trị vì.
- **`MYSTERY`:** "bí ẩn", "thảm án", "oan khuất", "giả thuyết", "nghi vấn", "tranh luận".
- **`ARTIFACT`:** "cổ vật", "bảo vật", "trống đồng", "ấn kiếm", "khai quật", "bảo tàng".

---

## IV. BỘ KỊCH BẢN MẪU ĐỒNG BỘ NGUYÊN BẢN CODEBASE (PRODUCTION SCHEMA V4.1)

> **Lưu ý quy tắc tính thời lượng Scene trong Engine (`Root.tsx`):**
> 1. Trực tiếp `"durationInFrames": 450` (Ưu tiên số 1 - Khuyến nghị cho Production render).
> 2. Theo giây `"durationInSeconds": 15` (Engine tự nhân với `fps`).
> 3. Tự động theo Karaoke Audio Captions: `max(caption.endFrame) + 15` frames (tối thiểu 3s).
> 4. Tính qua khoảng thời gian `"startTime": 0, "endTime": 15` (`(endTime - startTime) * fps`).
> 5. Mặc định Fallback: 5 giây (`5 * fps`).
> *Khi `enableTransitions: true`, thời lượng tổng video sẽ được trừ đi khoảng overlap chuyển cảnh (`transitionDurationFrames` mặc định 15 frames).*

---

### 1. Kịch Bản Mẫu Domain `BIOGRAPHY`: Trần Quốc Tuấn

```json
{
  "title": "HƯNG ĐẠO ĐẠI VƯƠNG TRẦN QUỐC TUẤN – HUYỀN THOẠI BÁCH CHIẾN BÁCH THẮNG",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Trần Quốc Tuấn (1228 - 1300)",
  "videoType": "BIOGRAPHY",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#C89D35",
    "secondaryColor": "#9B1B1B",
    "backgroundColor": "#0E0C0A",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(200, 157, 53, 0.35)"
  },
  "audioUrl": "assets/biography/tran-hung-dao/voiceover.wav",
  "bgmUrl": "assets/biography/tran-hung-dao/bgm.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "FADE_TO_BLACK",
  "timeline": [
    {
      "id": "scene_00_brand_intro",
      "startTime": 0, "endTime": 15,
      "text": "ChronoViet Documentary Series — Dự án Phim tài liệu & Số hóa Lịch sử Việt Nam.",
      "layoutMode": "ARTICLE_UI",
      "overlayType": "ARTICLE_INTRO",
      "transition": "FADE_TO_BLACK",
      "hideHeader": true,
      "overlayData": {
        "title": "HƯNG ĐẠO ĐẠI VƯƠNG TRẦN QUỐC TUẤN",
        "author": "ChronoViet Research Team"
      }
    },
    {
      "id": "scene_01_title",
      "startTime": 15, "endTime": 35,
      "text": "Vị tướng duy nhất được nhân dân suy tôn thành 'Thánh', được cả thế giới nghiêng mình kính trọng.",
      "assetUrl": "assets/biography/scene_01_van_kiep_statue.jpg",
      "layoutMode": "TITLE_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "HISTORICAL",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "chapterNumber": "PHẦN I",
        "title": "TRẦN HƯNG ĐẠO",
        "subtitle": "Quốc Công Tiết Chế • Vị Đại Nguyên Soái 3 Lần Đánh Phá Quân Nguyên Mông"
      }
    },
    {
      "id": "scene_02_stat",
      "startTime": 35, "endTime": 55,
      "text": "Trần Quốc Tuấn sinh năm 1228 tại phủ Thiên Trường (Nam Định), con trai An Sinh Vương Trần Liễu.",
      "assetUrl": "assets/biography/scene_02_young_portrait.jpg",
      "layoutMode": "STAT_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "HISTORICAL",
      "transition": "SLIDE_LEFT",
      "overlayData": {
        "title": "HỒ SƠ THÂN THẾ & NIÊN ĐẠI",
        "name": "Trần Quốc Tuấn (1228 - 1300)",
        "role": "Quốc Công Tiết Chế • Vạn Kiếp Chí Linh",
        "statItems": [
          { "label": "Thân phụ", "value": "An Sinh Vương Trần Liễu", "color": "#D4AF37" },
          { "label": "Chinh chiến thắng lợi", "value": "3/3 Lần thắng Nguyên Mông", "color": "#2563eb" },
          { "label": "Tác phẩm quân sự", "value": "Hịch Tướng Sĩ & Binh Thư Yếu Lược", "color": "#8B0000" }
        ]
      }
    },
    {
      "id": "scene_05_quote",
      "startTime": 80, "endTime": 100,
      "text": "Năm 1285, Thoát Hoan dẫn 50 vạn quân Nguyên tràn sang. Trần Quốc Tuấn trả lời câu nói bất tử...",
      "layoutMode": "QUOTE_CANVAS",
      "overlayType": "QUOTE",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "quoteText": "Bệ hạ chém đầu tôi trước rồi hãy hàng!",
        "author": "Hưng Đạo Đại Vương Trần Quốc Tuấn",
        "subtitle": "Trả lời Vua Trần Thánh Tông năm 1285"
      }
    },
    {
      "id": "scene_20_outro",
      "startTime": 370, "endTime": 390,
      "text": "Hưng Đạo Đại Vương Trần Quốc Tuấn – Thiên tài quân sự bất tử của dân tộc Việt Nam.",
      "layoutMode": "OUTRO_CARD",
      "overlayType": "OUTRO_CARD",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "title": "HƯNG ĐẠO ĐẠI VƯƠNG TRẦN QUỐC TUẤN",
        "quoteText": "Khoan thư sức dân để làm kế sâu gốc bền gốc, đó là thượng sách giữ nước.",
        "ctaText": "CHRONOVIET DOCUMENTARY SERIES • CHUYÊN ĐỀ LỊCH SỬ CHUYÊN SÂU",
        "bulletPoints": ["VẠN KIẾP AN NAM", "THIÊN TÀI QUÂN SỰ", "DI SẢN TRẦN TRIỀU"]
      }
    }
  ]
}
```

---

### 2. Kịch Bản Mẫu Domain `BATTLE`: Trận Bạch Đằng 938

```json
{
  "title": "TRẬN BẠCH ĐẰNG 938 – CỘT MỐC MỞ ĐẦU KỶ NGUYÊN ĐỘC LẬP",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Trận Bạch Đằng Năm 938",
  "videoType": "BATTLE",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#9B1B1B",
    "secondaryColor": "#C89D35",
    "backgroundColor": "#0E0C0A",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(155, 27, 27, 0.4)"
  },
  "audioUrl": "assets/battle/bach-dang/voiceover.wav",
  "bgmUrl": "assets/battle/bach-dang/bgm.wav",
  "bgmVolume": 0.3,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "GLITCH",
  "timeline": [
    {
      "id": "scene_00_intro",
      "startTime": 0, "endTime": 15,
      "text": "ChronoViet Documentary Series — Trận Bạch Đằng 938.",
      "layoutMode": "ARTICLE_UI",
      "overlayType": "ARTICLE_INTRO",
      "transition": "FADE_TO_BLACK",
      "hideHeader": true,
      "overlayData": {
        "title": "TRẬN BẠCH ĐẰNG 938",
        "author": "ChronoViet Research Team"
      }
    },
    {
      "id": "scene_battle_versus",
      "startTime": 45, "endTime": 65,
      "text": "Tương quan lực lượng trên chiến trường sông Bạch Đằng năm 938 vô cùng chênh lệch...",
      "layoutMode": "VERSUS_CARD",
      "transition": "GLITCH",
      "overlayData": {
        "title": "TƯƠNG QUAN LỰC LƯỢNG TRẬN BẠCH ĐẰNG 938",
        "leftSide": {
          "name": "QUÂN THỦY ĐẠI VIỆT",
          "stat": "Thuyền nhỏ linh hoạt • Trận địa cọc nhọn bọc sắt • Nắm rõ quy luật thủy triều",
          "color": "#2563eb",
          "badge": "Chủ động"
        },
        "rightSide": {
          "name": "HẠM ĐỘI NAM HÁN",
          "stat": "Chiến thuyền lớn đồ sộ • Hoằng Tháo chỉ huy • Xâm lược hiếu chiến",
          "color": "#8B0000",
          "badge": "Hung hãn"
        }
      }
    }
  ]
}
```

---

### 3. Kịch Bản Mẫu Domain `DYNASTY`: Triều Đại Nhà Lý

```json
{
  "title": "TRIỀU ĐẠI NHÀ LÝ – KỶ NGUYÊN VÀNG VĂN MINH ĐẠI VIỆT (1009 – 1225)",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Vương Triều Lý",
  "videoType": "DYNASTY",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#D4AF37",
    "secondaryColor": "#2563eb",
    "backgroundColor": "#090d14",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(212, 175, 55, 0.35)"
  },
  "audioUrl": "assets/dynasty/nha-ly/voiceover.wav",
  "bgmUrl": "assets/dynasty/nha-ly/bgm.wav",
  "bgmVolume": 0.22,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "SLIDE_LEFT",
  "timeline": [
    {
      "id": "scene_dynasty_stat",
      "startTime": 45, "endTime": 65,
      "text": "Trải qua 216 năm trị vì, Triều đại Nhà Lý đã khai mở kỷ nguyên vàng về văn hóa và pháp luật...",
      "layoutMode": "STAT_CARD",
      "transition": "SLIDE_LEFT",
      "overlayData": {
        "title": "THÔNG SỐ VƯƠNG TRIỀU NHÀ LÝ",
        "name": "Hoàng Đế Lý Thái Tổ (974 - 1028)",
        "role": "Kinh đô Thăng Long • 9 Vị Hoàng Đế",
        "statItems": [
          { "label": "Thời gian trị vì", "value": "216 Năm (1009 - 1225)", "color": "#D4AF37" },
          { "label": "Số đời Hoàng đế", "value": "9 Vị Vua", "color": "#059669" },
          { "label": "Đổi quốc hiệu Đại Việt", "value": "Năm 1054 (Lý Thánh Tông)", "color": "#2563eb" }
        ]
      }
    }
  ]
}
```

---

### 4. Kịch Bản Mẫu Domain `MYSTERY`: Thảm Án Lệ Chi Viên

```json
{
  "title": "BÍ ẨN THẢM ÁN LỆ CHI VIÊN & NGUYỄN TRÃI (1442)",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Thảm Án Lệ Chi Viên",
  "videoType": "MYSTERY",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#6B7280",
    "secondaryColor": "#374151",
    "backgroundColor": "#050709",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(107, 114, 128, 0.3)"
  },
  "audioUrl": "assets/mystery/le-chi-vien/voiceover.wav",
  "bgmUrl": "assets/mystery/le-chi-vien/bgm.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "VIGNETTE_DARK",
  "defaultFilterStyle": "SEPIA",
  "defaultTransition": "FADE_TO_BLACK",
  "timeline": [
    {
      "id": "scene_mystery_split",
      "startTime": 90, "endTime": 115,
      "text": "Các nhà sử học hiện đại đặt ra hai giả thuyết lớn về thủ phạm thực sự...",
      "layoutMode": "SPLIT_THEORY",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "title": "HAI GIẢ THUYẾT VỀ NGUYÊN NHÂN BĂNG HÀ CỦA VUA LÊ THÁI TÔNG",
        "theories": [
          {
            "title": "GIẢ THUYẾT 1: BỆNH ĐỘT QUỴ TỰ NHIÊN",
            "desc": "Vua đi hành quân vất vả, ngấm trúng gió độc tại Lệ Chi Viên rồi phát bệnh nặng đột ngột tử vong.",
            "probability": "30% Khả năng"
          },
          {
            "title": "GIẢ THUYẾT 2: ÂM MƯU NGUYỄN THỊ ANH",
            "desc": "Tuyên Cừu Thái hậu mưu hại vua để bảo vệ ngai vàng cho con trai Lê Nhân Tông, đổ tội cho Nguyễn Thị Lộ.",
            "probability": "70% Khả năng"
          }
        ]
      }
    }
  ]
}
```

---

### 5. Kịch Bản Mẫu Domain `ARTIFACT`: Trống Đồng Ngọc Lũ

```json
{
  "title": "TRỐNG ĐỒNG NGỌC LŨ – ĐỈNH CAO ĐÚC ĐỒNG & BIỂU TƯỢNG VĂN MINH ĐÔNG SƠN",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Trống Đồng Ngọc Lũ",
  "videoType": "ARTIFACT",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#B45309",
    "secondaryColor": "#78350F",
    "backgroundColor": "#0d0a06",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(180, 83, 9, 0.35)"
  },
  "audioUrl": "assets/artifact/trong-dong-ngoc-lu/voiceover.wav",
  "bgmUrl": "assets/artifact/trong-dong-ngoc-lu/bgm.wav",
  "bgmVolume": 0.2,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "VINTAGE",
  "defaultTransition": "CROSS_ZOOM",
  "timeline": [
    {
      "id": "scene_artifact_tag",
      "startTime": 30, "endTime": 55,
      "text": "Trống đồng Ngọc Lũ I được công nhận là Bảo vật Quốc gia số 1 của Việt Nam...",
      "layoutMode": "MUSEUM_TAG",
      "transition": "DISSOLVE",
      "overlayData": {
        "title": "TRỐNG ĐỒNG NGỌC LŨ I",
        "subtitle": "Bảo vật Quốc gia số 01 • Khai quật năm 1893 tại Hà Nam",
        "artifactInfo": {
          "period": "Thế kỷ III - II Tr.CN (Văn hóa Đông Sơn)",
          "material": "Đồng thau hợp kim (Đồng - Thiếc - Chì)",
          "origin": "Làng Ngọc Lũ, Bình Lục, Hà Nam",
          "dimensions": "Đường kính: 79.3cm • Cao: 63cm • Nặng: 86kg"
        }
      }
    }
  ]
}
```

---

## V. LUỒNG THỰC THI TOÀN HỆ THỐNG (PIPELINE WORKFLOW)

```
┌─────────────────────────────────────────────────────────┐
│              1. USER REQUEST & PROMPT                   │
│   ("Làm video Shorts về Khởi nghĩa Lam Sơn")           │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              2. RAG RETRIEVAL ENGINE                    │
│   (Truy xuất Vector DB: SGK, Đại Việt Sử Ký)            │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              3. AI DIRECTOR AGENT                       │
│   - Gọi TTS API → tạo mảng word-level "captions"       │
│   - Nhận diện domain → BIOGRAPHY/BATTLE/...             │
│   - Crawl/Kiểm định ảnh bằng VLM Inspector (Score ≥ 60)│
│   - Fallback 404/thiếu ảnh → dùng Pure Code layoutMode │
│   - Đóng gói JSON chuẩn ChronoVideoSchema (v4.1)       │
└────────────────────────────┬────────────────────────────┘
                             │ (data.json)
                             ▼
┌─────────────────────────────────────────────────────────┐
│            4. ZOD SCHEMA VALIDATION                     │
│   ChronoVideoSchema.safeParse(data)                     │
│   → Fallback gracefully nếu field optional không có    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│            5. REMOTION RENDERING ENGINE                 │
│   calculateMetadata: tính durationInFrames từ timeline  │
│   - PURE_CODE: Render UI component                      │
│   - PURE_IMAGE: Ken Burns + filterStyle                 │
│   - Layer 3: Header + Subtitle Karaoke                  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 6. OUTPUT VIDEO MP4                     │
│   (Video Shorts/16:9 hoàn chỉnh, 0% crash layout)       │
└─────────────────────────────────────────────────────────┘
```

---

## VI. ĐỐI CHIẾU & ĐỒNG BỘ VỚI CODEBASE `remotion-engine` (`packages/remotion-engine`)

Thư mục `packages/remotion-engine/src/` và `packages/shared-spec/src/` đã được hoàn thiện 100% linh hoạt theo cơ chế Data-Driven:

1. **Types & Validation (`packages/shared-spec/src/` & `packages/remotion-engine/src/types/`):**
   - [`index.ts`](file:///D:/Persional_Projects/ChronoViet/packages/remotion-engine/src/types/index.ts): Re-export từ `@chronoviet/shared-spec` (Khai báo đầy đủ 31 `LayoutMode`, 19 `TransitionType`, 4 `FilterStyle`, `ThemeConfig`, `OverlayData` và toàn bộ sub-types).
   - [`schema.ts`](file:///D:/Persional_Projects/ChronoViet/packages/shared-spec/src/schema.ts): Zod Schema (`ChronoVideoSchema`, `TimelineSceneSchema`, `OverlayDataSchema`) validate JSON runtime.

2. **Hệ Thống Theme Động (`src/utils/themeUtils.ts`):**
   - `resolveTheme(theme)` — giải quyết màu sắc với fallback từ `COLOR_PALETTE`.
   - `getMergedTheme(templateId, customTheme)` — merge template default với custom theme JSON.
   - `TEMPLATE_THEMES` tại [`src/constants/config.ts`](file:///D:/Persional_Projects/ChronoViet/packages/remotion-engine/src/constants/config.ts).

3. **Thư viện 13 Component Pure Code (`src/components/`):**
   - `StatCard`, `VersusCard`, `BulletHighlight`, `MuseumTag`, `SplitTheory`, `ChapterTitle` (dùng cho cả `TITLE_CARD` và `CHAPTER_CARD`), `QuoteSlide`, `OutroSlide`, `SponsorSlide`, `ChronoIntro`, `DocumentaryHeader`, `DocumentarySubtitle`, `SlideImage`.

4. **Data Files (`src/data/`):**
   - Tổng cộng 9 file JSON kịch bản chuẩn (5 domain timelines + 3 legacy historical timelines + 1 general template timeline): `biographyTimeline.json` (21 scenes), `battleTimeline.json` (21 scenes), `dynastyTimeline.json` (21 scenes), `mysteryTimeline.json` (19 scenes), `artifactTimeline.json` (19 scenes), `templateGeneralTimeline.json`, `quang-trung/quangTrungTimeline.json`, `hai-ba-trung/haiBaTrungTimeline.json`, `mongol-viet-2/mongolViet2Timeline.json`.
   - **Lưu ý:** `audioUrl` & `bgmUrl` trong các file JSON hiện dùng placeholder `assets/quang-trung/voiceover.wav` — sẽ được thay thế bằng audio domain-specific khi Multi-Agent TTS Pipeline hoàn thiện. `templateId` là optional trong schema, các file có thể bổ sung khi cần override theme mặc định.

5. **Compositions & Core Engine (`src/Root.tsx` & `src/compositions/ChronoVideo.tsx`):**
   - 11 Composition đã đăng ký: `ChronoVideo` (general template), `BiographyVideo`, `BattleVideo`, `DynastyVideo`, `MysteryVideo`, `ArtifactVideo` (5 domain chuẩn), `QuickShortsVideo` (9:16), `ModernNewsVideo` (16:9) + `QuangTrungVideo`, `HaiBaTrungVideo`, `MongolViet2Video` (legacy).
   - `calculateMetadata` tự động tính duration từ `timeline` JSON, hỗ trợ cả `durationInFrames` lẫn `startTime`/`endTime`.

---

## VII. TÀI LIỆU THAM CHIẾU KỸ THUẬT

Chi tiết về thiết kế giao diện, sơ đồ hàm và hướng dẫn vận hành Remotion Engine được quy định tại:
👉 [Tài liệu Kỹ thuật Eval-Remotion Engine (100% JSON-Driven)](file:///D:/Persional_Projects/ChronoViet/docs/EVAL_REMOTION_TECHNICAL_SPEC.md)
