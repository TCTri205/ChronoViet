# KỊCH BẢN CHI TIẾT & BẢNG PHÂN CẢNH PRODUCTION (PRODUCTION SCRIPT & ASSET PROMPTS)

> **Tác phẩm:** BÍ ẨN THẢM ÁN LỆ CHI VIÊN & NỖI OAN KHUẤT CỦA NGUYỄN TRÃI (1442)  
> **Dự án:** ChronoViet (Video Essay / Historical Motion Graphics)  
> **MĂ£ Domain:** `MYSTERY`  
> **Thời lượng:** 6 phút 15 giây (375 giây / 11.250 frames @ 30fps) | **JSON scenes:** 19 (scene_00 brand intro + 18 nội dung)  
> **Phong cách Visual:** Trinh thám Lịch sử (Historical True Crime), Tông màu u tối huyền bí, Nến cháy trong đêm bão, Án văn sương mờ & Hiệu ứng Ken Burns kịch tính hồi hộp.

---

## 🎨 1. BỘ THIẾT KẾ NHẬN DIỆN THỊ GIÁC (VISUAL DESIGN SYSTEM)

* **Palette màu chính:**
  * **Crimson Blood (Đỏ Máu Thảm Án):** `#8B0000` & `#991B1B` (Tiêu đề, vết mực đỏ án phạt, ngọn lửa nghi án)
  * **Charcoal Black (Đêm Đen Lệ Chi Viên):** `#090D14` & `#0F172A` (Nền chính, bối cảnh u uất đêm 27 tháng 7)
  * **Muted Gold (Vàng Cổ Sao Khuê):** `#D4AF37` & `#F59E0B` (Lòng Nguyễn Trãi, lời minh oan Vua Lê Thánh Tông)
  * **Mystic Slate (Xanh Tím Huyền Bí Triều Chính):** `#1E1B4B` & `#312E81` (Sơ đồ phe phái triều đình, giả thuyết)

* **Typography:**
  * **Title Main:** `Merriweather` Bold / `UTM Classique Saigon` (Letter spacing 0.08em, hiệu ứng khắc đá u tối)
  * **Quote Text:** `Playfair Display` Italic / `Georgia` (Màu vàng sao Khuê nổi bật trên khung kính mờ)
  * **Voice Subtitle:** `Be Vietnam Pro` (Font size 30px, viền chữ đen 2px, nền dải lụa mờ)

---

## 🎬 2. BẢNG PHÂN CẢNH CHI TIẾT 20 SCENES (SHOT-BY-SHOT BREAKDOWN)

