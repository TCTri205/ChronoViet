# KỊCH BẢN CHI TIẾT & BẢNG PHÂN CẢNH PRODUCTION (PRODUCTION SCRIPT & ASSET PROMPTS)

> **Tác phẩm:** HƯNG ĐẠO ĐẠI VƯƠNG TRẦN QUỐC TUẤN – HUYỀN THOẠI BÁCH CHIẾN BÁCH THẮNG  
> **Dự án:** ChronoViet (Video Essay / Historical Motion Graphics)  
> **MĂ£ Domain:** `BIOGRAPHY`  
> **Thời lượng:** 6 phút 45 giây (405 giây / 12.150 frames @ 30fps) | **JSON scenes:** 21 (scene_00 brand intro + 20 nội dung)  
> **Phong cách Visual:** Đồ họa Cổ phong Hoàng gia nhà Trần, Vàng Son Hoàng Kim, Hào khí Đông A, Chữ Sát Thát xăm cánh tay & Hiệu ứng Ken Burns tráng lệ.

---

## 🎨 1. BỘ THIẾT KẾ NHẬN DIỆN THỊ GIÁC (VISUAL DESIGN SYSTEM)

* **Palette màu chính:**
  * **Imperial Gold (Hoàng Kim Thái Sư):** `#D4AF37` & `#F59E0B` (Tiêu đề, giáp trụ Thái sư, cờ Hào khí Đông A)
  * **Royal Crimson (Đỏ Son Triều Trần):** `#8B0000` & `#991B1B` (Hịch Tướng Sĩ, chữ Sát Thát, máu chiến trường)
  * **Navy Slate (Xanh Sông Lục Đầu & Thiên Trường):** `#1E293B` & `#0F172A` (Bối cảnh Vạn Kiếp, thủy chiến sông Hồng)
  * **Jade Bronze (Đồng Cổ & Khuê Táo):** `#78350F` & `#B45309` (Binh Thư Yếu Lược, sắc phong triều đình)

* **Typography:**
  * **Title Main:** `Merriweather` Bold / `UTM Classique Saigon` (Letter spacing 0.08em, hiệu ứng đúc đồng viền vàng)
  * **Quote Text:** `Playfair Display` Italic / `Georgia` (Nổi bật trên nền mờ glassmorphic)
  * **Voice Subtitle:** `Be Vietnam Pro` (Font size 30px, viền chữ đen 2px, nền dải lụa mờ)

---

## 🎬 2. BẢNG PHÂN CẢNH CHI TIẾT 20 SCENES (SHOT-BY-SHOT BREAKDOWN)

