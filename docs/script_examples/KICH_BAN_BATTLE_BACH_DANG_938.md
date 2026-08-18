# KỊCH BẢN CHI TIẾT & BẢNG PHÂN CẢNH PRODUCTION (PRODUCTION SCRIPT & ASSET PROMPTS)

> **Tác phẩm:** TRẬN BẠCH ĐẰNG 938 – CỘT MỐC MỞ ĐẦU KỶ NGUYÊN ĐỘC LẬP  
> **Dự án:** ChronoViet (Video Essay / Historical Motion Graphics)  
> **MĂ£ Domain:** `BATTLE`  
> **Thời lượng:** 6 phút 45 giây (405 giây / 12.150 frames @ 30fps) | **JSON scenes:** 21 (scene_00 brand intro + 20 nội dung)  
> **Phong cách Visual:** Đồ họa Cổ phong Việt Nam kết hợp Thủy mặc, Sương mù sông nước, Giáp sắt Nam Hán, Bãi cọc lim ngầm rực lửa & Hiệu ứng Ken Burns kịch tính.

---

## 🎨 1. BỘ THIẾT KẾ NHẬN DIỆN THỊ GIÁC (VISUAL DESIGN SYSTEM)

* **Palette màu chính:**
  * **Imperial Gold (Vàng Hoàng Kim Ngô Quyền):** `#D4AF37` & `#F59E0B` (Cờ hiệu Ngô Quyền, vương miện Cổ Loa, điểm nhấn chiến thắng)
  * **Crimson Red (Đỏ Son Chiến Trường):** `#8B0000` & `#DC2626` (Ngọn lửa chiến tranh, chiến thuyền bốc cháy, máu giặc Nam Hán)
  * **Oceanic Steel (Xanh Thủy Triều & Cọc Giọt Cắm Ngầm):** `#1E3A8A` & `#0F172A` (Dòng sông Bạch Đằng, triều cường rút, đêm sương mờ)
  * **Ancient Bronze (Nâu Đồng & Lim Cổ):** `#78350F` & `#B45309` (Cọc gỗ lim bịt sắt, thuyền gỗ Việt cổ)

* **Typography:**
  * **Title Main:** `Merriweather` Bold / `UTM Classique Saigon` (Đổ bóng mạ vàng, letter spacing 0.06em)
  * **Quote Text:** `Playfair Display` Italic / `Georgia` (Nổi bật trên khung mờ glassmorphism)
  * **Voice Subtitle:** `Be Vietnam Pro` (Font size 30px, viền chữ đen 2px, nền dải lụa mờ)

---

## 🎬 2. BẢNG PHÂN CẢNH CHI TIẾT 20 SCENES (SHOT-BY-SHOT BREAKDOWN)

