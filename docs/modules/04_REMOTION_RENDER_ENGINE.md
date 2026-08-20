# CHI TIẾT MÔ-ĐUN 4: REMOTION RENDER ENGINE
## (Agent Execution Tool & Data-Driven Presentation Engine)

---

## 1. Định Vị Trong Hệ Thống Multi-Agent

Mô-đun **Remotion Render Engine** là **Công cụ Thực thi (Agent Tool)** của hệ thống [Multi-Agent Orchestrator](02_MULTI_AGENT_ORCHESTRATOR.md). 

Trong sơ đồ tổng thể:
* Input của Remotion Render Engine là file **JSON Production Schema v4.1** (`ChronoVideoProps`) được đóng gói và thẩm định từ **Module 2 (Multi-Agent Orchestrator)**.
* Trước khi gọi CLI `npx remotion render`, Render Worker **pre-download toàn bộ media assets** (Audio `.wav`, Images, Fonts) về thư mục làm việc cục bộ Host Volume `/media/raw-assets/` để đảm bảo 0% gián đoạn do mạng.
* Remotion hoạt động như một Tool nhận diện lệnh CLI hoặc API wrapper, khởi tạo Chromium Process riêng biệt và giải phóng toàn bộ tài nguyên process (`browser.close()`) ngay sau khi xuất xong MP4.
* Engine này đã được **triển khai hoàn thiện 100%** tại thư mục codebase [`packages/remotion-engine/src/`](../../packages/remotion-engine/src).


---

## 2. Mô Tả Chi Tiết & 100% Chính Xác Format JSON Input Schema v4.1

Cấu trúc file JSON input truyền vào Remotion Render Engine tuân thủ 100% chuẩn Zod Schema quy định tại [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts) và TypeScript definitions tại [`packages/remotion-engine/src/types/index.ts`](../../packages/remotion-engine/src/types/index.ts).

Dưới đây là bảng tra cứu đầy đủ 100% không bỏ sót bất kỳ trường dữ liệu hay enum nào:

### 2.1. Cấu Trúc Gốc: Root Properties (`ChronoVideoProps`)

| Trường Dữ Liệu | Kiểu Dữ Liệu | Bắt Buộc | Giá Trị Mặc Định | Mô Tả & Quy Chuẩn Kỹ Thuật |
| :--- | :--- | :---: | :---: | :--- |
| `title` | `string` | **Bắt buộc** | - | Tiêu đề chính của video (VD: `"TRẬN NGỌC HỒI ĐỐNG ĐA 1789"`). |
| `subtitle` | `string` | Tùy chọn | `undefined` | Tiêu đề phụ hoặc tên series (VD: `"ChronoViet Deep Research Series"`). |
| `videoType` | `enum` | Tùy chọn | `'BATTLE'` | Thể loại video domain: `'BIOGRAPHY'`, `'BATTLE'`, `'DYNASTY'`, `'MYSTERY'`, `'ARTIFACT'`. |
| `templateId` | `enum` | Tùy chọn | `'HISTORICAL_DOCUMENTARY'` | ID mẫu giao diện: `'HISTORICAL_DOCUMENTARY'`, `'QUICK_SHORTS'`, `'MODERN_NEWS'`. |
| `aspectRatio` | `enum` | Tùy chọn | `'16:9'` | Tỉ lệ khung hình render: `'16:9'` (YouTube), `'9:16'` (TikTok/Shorts), `'1:1'` (Instagram). |
| `theme` | `object` | Tùy chọn | Theme mặc định | Cấu hình màu sắc & font chữ hệ thống (`ThemeConfig`). |
| `audioUrl` | `string` | Tùy chọn | `undefined` | Đường dẫn file âm thanh voiceover tổng hợp toàn bộ video (`.wav`/`.mp3`). |
| `captionsUrl` | `string` | Tùy chọn | `undefined` | Đường dẫn file phụ đề JSON karaoke words ngoài (`.json`). |
| `bgmUrl` | `string` | Tùy chọn | `undefined` | Đường dẫn file nhạc nền BGM (.wav/.mp3). |
| `bgmVolume` | `number` | Tùy chọn | Không có default (`undefined`) | Âm lượng nhạc nền (từ `0.0` đến `1.0`, khuyến nghị 0.2–0.3). |
| `defaultLayoutMode` | `enum` | Tùy chọn | `'BLUR_BG'` | LayoutMode dự phòng nếu scene không khai báo `layoutMode`. |
| `defaultFilterStyle` | `enum` | Tùy chọn | `'HISTORICAL'` | Bộ lọc màu mặc định (`'HISTORICAL'`, `'SEPIA'`, `'VINTAGE'`, `'NONE'`). |
| `defaultTransition` | `enum` | Tùy chọn | `'GLITCH'` | Chuyển cảnh mặc định giữa các scene (`'DISSOLVE'`, `'FADE_TO_BLACK'`, `'GLITCH'`...). |
| `enableTransitions` | `boolean` | Tùy chọn | `true` | Bật/tắt hiệu ứng chuyển cảnh tự động giữa các phân cảnh. |
| `fps` | `number` | Tùy chọn | `30` | Tốc độ khung hình (khuyên dùng 30 FPS). |
| `captions` | `array` | Tùy chọn | `[]` | Mảng chứa danh sách từ và mốc thời gian Karaoke Subtitle (`CaptionWord[]`). |
| `timeline` | `array` | **Bắt buộc** | `[]` | Danh sách mảng các phân cảnh kịch bản (`TimelineScene[]`). |