| Scene ID | Thời gian | Lời thuyết minh chi tiết (Voiceover Script) | Mô tả Hình ảnh & Chuyển động Camera | Âm thanh & Hiệu ứng (SFX / BGM) | Prompt AI Sinh ảnh (Midjourney / Flux) / Asset Specs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scene 01** | `00:00 - 00:20` | *"Trong chiều dài hàng ngàn năm dựng nước và giữ nước, lịch sử Việt Nam đã sản sinh ra nhiều vị tướng tài ba. Nhưng vị tướng duy nhất được nhân dân suy tôn thành 'Thánh', được cả thế giới nghiêng mình kính trọng như một thiên tài quân sự kiệt xuất – chính là Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn."* | Tượng đài Đức Thánh Trần đứng kiêu hãnh trên đỉnh núi Vạn Kiếp, ánh nắng hoàng hôn rực rỡ chiếu qua làn mây ngũ sắc. | **SFX:** Tiếng chuông đền linh thiêng ngân dài, tiếng gió thổi rào rạt. **BGM:** Nhạc giao hưởng cổ phong hào hùng. | `Majestic statue of Tran Hung Dao on Van Kiep mountain peak at sunset, golden rays, sacred Vietnamese historical art --ar 16:9` |
| **Scene 02** | `00:20 - 00:40` | *"Trần Quốc Tuấn sinh năm 1228 tại phủ Thiên Trường (Nam Định). Ông là con trai thứ của An Sinh Vương Trần Liễu. Ngay từ nhỏ, ông đã tỏ ra thông minh kiệt xuất, thông tuệ văn võ, đọc rộng sách thi thư và có hoài hoắc kinh bang tế thế."* | Hình ảnh thiếu niên Trần Quốc Tuấn bên trang sách cổ và thanh kiếm phong, bối cảnh vùng đất Thiên Trường trù phú. *(Hiển thị Bio Card)* | **SFX:** Tiếng lật sách cổ, tiếng tuốt kiếm nhẹ. **BGM:** Nhạc trầm tĩnh trí tuệ. | `Young Tran Quoc Tuan studying ancient military scrolls and practicing sword in Tran dynasty palace, peaceful lighting --ar 16:9` |
| **Scene 03** | `00:40 - 01:00` | *"Thế kỷ 13, đế chế Mông - Nguyên trỗi dậy như một cơn cuồng phong đẫm máu. Từ thảo nguyên Á Đông đến tận Tây Âu, vó ngựa Mông Cổ đi đến đâu, cỏ không mọc được đến đó. Họ đập tan hàng trăm vương quốc và san phẳng kinh thành hàng loạt quốc gia."* | Bản đồ động thể hiện sự giãn nở thần tốc của Đế quốc Mông Cổ từ mảng lục địa Á-Âu đến sát biên giới Đại Việt. | **SFX:** Tiếng vó ngựa giậm dồn dập rền trời, tiếng lửa cháy bùng bùng. | `Animated map of Mongol Empire conquest sweeping across Eurasia towards Vietnam 13th century, fiery trail --ar 16:9` |
| **Scene 04** | `01:00 - 01:20` | *"Trước khi qua đời, thân phụ Trần Liễu từng dặn Trần Quốc Tuấn phải chiếm lấy thiên hạ để trả thù nhà. Nhưng đứng trước nguy cơ diệt vong của dân tộc, Trần Quốc Tuấn đã đặt đại nghĩa quốc gia lên trên hết, chủ động hòa giải mối thù gia tộc với Trần Quang Khải tại bến Bình Than."* | Trần Quốc Tuấn tự tay tắm rửa cho Trần Quang Khải trên thuyền ở bến Bình Than, xóa bỏ mọi hiềm thù vì sự nghiệp cứu quốc. | **SFX:** Tiếng nước chảy róc rách, tiếng ly chén va chạm nhẹ. | `Emotional historical moment of Tran Hung Dao reconciling with Tran Quang Khai on boat at Binh Than wharf, brotherhood unity --ar 16:9` |
| **Scene 05** | `01:20 - 01:40` | *"Năm 1285, Thoát Hoan dẫn 50 vạn quân Nguyên tràn sang xâm lược. Vua Trần Thánh Tông lo lắng hỏi: 'Thế giặc mạnh như vậy, hay là ta tạm hàng?'. Trần Quốc Tuấn dứt khoát trả lời câu nói bất tử: 'Bệ hạ chém đầu tôi trước rồi hãy hàng!'"* | Thẻ trích dẫn nghệ thuật (Quote Card) hiển thị câu nói bất hủ của Trần Quốc Tuấn với hiệu ứng chữ mạ vàng rực cháy. | **SFX:** Tiếng gieo quẻ nổ rền, tiếng tuốt kiếm kiên cường. **BGM:** Nhạc cao trào căng thẳng. | `Epic quote card displaying Tran Hung Dao famous oath to King Tran Thanh Tong, dark crimson glassmorphism --ar 16:9` |
| **Scene 06** | `01:40 - 02:00` | *"Để xốc lại tinh thần quân sĩ, ông soạn tác phẩm bất hủ 'Hịch Tướng Sĩ' – ngọn lửa thiêu đốt tâm hồn mọi chiến binh Đại Việt. Hàng vạn quân sĩ cảm động ứa nước mắt, đồng lòng xăm lên cánh tay hai chữ 'SÁT THÁT' – thề thốt giết giặc Mông Cổ bảo vệ quê hương!"* | Tướng sĩ nhà Trần giơ cao cánh tay xăm chữ "SÁT THÁT" đỏ thẫm dưới ngọn đuốc rực sáng đêm Bình Than. | **SFX:** Tiếng hò reo "Sát Thát! Sát Thát!" làm rung chuyển sông núi, tiếng ngọn lửa cháy. | `Vietnamese soldiers raising arms inscribed with Sat That tattoos around campfire, intense patriotic determination --ar 16:9` |
| **Scene 07** | `02:00 - 02:20` | *"Không chỉ là ngọn đuốc tinh thần, ông còn biên soạn bộ 'Binh Thư Yếu Lược' – cuốn sách lý luận quân sự đầu tiên của Việt Nam, dạy tướng sĩ nghệ thuật 'Lấy đoản binh thắng trường binh', tránh thế mạnh ban đầu của giặc để chờ thời cơ phản công."* | Cuốn Binh Thư Yếu Lược mở ra với những nét chữ Nôm cổ, xung quanh là sơ đồ dàn trận quân sự Đại Việt. | **SFX:** Tiếng viết cọ trên giấy giang, tiếng sáo trúc trầm hùng. | `Ancient Vietnamese military manual Binh Thu Yeu Luoc manuscript with tactical battlefield diagrams --ar 16:9` |
| **Scene 08** | `02:20 - 02:40` | *"Trước sức tiến công như vũ bão của giặc, Trần Quốc Tuấn thực hiện cuộc rút lui chiến lược vĩ đại từ Thăng Long về Vạn Kiếp và Thiên Trường. Ông kiên quyết thi hành chiến thuật 'Vườn không nhà trống', triệt hạ toàn bộ nguồn lương thảo của quân Nguyên."* | Cảnh kinh thành Thăng Long di tản hoang vắng, quân Nguyên Mông vào thành trống rỗng không một hạt gạo. | **SFX:** Tiếng quạ kêu đêm hoang vắng, tiếng gió rít qua phố xá không người. | `Evacuated empty citadel of Thang Long, abandoned streets under dark gray sky, scorched earth tactic --ar 16:9` |
| **Scene 09** | `02:40 - 03:00` | *"Một trong những điểm đặc sắc nhất của Trần Quốc Tuấn là tư duy nhìn người và trọng dụng nhân tài. Ông không phân biệt nguồn gốc xuất thân, cất nhắc hàng loạt danh tướng kiệt xuất: Phạm Ngũ Lão từ người đan sọt, Yết Kiêu, Dã Tượng và thiếu niên anh hùng Trần Quốc Toản."* | Chân dung tập hợp các danh tướng nhà Trần: Phạm Ngũ Lão, Yết Kiêu, Dã Tượng và Trần Quốc Toản tay bóp nát quả cam. *(Hiển thị Event Badge)* | **SFX:** Tiếng trống trận giục giã, tiếng quả cam bị bóp vỡ chát chúa. | `Collage of brilliant generals under Tran Hung Dao (Pham Ngu Lao, Yet Kieu, Da Tuong, Tran Quoc Toan) --ar 16:9` |
| **Scene 10** | `03:00 - 03:20` | *"Mùa hè năm 1285, quân giặc sa lầy, đói khát và kiệt sức vì chướng khí. Thượng phụ Tiết chế phát lệnh tổng phản công thần tốc! Các chiến thắng dồn dập tại Tây Kết, Hàm Tử, Chương Dương đã đập tan 50 vạn quân Nguyên, buộc Thoát Hoan chui ống đồng tháo chạy."* | Quân Đại Việt tổng phản công trên sông Hồng, cờ nghĩa nổ rực trời, thuyền giặc Nguyên Mông bốc cháy cuồn cuộn. | **SFX:** Tiếng trống trận rầm rập, tiếng pháo nổ, tiếng gươm giáo giao tranh dữ dội. | `Victorious counter-offensive of Dai Viet army at Chuong Duong gate, burning Mongol junks on Red River --ar 16:9` |
| **Scene 11** | `03:20 - 03:40` | *"Ba năm sau, năm 1288, Hốt Tất Liệt phẫn nộ phục thù, sai Ô Mã Nhi dẫn 30 vạn quân sang lần thứ ba. Trần Quốc Tuấn bình thản trả lời Vua Trần Nhân Tông: 'Năm nay đánh giặc nhàn!'"* | Trần Quốc Tuấn đứng trên thuyền chỉ phụng quan sát địa hình sông Bạch Đằng, nụ cười tự tin và quyết đoán. | **SFX:** Tiếng sóng nước rì rầm, tiếng sáo trúc vút cao tự tin. | `Tran Hung Dao standing confident on flagship inspecting Bach Dang river battlefield, serene authority --ar 16:9` |
| **Scene 12** | `03:40 - 04:00` | *"Ngày 09 tháng 04 năm 1288, đại chiến Bạch Đằng bùng nổ. Dựa vào bãi cọc nhọn ngầm và thủy triều rút, Trần Quốc Tuấn tiêu diệt gọn 400 chiến thuyền giặc, bắt sống Đô đốc Ô Mã Nhi và Phàn Nạp, đập tan hoàn toàn dã tâm của đế quốc Mông Cổ."* | Trận thủy chiến Bạch Đằng 1288 lên cao trào: Thuyền Ô Mã Nhi mắc kẹt bãi cọc bị quân Đại Việt bao vây bắt sống. *(Tranh cao trào)* | **SFX:** Tiếng đâm va dữ dội của mạn thuyền, tiếng Ô Mã Nhi gào khóc hàng đầu, tiếng reo hò chiến thắng. | `Epic climax of Battle of Bach Dang 1288, Mongol commander O Ma Nhi captured on sinking warship --ar 16:9` |
| **Scene 13** | `04:00 - 04:20` | *"Ba lần đại thắng Nguyên Mông – đế chế hùng mạnh nhất thế giới thời bấy giờ – đã bảo vệ toàn vẹn chủ quyền Đại Việt, đồng thời ngăn chặn bước tiến của kỵ binh Mông Cổ xuống toàn bộ khu vực Đông Nam Á."* | Thẻ thống kê 3 lần chiến thắng (1258 Đông Bộ Đầu, 1285 Tây Kết - Chương Dương, 1288 Bạch Đằng) nổi bật trên bản đồ Đông Nam Á. *(Hiển thị Stat Card)* | **SFX:** Tiếng trống đồng vang vọng linh thiêng. | `Statistical infographic badge showing 3 victories against Mongol Empire (1258, 1285, 1288) over map --ar 16:9` |
| **Scene 14** | `04:20 - 04:40` | *"Khi đất nước thanh bình, ông từ bỏ mọi quyền lực triều chính, lui về ở ẩn tại phủ Vạn Kiếp. Khi Vua Trần Anh Tông đến thăm và hỏi kế giữ nước, ông dặn lại lời di ngôn kinh điển: 'Khoan thư sức dân để làm kế sâu gốc bền gốc, đó là thượng sách giữ nước!'"* | Thẻ trích dẫn di ngôn "Khoan thư sức dân" với chữ Nôm mạ vàng trên nền cảnh đền Vạn Kiếp thanh bình. | **SFX:** Tiếng chim hót thanh bình, tiếng chuông chùa thanh tịnh. | `Calligraphy quote card with "Khoan thu suc dan" advice to King Tran Anh Tong, serene Van Kiep temple backdrop --ar 16:9` |
| **Scene 15** | `04:40 - 05:00` | *"Ngày 20 tháng 8 năm Canh Tý (1300), Hưng Đạo Đại Vương bằng an qua đời tại Vạn Kiếp, thọ 73 tuổi. Vua truy phong ông là Thái sư Thượng phụ Quốc Công Tiết Chế Nhân Vũ Hưng Đạo Đại Vương – danh xưng cao quý nhất triều đại."* | Tranh tư liệu vua tôi và nhân dân Đại Việt tiếc thương khóc viếng Đức Thánh Trần tại phủ Vạn Kiếp. | **SFX:** Tiếng nhạc nhị bi hùng lắng đọng, tiếng chuông tang ngân dài. | `Mourning ceremony for Tran Hung Dao in 1300 AD, royal incense, deep respect and sorrow --ar 16:9` |
| **Scene 16** | `05:00 - 05:20` | *"Người dân Việt Nam không chỉ nhớ về ông như một vị tướng thắng trận, mà còn tôn thờ ông thành 'Đức Thánh Trần'. Hàng ngàn ngôi đền thờ ông mọc lên khắp mọi miền đất nước, nhang khói nghi ngút quanh năm."* | Cảnh người dân dâng hương kính cẩn tại Đền Kiếp Bạc (Hải Dương) và Đền Trần (Nam Định). | **SFX:** Tiếng chuông đền ngân vang, tiếng khói hương nghi ngút. | `Modern pilgrims burning incense at Kiep Bac temple honoring Saint Tran Hung Dao, glowing lanterns --ar 16:9` |
| **Scene 17** | `05:20 - 05:40` | *"Các nhà nghiên cứu quân sự thế giới đã xếp Trần Hưng Đạo vào danh sách những vị tướng vĩ đại nhất mọi thời đại – vị tướng đã 3 lần đánh bại đế chế hung hãn nhất lịch sử nhân loại."* | Hình ảnh tư liệu các cuốn sách quân sự quốc tế và bức bức tượng Trần Hưng Đạo được vinh danh trên thế giới. | **SFX:** Tiếng lật trang sách tri thức, âm hưởng tự hào dân tộc. | `International military history book illustration featuring General Tran Hung Dao alongside world conquerors --ar 16:9` |
| **Scene 18** | `05:40 - 06:00` | *"Sinh làm Tướng giỏi, chết hóa Thánh linh! Tấm lòng trung trinh vì nước và thiên tài quân sự của Trần Quốc Tuấn là biểu tượng vĩnh cửu cho bản lĩnh và trí tuệ Việt Nam."* | Tượng đài Trần Hưng Đạo soi bóng xuống dòng sông Lục Đầu dưới ánh bình minh tươi sáng. | **SFX:** Nhạc kết cao trào kiêu hãnh và hào hùng. | `Glorious sunrise shot over Tran Hung Dao monument at Luc Dau river, radiant light --ar 16:9` |
| **Scene 19** | `06:00 - 06:15` | *"Khí phách Hào khí Đông A và di sản 'Khoan thư sức dân' của Đức Thánh Trần sẽ mãi mãi là ngọn đèn soi đường cho muôn đời con cháu mai sau."* | Thẻ ghi nhận di sản lịch sử (Historical Note): "DI SẢN HÀO KHÍ ĐÔNG A BẤT TỬ". | **SFX:** Tiếng trống đồng ngân dài linh thiêng. | `Gold inscribed heritage note badge over Tran dynasty lotus pattern background --ar 16:9` |
| **Scene 20** | `06:15 - 06:30` | *"Hưng Đạo Đại Vương Trần Quốc Tuấn – Thiên tài quân sự bất tử của dân tộc Việt Nam."* | Màn hình thương hiệu ChronoViet Outro Card kết hợp lời kêu gọi đăng ký và theo dõi các tập tiếp theo. | **SFX:** Sound boom kết thúc. **BGM:** Outro Track Fade Out. | `ChronoViet branding outro card with subscribe button and recommended videos layout --ar 16:9` |