| Scene ID | Thời gian | Lời thuyết minh chi tiết (Voiceover Script) | Mô tả Hình ảnh & Chuyển động Camera | Âm thanh & Hiệu ứng (SFX / BGM) | Prompt AI Sinh ảnh (Midjourney / Flux) / Asset Specs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scene 01** | `00:00 - 00:20` | *"Hơn một nghìn năm Bắc thuộc – một thiên niên kỷ chìm trong lầm than và máu lệ dưới ách thống trị tàn bạo của các triều đại phương Bắc. Nhưng người Việt chưa bao giờ khuất phục. Và đến năm 938, một trận thủy chiến vô tiền khoáng hậu tại sông Bạch Đằng đã vĩnh viễn chấm dứt đêm trường nô lệ."* | Toàn cảnh dòng sông Bạch Đằng cuồn cuộn sóng trong sương sớm. Camera Zoom Out chậm lộ ra bãi cọc nhọn đâm đâm qua làn sương mù. | **SFX:** Tiếng sóng vỗ rì rầm, tiếng gió rít qua rặng cây. **BGM:** Nhạc sáo trúc u trầm chuyển dần sang tone căng thẳng. | `Cinematic epic wide shot of Bach Dang river Vietnam in 10th century, early morning fog, ominous atmosphere, ancient Vietnamese historical style --ar 16:9` |
| **Scene 02** | `00:20 - 00:40` | *"Ngô Quyền – sinh năm 896 tại làng Đường Lâm (Hà Nội ngày nay). Ông là người có tướng mạo phi thường, mắt sáng như chớp, bước đi như hổ. Là con rể của Tiết độ sứ Dương Đình Nghệ, ông nắm giữ vùng đất Ái Châu giàu có và lòng dân."* | Chân dung uy nghi của Chủ công Ngô Quyền khoác chiến phong vàng, ánh mắt kiên cường nhìn về phía biển Đông. *(Hiển thị Bio Card)* | **SFX:** Tiếng trống trận rầm rập từ xa. **BGM:** Nhạc hào hùng kiêu hãnh. | `Majestic portrait of ancient Vietnamese leader Ngo Quyen in 10th century warrior armor, sharp eyes, golden cape, dramatic lighting --ar 16:9` |
| **Scene 03** | `00:40 - 01:00` | *"Năm 937, sóng gió nổi lên. Tên phản quốc Kiều Công Tiễn sát hại Dương Đình Nghệ để đoạt chức Tiết độ sứ. Hoảng sợ trước sự trừng phạt của Ngô Quyền, Công Tiễn đã rước voi về giày mả tổ, rước quân Nam Hán sang xâm lược đất nước ta."* | Cảnh đêm giông bão: Kiều Công Tiễn gặp sứ thần Nam Hán, bên ngoài nhân dân căm hờn oán thán. | **SFX:** Tiếng sét đánh nổ rền, tiếng mưa rơi nặng hạt, tiếng xích sắt. | `Dark sinister scene of traitor Kieu Cong Tien meeting Southern Han emissaries in rainy night, ominous green-red lighting --ar 16:9` |
| **Scene 04** | `01:00 - 01:20` | *"Nắm lấy cơ hội ngàn năm, Vua Nam Hán Lưu Cung phong con trai là Lưu Hoằng Tháo làm Bình Nam vương, chỉ huy hạm đội vạn chiến thuyền vượt biển tràn xuống miền Nam, tham vọng nuốt chửng Đại Việt lần nữa."* | Hạm đội thuyền chiến lầu cao đồ sộ của Nam Hán giăng kín mặt biển, cờ hiệu phương Bắc rợp trời. | **SFX:** Tiếng tù và quân Hán rền vang đe dọa, tiếng sóng biển đập mạnh vào mạn thuyền. | `Massive Southern Han armada of huge war junks sailing on stormy sea, dark clouds, Han flags, cinematic epic scale --ar 16:9` |
| **Scene 05** | `01:20 - 01:40` | *"Tháng 10 năm 938, Ngô Quyền thần tốc cất quân ra Bắc, hạ thành Đại La, trừng trị đích đáng kẻ phản quốc Kiều Công Tiễn. Diệt xong nội phản, ông lập tức hành quân ra vùng cửa biển Quảng Ninh - Hải Phòng để chuẩn bị nghênh chiến."* | Quân đội Ngô Quyền tiến vào thành Đại La, cờ nghĩa phất phới dưới nắng thu rực rỡ. | **SFX:** Tiếng bước chân hành quân rầm rập, tiếng ngựa sải bước dồn dập. | `Vietnamese army under Ngo Quyen marching into Dai La citadel, golden banners, triumphant warrior spirit --ar 16:9` |
| **Scene 06** | `01:40 - 02:00` | *"Nhận định tình hình đối phương, Ngô Quyền dứt khoát tuyên bố với các tướng sĩ: 'Hoằng Tháo là một đứa trẻ ranh, dẫn quân từ xa đến, quân sĩ mệt mỏi, lại nghe tin Công Tiễn đã chết, không có người làm nội ứng. Nếu ta chuẩn bị trước, quân giặc nhất định phải thua!'"* | Thẻ trích dẫn nghệ thuật (Quote Card) hiển thị câu nói lịch sử của Ngô Quyền với nét chữ calligraphy mạ vàng rực rỡ. | **SFX:** Tiếng rút gươm đanh thép, tiếng reo hò rấn rập của tướng sĩ. | `Calligraphy quote card with golden text over dark wooden texture background, dramatic lighting --ar 16:9` |
| **Scene 07** | `02:00 - 02:20` | *"Hiểu rõ quy luật thủy triều vùng cửa sông Bạch Đằng – nơi nước dâng rút chênh lệch tới 3 đến 4 mét mỗi ngày – Ngô Quyền đã sáng tạo ra một trận đồ thủy chiến độc nhất vô nhị trong lịch sử quân sự thế giới."* | Đồ họa 3D/Motion Graphics mô phỏng dòng sông Bạch Đằng và sự biến thiên của mực nước thủy triều lên xuống. | **SFX:** Tiếng nước triều dâng cuồn cuộn, tiếng nhạc phân tích chiến thuật. | `Dynamic animated map illustration showing Bach Dang river tide levels rising and falling, tactical military blueprint --ar 16:9` |
| **Scene 08** | `02:20 - 02:40` | *"Hàng vạn quân dân được huy động vào rừng đẽo gọt hàng nghìn cây gỗ lim, gỗ sến cổ thụ thành những cọc nhọn vạt đầu, đút sắt nhọn, rồi đem cắm ngầm xuống lòng sông tại các cửa lạch hiểm yếu."* | Quân dân Đại Việt đẽo cọc gỗ lim, bịt đầu sắt nhọn và nỗ lực cắm cọc xuống lòng sông trong đêm tối. | **SFX:** Tiếng búa nện chát chúa, tiếng gỗ va đập, tiếng hò kéo cọc cuồn cuộn. | `Ancient Vietnamese soldiers and villagers shaping massive iron-tipped wooden stakes and planting them in riverbed at night --ar 16:9` |
| **Scene 09** | `02:40 - 03:00` | *"Khi nước triều dâng cao, toàn bộ bãi cọc nhọn chìm sâu dưới lòng sông, mặt nước lại phẳng lặng như không hề có bẫy chết người. Một chiếc bẫy rồng vĩ đại đã giăng sẵn chờ hạm đội Nam Hán!"* | Mặt sông Bạch Đằng đầy nước che phủ hoàn toàn bãi cọc ngầm, khung cảnh phẳng lặng đầy đe dọa. | **SFX:** Tiếng nước chép chép êm đềm, tiếng quạ kêu xa xăm. **BGM:** Nhạc chờ đợi ngột ngạt. | `Calm surface of Bach Dang river covering hidden submerged iron stakes, deceptive tranquility, high suspense --ar 16:9` |
| **Scene 10** | `03:00 - 03:20` | *"Cuối năm 938, hạm đội thuyền lớn của Lưu Hoằng Tháo hung hãn tiến vào cửa biển Bạch Đằng. Ngô Quyền sai các thuyền nhẹ ra khiêu chiến, vừa đánh vừa giả vờ thua chạy rút lui vào sâu trong lạch sông."* | Thuyền nhẹ Đại Việt khiêu chiến rồi quay đầu tháo chạy, hạm đội lớn Nam Hán thừa thắng kiêu ngạo đuổi theo. | **SFX:** Tiếng trống trận Nam Hán thúc dồn dập, tiếng đại tướng Hoằng Tháo thét thúc quân. | `Light Vietnamese boats luring massive Han warships into river estuary, fast motion water spray --ar 16:9` |
| **Scene 11** | `03:20 - 03:40` | *"Hoằng Tháo trúng kế! Đầy tự mãn, hắn hạ lệnh cho toàn bộ chiến thuyền lầu cao húc thẳng vào lòng sông mà không hề biết thủy triều đang bắt đầu đạt đỉnh và sắp rút nhanh."* | Thuyền chiến Nam Hán lọt sâu vào bẫy mai phục, quân giặc reo hò đắc thắng trên mạn thuyền. | **SFX:** Tiếng giặc reo hò cuồng nhiệt, tiếng mái chèo khua nước dữ dội. | `Arrogant Prince Hoang Thao commanding heavy armada pushing deep into narrow river inlet, sunset lighting --ar 16:9` |
| **Scene 12** | `03:40 - 04:00` | *"Đúng thời điểm thủy triều rút mạnh, Ngô Quyền đứng trên thuyền chỉ huy phất cờ hiệu. Trống trận rền vang sấm dội! Quân Đại Việt từ hai bên ngách sông lao ra khép chặt vòng vây, tổng phản công dữ dội."* | Ngô Quyền phất cờ lệnh, thuyền chiến Đại Việt áp sát hai bên mạn, tên bắn như mưa gieo rắc kinh hoàng. | **SFX:** Tiếng trống trận bùng nổ (Epic war drums), tiếng tên bay vè vè, tiếng thét xung phong. | `Ngo Quyen giving attack signal, Vietnamese fleet ambushing from riverbanks, intense arrow salvos --ar 16:9` |
| **Scene 13** | `04:00 - 04:20` | *"Hoảng loạn trước sức tấn công vũ bão, Hoằng Tháo vội vã vung kiếm hạ lệnh quay đầu rút chạy ra biển. Nhưng đã quá muộn!"* | Thuyền Nam Hán hoảng loạn quay đầu, va chạm hỗn loạn trong lòng sông hẹp. | **SFX:** Tiếng va chạm sầm sập của mạn thuyền, tiếng quân sĩ gào khóc hoảng loạn. | `Panicked Han warships colliding while attempting chaotic retreat, fiery explosions and smoke --ar 16:9` |
| **Scene 14** | `04:20 - 04:40` | *"Thủy triều rút nhanh như thác đổ! Bãi cọc lim bịt sắt nhọn hoắt nhô lên khỏi mặt nước như nghìn chông gai thép. Thuyền lớn Nam Hán bị nước cuốn húc mạnh vào bãi cọc, mạn thuyền đâm thủng vỡ tan tành!"* | Thuyền giặc vỡ đâm chập bãi cọc nhọn, thuyền chìm, giặc rơi xuống sông chết vô số kể. *(Tranh cao trào)* | **SFX:** Tiếng gỗ gãy rắc rắc dữ dội, tiếng mạn thuyền đâm cọc rầm rầm, tiếng giặc ngã xuống nước. | `Climax shot of Han warships impaled on sharp iron-tipped wooden stakes emerging from receding tide, sinking ships, chaotic carnage --ar 16:9` |
| **Scene 15** | `04:40 - 05:00` | *"Quân Đại Việt trên thuyền nhẹ thừa thắng lao tới dùng giáo dài, nỏ liên châu tiêu diệt địch. Quân Nam Hán chết đuối và tử trận đến hơn một nửa. Lưu Hoằng Tháo bị đâm chết tại trận giữa dòng nước đỏ quạch máu giặc."* | Quân Đại Việt chiến đấu dũng mãnh trên thuyền nhẹ, Hoằng Tháo trúng tên đền tội giữa sông Bạch Đằng. | **SFX:** Tiếng gươm giáo va chạm ác liệt, tiếng kêu khóc bi thảm của quân Nam Hán. | `Vietnamese warriors on swift boats eliminating trapped enemy soldiers, Prince Hoang Thao defeated in water --ar 16:9` |
| **Scene 16** | `05:00 - 05:20` | *"Vua Nam Hán Lưu Cung đang dẫn quân tiếp viện ở biên giới nghe tin con trai tử trận, quân sĩ đại bại hoảng sợ khóc than, đành ngậm ngùi thu gom tàn quân tháo chạy về nước, vĩnh viễn từ bỏ dã tâm xâm lược."* | Vua Nam Hán khóc đau đớn gạt nước mắt rút quân về phương Bắc trong ô nhược. *(Hiển thị Stat Card)* | **SFX:** Tiếng gió hú bi ai, tiếng chuông ngân trầm u uất. | `Desperate King of Southern Han mourning his son and retreating back to China in defeat --ar 16:9` |
| **Scene 17** | `05:20 - 05:40` | *"Nhà sử học Lê Văn Hưu đã hết lời ca ngợi: 'Ngô Quyền mưu giỏi đánh giỏi, làm cho người Hán không dám ngó ngàng sang nước ta nữa. Công đức ấy trùm lấp cả các vua trước, dựng lại cơ đồ độc lập.'"* | Bảng trích dẫn đánh giá của Lê Văn Hưu trong *Đại Việt Sử Ký Toàn Thư* mạ vàng trang trọng. *(Hiển thị Historical Note)* | **SFX:** Tiếng trang sách cổ lật, tiếng nhạc trang nghiêm hào hùng. | `Historical evaluation note badge over ancient Vietnamese map, gold detailing --ar 16:9` |
| **Scene 18** | `05:40 - 06:00` | *"Mùa xuân năm 939, Ngô Quyền chính thức xưng Vương, bãi bỏ chức Tiết độ sứ của phong kiến phương Bắc, chọn Cổ Loa làm kinh đô – khẳng định sự nối tiếp truyền thống tự chủ từ thời Hùng Vương."* | Cảnh đăng quang của Ngô Quyền tại kinh đô Cổ Loa, trăm họ hân hoan ăn mừng nền độc lập tự chủ. | **SFX:** Tiếng trống hội bừa bãi hân hoan, tiếng chuông đồng vang rực rỡ. | `King Ngo Quyen coronation at Co Loa citadel 939 AD, traditional festival, golden throne --ar 16:9` |
| **Scene 19** | `06:00 - 06:15` | *"Trận Bạch Đằng 938 không chỉ là một chiến thắng quân sự lẫy lừng, mà còn là cột mốc vĩ đại chấm dứt 1058 năm Bắc thuộc, mở ra kỷ nguyên độc lập tự cường vạn đại cho dân tộc Việt Nam."* | Tượng đài Ngô Quyền đứng uy nghi bên dòng sông Bạch Đằng lịch sử dưới bầu trời nắng vàng rực rỡ. | **SFX:** Âm nhạc giao hưởng vút cao kiêu hãnh. | `Majestic statue of Ngo Quyen at Bach Dang river site, sunny blue sky, national monument --ar 16:9` |
| **Scene 20** | `06:15 - 06:30` | *"Ngô Quyền – Vị Tổ Trung Hưng vĩ đại của dân tộc Việt Nam. Khí phách Bạch Đằng Giang sẽ mãi mãi ngân vang cùng sông núi!"* | Màn hình thương hiệu ChronoViet Outro Card kết hợp lời kêu gọi đăng ký và theo dõi series lịch sử. | **SFX:** Tiếng trống đồng ngân dài kết thúc. **BGM:** Outro Track Fade Out. | `ChronoViet branding outro card with subscribe button and recommended videos layout --ar 16:9` |