#### Chi Tiết `ThemeConfig` (Cấu Hình Màu Sắc & Typography):
```json
{
  "primaryColor": "#C89D35",        // Màu chủ đạo Hoàng Thành (Headers, Viền nổi bật, Accent)
  "secondaryColor": "#9B1B1B",      // Màu phụ Đỏ Son (Con dấu Triện, Badges, Highlights)
  "backgroundColor": "#0E0C0A",     // Màu nền Canvas Sơn Mài (Dark mode bảo tàng)
  "gradientBg": "linear-gradient(135deg, #1e1b4b, #0f172a)", // Nền gradient tùy biến (tùy chọn)
  "fontFamily": "Merriweather, serif", // Font chữ tiếng Việt chuẩn
  "customFontUrl": "/fonts/MyFont.ttf", // URL tải font tùy biến (tùy chọn)
  "headerTitle": "CHRONOVIET HISTORICAL ARCHIVE", // Tiêu đề watermark header góc trên (tùy chọn)
  "accentGlow": "rgba(200, 157, 53, 0.4)" // Hiệu ứng phát sáng/hào quang kim sắc
}
```

---

### 2.2. Cấu Trúc Chi Tiết Cảnh: Scene Object (`TimelineScene`)

Mỗi phần tử trong mảng `timeline` định nghĩa chính xác 1 phân cảnh video:

| Trường Dữ Liệu | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả Kỹ Thuật & Quy Chuẩn |
| :--- | :--- | :---: | :--- |
| `id` | `string` | **Bắt buộc** | Mã định danh scene duy nhất (e.g. `"scene-01-intro"`, `"scene-02-stat"`). |
| `durationInFrames` | `number` | Khuyên dùng | Độ dài scene tính theo số khung hình (ở 30 FPS: 5 giây = 150 frames). Ưu tiên cao nhất. |
| `startTime` | `number` | Tùy chọn | Thời điểm bắt đầu scene tính bằng giây (VD: `0`). |
| `endTime` | `number` | Tùy chọn | Thời điểm kết thúc scene tính bằng giây (VD: `15`). |
| `type` | `enum` | Tùy chọn | Phân loại phân cảnh: `'PURE_CODE'` (render bằng code UI) hoặc `'PURE_IMAGE'` (dùng ảnh tư liệu). |
| `component` | `string` | Tùy chọn | Gợi ý tên Component cho Agent (dùng cho thông tin debug/metadata). |
| `text` | `string` | Tùy chọn | Lời thuyết minh hiển thị tại thanh phụ đề Karaoke phía dưới màn hình. |
| `assetUrl` | `string` | Tùy chọn | Đường dẫn ảnh/video tư liệu chính (đã qua VLM Inspector duyệt). |
| `secondaryAssetUrl`| `string` | Tùy chọn | Đường dẫn ảnh phụ thứ hai (dùng cho layout `SPLIT_COMPARE`). |
| `sceneAudioUrl` | `string` | Tùy chọn | File voiceover riêng lẻ từng scene (nếu không dùng file `audioUrl` tổng). |
| `sfxUrl` | `string` | Tùy chọn | File hiệu ứng âm thanh SFX (tiếng gươm đao, tiếng trống trận, tiếng lật sách cổ). |
| `layoutMode` | `enum` | **Quan trọng** | 1 trong **31 LayoutMode** điều khiển Component UI render scene. |
| `overlayType` | `string` | Tùy chọn | Gắn nhãn overlay (VD: `"QUOTE"`, `"ARTICLE_INTRO"`, `"BIO_CARD"`). |
| `effect` | `enum` | Tùy chọn | Hiệu ứng Ken Burns chuyển động ảnh (xem 6 kiểu tại section 2.5). |
| `customKenBurns` | `object` | Tùy chọn | Tùy chỉnh tọa độ & tỉ lệ Ken Burns (`CustomKenBurns`). |
| `filterStyle` | `enum` | Tùy chọn | Bộ lọc màu ảnh (`'HISTORICAL'`, `'SEPIA'`, `'VINTAGE'`, `'NONE'`). |
| `rotateDeg` | `number` | Tùy chọn | Độ xoay ảnh theo độ (VD: `0`, `90`, `180`). |
| `transition` | `enum` | Tùy chọn | Loại hiệu ứng chuyển cảnh (xem 19 kiểu tại section 2.6). |
| `transitionDurationFrames` | `number` | Tùy chọn | Độ dài hiệu ứng chuyển cảnh tính theo frames (mặc định: `15` frames = 0.5s). |
| `hideSubtitle` | `boolean` | Tùy chọn | `true` để ẩn thanh phụ đề viền dưới (dùng cho scene tiêu đề mở đầu). |
| `hideHeader` | `boolean` | Tùy chọn | `true` để ẩn thanh thương hiệu/chương viền trên. |
| `license` | `enum` | Tùy chọn | Loại giấy phép ảnh (`'PUBLIC_DOMAIN'`, `'CC0'`, `'CC_BY_4_0'`, `'CC_BY_SA_4_0'`). |
| `attribution` | `object` | Tùy chọn | Metadata tác giả & nguồn ảnh (`{ author, sourceUrl, license }`). |
| `requiresAttribution` | `boolean` | Tùy chọn | `true` nếu cần hiển thị credit tác giả góc dưới màn hình. |
| `overlayData` | `object` | **Quan trọng** | Chứa các thuộc tính dữ liệu chuyên biệt truyền trực tiếp cho Component UI. |

---

### 2.3. Cấu Trúc Chi Tiết Thuộc Tính `overlayData` (`OverlayData`)

Mọi thuộc tính trong `overlayData` được bóc tách truyền trực tiếp vào Component React của scene tương ứng:

| Trường Dữ Liệu | Kiểu Dữ Liệu | Dùng Cho LayoutMode | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Tất cả UI Cards | Tiêu đề chính hiển thị trên card/slide. |
| `subtitle` | `string` | Tất cả UI Cards | Tiêu đề phụ / Mô tả ngắn. |
| `chapterNumber` | `string` | `CHAPTER_CARD`, `TITLE_CARD` | Số chương dạng La Mã (VD: `"I"`, `"II"`, `"III"`). |
| `seriesTitle` | `string` | `CHAPTER_CARD`, `ARTICLE_UI` | Tên chuỗi series (VD: `"HỒ SƠ MẬT LỊCH SỬ"`). |
| `author` | `string` | `QUOTE_SLIDE`, `ARTICLE_UI` | Tác giả / Nguồn trích dẫn (VD: `"Đại Việt Sử Ký Toàn Thư"`). |
| `quoteText` | `string` | `QUOTE_SLIDE` | Nội dung câu nói trích dẫn / Thơ / Hịch. |
| `name` | `string` | `STAT_CARD`, `SPONSOR_UI` | Tên nhân vật hoặc thực thể chính. |
| `role` | `string` | `STAT_CARD`, `SPONSOR_UI` | Chức danh / Nhãn vai trò. |
| `details` | `string` | `STAT_CARD`, `MUSEUM_TAG` | Đoạn văn mô tả chi tiết mở rộng. |
| `position` | `enum` | Các UI Cards | Vị trí đặt card trên màn hình: `'LEFT'`, `'RIGHT'`, `'TOP_LEFT'`, `'TOP_RIGHT'`, `'BOTTOM_LEFT'`, `'BOTTOM_RIGHT'`, `'CENTER'`. |
| `sponsorTitle` | `string` | `SPONSOR_UI` | Tiêu đề nhà tài trợ / Đối tác. |
| `sponsorDesc` | `string` | `SPONSOR_UI` | Lời cảm ơn / Nội dung tài trợ. |
| `ctaText` | `string` | `OUTRO_CARD`, `SPONSOR_UI` | Nút Kêu gọi hành động (Call To Action: `"ĐĂNG KÝ KÊNH"`). |
| `statItems` | `array` | `STAT_CARD` | Mảng chứa các chỉ số (`StatItem[]`). |
| `leftSide` | `object` | `VERSUS_CARD` | Thông tin bên tả (`VersusSide`). |
| `rightSide` | `object` | `VERSUS_CARD` | Thông tin bên hữu (`VersusSide`). |
| `bulletPoints` | `array` | `BULLET_HIGHLIGHT` | Mảng danh sách các ý chính (`string[]`). |
| `artifactInfo` | `object` | `MUSEUM_TAG` | Thông tin bảo vật / cổ vật (`ArtifactInfo`). |
| `theories` | `array` | `SPLIT_THEORY` | Danh sách các giả thuyết lịch sử (`HistoricalTheory[]`). |

#### Chi Tiết Các Sub-Interfaces Của `overlayData`:

```typescript
// 1. StatItem (Dùng cho STAT_CARD)
export interface StatItem {
  label: string;  // Nhãn chỉ số (VD: "Năm chiến thắng")
  value: string;  // Giá trị chỉ số (VD: "1288")
  color?: string; // Mã màu hex (VD: "#F59E0B")
}

// 2. VersusSide (Dùng cho VERSUS_CARD)
export interface VersusSide {
  name: string;   // Tên lực lượng (VD: "Đại Việt")
  stat: string;   // Chỉ số lực lượng (VD: "40.000 quân")
  color?: string; // Mã màu diện mạo (VD: "#059669")
  badge?: string; // Nhãn trạng thái (VD: "Chiến thắng")
}

// 3. ArtifactInfo (Dùng cho MUSEUM_TAG)
export interface ArtifactInfo {
  origin?: string;    // Nguồn gốc phát hiện (VD: "Sông Bạch Đằng, Quảng Ninh")
  material?: string;  // Chất liệu chế tạo (VD: "Gỗ Táu cổ")
  period?: string;    // Niên đại lịch sử (VD: "Nhà Trần - Thế kỷ 13")
  location?: string;  // Nơi trưng bày (VD: "Bảo tàng Lịch sử Quốc gia")
  dimensions?: string;// Kích thước (VD: "Dài 2.4m, Đường kính 30cm")
}

// 4. HistoricalTheory (Dùng cho SPLIT_THEORY)
export interface HistoricalTheory {
  title: string;       // Tên giả thuyết (VD: "Giả thuyết 1")
  desc: string;        // Nội dung mô tả giả thuyết
  probability?: string;// Tỷ lệ xác suất (VD: "70%")
}

// 5. CustomKenBurns (Dùng cho tùy chỉnh camera)
export interface CustomKenBurns {
  scaleFrom?: number; // Tỉ lệ zoom bắt đầu (VD: 1.0)
  scaleTo?: number;   // Tỉ lệ zoom kết thúc (VD: 1.25)
  originX?: number;   // Tâm X từ 0.0 đến 1.0 (VD: 0.5)
  originY?: number;   // Tâm Y từ 0.0 đến 1.0 (VD: 0.5)
}

// 6. CaptionWord (Dùng cho Karaoke Subtitle)
export interface CaptionWord {
  word: string;       // Từ thuyết minh
  startFrame: number; // Khung hình bắt đầu đọc từ này
  endFrame: number;   // Khung hình đọc xong từ này
}
```