| Scene ID | Thời gian | Lời thuyết minh chi tiết (Voiceover Script) | Mô tả Hình ảnh & Chuyển động Camera | Âm thanh & Hiệu ứng (SFX / BGM) | Prompt AI Sinh ảnh (Midjourney / Flux) / Asset Specs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scene 01** | `00:00 - 00:20` | *"Đêm ngày 27 tháng 7 năm Nhâm Tuất 1442, tại khu vườn vải Lệ Chi Viên... một cái chết đột ngột của vị vua trẻ đã châm ngòi cho thảm án tàn khốc và bí ẩn bậc nhất trong lịch sử phong kiến Việt Nam. Thảm án trút xuống đầu gia tộc Nguyễn Trãi – khai quốc công thần và là Danh nhân văn hóa thế giới."* | Cảnh vườn vải Lệ Chi Viên trong đêm giông bão, lá cây chao đảo dưới ánh chớp giật liên hồi, bóng hoàng gia ngã xuống. | **SFX:** Tiếng gió rít qua rặng cây, tiếng sấm nổ rền, tiếng nến phụt tắt. **BGM:** Nhạc trinh thám u uất căng thẳng. | `Dark mysterious lychee garden Le Chi Vien at midnight, heavy storm lightning, ominous shadows, dramatic 15th century --ar 16:9` |
| **Scene 02** | `00:20 - 00:40` | *"Nguyễn Trãi (1380 - 1442) – người đã dốc trọn tâm huyết soạn 'Bình Ngô Đại Cáo' dựng xây triều Lê Sơ. Bên cạnh ông là Nguyễn Thị Lộ – một người phụ nữ tài sắc vẹn toàn, được Vua Lê Thái Tông tin yêu bổ dụng làm Lễ nghi quan chuyên dạy bảo cung nữ."* | Chân dung tri thức uy nghi của Nguyễn Trãi bên cuốn Bình Ngô Đại Cáo và Nguyễn Thị Lộ trong trang phục Lễ nghi quan. *(Hiển thị Bio Card)* | **SFX:** Tiếng lật trang sách cổ, tiếng nhạc trầm lắng hoài niệm. | `Portrait of ancient scholar Nguyen Trai and his intelligent wife Nguyen Thi Lo, royal court setting 15th century --ar 16:9` |
| **Scene 03** | `00:40 - 01:00` | *"Vua Lê Thái Tông – vị vua trẻ 20 tuổi đầy hoài bảo – trên đường đi duyệt quân ở Chí Linh đã ghé thăm nơi ở ẩn của Nguyễn Trãi tại Côn Sơn. Khi trở về đến Lệ Chi Viên (Gia Bình, Bắc Ninh), vua thức suốt đêm với Nguyễn Thị Lộ rồi đột ngột trút hơi thở cuối cùng."* | Hoàng đế Lê Thái Tông nằm trên sập rồng tại Lệ Chi Viên, Nguyễn Thị Lộ bàng hoàng hoảng sợ trong đêm tối. | **SFX:** Tiếng tim đập dồn dập (Heartbeat SFX), tiếng thở dốc lịm dần. | `King Le Thai Tong suddenly passing away in imperial tent at Le Chi Vien, high tension emotional scene --ar 16:9` |
| **Scene 04** | `01:00 - 01:20` | *"Ngay lập tức, triều đình quy tội cho Nguyễn Thị Lộ mưu sát Vua. Nguyễn Trãi bị khép vào tội mưu phản. Án phạt tàn khốc nhất lịch sử – Tru di tam tộc (chém sạch ba họ) – được thi hành thần tốc, lấy đi mạng sống của hơn một trăm con người vô tội."* | Thẻ hình phạt tàn khốc (Tru di tam tộc) hiển thị trên nền mực máu loang lổ và gươm đao triều đình. *(Hiển thị Event Badge)* | **SFX:** Tiếng gươm chém chát chúa, tiếng khóc than nghẹn ngào, tiếng trống án nổ rền. | `Dark red ink splatter background with ancient execution swords, tragic historic tone --ar 16:9` |
| **Scene 05** | `01:20 - 01:40` | *"Nhưng đằng sau bản án vội vã ấy là gì? Liệu Nguyễn Thị Lộ có thực sự đầu độc vua, hay đây là một âm mưu chính trị được dàn dựng tỉ mỉ nhằm thanh tiêu diệt công thần kiệt xuất nhất triều đình?"* | Đồ họa phân tích trinh thám: Kính phóng đại soi chiếu bản án cổ, các dấu chấm hỏi nghi vấn phát sáng. | **SFX:** Tiếng kính vỡ nhẹ, tiếng đồng hồ tích tắc hồi hộp. | `Detective style inspection of ancient Vietnamese imperial verdict document, magnifying glass, high suspense --ar 16:9` |
| **Scene 06** | `01:40 - 02:00` | *"Để hiểu thảm án, phải nhìn vào cuộc đấu tranh quyền lực triều chính lúc bấy giờ. Hoàng thái hậu Nguyễn Thị Anh – mẹ của Hoàng tử Lê Nhân Tông 2 tuổi – đang lo sợ ngôi báu bị đe dọa bởi Hoàng tử Lê Tư Thành, người vốn được Nguyễn Trãi và phe trung lập ủng hộ."* | Sơ đồ đối đầu phe phái: Phe Thái hậu Nguyễn Thị Anh vs Phe Hoàng tử Lê Tư Thành & Nguyễn Trãi. *(Hiển thị Split Theory)* | **SFX:** Tiếng quân cờ di chuyển trên bàn cờ triều đình, tiếng nhạc âm mưu. | `Infographic chart showing court faction struggle between Queen Mother Nguyen Thi Anh and Nguyen Trai faction --ar 16:9` |
| **Scene 07** | `02:00 - 02:20` | *"GIẢ THUYẾT 1 (Đạt 65% nghi vấn): Đây là vụ ám sát chính trị do Tuyên Cực Thái hậu Nguyễn Thị Anh đứng sau chỉ đạo. Bà lợi dụng chuyến đi của vua để ra tay đầu độc, sau đó đổ toàn bộ tội lỗi cho Nguyễn Thị Lộ để diệt trừ Nguyễn Trãi."* | Thẻ giả thuyết 1 (Âm mưu đầu độc tranh ngôi) hiển thị chi tiết các manh mối chính trị triều đình. *(Hiển thị Split Theory)* | **SFX:** Tiếng chén thuốc độc nhỏ giọt, tiếng nhạc nghi vấn căng thẳng. | `Theory 1 graphic badge: Political Assassination conspiracy by Queen Mother, dark purple palette --ar 16:9` |
| **Scene 08** | `02:20 - 02:40` | *"GIẢ THUYẾT 2 (Đạt 35% nghi vấn): Vua Lê Thái Tông qua đời đột ngột vì bệnh lý y học – một cơn cảm sốt ác tính hoặc đột quỵ do hành quân vất vả giữa mùa hè oi bức. Nguyễn Thị Lộ và Nguyễn Trãi chỉ là những nạn nhân thế mạng cho sự hoảng loạn của triều đình."* | Thẻ giả thuyết 2 (Đột quỵ y học / Cảm sốt) hiển thị các triệu chứng y khoa thời phong kiến. *(Hiển thị Split Theory)* | **SFX:** Tiếng gió bão mùa hè rít qua, tiếng nhịp tim lịm dần. | `Theory 2 graphic badge: Medical Stroke or Acute Fever theory, muted blue palette --ar 16:9` |
| **Scene 09** | `02:40 - 03:00` | *"Sau thảm án, Tuyên Cực Thái hậu nhanh chóng buông rèm xí xóa điều tra. Di sản của Nguyễn Trãi – từ tác phẩm Bình Ngô Đại Cáo đến toàn bộ tập thơ 'Ức Trai tập' – đều bị tiêu hủy, cấm đoán lưu hành. Đêm trường u tối phủ lên tên tuổi ông suốt 20 năm."* | Những trang thơ văn của Nguyễn Trãi bị đốt cháy trong đêm, tro tàn bay tản mạn giữa không trung đen tối. | **SFX:** Tiếng ngọn lửa liếm giấy nổ lách tách, tiếng quạ kêu buồn thảm. | `Ancient poetry manuscripts of Nguyen Trai burning to ashes in dark imperial courtyard, sorrowful atmosphere --ar 16:9` |
| **Scene 10** | `03:00 - 03:20` | *"Bên cạnh các giả thuyết lịch sử, dân gian còn thêu dệt nên huyền thoại 'Xà báo oán' – câu chuyện con rắn bị Nguyễn Trãi vô tình diệt tộc hóa thân thành Nguyễn Thị Lộ để trả thù. Dù mang màu sắc hoang đường, huyền thoại ấy phản ánh niềm thương xót vô hạn của nhân dân trước nỗi oan ngút trời của ông."* | Hình ảnh minh họa mờ ảo huyền bí về huyền thoại Xà báo oán hòa quyện trong làn sương khói cổ tích. | **SFX:** Tiếng sương mù dâng dạt, tiếng đàn bầu bi ai. | `Ethereal mythical artwork illustrating the folk legend of Snake Vengeance, glowing mist --ar 16:9` |
| **Scene 11** | `03:20 - 03:40` | *"Năm 1460, Hoàng tử Lê Tư Thành lên ngôi, trở thành Vua Lê Thánh Tông – vị vua vĩ đại nhất triều Lê. Ngay sau khi nắm trọn quyền lực, nhà vua lập tức cho mở lại hồ sơ thảm án Lệ Chi Viên để tìm lại sự thật."* | Hoàng đế Lê Thánh Tông uy nghi trên ngai vàng giật phán quyết mở lại hồ sơ minh oan cho Nguyễn Trãi. *(Hiển thị Bio Card)* | **SFX:** Tiếng chuông rồng vang rực rỡ, tiếng xé phán quyết oan nổ rền. | `Wise Emperor Le Thanh Tong reviewing ancient trial records at imperial palace, golden light breaking dark clouds --ar 16:9` |
| **Scene 12** | `03:40 - 04:00` | *"Năm 1464, Vua Lê Thánh Tông chính thức ban sắc minh oan cho Nguyễn Trãi, truy tặng ông tước Tán Trù Bá, cho tìm lại con cháu còn sống sót ra làm quan, và ra lệnh thu thập lại toàn bộ di văn thơ thơ bị cấm đoán."* | Chiếu thư minh oan của Lê Thánh Tông tỏa hào quang vàng rực rỡ, xua tan hoàn toàn bóng tối thảm án Lệ Chi Viên. | **SFX:** Tiếng nhạc giao hưởng vút cao kiêu hãnh, tiếng tù và hoàng gia. | `Vindication decree of King Le Thanh Tong glowing with bright gold light, erasing dark shadows --ar 16:9` |
| **Scene 13** | `04:00 - 04:20` | *"Thẻ trích dẫn lời đánh giá bất hủ của Vua Lê Thánh Tông: 'Ức Trai tâm thượng quang khuê táo' – Lòng Ức Trai Nguyễn Trãi sáng như sao Khuê chiếu sáng lịch sử dân tộc!"* | Thẻ trích dẫn "Lòng Ức Trai sáng như sao Khuê" với chòm sao Khuê tỏa sáng lấp lánh trên bầu trời đêm Việt Nam. *(Hiển thị Quote Canvas)* | **SFX:** Tiếng ngân vang thiêng liêng của tiếng chuông đồng, tiếng sáo vút cao. | `Calligraphy quote card with glowing Khue star constellation over dark blue starlit sky --ar 16:9` |
| **Scene 14** | `04:20 - 04:40` | *"Các tác phẩm kiệt tác như Bình Ngô Đại Cáo, Quân Trung Từ Mệnh Tập, Quốc Âm Thi Tập nhờ đó mà sống lại, trở thành di sản văn hóa bất tử của dân tộc Việt Nam và nhân loại."* | Cuốn Bình Ngô Đại Cáo và Quốc Âm Thi Tập tỏa ánh sáng vàng kim giữa điện bảo tàng trang trọng. | **SFX:** Tiếng lật trang sách cổ, tiếng nhạc cung đình hào hùng. | `Illuminated manuscripts of Binh Ngo Dai Cao and Quoc Am Thi Tap displayed in golden light --ar 16:9` |
| **Scene 15** | `04:40 - 05:00` | *"Năm 1980, nhân kỷ niệm 600 năm ngày sinh của ông, tổ chức UNESCO đã chính thức công nhận Nguyễn Trãi là Danh nhân Văn hóa Thế giới – tôn vinh một tư tưởng nhân văn vĩ đại: 'Việc nghĩa trước hết để yên dân / Quân làm gian tà phải trừ tiêu diệt'."* | Biểu tượng UNESCO vinh danh Danh nhân Văn hóa Thế giới Nguyễn Trãi trên nền tượng đài Côn Sơn. *(Hiển thị Stat Card)* | **SFX:** Tiếng pháo mừng vinh danh quốc tế, âm nhạc tự hào. | `UNESCO World Cultural Celebrity badge honoring Nguyen Trai over Con Son monument background --ar 16:9` |
| **Scene 16** | `05:20 - 05:40` | *"Thảm án Lệ Chi Viên là một bài học đắt giá về sự tàn khốc của quyền lực triều chính phong kiến, nhưng đồng thời là bằng chứng chứng minh: Sự thật và lòng trung trinh có thể bị vùi lấp trong chốc khảnh, nhưng giá trị vĩ đại sẽ mãi mãi trường tồn."* | Khu di tích Lệ Chi Viên ngày nay xanh tươi ngợp bóng cây vải, tượng đài Nguyễn Trãi và Nguyễn Thị Lộ thanh bình dưới nắng ấm. | **SFX:** Tiếng chim hót thanh bình, tiếng gió thổi rào rạt qua lá vải. | `Modern Le Chi Vien memorial site, green lychee trees under bright warm sunlight, peaceful sanctuary --ar 16:9` |
| **Scene 17** | `05:40 - 06:00` | *"Trái tim yêu nước thương dân của Nguyễn Trãi và nỗi oan khuất Lệ Chi Viên sẽ mãi mãi là trang sử bi hùng nhói đau nhưng vô cùng kiêu hãnh của dân tộc."* | Tượng đài Nguyễn Trãi soi bóng xuống dòng sông Côn Sơn lung linh hào quang mặt trời mọc. | **SFX:** Âm nhạc kết cao trào vô cùng xúc động và tự hào. | `Majestic statue of Nguyen Trai looking at golden sunrise over Con Son river, inspiring emotion --ar 16:9` |
| **Scene 18** | `06:00 - 06:15` | *"Nguyễn Trãi – Danh nhân Văn hóa Thế giới, Trái tim trường tồn cùng sông núi Việt Nam."* | Thẻ ghi nhận di sản lịch sử (Historical Note): "DI SẢN NGUYỄN TRÃI BẤT TỬ". | **SFX:** Tiếng chuông đồng ngân dài linh thiêng. | `Gold inscribed heritage badge on dark crimson slate background --ar 16:9` |
| **Scene 19** | `06:15 - 06:30` | *"Bí ẩn vụ án Lệ Chi Viên – Trang sử bi hùng của Danh nhân Nguyễn Trãi."* | Màn hình thương hiệu ChronoViet Outro Card kết hợp lời kêu gọi đăng ký và theo dõi các tập tiếp theo. | **SFX:** Sound boom kết thúc. **BGM:** Outro Track Fade Out. | `ChronoViet branding outro card with subscribe button and recommended videos layout --ar 16:9` |