---

## 🛠️ 3. TEMPLATE DỮ LIỆU JSON CHO ENGINE REMOTION (`bachDang938Timeline.json`)

Tệp này nằm tại `packages/remotion-engine/src/data/battleTimeline.json` và đã được đăng ký tại `Root.tsx` với Composition ID `BattleVideo`.

> **Chuẩn:** Schema v4.1 — tương thích 100% với `ChronoVideoSchema` tại [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts).

```json
{
  "title": "TRẬN BẠCH ĐẰNG 938 – CỘT MỐC MỞ ĐẦU KỶ NGUYÊN ĐỘC LẬP",
  "subtitle": "ChronoViet Deep Research Series • Phim Tài Liệu Khảo Cứu Trận Bạch Đằng Năm 938",
  "videoType": "BATTLE",
  "templateId": "HISTORICAL_DOCUMENTARY",
  "aspectRatio": "16:9",
  "fps": 30,
  "audioUrl": "assets/battle/bach-dang/voiceover.wav",
  "bgmUrl": "assets/battle/bach-dang/bgm.wav",
  "bgmVolume": 0.3,
  "defaultLayoutMode": "BLUR_BG",
  "defaultFilterStyle": "HISTORICAL",
  "defaultTransition": "GLITCH",
  "theme": {
    "primaryColor": "#DC2626",
    "secondaryColor": "#1E293B",
    "backgroundColor": "#090d14",
    "fontFamily": "Merriweather, serif",
    "accentGlow": "rgba(220, 38, 38, 0.4)"
  },
  "timeline": [
    {
      "id": "scene_00_intro",
      "startTime": 0,
      "endTime": 15,
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
      "id": "scene_01_title",
      "startTime": 15,
      "endTime": 35,
      "text": "Hơn một nghìn năm Bắc thuộc – một thiên niên kỷ chìm trong lầm than và máu lệ. Năm 938, trận thủy chiến Bạch Đằng vĩnh viễn chấm dứt đêm trường nô lệ.",
      "assetUrl": "assets/battle/bach-dang/scene_01_bach_dang_mist.jpg",
      "layoutMode": "TITLE_CARD",
      "effect": "KEN_BURNS_ZOOM_IN",
      "filterStyle": "HISTORICAL",
      "transition": "GLITCH",
      "overlayData": {
        "chapterNumber": "PHẦN I",
        "title": "TRẬN BẠCH ĐẰNG 938",
        "subtitle": "Chiến Công Lẫy Lừng Chấm Dứt 1058 Năm Bắc Thuộc"
      }
    },
    {
      "id": "scene_battle_versus",
      "startTime": 45,
      "endTime": 65,
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
          "badge": "Hung hĂ£n"
        }
      }
    },
    {
      "id": "scene_15_outro",
      "startTime": 360,
      "endTime": 375,
      "text": "Trận Bạch Đằng 938 – Cột mốc vĩ đại mở ra kỷ nguyên độc lập trường tồn cho dân tộc Việt Nam.",
      "layoutMode": "OUTRO_CARD",
      "overlayType": "OUTRO_CARD",
      "transition": "FADE_TO_BLACK",
      "overlayData": {
        "title": "TRẬN BẠCH ĐẰNG 938",
        "quoteText": "Ngô Quyền xưng Vương, mở đầu kỷ nguyên độc lập tự chủ.",
        "ctaText": "CHRONOVIET DOCUMENTARY SERIES • CHUYÊN ĐỀ LỊCH SỬ CHUYÊN SÂU",
        "bulletPoints": ["VỊ TỔ TRUNG HƯNG", "TRẬN ĐỊA CỌC BẠCH ĐẰNG", "CHẤM DỨT BẮC THUỘC"]
      }
    }
  ]
}
```      "assetUrl": "assets/battle/scene_06_ngo_quyen_quote.jpg",
      "overlayType": "QUOTE",
      "overlayData": {
        "quoteText": "Hoằng Tháo là một đứa trẻ ranh, dẫn quân từ xa đến, quân sĩ mệt mỏi... Nếu ta chuẩn bị trước, quân giặc nhất định phải thua!",
        "author": "Ngô Quyền (Nhận định chiến lược năm 938)"
      },
      "layoutMode": "QUOTE_CANVAS"
    }
  ]
}
```