---

### 2.4. Danh Mục Đầy Đủ 31 LayoutModes Trong Remotion Engine (Tối ưu 16:9 Phim Tài Liệu)

```typescript
export type LayoutMode =
  // Group 1: Pure Image Layouts (11 Modes - Sử dụng ảnh Crawl đã qua VLM duyệt)
  | 'BLUR_BG'          // Ảnh chính ở giữa, làm mờ hậu cảnh tràn màn hình (Phổ biến nhất)
  | 'HISTORICAL_FRAME' // Ảnh đặt trong khung cổ kính mạ vàng / họa tiết sử
  | 'FULL_COVER'       // Ảnh phủ kín toàn màn hình (Crop vừa khung)
  | 'FULL_CONTAIN'     // Ảnh giữ nguyên tỉ lệ gốc, không mờ hậu cảnh
  | 'CENTER_SCALE'     // Zoom nhẹ ảnh ở trung tâm màn hình
  | 'VIGNETTE_DARK'    // Ảnh phủ lớp tối viền đen xung quanh
  | 'SPLIT_COMPARE'    // Chia đôi màn hình so sánh 2 ảnh (assetUrl vs secondaryAssetUrl)
  | 'PURE_IMAGE_FULL'  // Ảnh toàn màn hình không che phủ
  | 'DOCUMENTARY_GRID' // Lưới ảnh tư liệu 16:9
  | 'NEWSPAPER_ARCHIVE'// Phong cách tư liệu trang báo cổ
  | 'GALLERY_3D'       // Triển lãm ảnh 3D không gian di sản

  // Group 2: Pure Code Layouts (20 Modes - Render 100% bằng React Code, KHÔNG DÙNG ẢNH, Tối ưu 16:9)
  | 'TITLE_CARD'       // Màn hình tiêu đề chính tráng lệ 16:9
  | 'CHAPTER_CARD'     // Thẻ báo hiệu chuyển Chương (Chapter I, II, III)
  | 'STAT_CARD'        // Thẻ hiển thị mốc năm, quân số, chỉ số ấn tượng
  | 'VERSUS_CARD'      // Thẻ so sánh tương quan 2 thế lực đối đầu (Tây Sơn vs Thanh, v.v.)
  | 'QUOTE_SLIDE'      // Màn hình trích dẫn Hịch / Thơ / Lời nói lịch sử dạng Sắc Phong
  | 'BULLET_HIGHLIGHT' // Liệt kê điểm nhấn sự kiện trọng tâm
  | 'TIMELINE_CHRONO'  // Trục niên đại sự kiện chạy ngang 16:9 (Horizontal Timeline)
  | 'ROYAL_DECREE'     // Chiếu Cần Vương / Sắc Phong cuộn ngang 16:9 (Imperial Scroll)
  | 'MAP_TACTICAL'     // Sa bàn / Sơ đồ trận đánh lịch sử 16:9 kèm Chú giải (Battle Map UI)
  | 'CHARACTER_PROFILE'// Hồ sơ danh nhân / tướng lĩnh dạng Dual-Column 16:9
  | 'ARTIFACT_INSPECT' // Giao diện thẩm định bảo vật quốc gia 16:9 kèm 4 Hotspot tags
  | 'POEM_RECITING'    // Màn hình ngâm thơ lịch sử / tuyên ngôn độc lập 16:9
  | 'MUSEUM_TAG'       // Thẻ thông tin cổ vật bảo tàng
  | 'SPLIT_THEORY'     // Trình bày các giả thuyết / góc nhìn lịch sử
  | 'ARTICLE_UI'       // Giao diện trích đoạn bài báo sử học
  | 'SPONSOR_UI'       // Thẻ đồng hành / nhà tài trợ
  | 'OUTRO_CARD'       // Màn hình kết thúc video (Subscribe, Kênh)
  | 'QUOTE_CANVAS'     // Trích dẫn dạng parchment canvas
  | 'HERO_SPOTLIGHT'   // Điểm sáng danh nhân lịch sử
  | 'ARMY_STRENGTH';   // Biểu đồ tương quan lực lượng quân sự
```