---

## 🛠️ 3. TEMPLATE DỮ LIỆU JSON CHO ENGINE REMOTION (`mysteryLeChiVienTimeline.json`)

Tệp này nằm tại `packages/remotion-engine/src/data/mysteryTimeline.json` và đã được đăng ký tại `Root.tsx` với Composition ID `MysteryVideo`.

> **Chuẩn:** Schema v4.1 — tương thích 100% với `ChronoVideoSchema` tại [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts).

```json
{
  "title": "BÍ ẨN THẢM ÁN LỆ CHI VIÊN & NGUYỄN TRÃI (1442)",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Thảm Án Lệ Chi Viên",
  "videoType": "MYSTERY",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "fps": 30,
  "audioUrl": "assets/mystery/le-chi-vien/voiceover.wav",
  "bgmUrl": "assets/mystery/le-chi-vien/bgm.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "VIGNETTE_DARK",
  "defaultFilterStyle": "SEPIA",
  "defaultTransition": "FADE_TO_BLACK",
  "theme": {
    "primaryColor": "#6B7280",
    "secondaryColor": "#374151",
    "backgroundColor": "#050709",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(107, 114, 128, 0.3)"
  },
  "timeline": [
    {
      "id": "scene_00_intro",
      "startTime": 0,
      "endTime": 15,
      "text": "ChronoViet Documentary Series — Thảm Án Lệ Chi Viên.",
      "layoutMode": "ARTICLE_UI",
      "overlayType": "ARTICLE_INTRO",
      "transition": "FADE_TO_BLACK",
      "hideHeader": true,
      "overlayData": {
        "title": "BÍ ẨN THẢM ÁN LỆ CHI VIÊN 1442",
        "author": "ChronoViet Research Team"
      }
    },
    {
      "id": "scene_01_title",
      "startTime": 15,
      "endTime": 35,
      "text": "Đêm ngày 27 tháng 7 năm 1442, tại khu vườn vải Lệ Chi Viên... cái chết đột ngột của vị vua trẻ đã châm ngòi cho thảm án tàn khốc và bí ẩn bậc nhất lịch sử Việt Nam.",
      "assetUrl": "assets/mystery/le-chi-vien/scene_01_garden_night.jpg",
      "layoutMode": "TITLE_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "SEPIA",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "chapterNumber": "PHẦN I",
        "title": "THẢM ÁN LỆ CHI VIÊN",
        "subtitle": "Nỗi Oan Khuất Ba Dòng Họ của Danh Nhân Nguyễn Trãi"
      }
    },
    {
      "id": "scene_mystery_split",
      "startTime": 90,
      "endTime": 115,
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
    },
    {
      "id": "scene_13_quote",
      "startTime": 240,
      "endTime": 260,
      "text": "Ức Trai tâm thượng quang khuê táo!",
      "layoutMode": "QUOTE_CANVAS",
      "overlayType": "QUOTE",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "quoteText": "Ức Trai tâm thượng quang khuê táo (Lòng Ức Trai sáng như sao Khuê)",
        "author": "Vua Lê Thánh Tông (Lời minh oan năm 1464)"
      }
    },
    {
      "id": "scene_15_outro",
      "startTime": 360,
      "endTime": 375,
      "text": "Nguyễn Trãi – Danh nhân văn hóa thế giới, tấm lòng sáng như sao Khuê mãi tỏa sáng cùng dân tộc.",
      "layoutMode": "OUTRO_CARD",
      "overlayType": "OUTRO_CARD",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "title": "BÍ ẨN THẢM ÁN LỆ CHI VIÊN",
        "quoteText": "Ức Trai tâm thượng quang khuê táo.",
        "ctaText": "CHRONOVIET DOCUMENTARY SERIES • CHUYÊN ĐỀ LỊCH SỬ CHUYÊN SÂU",
        "bulletPoints": ["MINH OAN 1464", "DANH NHÂN NGUYỄN TRÃI", "ỨC TRAI TẬP"]
      }
    }
  ]
}
```