---

## 🛠️ 3. TEMPLATE DỮ LIỆU JSON CHO ENGINE REMOTION (`biographyTranHungDaoTimeline.json`)

> **Chuẩn:** Schema v4.1 — tương thích 100% với `ChronoVideoSchema` tại [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts).

```json
{
  "title": "HƯNG ĐẠO ĐẠI VƯƠNG TRẦN QUỐC TUẤN – HUYỀN THOẠI BÁCH CHIẾN BÁCH THẮNG",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Trần Quốc Tuấn (1228 - 1300)",
  "videoType": "BIOGRAPHY",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "fps": 30,
  "theme": {
    "primaryColor": "#D4AF37",
    "secondaryColor": "#8B0000",
    "backgroundColor": "#090d14",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(212, 175, 55, 0.35)"
  },
  "audioUrl": "assets/biography/tran-hung-dao/voiceover.wav",
  "bgmUrl": "assets/biography/tran-hung-dao/bgm.wav",
  "bgmVolume": 0.25,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "FADE_TO_BLACK",
  "timeline": [
    {
      "id": "scene_00_intro",
      "startTime": 0,
      "endTime": 15,
      "text": "ChronoViet Documentary Series — Phim tài liệu Trần Hưng Đạo.",
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
      "startTime": 15,
      "endTime": 35,
      "text": "Vị tướng duy nhất được nhân dân suy tôn thành 'Thánh', được cả thế giới nghiêng mình kính trọng như một thiên tài quân sự kiệt xuất – chính là Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn.",
      "assetUrl": "assets/biography/tran-hung-dao/scene_01_van_kiep_statue.jpg",
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
      "startTime": 35,
      "endTime": 55,
      "text": "Trần Quốc Tuấn sinh năm 1228 tại phủ Thiên Trường (Nam Định), con trai An Sinh Vương Trần Liễu.",
      "assetUrl": "assets/biography/tran-hung-dao/scene_02_young_portrait.jpg",
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
      "startTime": 80,
      "endTime": 100,
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
      "startTime": 370,
      "endTime": 390,
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