---

### 2.5. Danh Mục Đầy Đủ 7 Giá Trị Hiệu Ứng Ken Burns (`KenBurnsEffect`)

1. `'KEN_BURNS_ZOOM_IN'`: Thu phóng ống kính tiến vào trung tâm ảnh.
2. `'KEN_BURNS_ZOOM_OUT'`: Thu phóng ống kính lùi ra xa toàn cảnh.
3. `'KEN_BURNS_PAN_LEFT'`: Quét camera từ phải sang trái.
4. `'KEN_BURNS_PAN_RIGHT'`: Quét camera từ trái sang phải.
5. `'KEN_BURNS_PAN_UP'`: Quét camera từ dưới lên trên.
6. `'KEN_BURNS_PAN_DOWN'`: Quét camera từ trên xuống dưới.
7. `'NONE'`: Không áp dụng chuyển động (ảnh tĩnh).

---

### 2.6. Danh Mục Đầy Đủ 19 Hiệu Ứng Chuyển Cảnh (`TransitionType`)

1. `'DISSOLVE'`: Hòa tan hình ảnh nhẹ nhàng.
2. `'FADE'`: Chuyển mờ dần.
3. `'FADE_TO_BLACK'`: Chuyển mờ dần về nền đen.
4. `'LIGHT_LEAK'`: Chuyển cảnh hiệu ứng vệt sáng điện ảnh.
5. `'FILM_BURN'`: Hiệu ứng cháy phim cổ điển.
6. `'GLITCH'`: Chuyển cảnh nhiễu sóng số hiện đại.
7. `'SLIDE_LEFT'`: Trượt phân cảnh sang trái.
8. `'SLIDE_RIGHT'`: Trượt phân cảnh sang phải.
9. `'SLIDE_UP'`: Trượt phân cảnh lên trên.
10. `'SLIDE_DOWN'`: Trượt phân cảnh xuống dưới.
11. `'ZOOM_IN'`: Thu phóng ống kính vào trong.
12. `'ZOOM_OUT'`: Thu phóng ống kính ra ngoài.
13. `'WIPE'`: Gạt màn hình ngang.
14. `'FLIP'`: Lật thẻ 3D.
15. `'CLOCK_WIPE'`: Gạt màn hình theo chiều kim đồng hồ.
16. `'ZOOM_DREAMY'`: Zoom mờ huyền ảo.
17. `'CROSS_ZOOM'`: Zoom xuyên không gian.
18. `'LINEAR_BLUR'`: Chuyển cảnh làm mờ tuyến tính.
19. `'NONE'`: Cắt cảnh trực tiếp không dùng hiệu ứng.

---

## 3. Mã Nguồn Mẫu File JSON Production v4.1 Đầy Đủ (Complete Realistic Payload)

Dưới đây là một file JSON kịch bản hoàn chỉnh chuẩn 100% được sinh ra từ Mô-đun 2 và truyền vào Remotion Render Tool để render video:

```json
{
  "title": "TRẬN NGỌC HỒI ĐỐNG ĐA 1789",
  "subtitle": "ChronoViet Deep Research Series",
  "videoType": "BATTLE",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "theme": {
    "primaryColor": "#DC2626",
    "secondaryColor": "#F59E0B",
    "backgroundColor": "#090D14",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(220, 38, 38, 0.4)"
  },
  "audioUrl": "assets/battle/ngoc-hoi/voiceover_full.wav",
  "bgmUrl": "assets/battle/ngoc-hoi/bgm_epic_heroic.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "GLITCH",
  "enableTransitions": true,
  "fps": 30,
  "captions": [
    { "word": "Đêm", "startFrame": 0, "endFrame": 15 },
    { "word": "mùng", "startFrame": 15, "endFrame": 28 },
    { "word": "4", "startFrame": 28, "endFrame": 40 },
    { "word": "Tết", "startFrame": 40, "endFrame": 52 },
    { "word": "Kỷ", "startFrame": 52, "endFrame": 65 },
    { "word": "Dậu,", "startFrame": 65, "endFrame": 80 }
  ],
  "timeline": [
    {
      "id": "scene-01-title",
      "durationInFrames": 150,
      "type": "PURE_CODE",
      "text": "Đêm mùng 4 Tết Kỷ Dậu, quân Tây Sơn áp sát đồn Ngọc Hồi.",
      "layoutMode": "TITLE_CARD",
      "transition": "FADE_TO_BLACK",
      "hideSubtitle": true,
      "overlayData": {
        "chapterNumber": "I",
        "title": "TRẬN NGỌC HỒI ĐỐNG ĐA 1789",
        "subtitle": "Cuộc Tổng Tấn Công Thần Tốc Tết Kỷ Dậu"
      }
    },
    {
      "id": "scene-02-stat",
      "durationInFrames": 300,
      "type": "PURE_IMAGE",
      "text": "Vua Quang Trung điều động 10 vạn quân cùng 100 voi chiến thần tốc tiến về Thăng Long.",
      "assetUrl": "assets/battle/ngoc-hoi/ngoc-hoi-map.jpg",
      "layoutMode": "STAT_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "HISTORICAL",
      "transition": "GLITCH",
      "overlayData": {
        "title": "THÔNG SỐ LỰC LƯỢNG TÂY SƠN",
        "statItems": [
          { "label": "Quân sĩ thần tốc", "value": "100.000", "color": "#F59E0B" },
          { "label": "Voi chiến bọc giáp", "value": "100", "color": "#DC2626" },
          { "label": "Thời gian hành quân", "value": "5 Ngày", "color": "#059669" }
        ]
      }
    },
    {
      "id": "scene-03-quote",
      "durationInFrames": 240,
      "type": "PURE_CODE",
      "text": "Đánh cho để dài tóc, đánh cho để đen răng. Đánh cho nó bánh xe bất phản!",
      "layoutMode": "QUOTE_SLIDE",
      "transition": "DISSOLVE",
      "overlayData": {
        "quoteText": "Đánh cho để dài tóc. Đánh cho để đen răng. Đánh cho nó bánh xe bất phản, đánh cho nó giáp phản bất hoàn!",
        "author": "Vua Quang Trung - Nguyễn Huệ",
        "role": "Hịch Mẫn Thái 1789"
      }
    },
    {
      "id": "scene-04-pure-code-fallback",
      "durationInFrames": 270,
      "type": "PURE_CODE",
      "text": "Mờ sáng mùng 5 Tết, đồn Ngọc Hồi hoàn toàn bị san phẳng.",
      "layoutMode": "BULLET_HIGHLIGHT",
      "transition": "SLIDE_LEFT",
      "overlayData": {
        "title": "DIỄN BIẾN TRẬN ĐÁNH NGỌC HỒI",
        "bulletPoints": [
          "Mờ sáng mùng 5 Tết: Dùng rơm ướt bện ván gỗ chắn đạn đại bác",
          "Voi chiến Tây Sơn húc đổ cổng đồn Ngọc Hồi",
          "Tướng Thanh Hứa Thế Lai tử trận tại chỗ"
        ]
      }
    }
  ]
}
```

---

## 4. Kiểm Định Runtime & Đăng Ký Compositions

### 4.1. Zod Schema Validation Boundary (`packages/shared-spec/src/schema.ts`)
Khi Agent gọi Remotion Tool, dữ liệu được parse trực tiếp qua Zod Schema. Nếu phát hiện thiếu trường dữ liệu hoặc sai định dạng, Tool trả về lỗi Validation cụ thể để Orchestrator thực hiện Self-Correction Loop:

```typescript
export const ChronoVideoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  videoType: VideoDomainSchema.optional(),
  templateId: TemplateIdSchema.optional(),
  aspectRatio: AspectRatioSchema.default('16:9'),
  theme: ThemeConfigSchema.optional(),
  audioUrl: z.string().optional(),
  captionsUrl: z.string().optional(),
  bgmUrl: z.string().optional(),
  bgmVolume: z.number().optional(),
  defaultLayoutMode: LayoutModeSchema.optional(),
  defaultFilterStyle: FilterStyleSchema.optional(),
  defaultTransition: TransitionTypeSchema.optional(),
  enableTransitions: z.boolean().optional(),
  timeline: z.array(TimelineSceneSchema),
  captions: z.array(CaptionWordSchema).optional(),
  fps: z.number().optional(),
});
```

### 4.2. 11 Compositions Đã Đăng Ký Chính Thức (`packages/remotion-engine/src/Root.tsx`)

Engine đã đăng ký sẵn 1 Composition chung, 5 Compositions chuẩn theo domain nội dung, 2 Compositions định dạng chuyên biệt (Shorts/News) và 3 Legacy Compositions:

```tsx
// Core & Domain Compositions (v4.1 Schema)
<Composition id="ChronoVideo" component={ChronoVideo} defaultProps={templateGeneralTimeline} />
<Composition id="BiographyVideo" component={ChronoVideo} defaultProps={biographyData} />
<Composition id="BattleVideo" component={ChronoVideo} defaultProps={battleData} />
<Composition id="DynastyVideo" component={ChronoVideo} defaultProps={dynastyData} />
<Composition id="MysteryVideo" component={ChronoVideo} defaultProps={mysteryData} />
<Composition id="ArtifactVideo" component={ChronoVideo} defaultProps={artifactData} />
<Composition id="QuickShortsVideo" component={ChronoVideo} defaultProps={shortsData} width={1080} height={1920} />
<Composition id="ModernNewsVideo" component={ChronoVideo} defaultProps={newsData} />

// Legacy Compositions (all using ChronoVideo component)
<Composition id="QuangTrungVideo" component={ChronoVideo} defaultProps={quangTrungData} />
<Composition id="MongolViet2Video" component={ChronoVideo} defaultProps={mongolViet2Data} />
<Composition id="HaiBaTrungVideo" component={ChronoVideo} defaultProps={haiBaTrungData} />
```

---

## 5. Lệnh Render MP4 Từ Tool Executable (CLI) (Chạy tại Root Monorepo)

Khi Orchestrator hoặc Render Worker kích hoạt CLI từ **Root Monorepo**:

```bash
# Render MP4 theo props từ file JSON kịch bản do Multi-Agent tạo ra (Chuẩn SSOT Workspace):
pnpm --filter @chronoviet/remotion-engine cli render -i media/projects/battle_001/project_schema.json -o media/projects/battle_001/output/video.mp4

# Render với correlation ID và project ID để đồng bộ distributed logs:
pnpm --filter @chronoviet/remotion-engine cli render -i media/projects/battle_001/project_schema.json -o media/projects/battle_001/output/video.mp4 -k job-12345 -p project-abc

# Render các kịch bản domain chuẩn:
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/biography_tran_hung_dao.json -o media/projects/biography_001/output/video.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/battle_bach_dang_938.json -o media/projects/battle_002/output/video.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/dynasty_nha_ly.json -o media/projects/dynasty_001/output/video.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/mystery_le_chi_vien.json -o media/projects/mystery_001/output/video.mp4
pnpm --filter @chronoviet/remotion-engine cli render -i eval/test-cases/artifact_trong_dong_ngoc_lu.json -o media/projects/artifact_001/output/video.mp4

# Chạy deterministic unit tests (Tier 4 verification):
pnpm --filter @chronoviet/remotion-engine test

# Chạy evaluation benchmark suite:
pnpm --filter @chronoviet/remotion-engine eval
```

---

## 6. Khả Năng Quan Sát & Telemetry (Observability)

1. **Structured Asset Load Telemetry:** Khi ảnh tư liệu bị lỗi (404, network failure, invalid format), `SlideImage.tsx` tự động ghi log cảnh báo cấu trúc `render.asset_load_failed` (kèm `assetUrl`, `sceneId`, `layoutMode`) và fallback an toàn sang vector placeholder để Chromium render trơn tru mà không bị crash pipeline.
2. **Runtime Sanity Checks:** `Root.tsx` cảnh báo tự động `render.duration_warning` khi video có thời lượng bất thường (<30 frames).
3. **Correlation Context:** CLI hỗ trợ `--correlation-id` (`-k`) và `--project-id` (`-p`) gắn vào Logger Context giúp trace log liền mạch qua BullMQ queues và Orchestrator state.

