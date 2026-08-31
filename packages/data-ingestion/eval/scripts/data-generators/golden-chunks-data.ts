import { ChunkInput } from '../benchmark-builder-utils.js';

export const GOLDEN_CHUNKS_DATA: ChunkInput[] = [
  {
    "id": "CHUNK_EP01_001_AU_LAC_CO_LOA",
    "epochId": "EPOCH_01",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Ngoại Kỷ Toàn Thư Quyển I",
    "dynasty": "Âu Lạc",
    "sectionTitle": "Kỷ Thục Vương - Xây thành Cổ Loa và chế tạo nỏ thần",
    "evaluationFocus": "CLASSICAL_CHRONICLE_ANCIENT_DEFENSE",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Âu Lạc] [Mục: An Dương Vương định đô Cổ Loa] [Nhân Vật: An Dương Vương, Cao Lỗ, Triệu Đà] [Thời Gian: Thế kỷ III TCN]",
    "rawText": "Vua An Dương Vương họ Thục, tên húy là Phán, người Ba Thục. Sau khi đánh bại Hùng Vương thứ mười tám, Thục Phán đã thống nhất đất đai Lạc Việt và Tây Âu lập nên nhà nước Âu Lạc, xưng vương và dời đô về vùng đồng bằng đất Việt Thường, chọn đất Phong Khê nay thuộc Đông Anh Hà Nội để xây đắp kinh đô kiên cố. Bấy giờ vua cho đắp thành rộng nghìn trượng, xoáy trôn ốc chín vòng thành gọi là Loa Thành hay Khả Lũ Thành. Tướng quốc Cao Lỗ phụng mệnh vua ngày đêm chế tạo nỏ thần Liên Châu, mỗi phát bắn ra hàng trăm mũi tên đồng sắc nhọn, uy lực muôn phần dũng mãnh khiến giặc phương Bắc khiếp sợ gọi là Linh Quang Kim Trảo Thần Nỏ. Khi Triệu Đà chúa đất Nam Hải mang đại binh thủy bộ sang xâm lấn cõi bờ, An Dương Vương đem nỏ thần ra bắn, quân Nam Hải đại bại bỏ chạy, giữ yên cương vực bờ cõi nước Âu Lạc. Toàn Thư ghi nhận rằng việc dời đô từ vùng núi đồi trung du Phong Châu về đồng bằng Phong Khê đánh dấu bước chuyển mình vượt bậc về tư duy quân sự và kinh tế nông nghiệp của cư dân Việt cổ. Địa thế hiểm trở kết hợp với hệ thống hào nước sông Hoàng Giang bao bọc xung quanh giúp Loa Thành trở thành một pháo đài quân sự liên hoàn thủy bộ độc nhất vô nhị trong lịch sử phòng thủ cổ đại phương Đông. Nhờ tài chỉ huy quân sự kiệt xuất của Cao Lỗ và uy danh của vua Thục, nhà nước Âu Lạc giữ vững nền độc lập tự chủ suốt nhiều thập kỷ trước dã tâm bành trướng của phong kiến phương Bắc, đặt nền móng bền vững cho truyền thống dựng nước và giữ nước oanh liệt của dân tộc.",
    "wordCount": 327,
    "entities": [
      {
        "id": "person_an_duong_vuong",
        "name": "An Dương Vương",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Thục Phán"
        ]
      },
      {
        "id": "dynasty_au_lac",
        "name": "Âu Lạc",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thanh_co_loa",
        "name": "Đông Anh",
        "type": "LOCATION",
        "aliases": [
          "Cổ Loa",
          "Loa Thành"
        ]
      },
      {
        "id": "person_cao_lo",
        "name": "Cao Lỗ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_no_lien_chau",
        "name": "nỏ thần Liên Châu",
        "type": "ARTIFACT",
        "aliases": [
          "Nỏ thần"
        ]
      },
      {
        "id": "person_trieu_da",
        "name": "Triệu Đà",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_song_hong",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_an_duong_vuong",
        "subjectName": "An Dương Vương",
        "relationType": "PART_OF",
        "objectId": "dynasty_au_lac",
        "objectName": "Âu Lạc"
      },
      {
        "subjectId": "person_an_duong_vuong",
        "subjectName": "An Dương Vương",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_co_loa",
        "objectName": "Đông Anh"
      },
      {
        "subjectId": "artifact_no_lien_chau",
        "subjectName": "nỏ thần Liên Châu",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_au_lac",
        "objectName": "Âu Lạc"
      },
      {
        "subjectId": "person_cao_lo",
        "subjectName": "Cao Lỗ",
        "relationType": "PART_OF",
        "objectId": "dynasty_au_lac",
        "objectName": "Âu Lạc"
      }
    ]
  },
  {
    "id": "CHUNK_EP01_002_VAN_HOA_DONG_SON",
    "epochId": "EPOCH_01",
    "sourceDocument": "Bách khoa Khảo cổ học & Lịch sử Văn hóa Văn Lang",
    "dynasty": "Văn Lang",
    "sectionTitle": "Nền văn minh sông Hồng và biểu tượng Trống đồng Đông Sơn",
    "evaluationFocus": "ARCHAEOLOGICAL_BRONZE_CULTURE",
    "banner": "[Sử Liệu: Nghiên cứu Khảo cổ học] [Kỷ/Triều Đại: Văn Lang] [Mục: Văn hóa Đông Sơn và thời đại Hùng Vương] [Di Chỉ: Đông Sơn, Đào Thịnh, Ngọc Lũ] [Thời Gian: Thiên niên kỷ I TCN]",
    "rawText": "Thời đại các vua Hùng dựng nước Văn Lang gắn liền với đỉnh cao của nền văn hóa Đông Sơn rực rỡ phát triển dọc lưu vực các con sông lớn như sông Hồng, sông Mã và sông Cả. Các cư dân Lạc Việt cổ đại đã đạt đến trình độ luyện kim đúc đồng bậc thầy, sáng tạo nên những kiệt tác đồ đồng vô giá như Trống đồng Đông Sơn, trống đồng Ngọc Lũ và thạp đồng Đào Thịnh. Hoa văn trên mặt trống đồng phản ánh thế giới quan sinh động của người Việt cổ với hình ảnh ngôi sao nhiều cánh ở trung tâm, đoàn thuyền chiến vượt sóng, chim lạc sải cánh bay và lễ hội giã gạo cầu mùa. Nền nông nghiệp trồng lúa nước kết hợp nghề đánh bắt thủy sản và chăn nuôi đã tạo nền tảng kinh tế xã hội vững chắc cho sự hình thành nhà nước sơ khai Văn Lang. Các nhà khảo cổ học phát hiện hàng nghìn hiện vật đồ đồng gồm rìu xéo gót vuông, mũi tên đồng Cổ Loa, giáo đồng và đồ trang sức tinh xảo chứng minh sự phân hóa xã hội sâu sắc cùng năng lực tổ chức phòng thủ quy mô lớn. Việc sử dụng rộng rãi lưỡi cày đồng thay thế công cụ bằng đá đã tạo nên cuộc cách mạng trong sản xuất nông nghiệp mùa vụ, nâng cao năng suất trồng trọt ở các vùng phù sa trù phú. Trống đồng không chỉ đóng vai trò là một nhạc khí thiêng liêng trong các nghi lễ tôn giáo thần quyền mà còn tượng trưng cho quyền lực tối cao của thủ lĩnh Lạc tướng và vua Hùng trong việc quy tụ các thị tộc bộ lạc, tạo nên bản sắc cội nguồn bền vững của nền văn minh Đại Việt suốt chiều dài lịch sử.",
    "wordCount": 317,
    "entities": [
      {
        "id": "dynasty_van_lang",
        "name": "Văn Lang",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "artifact_trong_dong_dong_son",
        "name": "Trống đồng Đông Sơn",
        "type": "ARTIFACT"
      },
      {
        "id": "artifact_trong_dong_ngoc_lu",
        "name": "trống đồng Ngọc Lũ",
        "type": "ARTIFACT"
      },
      {
        "id": "loc_song_hong",
        "name": "sông Hồng",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "artifact_trong_dong_dong_son",
        "subjectName": "Trống đồng Đông Sơn",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_van_lang",
        "objectName": "Văn Lang"
      },
      {
        "subjectId": "artifact_trong_dong_ngoc_lu",
        "subjectName": "trống đồng Ngọc Lũ",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_van_lang",
        "objectName": "Văn Lang"
      },
      {
        "subjectId": "artifact_trong_dong_dong_son",
        "subjectName": "Trống đồng Đông Sơn",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_song_hong",
        "objectName": "sông Hồng"
      }
    ]
  },
  {
    "id": "CHUNK_EP01_003_THANH_GIONG_SOC_SON",
    "epochId": "EPOCH_01",
    "sourceDocument": "Lĩnh Nam Chích Quái & Đại Việt Sử Ký Toàn Thư",
    "dynasty": "Văn Lang",
    "sectionTitle": "Truyền thuyết Phù Đổng Thiên Vương dẹp giặc Ân cứu nước",
    "evaluationFocus": "FOLKLORE_MYTHOLOGY_DEFENSE",
    "banner": "[Sử Liệu: Lĩnh Nam Chích Quái] [Kỷ/Triều Đại: Văn Lang] [Mục: Truyện Đổng Thiên Vương] [Nhân Vật: Thánh Gióng, Hùng Vương] [Thời Gian: Thời Hùng Vương thứ sáu]",
    "rawText": "Vào đời Hùng Vương thứ sáu, đất nước bị giặc Ân từ phương Bắc tràn xuống xâm lấn biên cương bờ cõi. Vua Hùng lo lắng sai sứ giả đi khắp non sông truyền loa tìm bậc hiền tài cứu nước giúp dân. Tại làng Phù Đổng có đứa trẻ lên ba chưa biết nói cười, nằm trên chõng tre nghe tiếng loa sứ giả bỗng cất tiếng bảo mẹ ra mời thiên sứ vào, nói: Xin vua rèn cho một thanh gươm sắt, một áo giáp sắt và một con ngựa sắt phun lửa, vua không phải lo gì giặc dữ. Vua Hùng mừng rỡ lập tức lệnh cho thợ rèn ngày đêm đúc ngựa sắt và áo giáp. Đứa trẻ ăn bao nhiêu cơm cũng không no, áo mặc vừa xong đã đứt chỉ, bỗng vươn vai trở thành tráng sĩ oai phong lẫm liệt, tên là Thánh Gióng. Tráng sĩ mặc giáp sắt, cầm roi sắt nhảy lên lưng ngựa sắt hí vang một tiếng lao thẳng ra chiến trường. Ngựa sắt phi như bay, phun lửa thiêu rụi đồn trại giặc Ân, roi sắt quét sạch quân thù tại chân núi Trâu Sơn. Khi roi sắt gãy giữa trận tiền, tráng sĩ bình tĩnh nhổ từng bụi tre đằng ngà bên đường quật nát tàn quân giặc khiến chúng tan tác tháo chạy. Dẹp yên giặc xâm lăng, tráng sĩ một mình một ngựa phi thẳng lên đỉnh núi Sóc Sơn rồi cởi bỏ áo giáp bay về trời. Vua Hùng ghi nhớ công ơn to lớn phong làm Phù Đổng Thiên Vương và cho lập đền thờ tại Sóc Sơn Hà Nội đời đời hương khói tưởng nhớ vị anh hùng thần thoại biểu tượng cho sức mạnh quật khởi của dân tộc.",
    "wordCount": 298,
    "entities": [
      {
        "id": "person_thanh_giong",
        "name": "Thánh Gióng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Phù Đổng Thiên Vương"
        ]
      },
      {
        "id": "person_hung_vuong",
        "name": "Hùng Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_van_lang",
        "name": "Văn Lang",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_soc_son",
        "name": "Sóc Sơn",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_thanh_giong",
        "subjectName": "Thánh Gióng",
        "relationType": "PART_OF",
        "objectId": "dynasty_van_lang",
        "objectName": "Văn Lang"
      },
      {
        "subjectId": "person_thanh_giong",
        "subjectName": "Thánh Gióng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_soc_son",
        "objectName": "Sóc Sơn"
      }
    ]
  },
  {
    "id": "CHUNK_EP01_004_CHU_DONG_TU_TIEN_DUNG",
    "epochId": "EPOCH_01",
    "sourceDocument": "Lĩnh Nam Chích Quái - Truyện Chử Đồng Tử Tiên Dung",
    "dynasty": "Văn Lang",
    "sectionTitle": "Mối tình bãi Tự Nhiên và sự tích đầm Dạ Trạch",
    "evaluationFocus": "EARLY_COMMERCE_AND_BELIEF",
    "banner": "[Sử Liệu: Lĩnh Nam Chích Quái] [Kỷ/Triều Đại: Hùng Vương] [Mục: Truyện Nhất Dạ Trạch] [Nhân Vật: Chử Đồng Tử, Tiên Dung, Hùng Vương] [Thời Gian: Thời Hùng Vương thứ mười tám]",
    "rawText": "Chử Đồng Tử là chàng trai nghèo hiếu thảo sống cùng cha già bên bờ sông Hồng tại bãi Tự Nhiên thuộc đất Khoái Châu. Gia cảnh bần hàn chỉ có một chiếc khố duy nhất, khi cha mất chàng dùng khố chôn cha còn mình thì ngâm mình dưới nước mò cá kiếm sống qua ngày. Con gái vua Hùng thứ mười tám là công chúa Tiên Dung trong một chuyến du ngoạn sông nước trên thuyền rồng đã tình cờ ghé bãi cát vây màn tắm mát, nước xối làm lộ ra Chử Đồng Tử đang ẩn mình dưới cát. Nhận thấy đây là duyên trời định đoạt, Tiên Dung quyết định kết duyên phu thê cùng chàng. Vua Hùng nổi giận không cho hai người trở về cung đình, Tiên Dung cùng chồng ở lại ven sông mở mang chợ búa buôn bán sầm uất với thương nhân nước ngoài, trao đổi lâm thổ sản và học đạo tiên từ các bậc ẩn sĩ để cứu giúp dân lành qua khỏi bệnh tật đói nghèo. Sau đó, trong một đêm mưa to gió lớn kèm sấm sét dữ dội, hai vợ chồng cùng toàn bộ dinh thự lâu đài chợ búa bay thẳng lên trời, để lại một vùng đầm nước mênh mông gọi là đầm Dạ Trạch thuộc Hưng Yên. Dân chúng trong vùng lập miếu phụng thờ, tôn kính Chử Đồng Tử là một trong Tứ Bất Tử linh thiêng của tín ngưỡng dân gian nước ta, tượng trưng cho tình yêu thuần khiết, đạo hiếu son sắt và khát vọng phát triển giao thương mở mang kinh tế thuở sơ khai.",
    "wordCount": 277,
    "entities": [
      {
        "id": "person_chu_dong_tu",
        "name": "Chử Đồng Tử",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_hung_vuong",
        "name": "Hùng Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_da_trach",
        "name": "Dạ Trạch",
        "type": "LOCATION"
      },
      {
        "id": "loc_song_hong",
        "name": "sông Hồng",
        "type": "LOCATION"
      },
      {
        "id": "loc_hung_yen",
        "name": "Hưng Yên",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_chu_dong_tu",
        "subjectName": "Chử Đồng Tử",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_da_trach",
        "objectName": "Dạ Trạch"
      },
      {
        "subjectId": "loc_da_trach",
        "subjectName": "Dạ Trạch",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_hung_yen",
        "objectName": "Hưng Yên"
      }
    ]
  },
  {
    "id": "CHUNK_EP02_001_HAI_BA_TRUNG_ME_LINH",
    "epochId": "EPOCH_02",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Ngoại Kỷ Toàn Thư Quyển III",
    "dynasty": "Trưng Nữ Vương",
    "sectionTitle": "Kỷ Trưng Nữ Vương - Khởi nghĩa Mê Linh đánh đuổi Tô Định",
    "evaluationFocus": "FEMALE_HEROISM_RESISTANCE",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Hai Bà Trưng] [Mục: Khởi nghĩa Hát Môn - Mê Linh] [Nhân Vật: Trưng Trắc, Trưng Nhị, Thi Sách, Tô Định] [Thời Gian: Năm 40 - 43]",
    "rawText": "Mùa xuân năm Canh Tý (năm 40), Thái thú quận Giao Chỉ là Tô Định dùng chính sách bạo ngược tham tàn, áp bức hà khắc và giết hại Thi Sách là chồng của bà Trưng Trắc để răn đe các lạc tướng. Căm phẫn trước ách áp bức ngoại bang và mối thù gia đình sâu nặng, Hai Bà Trưng gồm Trưng Trắc và em gái là Trưng Nhị đã phất cờ khởi nghĩa tại cửa sông Hát Môn thuộc đất Mê Linh. Hào kiệt bốn phương cùng nhân dân sáu mươi lăm thành trì thuộc Giao Chỉ, Cửu Chân, Nhật Nam và Hợp Phố đồng lòng hưởng ứng vùng lên khởi nghĩa như triều dâng bão nổi. Nghĩa quân tiến đánh công phá trị sở thành Luy Lâu khiến Tô Định khiếp sợ phải cắt tóc cạo râu trốn chạy về phương Bắc. Trưng Trắc lên ngôi hoàng đế xưng là Trưng Nữ Vương, đóng đô tại Mê Linh và hạ lệnh miễn toàn bộ thuế khóa cho dân chúng trong hai năm để khôi phục thái bình an cư lạc nghiệp cho đất nước. Sử thần Ngô Sĩ Liên ca ngợi: Trưng Trắc, Trưng Nhị là đàn bà, hô một tiếng mà các quận Cửu Chân, Nhật Nam, Hợp Phố và sáu mươi lăm thành ở Lĩnh Ngoại đều hưởng ứng, dựng nước xưng vương dễ như trở bàn tay, đủ biết hình thế nước Việt ta có thể dựng nghiệp bá vương được. Mặc dù sau đó nhà Đông Hán phái Mã Viện đem đại quân sang đàn áp khốc liệt dẫn đến sự hy sinh oanh liệt của Hai Bà Trưng tại Cấm Khê, nhưng ngọn lửa quật khởi đầu tiên này đã khắc sâu ý chí độc lập bất khuất của dân tộc Việt Nam.",
    "wordCount": 301,
    "entities": [
      {
        "id": "person_hai_ba_trung",
        "name": "Hai Bà Trưng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trưng Trắc",
          "Trưng Nhị"
        ]
      },
      {
        "id": "loc_me_linh",
        "name": "Mê Linh",
        "type": "LOCATION"
      },
      {
        "id": "person_to_dinh",
        "name": "Tô Định",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_thi_sach",
        "name": "Thi Sách",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_luy_lau",
        "name": "Luy Lâu",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_hai_ba_trung",
        "subjectName": "Hai Bà Trưng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_me_linh",
        "objectName": "Mê Linh"
      },
      {
        "subjectId": "person_to_dinh",
        "subjectName": "Tô Định",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_luy_lau",
        "objectName": "Luy Lâu"
      }
    ]
  },
  {
    "id": "CHUNK_EP02_002_LY_NAM_DE_VAN_XUAN",
    "epochId": "EPOCH_02",
    "sourceDocument": "Việt Sử Tiêu Án - Ngô Thời Sỹ & Đại Việt Sử Ký",
    "dynasty": "Tiền Lý",
    "sectionTitle": "Khởi nghĩa Lý Bí lập nước Vạn Xuân và xây chùa Khai Quốc",
    "evaluationFocus": "FOUNDING_VAN_XUAN_MONARCHY",
    "banner": "[Sử Liệu: Việt Sử Tiêu Án] [Kỷ/Triều Đại: Nhà Tiền Lý] [Mục: Lý Nam Đế lập nước Vạn Xuân] [Nhân Vật: Lý Bí, Triệu Quang Phục, Tiêu Tư] [Thời Gian: Năm 542 - 548]",
    "rawText": "Năm Nhâm Tuất (542), Lý Bí liên kết với các hào kiệt các châu quận như Tinh Thiều, Phạm Tu khởi binh đánh đuổi Thứ sử Tiêu Tư bạo ngược của nhà Lương giải phóng thành Long Biên. Đến năm Giáp Tý (544), Lý Bí chính thức lên ngôi hoàng đế, xưng hiệu là Lý Nam Đế, đặt niên hiệu là Thiên Đức và đặt tên nước là Vạn Xuân với mong muốn non sông đất nước trường tồn vạn mùa xuân thái bình độc lập. Triều đình nhà Tiền Lý được thiết lập quy củ có hai ban văn võ, cho dựng điện Vạn Thọ và chùa Khai Quốc bên bờ sông Hồng tại Thăng Long Hà Nội ngày nay để cầu quốc thái dân an. Đây là lần đầu tiên người Việt tự xưng hoàng đế ngang hàng với các hoàng đế phương Bắc, khẳng định quyền tự chủ thiêng liêng của một quốc gia độc lập. Sau khi Lý Nam Đế lui quân về động Khuất Lão và qua đời vì bạo bệnh, danh tướng Triệu Quang Phục tiếp nối sự nghiệp lãnh đạo nhân dân lui về đầm Dạ Trạch kiên cường áp dụng chiến thuật du kích ban ngày ẩn nấp ban đêm tập kích, đánh lui danh tướng Trần Bá Tiên của giặc Lương. Thắng lợi của Triệu Việt Vương và sự ra đời của nước Vạn Xuân đã chứng minh sức sống mãnh liệt của nền văn minh độc lập bản địa bất chấp hàng thế kỷ bị áp đặt ách cai trị ngoại bang.",
    "wordCount": 262,
    "entities": [
      {
        "id": "person_ly_nam_de",
        "name": "Lý Bí",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lý Nam Đế"
        ]
      },
      {
        "id": "dynasty_van_xuan",
        "name": "Vạn Xuân",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_trieu_quang_phuc",
        "name": "Triệu Quang Phục",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_da_trach",
        "name": "Dạ Trạch",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ly_nam_de",
        "subjectName": "Lý Bí",
        "relationType": "PART_OF",
        "objectId": "dynasty_van_xuan",
        "objectName": "Vạn Xuân"
      },
      {
        "subjectId": "person_trieu_quang_phuc",
        "subjectName": "Triệu Quang Phục",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_da_trach",
        "objectName": "Dạ Trạch"
      },
      {
        "subjectId": "person_ly_nam_de",
        "subjectName": "Lý Bí",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Thăng Long"
      }
    ]
  },
  {
    "id": "CHUNK_EP02_003_BA_TRIEU_NONG_CONG",
    "epochId": "EPOCH_02",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Bắc Thuộc",
    "sectionTitle": "Khởi nghĩa Bà Triệu tại căn cứ núi Nưa Nông Cống",
    "evaluationFocus": "FEMALE_WARRIOR_HEROISM",
    "banner": "[Sử Liệu: Cương Mục] [Kỷ/Triều Đại: Thời kỳ Bắc thuộc] [Mục: Khởi nghĩa Triệu Ẩu] [Nhân Vật: Bà Triệu, Lục Dận] [Thời Gian: Năm 248]",
    "rawText": "Năm Mậu Thìn (248), tại vùng Cửu Chân nay thuộc Thanh Hóa, nữ anh hùng Triệu Thị Trinh thường gọi là Bà Triệu cùng anh trai là Triệu Quốc Đạt đã tập hợp hào kiệt phất cờ khởi nghĩa chống lại ách đô hộ tàn bạo của nhà Đông Ngô. Khi có người khuyên lấy chồng yên phận, Bà Triệu khẳng khái tuyên bố lời thề son sắt lưu danh muôn thuở: Tôi muốn cưỡi cơn gió mạnh, đạp luồng sóng dữ, chém cá kình ở biển Đông, giành lại giang sơn cởi ách nô lệ, chứ không chịu khom lưng làm tì thiếp người ta. Nghĩa quân xây dựng căn cứ vững chắc trên núi Nưa thuộc vùng Nông Cống, chế tạo vũ khí luyện tập binh sĩ và tiến công đánh tan quan lại đô hộ Đông Ngô khắp các châu quận, khiến toàn thể đất Giao Châu chấn động kinh hoàng. Hình ảnh nữ tướng mặc áo giáp vàng, đi guốc ngà, cài trâm vàng, cưỡi voi trắng một ngà xung trận khiến quân thù khiếp vía truyền tai nhau câu nói: Vung tay đánh cọp dễ, giáp mặt vua Bà khó. Triều đình Đông Ngô hoảng sợ phải cử tướng Lục Dận đem tám nghìn quân thiện chiến cùng nhiều thủ đoạn mua chuộc chia rẽ sang đàn áp. Sau nhiều tháng chiến đấu kiên cường đến cùng kiệt lực lượng, Bà Triệu đã tuẫn tiết tại núi Tùng Thanh Hóa, để lại tấm gương liệt nữ ngời sáng tinh thần bất khuất của phụ nữ Việt Nam.",
    "wordCount": 262,
    "entities": [
      {
        "id": "person_ba_trieu",
        "name": "Bà Triệu",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Triệu Thị Trinh",
          "Triệu Ẩu"
        ]
      },
      {
        "id": "loc_nong_cong",
        "name": "Nông Cống",
        "type": "LOCATION"
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ba_trieu",
        "subjectName": "Bà Triệu",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_nong_cong",
        "objectName": "Nông Cống"
      },
      {
        "subjectId": "loc_nong_cong",
        "subjectName": "Nông Cống",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_hoa",
        "objectName": "Thanh Hóa"
      }
    ]
  },
  {
    "id": "CHUNK_EP02_004_MAI_HAC_DE_VAN_AN",
    "epochId": "EPOCH_02",
    "sourceDocument": "Việt Sử Tiêu Án & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Thời kỳ Tự Chủ Sơ Kỳ",
    "sectionTitle": "Khởi nghĩa Mai Hắc Đế lập thành Vạn An chống quân Đường",
    "evaluationFocus": "ANTI_TANG_INSURRECTION",
    "banner": "[Sử Liệu: Cương Mục] [Kỷ/Triều Đại: Bắc thuộc lần 3] [Mục: Khởi nghĩa Mai Thúc Loan] [Nhân Vật: Mai Thúc Loan, Dương Tư Húc] [Thời Gian: Năm 713 - 722]",
    "rawText": "Đầu thế kỷ thứ tám, dưới ách bóc lột cống nạp quả vải nặng nề và sưu thuế hà khắc của chính quyền đô hộ nhà Đường, Mai Thúc Loan đã lãnh đạo phu phen và nhân dân Hoan Châu nổi dậy khởi nghĩa. Ông cho xây dựng căn cứ thành Vạn An kiên cố bên bờ sông Lam thuộc huyện Nam Đàn tỉnh Nghệ An làm tổng hành dinh kháng chiến và chính thức lên ngôi xưng vương, tôn xưng tôn hiệu là Mai Hắc Đế. Nhờ chính sách khoan hòa và uy tín cá nhân sâu rộng, Mai Hắc Đế đã liên kết chặt chẽ với nhân dân các nước láng giềng như Champa và Chân Lạp, tập hợp lực lượng liên quân lên tới hàng chục vạn người tiến công thần tốc đánh chiếm phủ thành Tống Bình nay là Hà Nội, quét sạch toàn bộ quan lại đô hộ nhà Đường và giải phóng giang sơn trong gần mười năm. Vua Đường Huyền Tông vô cùng kinh sợ trước quy mô của cuộc khởi nghĩa, lập tức điều động đại tướng Dương Tư Húc cùng tướng Quang Sở Khách đem mười vạn quân tinh nhuệ sang tiến công ác liệt bằng đường bộ và thủy quân. Mặc dù cuộc khởi nghĩa sau cùng bị dập tắt, nhưng thành Vạn An và danh hiệu Mai Hắc Đế mãi mãi là biểu tượng chói lọi cho tinh thần đoàn kết quốc tế khu vực và ý chí kiên cường chống ngoại xâm của nhân dân xứ Nghệ.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_mai_hac_de",
        "name": "Mai Thúc Loan",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Mai Hắc Đế"
        ]
      },
      {
        "id": "loc_nghe_an",
        "name": "Nghệ An",
        "type": "LOCATION"
      },
      {
        "id": "loc_ha_noi",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_mai_hac_de",
        "subjectName": "Mai Thúc Loan",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_nghe_an",
        "objectName": "Nghệ An"
      },
      {
        "subjectId": "person_mai_hac_de",
        "subjectName": "Mai Thúc Loan",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_ha_noi",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP03_001_NGO_QUYEN_BACH_DANG_938",
    "epochId": "EPOCH_03",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Tiền Kỷ Toàn Thư Quyển V",
    "dynasty": "Nhà Ngô",
    "sectionTitle": "Kỷ Tiền Ngô Vương - Chiến thắng Bạch Đằng năm 938 dẹp tan quân Nam Hán",
    "evaluationFocus": "DECISIVE_NAVAL_TACTICS",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Ngô] [Mục: Ngô Quyền đại thắng Bạch Đằng] [Nhân Vật: Ngô Quyền, Lưu Hoằng Tháo, Dương Đình Nghệ] [Thời Gian: Năm 938]",
    "rawText": "Năm Mậu Tuất (938), sau khi diệt trừ tên phản nghịch Kiều Công Tiễn để trả thù cho cha vợ là Tiết độ sứ Dương Đình Nghệ, Ngô Quyền khẩn trương chuẩn bị lực lượng đón đánh thủy quân Nam Hán do Hoằng Tháo chỉ huy sang xâm lấn. Ngô Quyền nhận định cửa sông Bạch Đằng là vị trí hiểm yếu nước thủy triều lên xuống chênh lệch rất lớn, đáy sông có bãi cọc nhọn bọc sắt sẽ tạo thành cạm bẫy nghiền nát thuyền giặc. Vua hạ lệnh cho quân dân đẵn gỗ rừng vạt nhọn đầu bịt sắt đóng ngầm xuống lòng sông rồi bố trí phục binh hai bên bờ lau sậy. Khi nước triều dâng ngập bãi cọc, Ngô Quyền sai thuyền nhẹ ra khiêu chiến rồi vờ thua rút chạy nhử Hoằng Tháo vượt qua cửa ải hiểm trở. Chờ lúc thủy triều rút nhanh cuốn theo dòng nước siết, Ngô Quyền tung toàn lực đánh quật ngược trở lại, dồn thuyền chiến giặc vào bãi cọc nhọn nhô lên khỏi mặt nước. Thuyền lớn của Nam Hán xô vào cọc nhọn vỡ nát đắm chìm vô số, Hoằng Tháo tử trận tại chỗ, quân giặc tan vỡ hoàn toàn. Chiến thắng Bạch Đằng lịch sử năm 938 của Ngô Quyền đã vĩnh viễn chấm dứt hơn một nghìn năm Bắc thuộc tăm tối, mở ra kỷ nguyên độc lập tự chủ lâu dài cho dân tộc Việt Nam. Năm 939, Ngô Quyền chính thức xưng vương, đóng đô ở Cổ Loa, bãi bỏ chức quan đô hộ của phương Bắc và đặt định trăm quan, thiết lập nền độc lập dân tộc.",
    "wordCount": 280,
    "entities": [
      {
        "id": "person_ngo_quyen",
        "name": "Ngô Quyền",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Tiền Ngô Vương"
        ]
      },
      {
        "id": "loc_song_bach_dang",
        "name": "sông Bạch Đằng",
        "type": "LOCATION",
        "aliases": [
          "Bạch Đằng"
        ]
      },
      {
        "id": "person_duong_dinh_nghe",
        "name": "Dương Đình Nghệ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ngo",
        "name": "Nhà Ngô",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ngo_quyen",
        "subjectName": "Ngô Quyền",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_song_bach_dang",
        "objectName": "sông Bạch Đằng"
      },
      {
        "subjectId": "person_ngo_quyen",
        "subjectName": "Ngô Quyền",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ngo",
        "objectName": "Nhà Ngô"
      },
      {
        "subjectId": "person_ngo_quyen",
        "subjectName": "Ngô Quyền",
        "relationType": "ROYAL_LINEAGE",
        "objectId": "person_duong_dinh_nghe",
        "objectName": "Dương Đình Nghệ"
      }
    ]
  },
  {
    "id": "CHUNK_EP03_002_DINH_TIEN_HOANG_HOA_LU",
    "epochId": "EPOCH_03",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Nhà Đinh",
    "sectionTitle": "Kỷ Nhà Đinh - Đinh Bộ Lĩnh dẹp loạn 12 sứ quân và định đô Hoa Lư",
    "evaluationFocus": "NATIONAL_UNIFICATION_MONARCHY",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Đinh] [Mục: Đinh Tiên Hoàng thống nhất non sông] [Nhân Vật: Đinh Tiên Hoàng, Đinh Liễn, Nguyễn Bặc] [Thời Gian: Năm 968 - 979]",
    "rawText": "Sau khi Ngô Vương qua đời, triều đình rối ren dẫn đến cục diện loạn 12 sứ quân cát cứ chia cắt đất nước thành từng vùng cục bộ. Tại đất Động Hoa Lư châu Đại Hoàng, Đinh Bộ Lĩnh từ thuở thiếu thời chăn trâu tập trận cờ lau đã bộc lộ tài năng quân sự xuất chúng, được nghĩa quân suy tôn làm Vạn Thắng Vương. Với sự phò tá đắc lực của các tướng tài trung kiên như Nguyễn Bặc, Đinh Điền, Trịnh Tú, Lưu Cơ và con trưởng Đinh Liễn, Đinh Bộ Lĩnh dùng chiến thuật kết hợp quân sự và ngoại giao thu phục từng sứ quân, dẹp tan tình trạng cát cứ chia rẽ và thống nhất toàn vẹn lãnh thổ giang sơn vào năm 968. Ông lên ngôi hoàng đế xưng là Đinh Tiên Hoàng, đặt quốc hiệu là Đại Cồ Việt, lấy niên hiệu là Thái Bình và chọn Hoa Lư Ninh Bình làm kinh đô non trẻ. Nơi đây có núi non hiểm trở bao bọc như bức tường thành tự nhiên kết hợp hào sâu sông Đáy hiểm yếu giúp phòng thủ vững chắc trước mọi mưu đồ can thiệp ngoại bang. Vua Đinh Tiên Hoàng cho đúc tiền đồng Thái Bình Hưng Bảo - đồng tiền đầu tiên của nền tài chính độc lập Việt Nam, thiết lập hệ thống quan chế hành chính và quân đội chia thành mười đạo, khẳng định vị thế một đế chế độc lập có chủ quyền trọn vẹn và thể chế tập quyền vững chắc.",
    "wordCount": 263,
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Tiên Hoàng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đinh Bộ Lĩnh",
          "Vạn Thắng Vương"
        ]
      },
      {
        "id": "loc_co_do_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_dai_co_viet",
        "name": "Đại Cồ Việt",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_ninh_binh",
        "name": "Ninh Bình",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_dinh_tien_hoang",
        "subjectName": "Đinh Tiên Hoàng",
        "relationType": "PART_OF",
        "objectId": "dynasty_dai_co_viet",
        "objectName": "Đại Cồ Việt"
      },
      {
        "subjectId": "person_dinh_tien_hoang",
        "subjectName": "Đinh Tiên Hoàng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_co_do_hoa_lu",
        "objectName": "Hoa Lư"
      },
      {
        "subjectId": "loc_co_do_hoa_lu",
        "subjectName": "Hoa Lư",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_ninh_binh",
        "objectName": "Ninh Bình"
      }
    ]
  },
  {
    "id": "CHUNK_EP03_003_LE_DAI_HANH_PHA_TONG_981",
    "epochId": "EPOCH_03",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Tiền Kỷ Toàn Thư Quyển VI",
    "dynasty": "Tiền Lê",
    "sectionTitle": "Kỷ Nhà Lê - Lê Hoàn đại phá quân Tống năm Tân Tỵ 981",
    "evaluationFocus": "EARLY_DEFENSE_WAR_STRATEGY",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Tiền Lê] [Mục: Lê Đại Hành phá Tống bình Chiêm] [Nhân Vật: Lê Hoàn, Hầu Nhân Bảo, Dương Vân Nga] [Thời Gian: Năm 981]",
    "rawText": "Năm Tân Tỵ (981), nhân lúc vua Đinh Toàn còn nhỏ tuổi và triều đình Đại Cồ Việt gặp biến cố, nhà Tống sai Hầu Nhân Bảo đem đại quân thủy bộ ồ ạt chia làm hai cánh tiến sang xâm lược. Được Thái hậu Dương Vân Nga trao áo long bào và triều thần tôn vinh, Thập đạo tướng quân Lê Hoàn chính thức lên ngôi hoàng đế, lấy hiệu là Lê Đại Hành, lãnh đạo cuộc kháng chiến cứu quốc. Vua Lê Đại Hành thân chinh đốc chiến, cho đóng cọc gỗ ngăn sông Bạch Đằng và sông Lục Đầu để chặn đường tiến quân thủy của giặc, đồng thời tập trung phục binh tại cửa ải Chi Lăng. Quân Đại Cồ Việt anh dũng chặn đứng cánh quân bộ của Hầu Nhân Bảo tại sông Như Nguyệt và cửa ải Chi Lăng, chém chết chủ tướng Hầu Nhân Bảo tại trận tiền, khiến cánh quân thủy của Lưu Trừng hoảng loạn tháo chạy về nước. Chiến thắng phá Tống năm 981 khẳng định sức mạnh quân sự vượt bậc của nhà Tiền Lê và giữ vững nền độc lập non trẻ của Đại Cồ Việt. Sau chiến thắng oanh liệt, vua Lê Đại Hành đẩy mạnh khai hoang lập ấp, tự mình cày ruộng tịch điền đầu xuân tại Đọi Sơn để khuyến khích phát triển sản xuất nông nghiệp, mở đường giao thông thủy bộ và củng cố vững chắc nền an ninh quốc gia trước sự dòm ngó của lân bang.",
    "wordCount": 256,
    "entities": [
      {
        "id": "person_le_dai_hanh",
        "name": "Lê Hoàn",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Đại Hành"
        ]
      },
      {
        "id": "loc_song_bach_dang",
        "name": "sông Bạch Đằng",
        "type": "LOCATION"
      },
      {
        "id": "person_duong_van_nga",
        "name": "Dương Vân Nga",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_dai_co_viet",
        "name": "Đại Cồ Việt",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_le_dai_hanh",
        "subjectName": "Lê Hoàn",
        "relationType": "PART_OF",
        "objectId": "dynasty_dai_co_viet",
        "objectName": "Đại Cồ Việt"
      },
      {
        "subjectId": "person_le_dai_hanh",
        "subjectName": "Lê Hoàn",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_song_bach_dang",
        "objectName": "sông Bạch Đằng"
      }
    ]
  },
  {
    "id": "CHUNK_EP03_004_DUONG_VAN_NGA_TRAO_AO_LONG_CON",
    "epochId": "EPOCH_03",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí",
    "dynasty": "Tiền Lê",
    "sectionTitle": "Thái hậu Dương Vân Nga trao áo long cổn vì đại nghĩa dân tộc",
    "evaluationFocus": "PATRIOTIC_REGENCY_DECISION",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Nhà Tiền Lê] [Mục: Quyết định lịch sử tại Hoa Lư] [Nhân Vật: Dương Vân Nga, Lê Hoàn, Đinh Toàn] [Thời Gian: Năm 980]",
    "rawText": "Năm Canh Thìn (980), sau khi Đinh Tiên Hoàng và Đinh Liễn bị ám hại, ấu chúa Đinh Toàn mới sáu tuổi lên nối ngôi trong bối cảnh nội bộ triều đình chia rẽ và quân Tống lăm le xâm lấn ngoài biên cương. Trước tình thế ngàn cân treo sợi tóc đe dọa trực tiếp đến sự tồn vong của xã tắc Đại Cồ Việt, Thái hậu Dương Vân Nga cùng các tướng lĩnh trung trinh đã đặt lợi ích tối cao của dân tộc lên trên quyền lợi dòng tộc. Tại điện kinh đô Hoa Lư, bà đã dũng cảm khoác áo long cổn lên người Thập đạo tướng quân Lê Hoàn, chính thức tôn ông lên làm hoàng đế lãnh đạo toàn dân đánh giặc giữ nước. Quyết định lịch sử sáng suốt của Hoàng hậu Dương Vân Nga đã giúp chuyển giao quyền lực hòa bình và nhanh chóng thống nhất ý chí quân dân cả nước, tạo nên sức mạnh tổng hợp đập tan cuộc xâm lược quy mô lớn của nhà Tống năm 981. Tấm lòng vì non sông xã tắc của Dương Vân Nga và sự nghiệp lẫy lừng của Lê Đại Hành đã mở ra một trang sử mới vẻ vang cho nhà Tiền Lê, củng cố nền độc lập tự chủ và tạo tiền đề vững chắc cho sự thăng hoa văn hóa, quân sự của các triều đại Lý - Trần mai sau. Việc hy sinh ngôi báu của dòng họ Đinh để trao quyền cho người tài đức Lê Hoàn là một nghĩa cử cao đẹp hiếm có trong lịch sử vương quyền phong kiến phương Đông, chứng minh lòng yêu nước nồng nàn và tinh thần đại nghĩa vì dân tộc luôn vượt lên trên mọi danh vọng quyền lực cá nhân.",
    "wordCount": 304,
    "entities": [
      {
        "id": "person_duong_van_nga",
        "name": "Dương Vân Nga",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_dai_hanh",
        "name": "Lê Hoàn",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Đại Hành"
        ]
      },
      {
        "id": "loc_co_do_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_dai_co_viet",
        "name": "Đại Cồ Việt",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_duong_van_nga",
        "subjectName": "Dương Vân Nga",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_co_do_hoa_lu",
        "objectName": "Hoa Lư"
      },
      {
        "subjectId": "person_duong_van_nga",
        "subjectName": "Dương Vân Nga",
        "relationType": "PART_OF",
        "objectId": "dynasty_dai_co_viet",
        "objectName": "Đại Cồ Việt"
      }
    ]
  },
  {
    "id": "CHUNK_EP04_001_LY_THAI_TO_DOI_DO_THANG_LONG",
    "epochId": "EPOCH_04",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển II",
    "dynasty": "Nhà Lý",
    "sectionTitle": "Kỷ Nhà Lý - Lý Thái Tổ ban Chiếu dời đô về Thăng Long năm 1010",
    "evaluationFocus": "CAPITAL_RELOCATION_STATE_FOUNDING",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lý] [Mục: Lý Thái Tổ dời đô] [Nhân Vật: Lý Thái Tổ, Vạn Hạnh] [Thời Gian: Năm 1010]",
    "rawText": "Mùa thu năm Canh Tuất (1010), sau khi lên ngôi sáng lập triều đại nhà Lý, vua Lý Thái Tổ nhận thấy kinh đô Hoa Lư địa thế chật hẹp, non sông hiểm trở tuy tiện cho việc phòng thủ quân sự nhưng không thuận lợi cho việc phát triển kinh tế lâu dài và mở mang cõi bờ thái bình. Dưới sự cố vấn chiến lược uyên bác của Quốc sư Vạn Hạnh, vua đã đích thân soạn thảo bản Chiếu dời đô bất hủ để ban bố cùng toàn thể thần dân thiên hạ. Chiếu dời đô chỉ rõ đất thành Đại La là nơi trung tâm trời đất, có thế rồng cuộn hổ ngồi, đúng ngôi nam bắc đông tây, lại tiện hướng nhìn sông tựa núi, địa thế rộng mà bằng, đất đai cao mà thoáng, muôn vật tốt tươi phồn thịnh, thật là chốn hội tụ trọng yếu của bốn phương đất nước, là kinh đô bậc nhất của đế vương muôn đời. Khi đoàn thuyền rồng của vua vừa cập bến dưới chân thành Đại La, có rồng vàng bay lượn trên bầu trời, vua mừng rỡ bèn đổi tên Đại La thành Thăng Long tức rồng bay lên, và đổi kinh đô cũ Hoa Lư làm phủ Tràng An. Quyết định thiên đô mang tầm nhìn chiến lược vĩ đại của Lý Thái Tổ đã định hình vị thế trung tâm chính trị, kinh tế, văn hóa của thủ đô Hà Nội suốt hơn một thiên niên kỷ lịch sử dân tộc.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_ly_thai_to",
        "name": "Lý Thái Tổ",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lý Công Uẩn"
        ]
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION",
        "aliases": [
          "Đại La",
          "Hà Nội"
        ]
      },
      {
        "id": "doc_chieu_doi_do",
        "name": "Chiếu dời đô",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_van_hanh",
        "name": "Vạn Hạnh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Nhà Lý",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ly_thai_to",
        "subjectName": "Lý Thái Tổ",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      },
      {
        "subjectId": "person_ly_thai_to",
        "subjectName": "Lý Thái Tổ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Thăng Long"
      },
      {
        "subjectId": "doc_chieu_doi_do",
        "subjectName": "Chiếu dời đô",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      }
    ]
  },
  {
    "id": "CHUNK_EP04_002_LY_THUONG_KIET_NHU_NGUYET",
    "epochId": "EPOCH_04",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí",
    "dynasty": "Nhà Lý",
    "sectionTitle": "Thái úy Lý Thường Kiệt lập phòng tuyến Như Nguyệt và bài thơ Thần",
    "evaluationFocus": "STRATEGIC_PREEMPTION_NATIONAL_SOVEREIGNTY",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lý] [Mục: Kháng chiến chống Tống (1075 - 1077)] [Nhân Vật: Lý Thường Kiệt, Quách Quỳ] [Thời Gian: Năm 1077]",
    "rawText": "Trong cuộc kháng chiến chống quân xâm lược Tống (1075 - 1077), Thái úy Lý Thường Kiệt đã thể hiện thiên tài quân sự kiệt xuất khi chủ động thực hiện chiến lược tiên phát chế nhân đánh úp các căn cứ Ung Châu, Khâm Châu để triệt tiêu hậu cần của địch rồi nhanh chóng rút về nước xây dựng phòng tuyến chiến lược trên sông Như Nguyệt nay là sông Cầu thuộc Bắc Ninh. Phòng tuyến được đắp bằng đất cao kết hợp chiến lũy cọc tre dày đặc nhiều tầng, kiểm soát toàn bộ tuyến đường thủy bộ tiến về kinh thành Thăng Long. Khi mười vạn đại quân Tống do Quách Quỳ và Triệu Tiết chỉ huy bị cầm chân và chịu tổn thất nặng nề trước chiến lũy kiên cố, giữa đêm thanh vắng, Lý Thường Kiệt cho người vào đền thờ Trương Hống, Trương Hát đọc vang bài thơ thần Nam Quốc Sơn Hà: Nam quốc sơn hà Nam đế cư, Tiệt nhiên định phận tại thiên thư, Như hà nghịch lỗ lai xâm phạm, Nhữ đẳng hành khan thủ bại hư. Bài thơ thần hào sảng vang vọng khắp núi sông đã khích lệ mạnh mẽ ý chí quyết chiến của quân dân Đại Việt, đồng thời làm nao núng tinh thần quân giặc. Sau đòn phản công quyết định bất ngờ của quân ta, quân Tống đại bại, Quách Quỳ buộc phải chấp nhận giảng hòa rút quân về nước, giữ vững toàn vẹn chủ quyền lãnh thổ quốc gia.",
    "wordCount": 258,
    "entities": [
      {
        "id": "person_ly_thuong_kiet",
        "name": "Lý Thường Kiệt",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Thái úy Lý Thường Kiệt"
        ]
      },
      {
        "id": "loc_song_nhu_nguyet",
        "name": "sông Như Nguyệt",
        "type": "LOCATION",
        "aliases": [
          "Như Nguyệt"
        ]
      },
      {
        "id": "doc_nam_quoc_son_ha",
        "name": "Nam Quốc Sơn Hà",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Nhà Lý",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_bac_ninh",
        "name": "Bắc Ninh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ly_thuong_kiet",
        "subjectName": "Lý Thường Kiệt",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      },
      {
        "subjectId": "person_ly_thuong_kiet",
        "subjectName": "Lý Thường Kiệt",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_song_nhu_nguyet",
        "objectName": "sông Như Nguyệt"
      },
      {
        "subjectId": "doc_nam_quoc_son_ha",
        "subjectName": "Nam Quốc Sơn Hà",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      }
    ]
  },
  {
    "id": "CHUNK_EP04_003_CHUA_MOT_COT_DIEN_HUU",
    "epochId": "EPOCH_04",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí",
    "dynasty": "Nhà Lý",
    "sectionTitle": "Vua Lý Thái Tông khởi dựng chùa Diên Hựu Một Cột năm 1049",
    "evaluationFocus": "BUDDHIST_ARCHITECTURE_HERITAGE",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lý] [Mục: Kiến trúc Chùa Diên Hựu] [Nhân Vật: Lý Thái Tông, Thiền sư Thiền Tuệ] [Thời Gian: Năm 1049]",
    "rawText": "Mùa đông năm Kỷ Sửu (1049), vua Lý Thái Tông nằm mộng thấy Phật Bà Quan Âm ngồi trên tòa sen dắt vua lên đài sen rực rỡ. Khi tỉnh dậy, vua đem việc ấy hỏi các quan triều đình và các bậc cao tăng, thiền sư Thiền Tuệ khuyên vua nên dựng chùa trên cột đá để báo đáp ơn Phật độ trì cho hoàng gia và xã tắc. Vua liền sai khởi công xây dựng ngôi chùa hình bông sen ngát hương nở trên một cột đá tròn vươn lên từ giữa hồ nước vuông Linh Chiểu, đặt tên chữ là chùa Diên Hựu với ý nghĩa kéo dài phúc lành bền lâu cho muôn dân Đại Việt. Chùa Một Cột cùng với tháp Báo Thiên, chuông Quy Điền và vạc Phổ Minh đã trở thành một trong An Nam tứ đại khí lừng danh biểu trưng cho đỉnh cao nghệ thuật đúc đồng và kiến trúc Phật giáo thời Lý. Ngôi chùa độc đáo này không chỉ là kiệt tác nghệ thuật kiến trúc tâm linh thanh thoát kết hợp hài hòa giữa điêu khắc gỗ tinh tế và không gian phong thủy mặt nước, mà còn phản ánh sâu sắc vai trò của Phật giáo như một quốc giáo đồng hành cùng sự thịnh trị của vương triều Lý trong việc giáo hóa muôn dân và duy trì thuần phong mỹ tục. Hàng năm vào ngày mùng 8 tháng 4 âm lịch lễ Phật Đản, nhà vua đều cùng triều thần xa giá ngự đến chùa làm lễ tắm Phật, phóng sinh chim cá và mở hội chẩn tế cầu cho mùa màng bội thu, bách tính an cư lạc nghiệp trong cảnh thái bình thịnh trị.",
    "wordCount": 291,
    "entities": [
      {
        "id": "person_ly_thai_tong",
        "name": "Lý Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_chua_mot_cot",
        "name": "chùa Diên Hựu",
        "type": "LOCATION",
        "aliases": [
          "Chùa Một Cột"
        ]
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Nhà Lý",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ly_thai_tong",
        "subjectName": "Lý Thái Tông",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      },
      {
        "subjectId": "person_ly_thai_tong",
        "subjectName": "Lý Thái Tông",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_chua_mot_cot",
        "objectName": "chùa Diên Hựu"
      }
    ]
  },
  {
    "id": "CHUNK_EP04_004_VAN_MIEU_QUOC_TU_GIAM_1070",
    "epochId": "EPOCH_04",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Nhà Lý",
    "sectionTitle": "Thành lập Văn Miếu Quốc Tử Giám - Trường đại học đầu tiên năm 1070",
    "evaluationFocus": "EDUCATION_ACADEMIC_FOUNDATION",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lý] [Mục: Khởi dựng Văn Miếu Quốc Tử Giám] [Nhân Vật: Lý Thánh Tông, Lý Nhân Tông, Lê Văn Thịnh] [Thời Gian: Năm 1070 - 1076]",
    "rawText": "Mùa thu năm Canh Tuất (1070), vua Lý Thánh Tông cho khởi dựng Văn Miếu tại kinh đô Thăng Long để thờ Khổng Tử, Chu Công và các bậc hiền triết Nho gia, đồng thời cho đắp tượng bảy mươi hai môn sinh của Khổng Tử và vẽ tranh sơn thếp trang nghiêm. Đến năm Bính Thìn (1076), vua Lý Nhân Tông cho lập thêm Quốc Tử Giám bên cạnh Văn Miếu để làm nơi học tập, rèn luyện văn tài của các hoàng tử, tôn thất và những nho sinh xuất chúng trong cả nước, đánh dấu sự ra đời của trường đại học quốc gia đầu tiên trong lịch sử Việt Nam. Triều đình nhà Lý bắt đầu mở các khoa thi Nho học đầu tiên vào năm 1075 để tuyển chọn nhân tài hiền đức phục vụ công cuộc quản lý hành chính quốc gia, trong đó Lê Văn Thịnh đã đỗ đầu và trở thành vị Trạng nguyên khai khoa đầu tiên của nền khoa cử Đại Việt. Sự kiện thành lập Văn Miếu Quốc Tử Giám đặt nền móng bền vững cho truyền thống hiếu học, tôn sư trọng đạo và đào tạo đội ngũ quan lại trí thức tinh hoa, thúc đẩy nền văn hóa học thuật của Đại Việt phát triển rực rỡ suốt hàng trăm năm. Nơi đây trở thành cái nôi sản sinh ra hàng nghìn bậc danh thần tài đức vẹn toàn cống hiến trọn đời cho sự hưng thịnh của non sông, biểu trưng cho ngọn đuốc trí tuệ bất diệt của nền văn hiến Thăng Long ngàn năm lịch sử.",
    "wordCount": 272,
    "entities": [
      {
        "id": "loc_van_mieu",
        "name": "Văn Miếu",
        "type": "LOCATION",
        "aliases": [
          "Quốc Tử Giám"
        ]
      },
      {
        "id": "person_ly_thanh_tong",
        "name": "Lý Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ly_nhan_tong",
        "name": "Lý Nhân Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Nhà Lý",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "loc_van_mieu",
        "subjectName": "Văn Miếu",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      },
      {
        "subjectId": "person_ly_thanh_tong",
        "subjectName": "Lý Thánh Tông",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ly",
        "objectName": "Nhà Lý"
      },
      {
        "subjectId": "loc_van_mieu",
        "subjectName": "Văn Miếu",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Thăng Long"
      }
    ]
  },
  {
    "id": "CHUNK_EP05_001_TRAN_HUNG_DAO_HICH_TUONG_SI",
    "epochId": "EPOCH_05",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển V",
    "dynasty": "Nhà Trần",
    "sectionTitle": "Hưng Đạo Đại Vương soạn Hịch tướng sĩ khích lệ ba quân năm 1284",
    "evaluationFocus": "MILITARY_LITERATURE_PATRIOTISM",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Trần] [Mục: Hịch tướng sĩ văn] [Nhân Vật: Trần Hưng Đạo, Thoát Hoan] [Thời Gian: Năm 1284]",
    "rawText": "Trước nguy cơ nửa triệu đại quân Nguyên Mông do Trấn Nam Vương Thoát Hoan chỉ huy lăm le tràn sang xâm lược Đại Việt lần thứ hai, Tiết chế Quốc công Hưng Đạo Đại Vương Trần Quốc Tuấn đã soạn bài Hịch tướng sĩ bất hủ để răn dạy và khích lệ tinh thần trung dũng của tướng sĩ dưới quyền. Trong áng hùng văn ái quốc này, Trần Hưng Đạo bộc bạch nỗi lòng son sắt vì vận mệnh giang sơn: Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa, chỉ căm tức chưa nuốt thịt ăn gan quân thù, dẫu cho trăm thân này phơi ngoài nội cỏ, nghìn xác này gói trong da ngựa, ta cũng vui lòng. Lời hịch đanh thép vừa phân tích sâu sắc đạo nghĩa chủ tướng trung kiên vừa phê phán thói ham vui ích kỷ tầm thường của một số tướng lĩnh, từ đó thổi bùng lên ngọn lửa căm thù giặc sục sôi và tinh thần xả thân vì nghĩa lớn của toàn quân. Toàn thể tướng sĩ nhà Trần vô cùng xúc động, đồng lòng thích vào cánh tay hai chữ Sát Thát để thề quyết tử bảo vệ nền độc lập của tổ quốc. Hịch tướng sĩ cùng với nghệ thuật quân sự tài tình của Trần Hưng Đạo đã chuẩn bị tâm thế vững vàng cho quân dân Đại Việt bước vào cuộc đọ sức sinh tử với đế quốc Nguyên Mông hùng mạnh nhất thế giới bấy giờ.",
    "wordCount": 262,
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Hưng Đạo",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trần Quốc Tuấn",
          "Hưng Đạo Đại Vương"
        ]
      },
      {
        "id": "doc_hich_tuong_si",
        "name": "Hịch tướng sĩ",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "Nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_thoat_hoan",
        "name": "Thoát Hoan",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "person_tran_hung_dao",
        "subjectName": "Trần Hưng Đạo",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tran",
        "objectName": "Nhà Trần"
      },
      {
        "subjectId": "doc_hich_tuong_si",
        "subjectName": "Hịch tướng sĩ",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_tran",
        "objectName": "Nhà Trần"
      }
    ]
  },
  {
    "id": "CHUNK_EP05_002_TRAN_BACH_DANG_1288",
    "epochId": "EPOCH_05",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Nhà Trần",
    "sectionTitle": "Đại thắng Bạch Đằng năm 1288 chôn vùi thủy quân Ô Mã Nhi",
    "evaluationFocus": "EPIC_NAVAL_VICTORY_TACTICS",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Trần] [Mục: Chiến thắng Bạch Đằng 1288] [Nhân Vật: Trần Hưng Đạo, Ô Mã Nhi, Phàn Tiếp, Trần Nhân Tông] [Thời Gian: Năm 1288]",
    "rawText": "Tháng 3 năm Mậu Tý (1288), sau khi các đạo quân Nguyên Mông bị vây hãm lâm vào cảnh thiếu lương thực và dịch bệnh hoành hành, chủ tướng Thoát Hoan buộc phải hạ lệnh chia quân rút chạy về nước, giao cho danh tướng Ô Mã Nhi và Phàn Tiếp chỉ huy toàn bộ đoàn thuyền chiến rút lui theo đường sông Bạch Đằng. Nắm chắc kế hoạch rút quân của địch, Quốc công Tiết chế Trần Hưng Đạo đã cho cắm bãi cọc nhọn bọc sắt dưới lòng sông tại các vị trí hiểm yếu như Tràng Kênh, Yên Giang và bố trí đại quân mai phục kín đáo trong các nhánh sông và lau sậy ven bờ. Sáng sớm ngày mùng 8 tháng 3, khi đoàn thuyền chiến Nguyên Mông tiến vào vùng phục kích lúc triều dâng, các thuyền nhẹ của quân ta ra khiêu chiến rồi rút lui nhử thuyền giặc vào bãi cọc ngầm. Khi thủy triều rút nhanh dữ dội, Trần Hưng Đạo hạ lệnh tổng phản công, bốn bề tiếng trống trận vang dội, tên bắn như mưa dồn thuyền giặc va vào cọc nhọn vỡ vụn đắm chìm vô số. Quân ta bắt sống các tướng giặc Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ Ngọc, tiêu diệt hoàn toàn thủy quân thiện chiến của đế chế Mông Cổ. Chiến thắng Bạch Đằng 1288 vĩ đại đã đập tan hoàn toàn cuộc xâm lược lần thứ ba của nhà Nguyên, giữ vững nền độc lập cho muôn đời Đại Việt.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Hưng Đạo",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_song_bach_dang",
        "name": "sông Bạch Đằng",
        "type": "LOCATION",
        "aliases": [
          "Bạch Đằng"
        ]
      },
      {
        "id": "person_o_ma_nhi",
        "name": "Ô Mã Nhi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "Nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_tran_nhan_tong",
        "name": "Trần Nhân Tông",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "person_tran_hung_dao",
        "subjectName": "Trần Hưng Đạo",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_song_bach_dang",
        "objectName": "sông Bạch Đằng"
      },
      {
        "subjectId": "person_tran_hung_dao",
        "subjectName": "Trần Hưng Đạo",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tran",
        "objectName": "Nhà Trần"
      }
    ]
  },
  {
    "id": "CHUNK_EP05_003_HOI_NGHI_DIEN_HONG",
    "epochId": "EPOCH_05",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển V",
    "dynasty": "Nhà Trần",
    "sectionTitle": "Thượng hoàng Trần Thánh Tông triệu tập Hội nghị Diên Hồng năm 1284",
    "evaluationFocus": "DEMOCRATIC_WAR_CONSULTATION",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Trần] [Mục: Hội nghị Diên Hồng] [Nhân Vật: Trần Thánh Tông, Trần Nhân Tông] [Thời Gian: Năm 1284]",
    "rawText": "Tháng 12 năm Giáp Thân (1284), khi đại quân Nguyên Mông rầm rộ áp sát biên thùy phía Bắc, Thượng hoàng Trần Thánh Tông và vua Trần Nhân Tông đã triệu tập một hội nghị lịch sử vô tiền khoáng hậu tại thềm điện Diên Hồng ở kinh thành Thăng Long, mời các bậc bô lão đại diện cho nhân dân khắp mọi miền đất nước về dự yến tiệc và bàn kế sách đánh giặc. Đứng trước các bậc phụ lão tóc bạc phơ uy nghiêm, Thượng hoàng ân cần thăm hỏi rồi hỏi ý kiến muôn dân: Giặc phương Bắc thế lực hung tàn, nay nên hòa hay nên đánh? Không một chút do dự, muôn người như một cùng giơ cao nắm tay đồng thanh hô vang dậy đất trời: Đánh! Tiếng hô đánh rung chuyển điện Diên Hồng thể hiện ý chí quật cường, lòng yêu nước nồng nàn và quyết tâm sắt đá của cả dân tộc không bao giờ chịu cúi đầu làm nô lệ. Toàn Thư nhận định việc triệu tập Hội nghị Diên Hồng là biểu hiện rực rỡ của tinh thần đoàn kết toàn dân và tư tưởng coi dân là gốc rễ của vương triều Trần, tạo nên khối đại đoàn kết muôn người cùng lòng làm nên chiến thắng hào hùng ba lần đánh tan đế chế xâm lược Nguyên Mông. Sức mạnh đồng lòng vua tôi đồng đức, anh em hòa thuận, cả nước góp sức chính là bí quyết then chốt giúp một quốc gia nhỏ bé đập tan đạo quân bành trướng xâm lăng hung hãn nhất thời trung cổ.",
    "wordCount": 274,
    "entities": [
      {
        "id": "person_tran_thanh_tong",
        "name": "Trần Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_tran_nhan_tong",
        "name": "Trần Nhân Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "Nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "event_hoi_nghi_dien_hong",
        "name": "Hội nghị Diên Hồng",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "subjectId": "person_tran_thanh_tong",
        "subjectName": "Trần Thánh Tông",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Thăng Long"
      },
      {
        "subjectId": "event_hoi_nghi_dien_hong",
        "subjectName": "Hội nghị Diên Hồng",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_tran",
        "objectName": "Nhà Trần"
      }
    ]
  },
  {
    "id": "CHUNK_EP05_004_CHU_VAN_AN_THAT_TRAM_SO",
    "epochId": "EPOCH_05",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí",
    "dynasty": "Nhà Trần",
    "sectionTitle": "Tư nghiệp Quốc Tử Giám Chu Văn An dâng Thất trảm sớ",
    "evaluationFocus": "INTEGRITY_SCHOLARSHIP_CONSCIENCE",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Trần] [Mục: Tiết tháo của Chu Văn An] [Nhân Vật: Chu Văn An, Trần Dụ Tông] [Thời Gian: Thế kỷ XIV]",
    "rawText": "Chu Văn An là bậc đại danh nho đức cao vọng trọng, giữ chức Tư nghiệp Quốc Tử Giám tận tâm dạy dỗ các thái tử và nho sinh triều Trần. Đến đời vua Trần Dụ Tông, triều chính ngày càng suy thoái, vua ham mê yến tiệc tửu sắc, bọn gian thần nịnh hót lộng hành thao túng triều cương khiến lòng dân oán thán. Trước cảnh kỷ cương phép nước bị xói mòn nghiêm trọng, Chu Văn An đã khẳng khái dâng lên nhà vua bản sớ chém bảy tên gian thần quyền quý được gọi là Thất trảm sớ để chấn chỉnh kỷ cương xã tắc. Khi thấy vua không nghe lời can gián chính trực, Chu Văn An lập tức treo mũ từ quan, từ bỏ mọi bổng lộc triều đình lui về ở ẩn tại núi Phượng Hoàng thuộc đất Chí Linh Hải Dương, lấy hiệu là Tiều Ẩn dạy học viết sách và chữa bệnh cho dân nghèo cho đến cuối đời. Hành động dũng cảm cùng nhân cách thanh cao không màng danh lợi của người thầy Chu Văn An được các sử gia ngợi ca là biểu tượng cao quý nhất của đạo làm thầy và lương tri trí thức Việt Nam qua mọi thời đại. Học trò của ông dù đỗ đạt làm quan to đầu triều như Phạm Sư Mạnh, Lê Quát khi về thăm thầy vẫn giữ đúng lễ phép quỳ gối hầu bên sập, minh chứng cho uy vọng đạo đức tuyệt vời của bậc Vạn thế sư biểu.",
    "wordCount": 261,
    "entities": [
      {
        "id": "person_chu_van_an",
        "name": "Chu Văn An",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_van_mieu",
        "name": "Quốc Tử Giám",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "Nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_hai_duong",
        "name": "Hải Dương",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_chu_van_an",
        "subjectName": "Chu Văn An",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tran",
        "objectName": "Nhà Trần"
      },
      {
        "subjectId": "person_chu_van_an",
        "subjectName": "Chu Văn An",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_hai_duong",
        "objectName": "Hải Dương"
      }
    ]
  },
  {
    "id": "CHUNK_EP06_001_HO_QUY_LY_CAI_CACH",
    "epochId": "EPOCH_06",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển VIII",
    "dynasty": "Nhà Hồ",
    "sectionTitle": "Hồ Quý Ly phát hành tiền giấy Thông Bảo Hội Sao và cải cách toàn diện",
    "evaluationFocus": "SOCIO_ECONOMIC_REFORM_CURRENCY",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Hồ] [Mục: Cải cách kinh tế thời Hồ] [Nhân Vật: Hồ Quý Ly, Hồ Hán Thương] [Thời Gian: Năm 1396 - 1400]",
    "rawText": "Cuối thế kỷ XIV, trước sự suy tàn không thể cứu vãn của triều Trần và mâu thuẫn ruộng đất gay gắt trong xã hội, Hồ Quý Ly đã tiến hành một công cuộc cải cách táo bạo và toàn diện trên mọi lĩnh vực chính trị, kinh tế, tài chính và quân sự. Năm Bính Tý (1396), ông cho ban hành tiền giấy Thông Bảo Hội Sao thay thế hoàn toàn tiền đồng, cấm tuyệt đối việc lưu hành tiền kim loại và hạ lệnh cho dân chúng nộp tiền đồng vào kho quốc gia để phục vụ đúc súng thần cơ và vũ khí phòng thủ. Đồng thời, Hồ Quý Ly ban hành chính sách Hạn điền và Hạn nô nhằm hạn chế tối đa quyền sở hữu ruộng đất và nô tỳ của tầng lớp quý tộc phong kiến cũ, sung công đất đai dư thừa chia cho nông dân nghèo cày cấy và sung nô tỳ vào quân đội quốc gia. Năm 1400, ông chính thức truất ngôi nhà Trần, lập ra triều đại nhà Hồ và đổi quốc hiệu là Đại Ngu với ước vọng một nền thái bình thịnh trị lớn lao. Mặc dù các chính sách cải cách tài chính, tiền tệ và chữ Nôm tiến bộ vượt trước thời đại, song việc thực thi có phần nóng vội và cưỡng chế nghiêm khắc đã khiến triều đình nhà Hồ mất đi sự ủng hộ rộng rãi của nhân dân khi họa ngoại xâm ập đến.",
    "wordCount": 253,
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "Nhà Hồ",
        "type": "DYNASTY_ERA",
        "aliases": [
          "Đại Ngu"
        ]
      },
      {
        "id": "person_ho_han_thuong",
        "name": "Hồ Hán Thương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_tien_giay_thong_bao",
        "name": "Thông Bảo Hội Sao",
        "type": "ARTIFACT"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ho_quy_ly",
        "subjectName": "Hồ Quý Ly",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ho",
        "objectName": "Nhà Hồ"
      },
      {
        "subjectId": "artifact_tien_giay_thong_bao",
        "subjectName": "Thông Bảo Hội Sao",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_ho",
        "objectName": "Nhà Hồ"
      }
    ]
  },
  {
    "id": "CHUNK_EP06_002_THANH_TAY_DO_VINH_LOC",
    "epochId": "EPOCH_06",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Di sản Văn hóa Thế giới UNESCO",
    "dynasty": "Nhà Hồ",
    "sectionTitle": "Xây dựng Thành đá Tây Đô tại Vĩnh Lộc Thanh Hóa năm 1397",
    "evaluationFocus": "STONE_ARCHITECTURE_FORTRESS",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Nhà Hồ] [Mục: Xây dựng Tây Đô] [Nhân Vật: Hồ Quý Ly] [Địa Danh: Thành Nhà Hồ, Vĩnh Lộc, Thanh Hóa] [Thời Gian: Năm 1397]",
    "rawText": "Mùa xuân năm Đinh Sửu (1397), nhận thấy Thăng Long có địa thế bằng phẳng dễ bị bao vây tấn công khi giặc phương Bắc tràn sang, Hồ Quý Ly đã hạ lệnh cho xây dựng một kinh đô đá kiên cố tại động An Tôn thuộc huyện Vĩnh Lộc tỉnh Thanh Hóa, gọi là Tây Đô hay Thành Nhà Hồ. Công trình quân sự kỳ vĩ này được hoàn thành chỉ trong vòng ba tháng với kỹ thuật ghép những khối đá vôi nguyên khối khổng lồ nặng từ mười đến hai mươi tấn mà không cần bất kỳ chất kết dính vữa hồ nào. Tòa thành có bốn cổng vòm cuốn kiên cố theo bốn hướng Đông, Tây, Nam, Bắc, bên ngoài có hào nước sâu và thành đất lũy tre bao bọc tạo nên hệ thống công sự phòng ngự đồ sộ bậc nhất Đông Nam Á. Kiến trúc độc nhất vô nhị của Thành Nhà Hồ thể hiện bước phát triển vượt bậc của kỹ nghệ khai thác, vận chuyển và xây dựng đá của người Việt cuối thế kỷ XIV. Công trình đã được UNESCO công nhận là Di sản Văn hóa Thế giới vào năm 2011, minh chứng cho tầm nhìn kiến trúc và công nghệ phòng thủ kiên cố của triều đại nhà Hồ trong lịch sử dân tộc. Các tường thành bằng đá sừng sững trải qua hơn sáu trăm năm mưa nắng và biến thiên lịch sử vẫn đứng vững như một đài kỷ niệm uy nghi về sức lao động phi thường và óc sáng tạo kỹ thuật của tiền nhân.",
    "wordCount": 271,
    "entities": [
      {
        "id": "loc_thanh_nha_ho",
        "name": "Thành Nhà Hồ",
        "type": "LOCATION",
        "aliases": [
          "Tây Đô"
        ]
      },
      {
        "id": "loc_vinh_loc",
        "name": "Vĩnh Lộc",
        "type": "LOCATION"
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      },
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "Nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "loc_thanh_nha_ho",
        "subjectName": "Thành Nhà Hồ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_vinh_loc",
        "objectName": "Vĩnh Lộc"
      },
      {
        "subjectId": "loc_vinh_loc",
        "subjectName": "Vĩnh Lộc",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_hoa",
        "objectName": "Thanh Hóa"
      },
      {
        "subjectId": "person_ho_quy_ly",
        "subjectName": "Hồ Quý Ly",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ho",
        "objectName": "Nhà Hồ"
      }
    ]
  },
  {
    "id": "CHUNK_EP06_003_HO_NGUYEN_TRUNG_SUNG_THAN_CO",
    "epochId": "EPOCH_06",
    "sourceDocument": "Minh Sử & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Nhà Hồ",
    "sectionTitle": "Hồ Nguyên Trừng sáng chế súng Thần cơ và thuyền Cổ lâu",
    "evaluationFocus": "MILITARY_INVENTION_TECHNOLOGY",
    "banner": "[Sử Liệu: Minh Sử & Cương Mục] [Kỷ/Triều Đại: Nhà Hồ] [Mục: Vũ khí Thần cơ thương pháo] [Nhân Vật: Hồ Nguyên Trừng, Hồ Quý Ly] [Thời Gian: Năm 1400 - 1407]",
    "rawText": "Hồ Nguyên Trừng là con trưởng của Hồ Quý Ly, giữ chức Tả Tướng quốc triều Hồ, là một thiên tài công binh và nhà phát minh vũ khí kiệt xuất hàng đầu trong lịch sử quân sự Việt Nam. Nhận thấy sự đe dọa xâm lược từ nhà Minh, ông đã dồn toàn bộ tâm huyết nghiên cứu đúc thành công súng Thần cơ - loại đại bác hỏa mai sử dụng thuốc súng có sức công phá vô cùng khủng khiếp có thể bắn đạn ghém và đạn chì xa hàng trăm trượng. Ngoài ra, Hồ Nguyên Trừng còn sáng chế ra loại thuyền chiến Cổ lâu hai tầng kiên cố, tầng trên dùng cho binh sĩ chiến đấu bắn tên nỏ hỏa thương, tầng dưới bố trí tay chèo kín đáo che chắn mũi tên giặc. Vũ khí Thần cơ pháo của Hồ Nguyên Trừng đã gây tổn thất nặng nề cho quân xâm lược Minh trong các trận chiến phòng thủ trên sông Hồng và cửa biển phía Bắc. Sau khi nhà Hồ thất thủ, nhà Minh bắt Hồ Nguyên Trừng về Kim Lăng phong làm quan Thượng thư bộ Công, chuyên trách chỉ đạo chế tạo hỏa khí cho quân đội triều Minh và tôn kính ông là bậc Thần hỏa khí tổ sư. Tài năng kỹ thuật đúc pháo vượt bậc của ông không chỉ làm rạng danh nền khoa học quân sự Đại Việt mà còn có tầm ảnh hưởng sâu rộng đến kỹ nghệ hỏa khí Đông Á thời bấy giờ.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_ho_nguyen_trung",
        "name": "Hồ Nguyên Trừng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_sung_than_co",
        "name": "súng Thần cơ",
        "type": "ARTIFACT"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "Nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ho_nguyen_trung",
        "subjectName": "Hồ Nguyên Trừng",
        "relationType": "ROYAL_LINEAGE",
        "objectId": "person_ho_quy_ly",
        "objectName": "Hồ Quý Ly"
      },
      {
        "subjectId": "artifact_sung_than_co",
        "subjectName": "súng Thần cơ",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_ho",
        "objectName": "Nhà Hồ"
      }
    ]
  },
  {
    "id": "CHUNK_EP06_004_THAT_BAI_DA_BANG_1407",
    "epochId": "EPOCH_06",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển VIII",
    "dynasty": "Nhà Hồ",
    "sectionTitle": "Thất bại thành Đa Bang năm 1407 và bài học mất lòng dân",
    "evaluationFocus": "FALL_OF_DYNASTY_LESSON",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Nhà Hồ] [Mục: Trận Đa Bang và bài học lịch sử] [Nhân Vật: Hồ Quý Ly, Hồ Nguyên Trừng, Trương Phụ] [Thời Gian: Năm 1407]",
    "rawText": "Đầu năm Đinh Hợi (1407), lấy cớ phù Trần diệt Hồ, Minh Thành Tổ sai hai tướng Trương Phụ và Mộc Thạnh đem ba mươi vạn đại quân tiến sang xâm lược nước ta. Triều đình nhà Hồ tập trung đại quân xây dựng tuyến phòng thủ kiên cố tại thành Đa Bang Ba Vì Hà Nội dựa vào lũy cọc gỗ và pháo thần cơ phòng thủ. Tuy nhiên, Trương Phụ đã dùng chiến thuật ban đêm lấy da báo trùm lên ngựa chiến để dọa đàn voi chiến của quân Hồ hoảng sợ chạy ngược giẫm đạp lên chính đội hình quân nhà, đánh vỡ tuyến phòng thủ Đa Bang và tiến vào chiếm kinh thành Đông Đô Thăng Long. Quân nhà Hồ rút lui dần về phương Nam rồi tan rã hoàn toàn tại cửa biển Kỳ La Hà Tĩnh, cha con Hồ Quý Ly và Hồ Nguyên Trừng đều bị quân Minh bắt giữ. Trước đó, khi vua Hồ Quý Ly hỏi kế sách phòng thủ chống giặc, Tướng quốc Hồ Nguyên Trừng đã thốt lên lời nói bất hủ đau xót: Thần không sợ đánh, chỉ sợ lòng dân không theo. Thất bại nhanh chóng của nhà Hồ để lại bài học xương máu sâu sắc cho muôn đời sau: Một triều đình dù có thành cao hào sâu và vũ khí tối tân đến đâu nhưng nếu làm mất lòng dân thì xã tắc khó lòng giữ vững. Bài học coi trọng sức mạnh của nhân dân và củng cố khối đại đoàn kết toàn dân tộc luôn là chân lý bất diệt trong sự nghiệp giữ nước của dân tộc Việt Nam qua mọi thời đại.",
    "wordCount": 283,
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ho_nguyen_trung",
        "name": "Hồ Nguyên Trừng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_thanh_da_bang",
        "name": "thành Đa Bang",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "Nhà Hồ",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_ha_tinh",
        "name": "Hà Tĩnh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ho_quy_ly",
        "subjectName": "Hồ Quý Ly",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_ho",
        "objectName": "Nhà Hồ"
      },
      {
        "subjectId": "person_ho_quy_ly",
        "subjectName": "Hồ Quý Ly",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_da_bang",
        "objectName": "thành Đa Bang"
      }
    ]
  },
  {
    "id": "CHUNK_EP07_001_LE_LOI_KHOI_NGHIA_LAM_SON",
    "epochId": "EPOCH_07",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lam Sơn Thực Lục",
    "dynasty": "Khởi nghĩa Lam Sơn",
    "sectionTitle": "Lê Lợi dựng cờ khởi nghĩa Lam Sơn tại Thanh Hóa năm 1418",
    "evaluationFocus": "NATIONAL_LIBERATION_UPRISING",
    "banner": "[Sử Liệu: Lam Sơn Thực Lục] [Kỷ/Triều Đại: Khởi nghĩa Lam Sơn] [Mục: Hội thề Lũng Nhai] [Nhân Vật: Lê Lợi, Nguyễn Trãi, Lê Lai] [Thời Gian: Năm 1416 - 1418]",
    "rawText": "Mùa xuân năm Mậu Tuất (1418), trước tội ác tày trời của giặc Minh nướng dân đen trên ngọn lửa hung tàn vùi con đỏ xuống dưới hầm tai vạ, Bình Định Vương Lê Lợi đã cùng các hào kiệt như Nguyễn Trãi, Lê Lai, Trần Nguyên Hãn phất cờ khởi nghĩa tại vùng rừng núi Lam Sơn Thanh Hóa. Trước đó tại Hội thề Lũng Nhai năm 1416, mười chín nghĩa sĩ kiên trung đã cắt máu ăn thề, đồng tâm hiệp lực quyết sống chết có nhau để cứu dân cứu nước khỏi ách thống trị tàn bạo của nhà Minh. Trong những năm đầu đầy gian khổ thiếu thốn, nghĩa quân Lam Sơn nhiều lần bị giặc bao vây ngặt nghèo tại núi Chí Linh, tướng Lê Lai đã dũng cảm liều mình cứu chúa mặc áo ngự bào xông ra trận nghi binh chịu chết để Lê Lợi và đại quân bí mật rút lui củng cố lực lượng. Với tư tưởng lấy đại nghĩa thắng hung tàn đem chí nhân thay cường bạo của quân sư Nguyễn Trãi, cuộc khởi nghĩa Lam Sơn đã chuyển hóa thành phong trào giải phóng dân tộc quy mô toàn quốc, từng bước tiến ra Bắc giải phóng non sông. Nghĩa quân gắn bó keo sơn với nhân dân, chia ngọt sẻ bùi, dựng cờ khởi nghĩa vì độc lập tự do của tổ quốc, biến mảnh đất Lam Sơn kiên cường thành bàn đạp vững chắc đập tan ách thống trị hai mươi năm tàn bạo của đế chế nhà Minh.",
    "wordCount": 263,
    "entities": [
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Bình Định Vương",
          "Lê Thái Tổ"
        ]
      },
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_lam_son",
        "name": "Lam Sơn",
        "type": "LOCATION"
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      },
      {
        "id": "person_le_lai",
        "name": "Lê Lai",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "person_le_loi",
        "subjectName": "Lê Lợi",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_lam_son",
        "objectName": "Lam Sơn"
      },
      {
        "subjectId": "loc_lam_son",
        "subjectName": "Lam Sơn",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_hoa",
        "objectName": "Thanh Hóa"
      }
    ]
  },
  {
    "id": "CHUNK_EP07_002_NGUYEN_TRAI_BINH_NGO_DAI_CAO",
    "epochId": "EPOCH_07",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư - Bản Kỷ Toàn Thư Quyển X",
    "dynasty": "Nhà Lê Sơ",
    "sectionTitle": "Nguyễn Trãi thừa lệnh Lê Thái Tổ soạn Bình Ngô đại cáo năm 1428",
    "evaluationFocus": "HUMANIST_DECLARATION_SOVEREIGNTY",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lê Sơ] [Mục: Bình Ngô đại cáo] [Nhân Vật: Nguyễn Trãi, Lê Lợi] [Thời Gian: Năm 1428]",
    "rawText": "Mùa xuân năm Mậu Thân (1428), sau khi toàn bộ quân xâm lược nhà Minh do Vương Thông chỉ huy phải ký hiệp ước rút quân về nước, Bình Định Vương Lê Lợi lên ngôi hoàng đế sáng lập triều đại Lê Sơ và sai đại danh thần Nguyễn Trãi soạn thảo Bình Ngô đại cáo để tuyên cáo nền độc lập thái bình cho muôn dân thiên hạ. Bản tuyên ngôn mở đầu bằng chân lý ngời sáng về chủ quyền thiêng liêng: Như nước Đại Việt ta từ trước, Vốn xưng nền văn hiến đã lâu, Núi sông bờ cõi đã chia, Phong tục Bắc Nam cũng khác, Từ Triệu, Đinh, Lý, Trần bao đời gây nền độc lập, Cùng Hán, Đường, Tống, Nguyên mỗi bên xưng đế một phương. Áng thiên cổ hùng văn tổng kết mười năm kháng chiến gian khổ tất thắng của nghĩa quân Lam Sơn, đề cao truyền thống nhân đạo hòa bình mở đường hiếu sinh cấp thuyền ngựa cho quân giặc bại trận về nước, khẳng định sức mạnh của lòng dân và đạo nghĩa chính nghĩa bất diệt của non sông Đại Việt. Tác phẩm được coi là bản Tuyên ngôn Độc lập thứ hai của dân tộc Việt Nam, kết tinh rực rỡ tư tưởng nhân văn cao cả, tinh thần tự hào dân tộc quật cường và khát vọng hòa bình muôn đời cho bách tính muôn phương. Bản cáo trạng đanh thép vạch trần tội ác dã man của quân xâm lược: Nướng dân đen trên ngọn lửa hung tàn, Vùi con đỏ xuống dưới hầm tai vạ. Dối trời lừa dân đủ muôn nghìn kế, Gây binh kết oán trải hai mươi năm. Bại nhân nghĩa nát cả đất trời, Nặng thuế khóa sạch không đầm núi. Đồng thời, bài cáo ca ngợi tinh thần nhân nghĩa thủy chung của dân tộc ta: Đem đại nghĩa để thắng hung tàn, Lấy chí nhân để thay cường bạo. Nghệ thuật ngôn từ mẫu mực kết hợp chặt chẽ giữa lý luận sắc bén và cảm xúc dạt dào đã đưa Bình Ngô đại cáo trở thành đỉnh cao chói lọi của nền văn học yêu nước Đại Việt, sống mãi cùng non sông đất nước qua muôn thế hệ.",
    "wordCount": 382,
    "entities": [
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Ức Trai"
        ]
      },
      {
        "id": "doc_binh_ngo_dai_cao",
        "name": "Bình Ngô đại cáo",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "doc_binh_ngo_dai_cao",
        "subjectName": "Bình Ngô đại cáo",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      },
      {
        "subjectId": "person_nguyen_trai",
        "subjectName": "Nguyễn Trãi",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      }
    ]
  },
  {
    "id": "CHUNK_EP07_003_TRAN_TOT_DONG_CHUC_DONG",
    "epochId": "EPOCH_07",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Khâm Định Việt Sử Thông Giám Cương Mục",
    "dynasty": "Khởi nghĩa Lam Sơn",
    "sectionTitle": "Trận phục kích Tốt Động Chúc Động đập tan viện binh Vương Thông",
    "evaluationFocus": "AMBUSH_ANNIHILATION_BATTLE",
    "banner": "[Sử Liệu: Cương Mục] [Kỷ/Triều Đại: Khởi nghĩa Lam Sơn] [Mục: Trận Tốt Động Chúc Động] [Nhân Vật: Phạm Văn Xảo, Đỗ Bí, Vương Thông] [Thời Gian: Năm 1426]",
    "rawText": "Tháng 10 năm Bính Ngọ (1426), viện binh nhà Minh do Tổng binh Vương Thông chỉ huy cùng mười vạn quân kéo sang hòng giải vây cho thành Đông Quan. Nắm bắt được kế hoạch hành quân và điểm yếu khinh địch của giặc, các tướng lĩnh Lam Sơn gồm Phạm Văn Xảo, Đỗ Bí, Lý Triện và Nguyễn Xí đã khôn khéo đặt trận địa mai phục hiểm yếu tại vùng đầm lầy Tốt Động Chúc Động thuộc huyện Chương Mỹ Hà Nội. Khi quân Minh tiến vào ổ phục kích giữa trời mưa bão lầy lội, nghĩa quân Lam Sơn đồng loạt nổi trống xung trận, voi chiến và bộ binh xông ra đánh quật tơi bời chém chết tướng giặc Trần Hiệp, Lý Lượng, tiêu diệt hơn năm vạn quân Minh, buộc Vương Thông phải tháo chạy vào thành Đông Quan cố thủ. Chiến thắng Tốt Động Chúc Động làm thay đổi cục diện chiến lược toàn diện, đẩy giặc Minh vào thế phòng ngự bị động tuyệt vọng trước sức mạnh vũ bão của nghĩa quân Lam Sơn. Trận phục kích kinh điển này đã thể hiện nghệ thuật quân sự tài ba của nghĩa quân Lam Sơn trong việc biến địa hình bùn lầy hiểm trở thành mồ chôn đạo quân xâm lược thiện chiến đông hơn gấp bội. Thắng lợi giòn giã tại Tốt Động Chúc Động đã đập tan hoàn toàn nhuệ khí của quân Minh, phá sản mưu đồ phản công giành lại quyền chủ động chiến trường của Vương Thông. Toàn Thư ghi nhận rằng sau trận đánh này, quân Minh rơi vào cảnh tiến thoái lưỡng nan, hoang mang cực độ và phải rút toàn bộ tàn quân co cụm vào trong thành Đông Quan chờ viện binh từ phương Bắc sang cứu nguy. Chiến thắng đã cổ vũ mạnh mẽ tinh thần chiến đấu của nghĩa quân trên khắp các mặt trận, tạo đà tâm lý vô cùng thuận lợi để nghĩa quân Lam Sơn bao vây siết chặt các thành lũy trọng yếu của địch và chuẩn bị cho trận quyết chiến chiến lược tiêu diệt viện binh Liễu Thăng ở Chi Lăng Xương Giang sau đó.",
    "wordCount": 369,
    "entities": [
      {
        "id": "event_tran_tot_dong",
        "name": "Tốt Động Chúc Động",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_chuong_my",
        "name": "Chương Mỹ",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "event_tran_tot_dong",
        "subjectName": "Tốt Động Chúc Động",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_chuong_my",
        "objectName": "Chương Mỹ"
      },
      {
        "subjectId": "loc_chuong_my",
        "subjectName": "Chương Mỹ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP07_004_TRAN_CHI_LANG_XUONG_GIANG",
    "epochId": "EPOCH_07",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lam Sơn Thực Lục",
    "dynasty": "Khởi nghĩa Lam Sơn",
    "sectionTitle": "Trận Chi Lăng Xương Giang chém Liễu Thăng toàn thắng năm 1427",
    "evaluationFocus": "MASTER_CAMPAIGN_INTERCEPTION",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Khởi nghĩa Lam Sơn] [Mục: Chiến dịch Chi Lăng Xương Giang] [Nhân Vật: Lê Lợi, Liễu Thăng, Trần Nguyên Hãn] [Thời Gian: Năm 1427]",
    "rawText": "Mùa thu năm Đinh Mùi (1427), nhà Minh cử đạo viện binh khổng lồ mười lăm vạn quân do An Viễn hầu Liễu Thăng và Mộc Thạnh chỉ huy chia làm hai đường tiến sang hòng cứu vãn thất bại. Bình Định Vương Lê Lợi cùng bộ chỉ huy nghĩa quân chủ trương vây thành diệt viện, tập trung lực lượng tinh nhuệ phục kích tại cửa ải Chi Lăng Lạng Sơn hiểm trở. Tướng Trần Lựu vờ thua nhử Liễu Thăng dẫn quân tiên phong vượt qua đầm lầy, nghĩa quân bất ngờ tung phục binh đâm chết Liễu Thăng tại núi Mã Yên, chém hơn một vạn đầu giặc. Tiếp đó tại thành Xương Giang Bắc Giang, các tướng Trần Nguyên Hãn, Lê Sát bao vây tiêu diệt toàn bộ đạo quân còn lại của Thôi Tụ, Hoàng Phúc. Đạo quân Mộc Thạnh nghe tin Liễu Thăng đền tội hoảng loạn tháo chạy về nước. Đại thắng Chi Lăng Xương Giang buộc Vương Thông tại thành Đông Quan phải xin mở Hội thề Đông Quan cầu hòa rút quân về nước, kết thúc thắng lợi mười năm kháng chiến cứu nước oanh liệt của nghĩa quân Lam Sơn. Chiến dịch này được đánh giá là đỉnh cao rực rỡ của nghệ thuật tác chiến vận động và tiêu diệt chiến lược trong lịch sử nghệ thuật quân sự trung đại Việt Nam. Chiến thắng vang dội Chi Lăng Xương Giang đã tiêu diệt và bắt sống gần mười vạn quân tiếp viện của nhà Minh, chôn vùi hoàn toàn hy vọng duy trì ách thống trị của phong kiến phương Bắc đối với nước ta. Tại Hội thề Đông Quan, Vương Thông và các tướng lĩnh nhà Minh phải cam kết rút toàn bộ quân đội về nước trong danh dự và hòa bình. Lê Lợi và Nguyễn Trãi đã thể hiện tinh thần nhân đạo cao cả khi không những không sát hại tù binh mà còn cấp hàng trăm cỗ xe, hàng nghìn con ngựa và lương thảo đầy đủ cho binh lính giặc lên đường hồi hương an toàn. Nghĩa cử cao đẹp này đã dập tắt nguy cơ chiến tranh phục thù từ phương Bắc, mở ra thời kỳ bang giao hòa hiếu lâu dài giữa hai quốc gia.",
    "wordCount": 385,
    "entities": [
      {
        "id": "loc_chi_lang",
        "name": "Chi Lăng",
        "type": "LOCATION"
      },
      {
        "id": "loc_lang_son",
        "name": "Lạng Sơn",
        "type": "LOCATION"
      },
      {
        "id": "person_lieu_thang",
        "name": "Liễu Thăng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "loc_chi_lang",
        "subjectName": "Chi Lăng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_lang_son",
        "objectName": "Lạng Sơn"
      },
      {
        "subjectId": "person_lieu_thang",
        "subjectName": "Liễu Thăng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_chi_lang",
        "objectName": "Chi Lăng"
      }
    ]
  },
  {
    "id": "CHUNK_EP08_001_LE_THANH_TONG_LUAT_HONG_DUC",
    "epochId": "EPOCH_08",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Quốc Triều Hình Luật",
    "dynasty": "Nhà Lê Sơ",
    "sectionTitle": "Vua Lê Thánh Tông ban hành Bộ luật Hồng Đức thịnh trị Đại Việt",
    "evaluationFocus": "PROGRESSIVE_LEGAL_FRAMEWORK",
    "banner": "[Sử Liệu: Đại Việt Sử Ký Toàn Thư] [Kỷ/Triều Đại: Nhà Lê Sơ] [Mục: Quốc Triều Hình Luật] [Nhân Vật: Lê Thánh Tông] [Thời Gian: Niên hiệu Hồng Đức (1470 - 1497)]",
    "rawText": "Dưới triều đại của hoàng đế Lê Thánh Tông, nước Đại Việt đạt đến đỉnh cao rực rỡ của chế độ quân chủ phong kiến tập quyền. Nhà vua đã cho ban hành bộ Quốc Triều Hình Luật thường gọi là Bộ luật Hồng Đức gồm sáu quyển với hơn bảy trăm điều luật quy chuẩn chi tiết mọi mặt đời sống xã hội. Bộ luật không chỉ kế thừa các giá trị pháp lý truyền thống mà còn chứa đựng nhiều tư tưởng tiến bộ vượt bậc như bảo vệ quyền lợi và tài sản của phụ nữ, trừng phạt nghiêm khắc quan lại tham nhũng nhũng nhiễu dân chúng, bảo vệ quyền sở hữu ruộng đất tư nhân và giữ gìn phong tục thuần lương. Vua Lê Thánh Tông kiên quyết chấn chỉnh kỷ cương phép nước, phân định rõ ràng quyền hạn của Lục Bộ và Lục Khoa để kiểm soát quyền lực chặt chẽ. Bộ luật Hồng Đức được đánh giá là một kiệt tác pháp lý phong kiến hoàn thiện nhất Đông Á bấy giờ, đặt nền tảng pháp trị vững chắc cho sự thịnh vượng kinh tế xã hội và ổn định lâu dài của quốc gia Đại Việt. Tinh thần thượng tôn pháp luật và tư tưởng nhân đạo tiến bộ của bộ luật này tiếp tục là tài sản văn hóa pháp lý vô giá trong kho tàng di sản lịch sử dân tộc. Bộ luật Hồng Đức thể hiện sự phát triển vượt bậc về kỹ thuật lập pháp của Đại Việt thời Lê Sơ với hệ thống thuật ngữ pháp lý chuẩn xác và cấu trúc logic chặt chẽ. Đáng chú ý, các điều luật về quyền thừa kế tài sản của con gái khi gia đình không có con trai, hay quy định bảo vệ người già, trẻ em mồ côi và người tàn tật đã phản ánh tính nhân bản sâu sắc và phong tục tốt đẹp của người Việt. Việc thực thi nghiêm minh pháp luật dưới thời vua Lê Thánh Tông đã góp phần xây dựng một xã hội kỷ cương, công bằng, hạn chế nạn lộng quyền của quan lại địa phương và củng cố vững chắc sự ổn định chính trị kinh tế của đất nước trong suốt gần ba thập kỷ trị vì.",
    "wordCount": 390,
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Tư Thành"
        ]
      },
      {
        "id": "doc_luat_hong_duc",
        "name": "Bộ luật Hồng Đức",
        "type": "DOCUMENT_CULTURE",
        "aliases": [
          "Quốc Triều Hình Luật"
        ]
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_le_thanh_tong",
        "subjectName": "Lê Thánh Tông",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      },
      {
        "subjectId": "doc_luat_hong_duc",
        "subjectName": "Bộ luật Hồng Đức",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      }
    ]
  },
  {
    "id": "CHUNK_EP08_002_HOI_TAO_DAN_NHI_THAP_BAT_TU",
    "epochId": "EPOCH_08",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí",
    "dynasty": "Nhà Lê Sơ",
    "sectionTitle": "Hội Tao Đàn Nhị thập bát tú - Đỉnh cao văn học thời Hồng Đức",
    "evaluationFocus": "LITERARY_GOLDEN_AGE",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Nhà Lê Sơ] [Mục: Hội Tao Đàn Hồng Đức] [Nhân Vật: Lê Thánh Tông, Thân Nhân Trung, Đỗ Nhuận] [Thời Gian: Năm 1495]",
    "rawText": "Năm Ất Mão (1495), vua Lê Thánh Tông sáng lập Hội Tao Đàn gồm chính nhà vua làm Tao Đàn đô nguyên súy cùng hai mươi tám vị đại danh nho tài ba được tôn vinh là Nhị thập bát tú như Thân Nhân Trung, Đỗ Nhuận, Lương Thế Vinh, Quách Đình Bảo. Hội Tao Đàn là một viện hàn lâm văn học cung đình đỉnh cao, chuyên sáng tác thi ca bằng chữ Hán và chữ Nôm ca ngợi cảnh đẹp đất nước thái bình, đạo đức lễ nghĩa và ca tụng khí phách hào hùng của dân tộc. Tác phẩm tiêu biểu Hồng Đức quốc âm thi tập là tập thơ Nôm đồ sộ khẳng định vị thế và vẻ đẹp phong phú của tiếng Việt trong sáng tác nghệ thuật bác học. Hoạt động sáng tạo văn chương sôi nổi của Hội Tao Đàn phản ánh niềm tự hào dân tộc sâu sắc và sự thăng hoa văn hóa rực rỡ của Đại Việt trong thế kỷ XV. Vua tôi cùng nhau xướng họa thi phú trong cung cấm không chỉ là thú vui tao nhã của bậc đế vương mà còn là phương tiện giáo hóa nhân tâm, bồi đắp lòng yêu nước và khẳng định khí phách văn hiến của quốc gia Đại Việt trước các nước lân bang. Tác phẩm Quỳnh uyển cửu ca gồm chín bài thơ ngự chế của vua Lê Thánh Tông cùng các bài họa của hai mươi tám vị danh nho đã thể hiện tài hoa thi phú trác tuyệt và tư tưởng triết lý chính trị sâu sắc của thời đại Hồng Đức thịnh trị. Hội Tao Đàn không chỉ quy tụ những tài năng văn chương lớn của đất nước mà còn là biểu tượng của tinh thần thượng võ kết hợp văn trị rực rỡ dưới thời Lê Sơ. Bằng cách khuyến khích sáng tác bằng cả chữ Hán bác học và chữ Nôm thuần thục, Hội Tao Đàn đã nâng cao vị thế của ngôn ngữ dân tộc, để lại cho hậu thế một gia tài văn chương quý báu phản ánh khí phách độc lập tự cường của Đại Việt thế kỷ XV.",
    "wordCount": 369,
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_than_nhan_trung",
        "name": "Thân Nhân Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_le_thanh_tong",
        "subjectName": "Lê Thánh Tông",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      },
      {
        "subjectId": "person_than_nhan_trung",
        "subjectName": "Thân Nhân Trung",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      }
    ]
  },
  {
    "id": "CHUNK_EP08_003_BIA_TIEN_SI_VAN_MIEU_1484",
    "epochId": "EPOCH_08",
    "sourceDocument": "Văn bia Quốc Tử Giám & Đại Việt Sử Ký Toàn Thư",
    "dynasty": "Nhà Lê Sơ",
    "sectionTitle": "Dựng bia tiến sĩ Văn Miếu Thăng Long tôn vinh hiền tài quốc gia năm 1484",
    "evaluationFocus": "SCHOLASTIC_HONOR_HERITAGE",
    "banner": "[Sử Liệu: Văn Bia Văn Miếu] [Kỷ/Triều Đại: Nhà Lê Sơ] [Mục: Dựng bia Tiến sĩ] [Nhân Vật: Lê Thánh Tông, Thân Nhân Trung] [Địa Danh: Văn Miếu Thăng Long] [Thời Gian: Năm 1484]",
    "rawText": "Năm Giáp Thìn (1484), vua Lê Thánh Tông ban sắc lệnh cho khởi dựng các tấm bia đá Tiến sĩ đặt trên lưng rùa đá tại Văn Miếu Thăng Long để khắc tên tuổi quê quán của những người đỗ đại khoa từ khoa thi năm 1442 trở đi. Nhà vua giao cho Đông các Đại học sĩ Thân Nhân Trung soạn bài ký văn bia nổi tiếng bất hủ khắc sâu chân lý: Hiền tài là nguyên khí của quốc gia, nguyên khí thịnh thì thế nước mạnh rồi ngày càng phát triển, nguyên khí suy thì thế nước yếu rồi ngày càng xuống dốc. Cho nên các đấng thánh đế minh vương chẳng ai không lấy việc bồi dưỡng nhân tài, kén chọn kẻ sĩ, vun trồng nguyên khí làm việc đầu tiên. Việc dựng bia Tiến sĩ không chỉ là sự tôn vinh cao quý dành cho học vấn và phẩm hạnh của các bậc danh nho, mà còn là lời nhắc nhở nghiêm khắc về trách nhiệm cống hiến hết mình cho dân tộc và giữ gìn thanh liêm của người trí thức. Tám mươi hai bia đá Tiến sĩ tại Văn Miếu đã được UNESCO công nhận là Di sản Tư liệu Thế giới, minh chứng cho truyền thống trọng dụng nhân tài vẻ vang của dân tộc ta suốt nhiều thế kỷ phong kiến vẻ vang. Mỗi tấm bia Tiến sĩ là một công trình nghệ thuật điêu khắc đá độc đáo thời Lê Sơ với các họa tiết hoa sen, mây nước và rồng chầu mặt nguyệt tinh xảo mang đậm bản sắc mỹ thuật dân tộc cổ truyền. Việc lưu danh bảng vàng nơi chốn tôn nghiêm bậc nhất của đạo học không chỉ là niềm tự hào vô bờ bến của cá nhân vị đỗ đạt và dòng họ làng quê, mà còn là lời nhắc nhở thiêng liêng về đạo làm tôi trung quân ái quốc, đem tài năng phụng sự nhân dân và không bao giờ được tha hóa phẩm chất đạo đức khi nắm giữ chức quyền triều đình.",
    "wordCount": 351,
    "entities": [
      {
        "id": "loc_van_mieu",
        "name": "Văn Miếu",
        "type": "LOCATION"
      },
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_than_nhan_trung",
        "name": "Thân Nhân Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "loc_van_mieu",
        "subjectName": "Văn Miếu",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      },
      {
        "subjectId": "person_le_thanh_tong",
        "subjectName": "Lê Thánh Tông",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_van_mieu",
        "objectName": "Văn Miếu"
      }
    ]
  },
  {
    "id": "CHUNK_EP08_004_BAN_DO_HONG_DUC_CUONG_VUC",
    "epochId": "EPOCH_08",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Hồng Đức Bản Đồ Địa Dư",
    "dynasty": "Nhà Lê Sơ",
    "sectionTitle": "Hoàn thành Bản đồ Hồng Đức khẳng định chủ quyền lãnh thổ năm 1490",
    "evaluationFocus": "TERRITORIAL_MAPPING_SOVEREIGNTY",
    "banner": "[Sử Liệu: Toàn Thư] [Kỷ/Triều Đại: Nhà Lê Sơ] [Mục: Địa đồ Hồng Đức] [Nhân Vật: Lê Thánh Tông] [Thời Gian: Năm 1490]",
    "rawText": "Năm Canh Tuất (1490), triều đình Lê Thánh Tông đã hoàn thành công trình đo đạc địa lý và vẽ tập bản đồ quốc gia đầu tiên mang tên Hồng Đức bản đồ. Tập bản đồ thể hiện chi tiết cương vực lãnh thổ mười ba xứ thừa tuyên của Đại Việt gồm cả vùng biên cương phía Bắc và bờ cõi biển đảo ngoài khơi. Vua Lê Thánh Tông từng căn dặn các quan trấn thủ biên giới lời dạy đanh thép: Một thước núi, một tấc sông của ta, lẽ nào lại nên đem vứt bỏ? Ngươi phải kiên quyết tranh biện, chớ cho họ lấn dần. Nếu họ không nghe, còn có thể sai sứ sang tận kinh đô của họ trình bày rõ điều ngay lẽ gian. Nếu ngươi dám đem một thước một tấc đất của Thái Tổ làm mồi cho giặc, thì tội phải tru di. Bản đồ Hồng Đức là tài liệu pháp lý và lịch sử vô giá khẳng định chủ quyền toàn vẹn lãnh thổ thiêng liêng của quốc gia Đại Việt trong thế kỷ XV. Sự hoàn thiện của công trình địa đồ này phản ánh trình độ đo đạc địa lý khoa học và ý thức chủ quyền quốc gia sâu sắc của triều đình Lê Sơ trong việc quản lý và bảo vệ biên cương bờ cõi của tổ quốc. Điểm đặc biệt của Bản đồ Hồng Đức là việc kết hợp nhuần nhuyễn giữa phương pháp khảo sát thực địa kỹ lưỡng với kiến thức thiên văn, thủy văn và phong thủy địa lý cổ truyền. Tài liệu thể hiện chi tiết mạng lưới sông ngòi, các đèo dốc hiểm yếu, vị trí các cửa biển tiền tiêu và hệ thống đường giao thông dịch trạm kết nối từ trung ương Thăng Long tới các vùng biên ải xa xôi như Tuyên Quang, Cao Bằng hay Thuận Hóa, Quảng Nam. Công trình bản đồ học đồ sộ này là minh chứng đanh thép cho chủ quyền lãnh thổ bất khả xâm phạm và tư duy quản lý quốc gia có tổ chức cao độ của tiền nhân thời Lê Sơ.",
    "wordCount": 363,
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_ban_do_hong_duc",
        "name": "Bản đồ Hồng Đức",
        "type": "DOCUMENT_CULTURE",
        "aliases": [
          "Hồng Đức bản đồ"
        ]
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "doc_ban_do_hong_duc",
        "subjectName": "Bản đồ Hồng Đức",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      },
      {
        "subjectId": "person_le_thanh_tong",
        "subjectName": "Lê Thánh Tông",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_le_so",
        "objectName": "Nhà Lê Sơ"
      }
    ]
  },
  {
    "id": "CHUNK_EP09_001_NGUYEN_BINH_KHIEM_SAM_TRUYEN",
    "epochId": "EPOCH_09",
    "sourceDocument": "Lịch Triều Hiến Chương Loại Chí & Bạch Vân Am Thi Tập",
    "dynasty": "Thời kỳ Lê - Mạc",
    "sectionTitle": "Trạng Trình Nguyễn Bỉnh Khiêm và lời sấm truyền định hướng thời cuộc",
    "evaluationFocus": "STRATEGIC_WISDOM_PROPHESY",
    "banner": "[Sử Liệu: Lịch Triều Hiến Chương] [Kỷ/Triều Đại: Nam Bắc Triều] [Mục: Trạng Trình Nguyễn Bỉnh Khiêm] [Nhân Vật: Nguyễn Bỉnh Khiêm, Nguyễn Hoàng, Mạc Đăng Dung] [Thời Gian: Thế kỷ XVI]",
    "rawText": "Trạng Trình Nguyễn Bỉnh Khiêm là bậc đại hiền triết, danh sĩ kiệt xuất và nhà tiên tri lỗi lạc bậc nhất thời kỳ Nam Bắc Triều và phân tranh Trịnh - Nguyễn. Sau khi đỗ Trạng nguyên triều Mạc và làm quan đến chức Tả Thị lang, thấy quyền thần lộng hành, ông dâng sớ xin trảm bảy tên nịnh thần không được bèn cáo quan về quê mở trường dạy học tại Am Bạch Vân bên bờ sông Tuyết Hải Phòng, lấy hiệu là Bạch Vân cư sĩ. Với trí tuệ uyên thâm thấu hiểu lẽ biến dịch của trời đất, Nguyễn Bỉnh Khiêm đã đưa ra những lời khuyên chiến lược mang tính định đoạt cho vận mệnh của cả ba tập đoàn phong kiến bấy giờ. Khi Nguyễn Hoàng lo sợ bị anh rể Trịnh Kiểm mưu hại sai người đến hỏi kế, Trạng Trình đã ngâm câu sấm truyền bất hủ: Hoành sơn nhất đái, vạn đại dung thân, mở đường cho họ Nguyễn tiến về phương Nam khai phá xứ Đàng Trong lập nên cơ nghiệp lẫy lừng. Với nhà Mạc khi thất thế, ông khuyên lui về giữ đất Cao Bằng: Cao Bằng tuy tiểu, khả diên sổ thế. Với chúa Trịnh, ông khuyên giữ danh nghĩa phò vua Lê: Giữ chùa thờ Phật thì ăn oản. Tầm nhìn chiến lược vượt thời đại của Nguyễn Bỉnh Khiêm đã góp phần định hình diện mạo lịch sử dân tộc trong suốt nhiều thế kỷ.",
    "wordCount": 251,
    "entities": [
      {
        "id": "person_nguyen_binh_khiem",
        "name": "Nguyễn Bỉnh Khiêm",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trạng Trình"
        ]
      },
      {
        "id": "person_nguyen_hoang",
        "name": "Nguyễn Hoàng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_hai_phong",
        "name": "Hải Phòng",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_mac",
        "name": "triều Mạc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_nguyen_binh_khiem",
        "subjectName": "Nguyễn Bỉnh Khiêm",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_hai_phong",
        "objectName": "Hải Phòng"
      }
    ]
  },
  {
    "id": "CHUNK_EP09_002_NGUYEN_HOANG_MO_COI_DANG_TRONG",
    "epochId": "EPOCH_09",
    "sourceDocument": "Đại Nam Thực Lục Tiền Biên & Phủ Biên Tạp Lục",
    "dynasty": "Thời kỳ Chúa Nguyễn",
    "sectionTitle": "Chúa Tiên Nguyễn Hoàng vượt Hoành Sơn mở mang bờ cõi Đàng Trong",
    "evaluationFocus": "SOUTHERN_EXPANSION_FOUNDING",
    "banner": "[Sử Liệu: Đại Nam Thực Lục] [Kỷ/Triều Đại: Thời kỳ Chúa Nguyễn] [Mục: Chúa Tiên vào xứ Thuận Hóa] [Nhân Vật: Nguyễn Hoàng, Trịnh Kiểm] [Thời Gian: Năm 1558]",
    "rawText": "Mùa đông năm Mậu Ngọ (1558), nghe theo lời chỉ dẫn chiến lược của Trạng Trình Nguyễn Bỉnh Khiêm, Đoan Quốc công Nguyễn Hoàng đã xin vua Lê và anh rể là Thái sư Trịnh Kiểm cho vào trấn thủ xứ Thuận Hóa - vùng đất xa xôi hiểm trở phía Nam đèo Ngang. Khi đặt chân đến đất Ái Tử Quảng Trị, Nguyễn Hoàng đã thực hiện chính sách cai trị nhân từ, thu phục lòng dân, giảm nhẹ sưu thuế và khuyến khích khai hoang lập ấp. Ông chiêu tập hào kiệt và lưu dân khắp các xứ phía Bắc cùng vào chung sức khẩn hoang, biến vùng đất hoang vu thành đồng ruộng trù phú và thương cảng buôn bán quốc tế sầm uất tại Hội An. Với phong thái độ lượng và chính sách khoan hòa vỗ về dân chúng, dân Đàng Trong kính cẩn tôn xưng ông là Chúa Tiên. Sự nghiệp khai hoang mở cõi kiên cường của Nguyễn Hoàng đã mở rộng không gian sinh tồn của dân tộc về phương Nam và đặt nền móng vững chắc cho sự hình thành lãnh thổ thống nhất của nước Việt Nam hiện đại. Hơn nửa thế kỷ trị vì ở phương Nam, Chúa Tiên đã gây dựng một nền tảng kinh tế quân sự vững mạnh, thu phục lòng người lương thiện và tạo lập tiền đề để các thế hệ chúa Nguyễn tiếp tục mở mang cương vực về tận dải đất Nam Bộ trù phú.",
    "wordCount": 253,
    "entities": [
      {
        "id": "person_nguyen_hoang",
        "name": "Nguyễn Hoàng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Chúa Tiên"
        ]
      },
      {
        "id": "loc_quang_tri",
        "name": "Quảng Trị",
        "type": "LOCATION"
      },
      {
        "id": "person_trinh_kiem",
        "name": "Trịnh Kiểm",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_chua_nguyen",
        "name": "Chúa Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_nguyen_hoang",
        "subjectName": "Nguyễn Hoàng",
        "relationType": "PART_OF",
        "objectId": "dynasty_chua_nguyen",
        "objectName": "Chúa Nguyễn"
      },
      {
        "subjectId": "person_nguyen_hoang",
        "subjectName": "Nguyễn Hoàng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_quang_tri",
        "objectName": "Quảng Trị"
      }
    ]
  },
  {
    "id": "CHUNK_EP09_003_MAC_DANG_DUNG_LAP_TRIEU_MAC",
    "epochId": "EPOCH_09",
    "sourceDocument": "Đại Việt Sử Ký Toàn Thư & Đại Việt Thông Sử",
    "dynasty": "Nhà Mạc",
    "sectionTitle": "Mạc Đăng Dung lập triều Mạc và chuyển giao quyền lực Thăng Long năm 1527",
    "evaluationFocus": "DYNASTIC_TRANSITION_REFORM",
    "banner": "[Sử Liệu: Toàn Thư & Thông Sử] [Kỷ/Triều Đại: Nhà Mạc] [Mục: Mạc Đăng Dung lên ngôi tại Thăng Long] [Nhân Vật: Mạc Đăng Dung, Lê Cung Hoàng] [Thời Gian: Năm 1527]",
    "rawText": "Đầu thế kỷ XVI, vương triều Lê Sơ rơi vào khủng hoảng suy thoái trầm trọng sau những biến loạn cung đình dưới thời các vua Uy Mục, Tương Dực. Thái sư Nhân Quốc công Mạc Đăng Dung vốn là đô lực sĩ xuất thân bình dân tại Nghi Dương Hải Phòng, nhờ tài võ nghệ phi thường và mưu lược chính trị đã dẹp yên các cuộc bạo loạn tranh giành quyền lực. Tháng 6 năm Đinh Hợi (1527), trước sự suy tàn không thể đảo ngược của triều Lê, Mạc Đăng Dung phế truất Lê Cung Hoàng lên ngôi hoàng đế tại Thăng Long, lập ra triều đại nhà Mạc lấy niên hiệu là Minh Đức. Nhà Mạc thi hành nhiều chính sách cởi mở về kinh tế, khuyến khích phát triển thủ công nghiệp làng nghề đúc đồng gốm sứ và thương mại tự do, đồng thời duy trì nền khoa cử Nho học quy củ để tuyển chọn hiền tài như Trạng Trình Nguyễn Bỉnh Khiêm, Giáp Hải. Việc thay thế triều Lê Sơ của nhà Mạc diễn ra trong hòa bình, chấm dứt thời kỳ loạn lạc cung đình và mở ra giai đoạn phát triển nghệ thuật điêu khắc và tư tưởng cởi mở trong văn hóa Đại Việt. Triều đại nhà Mạc đã để lại nhiều dấu ấn sâu đậm trong lịch sử với phong cách nghệ thuật kiến trúc đình làng phóng khoáng và kỹ thuật chế tác đồ gốm hoa lam tinh xảo lưu truyền hậu thế.",
    "wordCount": 256,
    "entities": [
      {
        "id": "person_mac_dang_dung",
        "name": "Mạc Đăng Dung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_mac",
        "name": "nhà Mạc",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_hai_phong",
        "name": "Hải Phòng",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_mac_dang_dung",
        "subjectName": "Mạc Đăng Dung",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_mac",
        "objectName": "nhà Mạc"
      },
      {
        "subjectId": "person_mac_dang_dung",
        "subjectName": "Mạc Đăng Dung",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_hai_phong",
        "objectName": "Hải Phòng"
      }
    ]
  },
  {
    "id": "CHUNK_EP09_004_PHONG_TUYEN_LUY_THAY",
    "epochId": "EPOCH_09",
    "sourceDocument": "Phủ Biên Tạp Lục - Lê Quý Đôn & Đại Nam Thực Lục",
    "dynasty": "Thời kỳ Chúa Nguyễn",
    "sectionTitle": "Đào Duy Từ xây dựng hệ thống phòng tuyến Lũy Thầy kiên cố tại Quảng Bình",
    "evaluationFocus": "FORTIFICATION_TACTICAL_DEFENSE",
    "banner": "[Sử Liệu: Phủ Biên Tạp Lục] [Kỷ/Triều Đại: Trịnh - Nguyễn Phân Tranh] [Mục: Công trình Lũy Thầy] [Nhân Vật: Đào Duy Từ, Chúa Sãi Nguyễn Phúc Nguyên] [Thời Gian: Năm 1630 - 1631]",
    "rawText": "Trong cuộc chiến tranh phân tranh Trịnh - Nguyễn kéo dài gần nửa thế kỷ (1627 - 1672), danh tướng Đào Duy Từ giữ chức Lộc Khê hầu đã dốc hết tài năng quân sự và phong thủy địa lý để thiết kế và chỉ huy xây dựng hệ thống chiến lũy phòng ngự Lũy Thầy đồ sộ tại đất Quảng Bình. Hệ thống gồm Lũy Trường Dục và Lũy Đầu Mâu dài hàng chục dặm, đắp bằng đất đá kết hợp hào sâu cọc tre kiên cố kiểm soát toàn bộ tuyến đường độc đạo từ Đàng Ngoài tiến vào Đàng Trong. Dưới sự lãnh đạo của Chúa Sãi Nguyễn Phúc Nguyên và tài phòng ngự siêu việt của Đào Duy Từ, quân đội Đàng Trong đã bảy lần bẻ gãy hoàn toàn các đợt tiến công quy mô lớn của hàng chục vạn đại quân chúa Trịnh với vũ khí phương Tây vượt trội. Dân gian truyền tụng câu ca dao: Khôn ngoan qua được Thanh Hà, Dẫu rằng có cánh khó qua Lũy Thầy. Lũy Thầy trở thành bức tường thành quân sự bất khả xâm phạm bảo vệ an nguy tuyệt đối cho bờ cõi Đàng Trong, giúp Chúa Nguyễn rảnh tay mở mang lãnh thổ trù phú về phương Nam. Công trình phòng ngự thiên tài này không chỉ thể hiện đỉnh cao của nghệ thuật công sự đất đá thời trung đại mà còn khẳng định tầm nhìn chiến lược kiệt xuất của Đào Duy Từ đối với sự nghiệp xây dựng bờ cõi của họ Nguyễn.",
    "wordCount": 263,
    "entities": [
      {
        "id": "person_dao_duy_tu",
        "name": "Đào Duy Từ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_quang_binh",
        "name": "Quảng Bình",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_chua_nguyen",
        "name": "Chúa Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_dao_duy_tu",
        "subjectName": "Đào Duy Từ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_quang_binh",
        "objectName": "Quảng Bình"
      },
      {
        "subjectId": "person_dao_duy_tu",
        "subjectName": "Đào Duy Từ",
        "relationType": "PART_OF",
        "objectId": "dynasty_chua_nguyen",
        "objectName": "Chúa Nguyễn"
      }
    ]
  },
  {
    "id": "CHUNK_EP10_001_QUANG_TRUNG_DAI_PHA_QUAN_THANH_1789",
    "epochId": "EPOCH_10",
    "sourceDocument": "Hoàng Lê Nhất Thống Chí - Ngô Gia Văn Phái",
    "dynasty": "Nhà Tây Sơn",
    "sectionTitle": "Hoàng đế Quang Trung hành quân thần tốc đại phá hai mươi chín vạn quân Thanh",
    "evaluationFocus": "BLITZKRIEG_STRATEGY_TACTICS",
    "banner": "[Sử Liệu: Hoàng Lê Nhất Thống Chí] [Kỷ/Triều Đại: Nhà Tây Sơn] [Mục: Đại thắng Ngọc Hồi Đống Đa] [Nhân Vật: Quang Trung, Tôn Sĩ Nghị, Sầm Nghi Đống] [Thời Gian: Mùa xuân Kỷ Dậu 1789]",
    "rawText": "Mùa đông năm Mậu Thân (1788), trước họa hai mươi chín vạn quân Thanh do Tổng đốc Lưỡng Quảng Tôn Sĩ Nghị chỉ huy tràn sang xâm chiếm kinh thành Thăng Long, Bắc Bình Vương Nguyễn Huệ đã làm lễ đăng cơ lên ngôi hoàng đế tại núi Bân Phú Xuân Huế, lấy niên hiệu là Quang Trung rồi lập tức hạ lệnh tiến quân ra Bắc. Tại lễ duyệt binh ở Nghệ An, vua Quang Trung dõng dạc đọc lời tuyên thệ đanh thép truyền lửa cho ba quân: Đánh cho để dài tóc, Đánh cho để đen răng, Đánh cho nó chích luân bất phản, Đánh cho nó phiến giáp bất hoàn, Đánh cho sử tri Nam quốc anh hùng chi hữu chủ. Với chiến thuật hành quân thần tốc kết hợp vừa đi vừa tuyển quân và ghép đôi cáng võng nghỉ ngơi trên đường, đội quân Tây Sơn đã vượt hàng nghìn dặm ra đến phòng tuyến Tam Điệp Ninh Bình đúng dịp Tết Nguyên Đán. Trong đêm mùng 4 rạng sáng mùng 5 Tết Kỷ Dậu (1789), vua Quang Trung cưỡi voi chiến trực tiếp đốc thúc quân sĩ dùng rơm ướt bện ván lá chắn chống đạn hỏa mai công phá dữ dội đồn Ngọc Hồi, đồng thời đạo quân của Đô đốc Đặng Tiến Đông bất ngờ tập kích đồn Khương Thượng Đống Đa khiến tướng giặc Sầm Nghi Đống phải thắt cổ tự vẫn. Tôn Sĩ Nghị hoảng loạn không kịp mặc giáp cỡi ngựa qua cầu phao sông Hồng chạy trốn, quân Thanh chen lấn giẫm đạp đứt cầu phao chết chìm vô số làm nghẽn cả dòng sông. Chiều mùng 5 Tết, Hoàng đế Quang Trung với chiếc áo hoàng bào sém đen khói súng oai phong dẫn đầu đại quân tiến vào Thăng Long trong sự reo hò mừng rỡ khôn xiết của nhân dân.",
    "wordCount": 316,
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nguyễn Huệ",
          "Bắc Bình Vương"
        ]
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      },
      {
        "id": "loc_phu_xuan",
        "name": "Phú Xuân",
        "type": "LOCATION",
        "aliases": [
          "Huế"
        ]
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Nhà Tây Sơn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_nghe_an",
        "name": "Nghệ An",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Quang Trung",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tay_son",
        "objectName": "Nhà Tây Sơn"
      },
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Quang Trung",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Thăng Long"
      },
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Quang Trung",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_phu_xuan",
        "objectName": "Phú Xuân"
      }
    ]
  },
  {
    "id": "CHUNK_EP10_002_RACH_GAM_XOAI_MUT_1785",
    "epochId": "EPOCH_10",
    "sourceDocument": "Đại Nam Thực Lục & Việt Nam Sử Lược",
    "dynasty": "Nhà Tây Sơn",
    "sectionTitle": "Nguyễn Huệ chỉ huy trận thủy chiến Rạch Gầm Xoài Mút chôn vùi năm vạn quân Xiêm",
    "evaluationFocus": "RIVER_AMBUSH_ANNIHILATION",
    "banner": "[Sử Liệu: Việt Nam Sử Lược] [Kỷ/Triều Đại: Nhà Tây Sơn] [Mục: Trận Rạch Gầm Xoài Mút] [Nhân Vật: Nguyễn Huệ, Chiêu Tăng, Chiêu Sương] [Thời Gian: Đầu năm 1785]",
    "rawText": "Đầu năm Ất Tỵ (1785), năm vạn thủy bộ quân Xiêm do hai danh tướng Chiêu Tăng và Chiêu Sương chỉ huy theo lời cầu viện của Nguyễn Ánh ồ ạt tiến sang xâm chiếm vùng đất Gia Định Nam Bộ, cướp bóc của cải và tàn sát dân lành hết sức man rợ. Nhận được tin cấp báo, Long Nhương tướng quân Nguyễn Huệ trực tiếp chỉ huy đại quân Tây Sơn từ Quy Nhơn tiến thẳng vào miền Nam đánh giặc. Sau khi khảo sát kỹ lưỡng địa hình sông Tiền, Nguyễn Huệ quyết định chọn đoạn sông dài sáu cây số từ Rạch Gầm đến Xoài Mút nay thuộc tỉnh Tiền Giang làm trận địa quyết chiến mai phục giặc. Ngày 19 và 20 tháng 1 năm 1785, quân Tây Sơn cho thuyền nhẹ ra khiêu chiến rồi rút lui nhử toàn bộ đoàn thuyền chiến quân Xiêm lọt sâu vào khúc sông mai phục lúc triều dâng. Khi địch đã lọt vào ổ phục kích, pháo hỏa hổ từ hai bờ sông và các cồn bãi cù lao Thới Sơn đồng loạt khai hỏa dữ dội, đại đội thuyền chiến Tây Sơn từ các nhánh sông bất ngờ lao ra chia cắt đội hình địch thành từng đoạn để tiêu diệt. Hầu như toàn bộ ba trăm chiến thuyền và hơn bốn vạn quân Xiêm bị chôn vùi dưới đáy sông Tiền, các tướng giặc khiếp sợ mở đường máu tháo chạy về nước. Chiến thắng Rạch Gầm Xoài Mút là một trong những trận thủy chiến tiêu diệt vĩ đại nhất trong lịch sử chống giặc ngoại xâm của dân tộc ta, đập tan hoàn toàn dã tâm xâm lược của phong kiến Xiêm La.",
    "wordCount": 290,
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Nguyễn Huệ",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Quang Trung"
        ]
      },
      {
        "id": "loc_tien_giang",
        "name": "Tiền Giang",
        "type": "LOCATION",
        "aliases": [
          "Rạch Gầm",
          "Xoài Mút"
        ]
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Nhà Tây Sơn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Nguyễn Huệ",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tay_son",
        "objectName": "Nhà Tây Sơn"
      },
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Nguyễn Huệ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_tien_giang",
        "objectName": "Tiền Giang"
      }
    ]
  },
  {
    "id": "CHUNK_EP10_003_NGO_THI_NHAM_DONG_BIEN_NGOAI_GIAO",
    "epochId": "EPOCH_10",
    "sourceDocument": "Hoàng Lê Nhất Thống Chí & Bang Giao Hảo Thoại",
    "dynasty": "Nhà Tây Sơn",
    "sectionTitle": "Ngô Thì Nhậm thực hiện chiến lược ngoại giao đỉnh cao bảo vệ nền độc lập",
    "evaluationFocus": "DIPLOMATIC_TACT_STRATEGY",
    "banner": "[Sử Liệu: Bang Giao Hảo Thoại] [Kỷ/Triều Đại: Nhà Tây Sơn] [Mục: Ngoại giao thời Quang Trung] [Nhân Vật: Ngô Thì Nhậm, Quang Trung, Càn Long] [Thời Gian: Năm 1789 - 1792]",
    "rawText": "Sau đại thắng Kỷ Dậu 1789, hiểu rõ vị thế của đất nước và tính hiếu danh của vua tôi nhà Thanh, Hoàng đế Quang Trung đã giao toàn quyền phụ trách công tác bang giao đối ngoại cho Thượng thư bộ Binh Ngô Thì Nhậm - bậc danh sĩ Nho gia kiệt xuất của Bắc Hà. Với mưu lược sâu sắc và ngòi bút ngoại giao sắc sảo, Ngô Thì Nhậm đã thực hiện đường lối ngoại giao kiên định về nguyên tắc chủ quyền nhưng linh hoạt mềm dẻo về sách lược nghi lễ. Ông đã khéo léo soạn thảo các biểu tấu biện giải sự biến chiến tranh, vừa giữ vững thể diện tôn nghiêm của Đại Việt vừa xoa dịu nỗi nhục thất trận của hoàng đế Càn Long. Kết quả là nhà Thanh buộc phải công nhận Quang Trung là vị hoàng đế chính thống duy nhất của An Nam quốc và bãi bỏ hoàn toàn ý đồ xâm lược trả thù. Vua Càn Long thậm chí còn phong vương, ban tặng áo cẩm bào và mời vua Quang Trung sang Yên Kinh dự lễ bát tuần đại thọ. Nghệ thuật ngoại giao của Ngô Thì Nhậm thời Tây Sơn là bài học mẫu mực về việc dùng trí tuệ văn hóa và lý lẽ chính nghĩa để củng cố vững chắc nền hòa bình dân tộc sau chiến tranh. Chiến lược khôn khéo này đã giữ cho biên cương phía Bắc hoàn toàn yên tĩnh, tạo điều kiện thuận lợi để triều đình Tây Sơn dồn sức phục hồi kinh tế và chấn hưng văn hóa nước nhà.",
    "wordCount": 274,
    "entities": [
      {
        "id": "person_ngo_thi_nham",
        "name": "Ngô Thì Nhậm",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Nhà Tây Sơn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ngo_thi_nham",
        "subjectName": "Ngô Thì Nhậm",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tay_son",
        "objectName": "Nhà Tây Sơn"
      }
    ]
  },
  {
    "id": "CHUNK_EP10_004_CHIEU_CAU_HIEN_VAN_HOA_CHU_NOM",
    "epochId": "EPOCH_10",
    "sourceDocument": "Chiếu Cầu Hiền & Lịch Sử Văn Hóa Việt Nam",
    "dynasty": "Nhà Tây Sơn",
    "sectionTitle": "Vua Quang Trung ban Chiếu cầu hiền và đề cao chữ Nôm thành quốc tự",
    "evaluationFocus": "CULTURAL_REFORM_VERNACULAR",
    "banner": "[Sử Liệu: Chiếu Cầu Hiền] [Kỷ/Triều Đại: Nhà Tây Sơn] [Mục: Cải cách văn hóa giáo dục] [Nhân Vật: Quang Trung, Nguyễn Thiếp] [Thời Gian: Năm 1789 - 1791]",
    "rawText": "Nhận thức sâu sắc rằng xây dựng đất nước sau chiến tranh đòi hỏi phải có đội ngũ trí thức tài đức phò tá, vua Quang Trung đã ban bố bản Chiếu cầu hiền bất hủ do Ngô Thì Nhậm chấp bút nhằm mời gọi các bậc danh sĩ Bắc Hà ra gánh vác việc nước: Dựng nước lấy việc học làm đầu, cầu trị lấy nhân tài làm gốc. Nhà vua đã kiên trì ba lần cử sứ giả đến tận nơi mời La Sơn Phu Tử Nguyễn Thiếp ra giúp triều đình lập Viện Sùng Chính tại Nghệ An để dịch toàn bộ kinh sách Nho gia từ chữ Hán sang chữ Nôm. Lần đầu tiên trong lịch sử phong kiến Việt Nam, chữ Nôm được nâng lên vị trí Quốc tự chính thức được sử dụng trong các chiếu chỉ của nhà vua và các khoa thi cử tuyển chọn quan lại. Đồng thời, triều đình Tây Sơn ban hành chính sách Chiếu khuyến nông, phát thẻ bài tín dụng quản lý dân cư và ổn định tiền tệ giúp nền kinh tế nhanh chóng hồi sinh sau nhiều năm nội chiến. Cuộc cải cách văn hóa giáo dục táo bạo của vua Quang Trung thể hiện tinh thần tự tôn dân tộc sâu sắc và khát vọng xây dựng một quốc gia hùng cường, độc lập tự chủ toàn diện. Việc tôn vinh chữ Nôm và trọng dụng kẻ sĩ không phân biệt nguồn gốc đã mở ra một luồng sinh khí mới cho nền học thuật và văn hóa dân tộc cuối thế kỷ XVIII.",
    "wordCount": 270,
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_thiep",
        "name": "Nguyễn Thiếp",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "La Sơn Phu Tử"
        ]
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Nhà Tây Sơn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_nghe_an",
        "name": "Nghệ An",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_quang_trung",
        "subjectName": "Quang Trung",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_tay_son",
        "objectName": "Nhà Tây Sơn"
      },
      {
        "subjectId": "person_nguyen_thiep",
        "subjectName": "Nguyễn Thiếp",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_nghe_an",
        "objectName": "Nghệ An"
      }
    ]
  },
  {
    "id": "CHUNK_EP11_001_GIA_LONG_DINH_DO_PHU_XUAN",
    "epochId": "EPOCH_11",
    "sourceDocument": "Đại Nam Thực Lục Chính Biên & Khâm Định Đại Nam Hội Điển Sự Lệ",
    "dynasty": "Nhà Nguyễn",
    "sectionTitle": "Vua Gia Long thống nhất giang sơn và định đô tại Phú Xuân Huế năm 1802",
    "evaluationFocus": "NATIONAL_CONSOLIDATION_EMPIRE",
    "banner": "[Sử Liệu: Đại Nam Thực Lục] [Kỷ/Triều Đại: Nhà Nguyễn] [Mục: Gia Long lập quốc xưng đế] [Nhân Vật: Gia Long, Lê Văn Duyệt, Nguyễn Văn Thành] [Thời Gian: Năm 1802 - 1804]",
    "rawText": "Mùa hè năm Nhâm Tuất (1802), sau khi đánh bại hoàn toàn vương triều Tây Sơn, Nguyễn Ánh chính thức lên ngôi hoàng đế tại Phú Xuân lấy niên hiệu là Gia Long, sáng lập triều đại nhà Nguyễn. Năm Giáp Tý (1804), nhà vua ban bố quốc hiệu mới của đất nước là Việt Nam, khẳng định một dải non sông liền một dải trải dài thống nhất từ ải Nam Quan đến mũi Cà Mau. Vua Gia Long đã quyết định chọn Phú Xuân Huế làm kinh đô của toàn đế chế, cho khởi công xây dựng Kinh thành Huế đồ sộ kết hợp hài hòa giữa kiến trúc thành lũy quân sự kiểu Vauban của phương Tây và quy hoạch cung đình phong thủy phương Đông cổ truyền. Nhà vua thiết lập hệ thống hành chính chia đất nước làm Bắc Thành, Trực Doanh và Gia Định Thành, đồng thời cho biên soạn bộ Hoàng Triều Luật Lệ gồm gần bốn trăm điều để quản lý đất nước thống nhất. Việc thống nhất toàn vẹn lãnh thổ sau hàng thế kỷ phân tranh chia cắt là một dấu mốc lịch sử trọng đại định hình cương vực biên giới hoàn chỉnh của dân tộc Việt Nam. Dưới sự phò tá của các đại thần như Lê Văn Duyệt, Nguyễn Văn Thành, vương triều Nguyễn đã củng cố nền trật tự xã hội, mở mang giao thông đường thiên lý Bắc Nam và đẩy mạnh công cuộc khai hoang lập ấp ven biển.",
    "wordCount": 255,
    "entities": [
      {
        "id": "person_gia_long",
        "name": "Gia Long",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nguyễn Ánh",
          "Nguyễn Phúc Ánh"
        ]
      },
      {
        "id": "loc_phu_xuan",
        "name": "Phú Xuân",
        "type": "LOCATION",
        "aliases": [
          "Kinh thành Huế",
          "Huế"
        ]
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "Nhà Nguyễn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_le_van_duyet",
        "name": "Lê Văn Duyệt",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "person_gia_long",
        "subjectName": "Gia Long",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_nguyen",
        "objectName": "Nhà Nguyễn"
      },
      {
        "subjectId": "person_gia_long",
        "subjectName": "Gia Long",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_phu_xuan",
        "objectName": "Phú Xuân"
      }
    ]
  },
  {
    "id": "CHUNK_EP11_002_MINH_MANG_CAI_CACH_HANH_CHINH",
    "epochId": "EPOCH_11",
    "sourceDocument": "Đại Nam Thực Lục Chính Biên Quyển Đệ Nhị",
    "dynasty": "Nhà Nguyễn",
    "sectionTitle": "Hoàng đế Minh Mạng thực hiện cải cách hành chính chia ba mươi tỉnh thành",
    "evaluationFocus": "ADMINISTRATIVE_STANDARDIZATION",
    "banner": "[Sử Liệu: Đại Nam Thực Lục] [Kỷ/Triều Đại: Nhà Nguyễn] [Mục: Cải cách Minh Mạng] [Nhân Vật: Minh Mạng] [Thời Gian: Năm 1831 - 1832]",
    "rawText": "Hoàng đế Minh Mạng là vị vua có tư duy quản trị hành chính quy củ và quyết đoán hàng đầu trong lịch sử phong kiến Việt Nam. Nhận thấy mô hình phân quyền Bắc Thành và Gia Định Thành tiềm ẩn nguy cơ cát cứ phân rã quyền lực trung ương, trong hai năm 1831 và 1832, vua Minh Mạng đã tiến hành một cuộc đại cải cách hành chính sâu rộng trên quy mô cả nước. Nhà vua bãi bỏ hoàn toàn các chức Tổng trấn, chia đất nước thành ba mươi tỉnh và một phủ Thừa Thiên kinh đô. Mỗi tỉnh đều được cơ cấu đồng bộ dưới sự quản lý của quan Tổng đốc hoặc Tuần phủ, cùng các quan Bố chính sứ phụ trách tài chính thuế khóa và Án sát sứ phụ trách tư pháp hình luật. Đồng thời, vua Minh Mạng thành lập Nội các và Cơ Mật Viện làm cơ quan tham mưu tối cao, hoàn thiện chế độ thi cử khoa cử tuyển chọn nhân tài và thiết lập hệ thống kiểm tra giám sát quan lại nghiêm ngặt. Cuộc cải cách hành chính của Minh Mạng đã tập trung tuyệt đối quyền lực về tay triều đình trung ương, tạo nên một hệ thống hành chính thống nhất, chặt chẽ và chuyên nghiệp đặt nền tảng cho sự phân chia địa giới hành chính các tỉnh thành Việt Nam cho đến tận ngày nay. Mô hình quản trị công khai, minh bạch với hệ thống sổ sách lưu trữ Châu bản chuẩn mực phản ánh năng lực tổ chức nhà nước đỉnh cao của vương triều Nguyễn trong thế kỷ XIX.",
    "wordCount": 281,
    "entities": [
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nguyễn Phúc Đảm"
        ]
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "Nhà Nguyễn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_phu_xuan",
        "name": "Thừa Thiên",
        "type": "LOCATION",
        "aliases": [
          "Huế"
        ]
      }
    ],
    "triples": [
      {
        "subjectId": "person_minh_mang",
        "subjectName": "Minh Mạng",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_nguyen",
        "objectName": "Nhà Nguyễn"
      },
      {
        "subjectId": "person_minh_mang",
        "subjectName": "Minh Mạng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_phu_xuan",
        "objectName": "Thừa Thiên"
      }
    ]
  },
  {
    "id": "CHUNK_EP11_003_HOANG_SA_TRUONG_SA_CHAU_BAN",
    "epochId": "EPOCH_11",
    "sourceDocument": "Châu Bản Triều Nguyễn & Đại Nam Nhất Thống Chí",
    "dynasty": "Nhà Nguyễn",
    "sectionTitle": "Triều đình nhà Nguyễn xác lập và thực thi chủ quyền Hoàng Sa Trường Sa",
    "evaluationFocus": "MARITIME_SOVEREIGNTY_ARCHIVES",
    "banner": "[Sử Liệu: Châu Bản Triều Nguyễn] [Kỷ/Triều Đại: Nhà Nguyễn] [Mục: Thủy quân khảo sát Hoàng Sa] [Nhân Vật: Minh Mạng, Phạm Hữu Nhật] [Thời Gian: Năm 1816 - 1836]",
    "rawText": "Chủ quyền thiêng liêng của Việt Nam đối với hai quần đảo Hoàng Sa và Trường Sa được các vua triều Nhà Nguyễn xác lập và thực thi liên tục bằng các biện pháp nhà nước chính thức có giá trị pháp lý quốc tế vững chắc. Năm 1816, vua Gia Long đích thân sai thủy quân ra Hoàng Sa cắm cờ và đo đạc thủy trình. Đến thời vua Minh Mạng, triều đình hàng năm đều cử đội Hoàng Sa và thủy quân do các suất đội tài ba như Phạm Hữu Nhật chỉ huy đi thuyền ra hai quần đảo để đo đạc hải đồ, dựng bia chủ quyền, trồng cây và xây dựng miếu thờ bảo vệ ngư dân. Châu bản triều Nhà Nguyễn ghi chép chi tiết các bản tấu trình của bộ Công và lời phê bằng mực son của nhà vua khen thưởng các binh lính có công lao đi khảo sát biển đảo gian khổ. Đại Nam Nhất Thống Chí khẳng định Hoàng Sa và Vạn Lý Trường Sa là một phần lãnh thổ không thể tách rời của Đại Nam. Hệ thống Châu bản và tư liệu Hán Nôm quý giá này đã được UNESCO công nhận là Di sản Tư liệu Thế giới, là bằng chứng lịch sử và pháp lý đanh thép chứng minh chủ quyền bất khả xâm phạm của Việt Nam trên Biển Đông suốt hàng trăm năm lịch sử không hề gián đoạn. Việc xác lập chủ quyền liên tục và hòa bình đối với hai quần đảo Hoàng Sa và Trường Sa dưới triều Nguyễn hoàn toàn phù hợp với các nguyên tắc thụ đắc lãnh thổ của luật pháp quốc tế thời bấy giờ. Các đội dân binh Hoàng Sa kiêm quản Trường Sa được tổ chức quy củ từ thời chúa Nguyễn tiếp tục được vua Gia Long và Minh Mạng nâng cấp thành nhiệm vụ chiến lược thường niên của hải quân triều đình. Những tài liệu hành chính Châu bản có chữ ký phê duyệt của nhà vua cùng các tư liệu bản đồ phương Tây cổ vẽ thời kỳ này đều ghi nhận rõ ràng Paracel và Spratly thuộc chủ quyền không thể tranh cãi của đế chế An Nam.",
    "wordCount": 379,
    "entities": [
      {
        "id": "loc_hoang_sa",
        "name": "Hoàng Sa",
        "type": "LOCATION"
      },
      {
        "id": "loc_truong_sa",
        "name": "Trường Sa",
        "type": "LOCATION"
      },
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "Nhà Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "loc_hoang_sa",
        "subjectName": "Hoàng Sa",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_nguyen",
        "objectName": "Nhà Nguyễn"
      },
      {
        "subjectId": "loc_truong_sa",
        "subjectName": "Trường Sa",
        "relationType": "HAPPENED_IN",
        "objectId": "dynasty_nha_nguyen",
        "objectName": "Nhà Nguyễn"
      }
    ]
  },
  {
    "id": "CHUNK_EP11_004_NGUYEN_TRI_PHUONG_GIU_THANH",
    "epochId": "EPOCH_11",
    "sourceDocument": "Đại Nam Thực Lục Chính Biên & Việt Nam Sử Lược",
    "dynasty": "Nhà Nguyễn",
    "sectionTitle": "Danh tướng Nguyễn Tri Phương kiên cường bảo vệ thành Hà Nội năm 1873",
    "evaluationFocus": "MARTYRED_DEFENDER_HONOR",
    "banner": "[Sử Liệu: Đại Nam Thực Lục] [Kỷ/Triều Đại: Nhà Nguyễn] [Mục: Trận thành Hà Nội 1873] [Nhân Vật: Nguyễn Tri Phương, Francis Garnier] [Thời Gian: Năm 1873]",
    "rawText": "Năm Quý Dậu (1873), thực dân Pháp phái đại úy Francis Garnier đem quân tàu chiến tiến ra Bắc Kỳ gây hấn và đánh chiếm thành Hà Nội. Khâm sai đại thần Nguyễn Tri Phương bấy giờ đã ngoài bảy mươi tuổi cùng con trai là Phò mã Nguyễn Lâm đã trực tiếp chỉ huy quân dân kiên cường tử chiến trên mặt thành cửa ngõ phía Nam. Khi quân Pháp nổ đại bác công phá dữ dội khiến thành bị vỡ và Nguyễn Lâm trúng đạn hy sinh tại chỗ, Nguyễn Tri Phương dù bị thương nặng vẫn không chịu rời vị trí chỉ huy. Bị giặc Pháp bắt giữ, ông khẳng khái cự tuyệt mọi lời dụ dỗ chữa trị và đồ ăn thức uống của kẻ thù, dõng dạc tuyên bố: Bây giờ nếu ta chỉ gắng gượng sống thừa, sao bằng ung dung chết vì đại nghĩa! Ông tuyệt thực suốt một tháng rồi thanh thản tuẫn tiết vì non sông. Khí phách kiên trung bất khuất của danh tướng Nguyễn Tri Phương và các nghĩa sĩ giữ thành Hà Nội đã thắp sáng ngọn lửa yêu nước chống xâm lược cận đại của dân tộc. Tấm gương tuẫn tiết vì nghĩa lớn của ông được nhân dân cả nước đời đời kính cẩn phụng thờ, trở thành biểu tượng ngời sáng của lòng trung nghĩa son sắt và tinh thần bất khuất của quan lại yêu nước triều Nguyễn. Sự hy sinh lẫy lừng của Nguyễn Tri Phương và Phò mã Nguyễn Lâm đã trở thành nguồn cảm hứng thôi thúc các phong trào kháng chiến chống Pháp tiếp tục bùng nổ mạnh mẽ khắp đồng bằng Bắc Bộ. Tinh thần thà chết vinh còn hơn sống nhục của vị Tổng đốc già đã thổi bùng ngọn lửa yêu nước trong lòng các tầng lớp nhân dân, chuẩn bị cho những cuộc đụng độ quyết liệt bảo vệ thủ đô Hà Nội trong những năm sau đó. Tên tuổi của danh tướng Nguyễn Tri Phương mãi mãi được khắc ghi trong tâm khảm của người dân Hà Nội và toàn thể đồng bào yêu chuộng tự do trên khắp mọi miền đất nước.",
    "wordCount": 368,
    "entities": [
      {
        "id": "person_nguyen_tri_phuong",
        "name": "Nguyễn Tri Phương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_thanh_ha_noi",
        "name": "Hà Nội",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "Nhà Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "subjectId": "person_nguyen_tri_phuong",
        "subjectName": "Nguyễn Tri Phương",
        "relationType": "PART_OF",
        "objectId": "dynasty_nha_nguyen",
        "objectName": "Nhà Nguyễn"
      },
      {
        "subjectId": "person_nguyen_tri_phuong",
        "subjectName": "Nguyễn Tri Phương",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thanh_ha_noi",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP12_001_TRUONG_DINH_GO_CONG",
    "epochId": "EPOCH_12",
    "sourceDocument": "Lịch Sử Việt Nam Cận Đại & Đại Nam Thực Lục",
    "dynasty": "Kháng Pháp Cận Đại",
    "sectionTitle": "Bình Tây Đại nguyên soái Trương Định lãnh đạo khởi nghĩa Gò Công",
    "evaluationFocus": "EARLY_ANTI_COLONIAL_RESISTANCE",
    "banner": "[Sử Liệu: Lịch Sử Cận Đại] [Kỷ/Triều Đại: Kháng chiến chống Pháp] [Mục: Khởi nghĩa Trương Định] [Nhân Vật: Trương Định, Phan Thanh Giản] [Thời Gian: Năm 1861 - 1864]",
    "rawText": "Sau khi quân Pháp đánh chiếm ba tỉnh miền Đông Nam Kỳ, triều đình Huế ký Hiệp ước Nhâm Tuất 1862 nhượng đất và hạ lệnh cho Trương Định phải bãi binh giải tán nghĩa quân đi nhận chức Lãnh binh ở An Giang. Đứng trước sự lựa chọn giữa lệnh vua và nỗi đau đớn mất nước của nhân dân Nam Bộ, Trương Định đã dứt khoát chọn ở lại cùng đồng bào đánh giặc. Hàng nghìn người dân và nghĩa sĩ đã suy tôn ông làm Bình Tây Đại nguyên soái và trao cờ khởi nghĩa thêu bốn chữ vàng Phan Lâm mãi quốc, Triều đình khí dân. Trương Định xây dựng căn cứ kháng chiến kiên cố tại Tân Phước Gò Công tỉnh Tiền Giang, áp dụng chiến thuật du kích phục kích trên sông rạch đầm lầy khiến quân Pháp chịu nhiều tổn thất nặng nề. Khi bị phản bội bao vây tại Đám lá tối trời năm 1864, ông đã rút gươm tự sát để giữ tròn khí tiết của người anh hùng áo vải Nam Kỳ. Sự hy sinh oanh liệt của Trương Định đã khích lệ mạnh mẽ tinh thần bất khuất của nhân dân Nam Bộ, mở đầu cho hàng loạt phong trào kháng chiến chống thực dân Pháp vũ trang sôi nổi khắp lục tỉnh Nam Kỳ. Căn cứ kháng chiến Gò Công dưới sự chỉ huy của Bình Tây Đại nguyên soái Trương Định đã trở thành trung tâm đầu não của phong trào chống Pháp tại miền Đông Nam Kỳ. Bằng việc xây dựng các phòng tuyến cọc gỗ liên hoàn trên sông Vàm Cỏ và tổ chức các trận đánh úp tiêu diệt các tàu chiến lính thủy đánh bộ Pháp, nghĩa quân Trương Định đã giáng những đòn đau đớn vào quân xâm lược. Dù cuộc khởi nghĩa sau cùng bị dập tắt do sự phản bội, ngọn cờ Bình Tây Đại nguyên soái mãi mãi là tượng đài bất khuất của lòng yêu nước kiên trung và khí phách hiên ngang của nhân dân Nam Bộ thành đồng tổ quốc.",
    "wordCount": 354,
    "entities": [
      {
        "id": "person_truong_dinh",
        "name": "Trương Định",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Bình Tây Đại nguyên soái"
        ]
      },
      {
        "id": "loc_go_cong",
        "name": "Gò Công",
        "type": "LOCATION"
      },
      {
        "id": "loc_tien_giang",
        "name": "Tiền Giang",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_truong_dinh",
        "subjectName": "Trương Định",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_go_cong",
        "objectName": "Gò Công"
      },
      {
        "subjectId": "loc_go_cong",
        "subjectName": "Gò Công",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_tien_giang",
        "objectName": "Tiền Giang"
      }
    ]
  },
  {
    "id": "CHUNK_EP12_002_PHAN_DINH_PHUNG_HUONG_KHE",
    "epochId": "EPOCH_12",
    "sourceDocument": "Lịch Sử Phong Trào Cần Vương & Văn Thơ Cận Đại",
    "dynasty": "Phong trào Cần Vương",
    "sectionTitle": "Phan Đình Phùng lãnh đạo cuộc khởi nghĩa Hương Khê Hà Tĩnh",
    "evaluationFocus": "PROTRACTED_GUERRILLA_WARFARE",
    "banner": "[Sử Liệu: Phong Trào Cần Vương] [Kỷ/Triều Đại: Phong trào Cần Vương] [Mục: Khởi nghĩa Hương Khê] [Nhân Vật: Phan Đình Phùng, Cao Thắng, Hàm Nghi] [Thời Gian: Năm 1885 - 1896]",
    "rawText": "Hưởng ứng Chiếu Cần Vương của vua Hàm Nghi năm 1885, Đình nguyên Tiến sĩ Phan Đình Phùng đã từ bỏ chức Ngự sử triều đình về quê nhà Hà Tĩnh phất cờ khởi nghĩa, lãnh đạo cuộc khởi nghĩa Hương Khê - đỉnh cao nhất của phong trào Cần Vương chống Pháp cuối thế kỷ XIX. Cùng với tướng tài Cao Thắng - người có công chế tạo thành công súng trường kiểu Pháp theo mẫu vũ khí tối tân, nghĩa quân đã xây dựng bốn căn cứ địa liên hoàn hiểm trở tại vùng rừng núi Vụ Quang Hương Khê trải rộng qua bốn tỉnh Thanh Hóa, Nghệ An, Hà Tĩnh, Quảng Bình. Phan Đình Phùng đã chỉ huy nghĩa quân đánh thắng nhiều trận oanh liệt như trận đồn Nu, trận Vụ Quang, tiêu diệt nhiều sinh lực địch. Khi bị kẻ thù đào mả tổ tiên và bắt giữ thân nhân để uy hiếp tinh thần, Phan Đình Phùng khẳng khái trả lời: Nay tôi chỉ có một ngôi mộ rất to là đất nước Việt Nam, chỉ có một gia đình rất lớn là toàn thể đồng bào! Cuộc khởi nghĩa kiên cường kéo dài hơn mười năm đã chứng minh ý chí quật cường của các sĩ phu yêu nước, trở thành biểu tượng cao quý nhất của phong trào Cần Vương cứu nước trong lịch sử cận đại. Dưới sự chỉ huy mưu trí của Phan Đình Phùng, nghĩa quân Hương Khê đã xây dựng được mạng lưới tình báo bí mật và hệ thống công sự công binh kiên cố trong lòng rừng rậm Vụ Quang. Việc chế tạo thành công hàng trăm khẩu súng trường kiểu Pháp của Cao Thắng đã giúp nghĩa quân cân bằng hỏa lực với kẻ thù trong nhiều trận giao tranh ác liệt. Lòng kiên định và tấm gương hy sinh oanh liệt vì đại nghĩa của cụ Phan Đình Phùng đã để lại bài học sâu sắc về tinh thần tự lực tự cường và ý chí độc lập không gì lay chuyển nổi của dân tộc Việt Nam trước phong ba bão táp của lịch sử.",
    "wordCount": 362,
    "entities": [
      {
        "id": "person_phan_dinh_phung",
        "name": "Phan Đình Phùng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_cao_thang",
        "name": "Cao Thắng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_huong_khe",
        "name": "Hương Khê",
        "type": "LOCATION"
      },
      {
        "id": "loc_ha_tinh",
        "name": "Hà Tĩnh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_phan_dinh_phung",
        "subjectName": "Phan Đình Phùng",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_huong_khe",
        "objectName": "Hương Khê"
      },
      {
        "subjectId": "loc_huong_khe",
        "subjectName": "Hương Khê",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_ha_tinh",
        "objectName": "Hà Tĩnh"
      }
    ]
  },
  {
    "id": "CHUNK_EP12_003_HOANG_HOA_THAM_YEN_THE",
    "epochId": "EPOCH_12",
    "sourceDocument": "Lịch Sử Phong Trào Nông Dân Yên Thế",
    "dynasty": "Kháng Pháp Cận Đại",
    "sectionTitle": "Hùm xám Hoàng Hoa Thám và ba mươi năm khởi nghĩa nông dân Yên Thế",
    "evaluationFocus": "PEASANT_GUERRILLA_RESISTANCE",
    "banner": "[Sử Liệu: Lịch Sử Cận Đại] [Kỷ/Triều Đại: Khởi nghĩa Yên Thế] [Mục: Hùm xám Yên Thế] [Nhân Vật: Hoàng Hoa Thám, Đề Nắm] [Thời Gian: Năm 1884 - 1913]",
    "rawText": "Khởi nghĩa Yên Thế (1884 - 1913) do Đề Thám tức Hoàng Hoa Thám lãnh đạo tại vùng núi rừng hiểm trở tỉnh Bắc Giang là phong trào vũ trang kháng Pháp của nông dân kiên cường và bền bỉ nhất trong lịch sử cận đại. Với biệt danh Hùm xám Yên Thế, Hoàng Hoa Thám đã tài tình vận dụng địa hình đồi núi rậm rạp để xây dựng hệ thống đồn lũy Phồn Xương, áp dụng chiến thuật du kích linh hoạt đánh thắng nhiều cuộc hành quân càn quét quy mô lớn của thực dân Pháp có pháo binh yểm trợ. Ông từng hai lần buộc quân Pháp phải ký hiệp ước đình chiến và nhượng quyền kiểm soát nhiều tổng đồn điền cho nghĩa quân. Tinh thần chiến đấu quả cảm của người anh hùng nông dân Hoàng Hoa Thám đã trở thành biểu tượng rực rỡ cho tinh thần tự lực tự cường và sức sống quật khởi của giai cấp nông dân Việt Nam trước quân xâm lược. Suốt gần ba thập kỷ đương đầu với bộ máy quân sự hiện đại của thực dân Pháp, cuộc khởi nghĩa Yên Thế đã để lại những kinh nghiệm vô giá về chiến tranh du kích và nghệ thuật dựa vào địa hình hiểm trở để bảo toàn lực lượng chiến đấu lâu dài. Khởi nghĩa Yên Thế là bản anh hùng ca bi tráng của những người nông dân mặc áo lính vì độc lập dân tộc. Hoàng Hoa Thám đã chứng minh rằng một đội quân nông dân được tổ chức kỷ luật và chỉ huy bởi người thủ lĩnh tài ba có thể cầm cự và giáng những đòn sấm sét vào kẻ thù trang bị vũ khí hiện đại suốt gần ba mươi năm. Tinh thần quật khởi của Hùm xám Yên Thế và căn cứ nghĩa quân Phồn Xương đã trở thành niềm cảm hứng to lớn cho các nhà yêu nước tiến bộ thời kỳ đầu thế kỷ XX tiếp bước con đường cứu nước giải phóng dân tộc.",
    "wordCount": 349,
    "entities": [
      {
        "id": "person_hoang_hoa_tham",
        "name": "Hoàng Hoa Thám",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đề Thám"
        ]
      },
      {
        "id": "loc_yen_the",
        "name": "Yên Thế",
        "type": "LOCATION"
      },
      {
        "id": "loc_bac_giang",
        "name": "Bắc Giang",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_hoang_hoa_tham",
        "subjectName": "Hoàng Hoa Thám",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_yen_the",
        "objectName": "Yên Thế"
      },
      {
        "subjectId": "loc_yen_the",
        "subjectName": "Yên Thế",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_bac_giang",
        "objectName": "Bắc Giang"
      }
    ]
  },
  {
    "id": "CHUNK_EP12_004_PHAN_BOI_CHAU_DONG_DU",
    "epochId": "EPOCH_12",
    "sourceDocument": "Tự Phán - Phan Bội Châu & Lịch Sử Việt Nam Hiện Đại",
    "dynasty": "Phong trào Duy Tân",
    "sectionTitle": "Cụ Phan Bội Châu khởi xướng phong trào Đông Du đào tạo nhân tài",
    "evaluationFocus": "MODERN_PATRIOTIC_INTELLECTUAL",
    "banner": "[Sử Liệu: Lịch Sử Hiện Đại] [Kỷ/Triều Đại: Phong trào Đông Du] [Mục: Phong trào Đông Du] [Nhân Vật: Phan Bội Châu, Cường Để, Phan Châu Trinh] [Thời Gian: Năm 1905 - 1908]",
    "rawText": "Đầu thế kỷ XX, nhận thấy con đường cứu nước theo ngọn cờ phong kiến Cần Vương không còn phù hợp trước thời cuộc mới, nhà yêu nước Phan Bội Châu đã sáng lập Hội Duy Tân năm 1904 và khởi xướng phong trào Đông Du đưa hàng trăm thanh niên trí thức ưu tú sang Nhật Bản du học. Ông chủ trương học tập văn minh khoa học kỹ thuật quân sự hiện đại của phương Đông để chuẩn bị lực lượng đánh đuổi thực dân Pháp giành lại độc lập cho tổ quốc. Cùng với phong trào Duy Tân khai dân trí chấn dân khí của cụ Phan Châu Trinh, phong trào Đông Du của Phan Bội Châu đã đánh dấu bước chuyển mình quan trọng của tư tưởng cách mạng Việt Nam từ ý thức hệ phong kiến sang xu hướng dân chủ tư sản tiến bộ, thức tỉnh lòng yêu nước nồng nàn của các thế hệ thanh niên trí thức Việt Nam. Dù sau đó bị thực dân Pháp cấu kết với chính phủ Nhật Bản trục xuất các du học sinh về nước, phong trào Đông Du đã gieo mầm cho những tư tưởng canh tân tiến bộ và đào tạo nên nhiều hạt giống cách mạng kiên trung cho phong trào giải phóng dân tộc những thập niên sau. Phong trào Đông Du đã đánh dấu sự kết nối tư tưởng giữa các nhà cách mạng Việt Nam với phong trào giải phóng dân tộc tại khu vực châu Á. Hội Duy Tân do Phan Bội Châu sáng lập không chỉ cử học sinh sang Nhật Bản học tập về quân sự và chính trị mà còn phát hành nhiều tài liệu văn thơ yêu nước như Hải ngoại huyết thư, Việt Nam vong quốc sử truyền về trong nước làm thức tỉnh tinh thần tự tôn dân tộc của đông đảo đồng bào. Tầm nhìn chiến lược mở cửa hội nhập tri thức hiện đại của cụ Phan Bội Châu là ngọn hải đăng soi sáng cho công cuộc vận động cách mạng Việt Nam thời cận đại.",
    "wordCount": 356,
    "entities": [
      {
        "id": "person_phan_boi_chau",
        "name": "Phan Bội Châu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_phan_chau_trinh",
        "name": "Phan Châu Trinh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_phong_trao_dong_du",
        "name": "phong trào Đông Du",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "subjectId": "person_phan_boi_chau",
        "subjectName": "Phan Bội Châu",
        "relationType": "LED_BY",
        "objectId": "event_phong_trao_dong_du",
        "objectName": "phong trào Đông Du"
      }
    ]
  },
  {
    "id": "CHUNK_EP13_001_TUYEN_NGON_DOC_LAP_1945",
    "epochId": "EPOCH_13",
    "sourceDocument": "Hồ Chí Minh Toàn Tập & Lịch Sử Cách Mạng Tháng Tám",
    "dynasty": "Việt Nam Dân Chủ Cộng Hòa",
    "sectionTitle": "Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình",
    "evaluationFocus": "FOUNDING_MODERN_REPUBLIC",
    "banner": "[Sử Liệu: Hồ Chí Minh Toàn Tập] [Kỷ/Triều Đại: Kháng chiến chống Pháp] [Mục: Khai sinh nước Việt Nam Dân chủ Cộng hòa] [Nhân Vật: Hồ Chí Minh] [Địa Danh: Ba Đình, Hà Nội] [Thời Gian: 2/9/1945]",
    "rawText": "Ngày 2 tháng 9 năm 1945, tại Quảng trường Ba Đình lịch sử ở thủ đô Hà Nội, trước hàng chục vạn đồng bào cả nước reo hò rực rỡ cờ đỏ sao vàng, Chủ tịch Hồ Chí Minh thay mặt Chính phủ lâm thời trang nghiêm đọc bản Tuyên ngôn Độc lập bất hủ, khai sinh ra nước Việt Nam Dân chủ Cộng hòa. Bản tuyên ngôn mở đầu bằng việc trích dẫn những chân lý bất hủ về quyền con người trong Tuyên ngôn Độc lập của nước Mỹ năm 1776 và Tuyên ngôn Nhân quyền và Dân quyền của Cách mạng Pháp năm 1791, rồi khẳng định đanh thép: Tất cả mọi người sinh ra đều có quyền bình đẳng. Tạo hóa cho họ những quyền không ai có thể xâm phạm được; trong những quyền ấy, có quyền được sống, quyền tự do và quyền mưu cầu hạnh phúc. Suy rộng ra, câu ấy có ý nghĩa là: Tất cả các dân tộc trên thế giới đều sinh ra bình đẳng; dân tộc nào cũng có quyền sống, quyền sung sướng và quyền tự do. Bản Tuyên ngôn tuyên bố dứt khoát xóa bỏ hoàn toàn ách thống trị thực dân của Pháp và chế độ phong kiến ngàn năm, khẳng định ý chí sắt đá: Nước Việt Nam có quyền hưởng tự do và độc lập, và sự thật đã thành một nước tự do độc lập. Toàn thể dân tộc Việt Nam quyết đem tất cả tinh thần và lực lượng, tính mạng và của cải để giữ vững quyền tự do, độc lập ấy.",
    "wordCount": 271,
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_ba_dinh",
        "name": "Ba Đình",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      },
      {
        "id": "doc_tuyen_ngon_doc_lap",
        "name": "Tuyên ngôn Độc lập",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ho_chi_minh",
        "subjectName": "Hồ Chí Minh",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_ba_dinh",
        "objectName": "Ba Đình"
      },
      {
        "subjectId": "loc_ba_dinh",
        "subjectName": "Ba Đình",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Hà Nội"
      },
      {
        "subjectId": "doc_tuyen_ngon_doc_lap",
        "subjectName": "Tuyên ngôn Độc lập",
        "relationType": "LED_BY",
        "objectId": "person_ho_chi_minh",
        "objectName": "Hồ Chí Minh"
      }
    ]
  },
  {
    "id": "CHUNK_EP13_002_DIEN_BIEN_PHU_1954",
    "epochId": "EPOCH_13",
    "sourceDocument": "Đại Tướng Võ Nguyên Giáp - Điện Biên Phủ Điểm Hẹn Lịch Sử",
    "dynasty": "Kháng chiến Chống Pháp",
    "sectionTitle": "Đại tướng Võ Nguyên Giáp chỉ huy chiến thắng Điện Biên Phủ năm 1954",
    "evaluationFocus": "DECISIVE_HISTORICAL_CAMPAIGN",
    "banner": "[Sử Liệu: Lịch Sử Quân Sự] [Kỷ/Triều Đại: Kháng chiến chống Pháp] [Mục: Chiến dịch Điện Biên Phủ] [Nhân Vật: Võ Nguyên Giáp, De Castries, Hoàng Văn Thái] [Thời Gian: Năm 1954]",
    "rawText": "Chiến dịch Điện Biên Phủ (13/3 - 7/5/1954) là đỉnh cao chói lọi nhất của cuộc kháng chiến chống thực dân Pháp xâm lược. Dưới sự chỉ đạo chiến lược thiên tài của Tổng Tư lệnh Đại tướng Võ Nguyên Giáp, quân và dân ta đã vượt qua muôn vàn gian khổ kéo pháo bằng tay qua đèo cao dốc thẳm xẻ núi đào hầm bao vây tập đoàn cứ điểm mạnh nhất Đông Dương của Pháp do tướng De Castries chỉ huy. Với quyết định lịch sử chuyển phương châm tác chiến từ đánh nhanh thắng nhanh sang đánh chắc tiến chắc của Đại tướng, quân đội ta đã lần lượt tiêu diệt các cứ điểm Him Lam, Độc Lập, Bản Kéo và thắt chặt vòng vây chiến hào ngột ngạt bóp nghẹt sân bay Mường Thanh. Chiều ngày 7 tháng 5 năm 1954, lá cờ Quyết chiến Quyết thắng tung bay trên nóc hầm tướng De Castries, toàn bộ quân Pháp đầu hàng. Chiến thắng Điện Biên Phủ lừng lẫy năm châu chấn động địa cầu đã đập tan kế hoạch Navarre, buộc chính phủ Pháp phải ký Hiệp định Genève chấm dứt chiến tranh xâm lược Đông Dương. Thắng lợi lịch sử này đã giáng một đòn sấm sét làm sụp đổ hoàn toàn hệ thống thuộc địa của chủ nghĩa thực dân cũ trên phạm vi toàn thế giới, mở ra thời kỳ mới cho phong trào giải phóng dân tộc của các nước bị áp bức.",
    "wordCount": 251,
    "entities": [
      {
        "id": "person_vo_nguyen_giap",
        "name": "Võ Nguyên Giáp",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đại tướng Võ Nguyên Giáp"
        ]
      },
      {
        "id": "loc_dien_bien_phu",
        "name": "Điện Biên Phủ",
        "type": "LOCATION"
      },
      {
        "id": "event_chien_dich_dien_bien_phu",
        "name": "Chiến dịch Điện Biên Phủ",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "subjectId": "event_chien_dich_dien_bien_phu",
        "subjectName": "Chiến dịch Điện Biên Phủ",
        "relationType": "LED_BY",
        "objectId": "person_vo_nguyen_giap",
        "objectName": "Võ Nguyên Giáp"
      },
      {
        "subjectId": "event_chien_dich_dien_bien_phu",
        "subjectName": "Chiến dịch Điện Biên Phủ",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_dien_bien_phu",
        "objectName": "Điện Biên Phủ"
      }
    ]
  },
  {
    "id": "CHUNK_EP13_003_CHIEN_DICH_BIEN_GIOI_1950",
    "epochId": "EPOCH_13",
    "sourceDocument": "Lịch Sử Cuộc Kháng Chiến Chống Thực Dân Pháp",
    "dynasty": "Kháng chiến Chống Pháp",
    "sectionTitle": "Chiến dịch Biên giới Thu Đông 1950 khai thông hành lang quốc tế",
    "evaluationFocus": "COUNTER_OFFENSIVE_BREAKTHROUGH",
    "banner": "[Sử Liệu: Lịch Sử Quân Sự] [Kỷ/Triều Đại: Kháng chiến chống Pháp] [Mục: Chiến dịch Biên Giới 1950] [Nhân Vật: Hồ Chí Minh, Võ Nguyên Giáp, La Văn Cầu] [Thời Gian: Năm 1950]",
    "rawText": "Mùa thu năm Canh Dần (1950), Trung ương Đảng và Chủ tịch Hồ Chí Minh quyết định mở Chiến dịch Biên giới Thu Đông nhằm tiêu diệt một bộ phận quan trọng sinh lực địch, khai thông tuyến biên giới Việt - Trung để mở đường liên lạc với các nước xã hội chủ nghĩa anh em. Chủ tịch Hồ Chí Minh đã trực tiếp lên đài quan sát tại mặt trận Đông Khê Cao Bằng để theo dõi và chỉ đạo trận đánh. Trong chiến dịch này, quân đội ta đã nêu cao chủ nghĩa anh hùng cách mạng với những tấm gương sáng ngời như anh hùng La Văn Cầu nhờ đồng đội chặt đứt cánh tay bị thương để tiếp tục ôm bộc phá xông lên phá lô cốt địch. Sau hai mươi chín ngày đêm chiến đấu mưu trí dũng cảm, quân ta đã đập tan tuyến phòng thủ kiên cố của thực dân Pháp trên đường số 4, giải phóng hoàn toàn dải biên giới phía Bắc dài hơn bảy trăm cây số. Chiến thắng Biên giới 1950 đã làm thay đổi căn bản cục diện chiến trường, đưa cuộc kháng chiến của ta bước sang giai đoạn tổng phản công chiến lược giành thắng lợi quyết định. Thắng lợi to lớn này đã phá tan thế bao vây cô lập của địch đối với căn cứ địa Việt Bắc, mở rộng vùng tự do và củng cố vững chắc hậu phương kháng chiến của quân và dân ta.",
    "wordCount": 254,
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_vo_nguyen_giap",
        "name": "Võ Nguyên Giáp",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_cao_bang",
        "name": "Cao Bằng",
        "type": "LOCATION"
      },
      {
        "id": "event_chien_dich_bien_gioi",
        "name": "Chiến dịch Biên giới",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "subjectId": "event_chien_dich_bien_gioi",
        "subjectName": "Chiến dịch Biên giới",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_cao_bang",
        "objectName": "Cao Bằng"
      },
      {
        "subjectId": "event_chien_dich_bien_gioi",
        "subjectName": "Chiến dịch Biên giới",
        "relationType": "LED_BY",
        "objectId": "person_vo_nguyen_giap",
        "objectName": "Võ Nguyên Giáp"
      }
    ]
  },
  {
    "id": "CHUNK_EP13_004_LOI_KEU_GOI_TOAN_QUOC_KHANG_CHIEN",
    "epochId": "EPOCH_13",
    "sourceDocument": "Hồ Chí Minh Toàn Tập & Lịch Sử Quân Đội Nhân Dân",
    "dynasty": "Kháng chiến Chống Pháp",
    "sectionTitle": "Lời kêu gọi toàn quốc kháng chiến của Chủ tịch Hồ Chí Minh năm 1946",
    "evaluationFocus": "ALL_PEOPLE_RESISTANCE_CALL",
    "banner": "[Sử Liệu: Hồ Chí Minh Toàn Tập] [Kỷ/Triều Đại: Kháng chiến chống Pháp] [Mục: Toàn quốc kháng chiến] [Nhân Vật: Hồ Chí Minh] [Địa Danh: Vạn Phúc, Hà Đông, Hà Nội] [Thời Gian: 19/12/1946]",
    "rawText": "Đêm ngày 19 tháng 12 năm 1946, khi thực dân Pháp bội ước gửi tối hậu thư đòi tước vũ khí của tự vệ ta tại Hà Nội, tại làng Vạn Phúc Hà Đông, Chủ tịch Hồ Chí Minh đã ra Lời kêu gọi toàn quốc kháng chiến thiêng liêng lay động triệu trái tim yêu nước: Chúng ta muốn hòa bình, chúng ta phải nhân nhượng. Nhưng chúng ta càng nhân nhượng, thực dân Pháp càng lấn tới, vì chúng quyết tâm cướp nước ta lần nữa! Không! Chúng ta thà hy sinh tất cả, chứ nhất định không chịu mất nước, nhất định không chịu làm nô lệ. Hỡi đồng bào! Bất kỳ đàn ông, đàn bà, bất kỳ người già, người trẻ, không chia tôn giáo, đảng phái, dân tộc. Hễ là người Việt Nam thì phải đứng lên đánh thực dân Pháp để cứu Tổ quốc. Ai có súng dùng súng. Ai có gươm dùng gươm, không có gươm thì dùng cuốc, thuổng, gậy gộc. Ai cũng phải ra sức chống thực dân Pháp cứu nước. Lời hiệu triệu bất hủ đã mở đầu cuộc kháng chiến toàn dân toàn diện trường kỳ chống thực dân Pháp của dân tộc ta. Tiếng súng kháng chiến rền vang từ pháo đài Láng và tinh thần Quyết tử để Tổ quốc quyết sinh của quân dân thủ đô Hà Nội đã giam chân địch suốt sáu mươi ngày đêm, bảo vệ an toàn cho cơ quan đầu não cách mạng rút lên căn cứ địa an toàn.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_ha_dong",
        "name": "Hà Đông",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_ho_chi_minh",
        "subjectName": "Hồ Chí Minh",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_ha_dong",
        "objectName": "Hà Đông"
      },
      {
        "subjectId": "loc_ha_dong",
        "subjectName": "Hà Đông",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP14_001_DUONG_TRUONG_SON_559",
    "epochId": "EPOCH_14",
    "sourceDocument": "Lịch Sử Đường Hồ Chí Minh - Bộ Tổng Tư Lệnh",
    "dynasty": "Kháng chiến Chống Mỹ",
    "sectionTitle": "Khai mở tuyến chi viện chiến lược Đường Trường Sơn Đoàn 559",
    "evaluationFocus": "LOGISTICAL_STRATEGY_TRAIL",
    "banner": "[Sử Liệu: Lịch Sử Quân Sự] [Kỷ/Triều Đại: Kháng chiến chống Mỹ] [Mục: Đường Hồ Chí Minh] [Nhân Vật: Võ Bẩm, Đồng Sĩ Nguyên] [Thời Gian: Năm 1959 - 1975]",
    "rawText": "Ngày 19 tháng 5 năm 1959, Tổng Quân ủy và Bộ Quốc phòng ra quyết định thành lập Đoàn công tác quân sự đặc biệt mang phiên hiệu Đoàn 559 do Thượng tá Võ Bẩm chỉ huy, có nhiệm vụ soi đường mở lối xẻ dọc dãy Trường Sơn hiểm trở để chi viện sức người sức của cho chiến trường miền Nam đánh Mỹ. Dưới sự chỉ huy kiệt xuất của Tư lệnh Đồng Sĩ Nguyên cùng tinh thần quả cảm Xẻ dọc Trường Sơn đi cứu nước của hàng vạn chiến sĩ công binh, thanh niên xung phong và bộ đội vận tải, con đường mòn thô sơ ban đầu đã phát triển thành một hệ thống huyết mạch giao thông quân sự liên hoàn kỳ vĩ dài hơn hai vạn cây số gồm năm trục dọc và hai mươi mốt trục ngang vươn sâu đến tận các chiến trường miền Đông Nam Bộ. Bất chấp hàng triệu tấn bom đạn và chất độc hóa học rải xuống của không quân Mỹ, Đường Trường Sơn huyền thoại vẫn thông suốt ngày đêm, vận chuyển hàng triệu tấn vũ khí lương thực và đưa hàng trăm vạn cán bộ chiến sĩ vào Nam chiến đấu, trở thành biểu tượng rực rỡ của ý chí thống nhất non sông của dân tộc. Tuyến vận tải quân sự chiến lược này là một kỳ tích vô song của nghệ thuật hậu cần quân sự Việt Nam trong thế kỷ XX. Đường Trường Sơn không chỉ là tuyến chi viện vật chất đơn thuần mà còn là biểu tượng rực rỡ của ý chí thống nhất non sông triệu người như một. Khẩu hiệu Tim có thể ngừng đập nhưng mạch máu giao thông không thể tắc đã trở thành mệnh lệnh thiêng liêng trong trái tim của mỗi chiến sĩ trên tuyến đường huyết mạch. Hàng nghìn người con ưu tú đã ngã xuống trên từng mét đường Trường Sơn để xe ta bon bon ra tiền tuyến lớn, tạo nên sức mạnh tổng hợp làm nên chiến thắng vĩ đại mùa xuân năm 1975 thống nhất trọn vẹn non sông bờ cõi.",
    "wordCount": 362,
    "entities": [
      {
        "id": "loc_duong_truong_son",
        "name": "Đường Trường Sơn",
        "type": "LOCATION",
        "aliases": [
          "Đường Hồ Chí Minh"
        ]
      },
      {
        "id": "org_doan_559",
        "name": "Đoàn 559",
        "type": "ORGANIZATION"
      },
      {
        "id": "person_dong_si_nguyen",
        "name": "Đồng Sĩ Nguyên",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "subjectId": "org_doan_559",
        "subjectName": "Đoàn 559",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_duong_truong_son",
        "objectName": "Đường Trường Sơn"
      }
    ]
  },
  {
    "id": "CHUNK_EP14_002_CHIEN_DICH_HO_CHI_MINH_1975",
    "epochId": "EPOCH_14",
    "sourceDocument": "Đại Thắng Mùa Xuân 1975 - Văn Tiến Dũng",
    "dynasty": "Kháng chiến Chống Mỹ",
    "sectionTitle": "Đại thắng Mùa Xuân 1975 giải phóng hoàn toàn miền Nam thống nhất đất nước",
    "evaluationFocus": "FINAL_VICTORY_STRATEGY",
    "banner": "[Sử Liệu: Đại Thắng Mùa Xuân] [Kỷ/Triều Đại: Kháng chiến chống Mỹ] [Mục: Chiến dịch Hồ Chí Minh] [Nhân Vật: Văn Tiến Dũng, Lê Đức Thọ, Dương Văn Minh] [Thời Gian: Mùa xuân năm 1975]",
    "rawText": "Chiến dịch Hồ Chí Minh lịch sử (26/4 - 30/4/1975) là đỉnh cao chói lọi của cuộc Tổng tiến công và nổi dậy Mùa Xuân 1975 giải phóng hoàn toàn miền Nam thống nhất đất nước. Dưới sự chỉ huy trực tiếp của Tư lệnh Đại tướng Văn Tiến Dũng và Chính ủy Phạm Hùng cùng đồng chí Lê Đức Thọ, năm cánh quân hùng mạnh của Quân Giải phóng từ các hướng Tây Bắc, Bắc, Đông Bắc, Đông và Tây Nam đã đồng loạt nổ súng tiến công thần tốc đập tan các tuyến phòng thủ tử thủ của quân đội Sài Gòn. Đúng 11 giờ 30 phút ngày 30 tháng 4 năm 1975, xe tăng mang số hiệu 390 và 843 húc đổ cánh cổng Dinh Độc Lập, lá cờ cách mạng tung bay kiêu hãnh trên nóc dinh, Tổng thống chính quyền Sài Gòn Dương Văn Minh buộc phải tuyên bố đầu hàng không điều kiện. Đại thắng lịch sử ngày 30 tháng 4 đã kết thúc vẻ vang ba mươi năm chiến tranh giải phóng dân tộc và bảo vệ tổ quốc, non sông thu về một mối, mở ra kỷ nguyên độc lập tự do và đi lên chủ nghĩa xã hội của đất nước Việt Nam. Thắng lợi vĩ đại này mãi mãi đi vào lịch sử dân tộc như một trong những trang chói lọi nhất, một biểu tượng sáng ngời về sự toàn thắng của chủ nghĩa anh hùng cách mạng và trí tuệ bản lĩnh con người Việt Nam.",
    "wordCount": 258,
    "entities": [
      {
        "id": "event_chien_dich_ho_chi_minh",
        "name": "Chiến dịch Hồ Chí Minh",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION",
        "aliases": [
          "TP.HCM"
        ]
      },
      {
        "id": "person_van_tien_dung",
        "name": "Văn Tiến Dũng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_dinh_doc_lap",
        "name": "Dinh Độc Lập",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "event_chien_dich_ho_chi_minh",
        "subjectName": "Chiến dịch Hồ Chí Minh",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_sai_gon",
        "objectName": "Sài Gòn"
      },
      {
        "subjectId": "event_chien_dich_ho_chi_minh",
        "subjectName": "Chiến dịch Hồ Chí Minh",
        "relationType": "LED_BY",
        "objectId": "person_van_tien_dung",
        "objectName": "Văn Tiến Dũng"
      },
      {
        "subjectId": "loc_dinh_doc_lap",
        "subjectName": "Dinh Độc Lập",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_sai_gon",
        "objectName": "Sài Gòn"
      }
    ]
  },
  {
    "id": "CHUNK_EP14_003_DIEN_BIEN_PHU_TREN_KHONG_1972",
    "epochId": "EPOCH_14",
    "sourceDocument": "Lịch Sử Quân Chủng Phòng Không Không Quân",
    "dynasty": "Kháng chiến Chống Mỹ",
    "sectionTitle": "Trận Điện Biên Phủ trên không mười hai ngày đêm đánh bại B-52 năm 1972",
    "evaluationFocus": "AIR_DEFENSE_HEROISM",
    "banner": "[Sử Liệu: Lịch Sử Phòng Không] [Kỷ/Triều Đại: Kháng chiến chống Mỹ] [Mục: Chiến thắng Hà Nội - Điện Biên Phủ trên không] [Nhân Vật: Phạm Tuân, Hoàng Đan] [Thời Gian: Tháng 12 năm 1972]",
    "rawText": "Trong mười hai ngày đêm khói lửa cuối tháng 12 năm 1972, không quân chiến lược Mỹ đã mở chiến dịch Linebacker II dùng hàng trăm lượt siêu pháo đài bay B-52 ném bom rải thảm tàn bạo xuống thủ đô Hà Nội, Hải Phòng và các vùng lân cận nhằm ép ta phải nhượng bộ trên bàn đàm phán Paris. Quân và dân miền Bắc với lực lượng nòng cốt là bộ đội Tên lửa, Radar và Không quân đã kiên cường chiến đấu, sáng tạo cách đánh độc đáo vạch nhiễu tìm thù bắn rơi ba mươi tư pháo đài bay B-52 và hàng chục máy bay chiến thuật của đế quốc Mỹ. Phi công Phạm Tuân đã lập chiến công lịch sử khi lái máy bay tiêm kích MiG-21 vượt qua hàng rào bảo vệ dày đặc bắn rơi một siêu pháo đài bay B-52 trên bầu trời đêm. Chiến thắng vang dội Hà Nội - Điện Biên Phủ trên không đã đập tan hoàn toàn mưu đồ dùng bom đạn khuất phục nhân dân ta, buộc chính phủ Mỹ phải tuyên bố chấm dứt chiến dịch ném bom và chấp nhận ký kết Hiệp định Paris rút toàn bộ quân đội về nước. Đây là thất bại nặng nề nhất trong lịch sử không lực Hoa Kỳ và là khúc tráng ca bất diệt về ý chí kiên cường bảo vệ bầu trời tổ quốc của quân dân ta. Chiến thắng Hà Nội - Điện Biên Phủ trên không đã chứng minh bản lĩnh kiên cường, trí thông minh sáng tạo và nghệ thuật quân sự độc đáo của quân và dân ta trong cuộc đọ sức với không lực hiện đại bậc nhất thế giới. Việc biến siêu pháo đài bay B-52 bất khả xâm phạm thành những đống sắt vụn rơi ngay giữa lòng thủ đô đã giáng đòn chí mạng vào ý đồ đàm phán trên thế mạnh của chính quyền Mỹ, buộc đối phương phải ký kết Hiệp định Paris rút toàn bộ quân đội về nước, mở ra thời cơ thuận lợi cho công cuộc giải phóng hoàn toàn miền Nam.",
    "wordCount": 360,
    "entities": [
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      },
      {
        "id": "loc_hai_phong",
        "name": "Hải Phòng",
        "type": "LOCATION"
      },
      {
        "id": "person_pham_tuan",
        "name": "Phạm Tuân",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_linebacker_ii",
        "name": "Linebacker II",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "subjectId": "person_pham_tuan",
        "subjectName": "Phạm Tuân",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP14_004_HIEP_DINH_PARIS_1973",
    "epochId": "EPOCH_14",
    "sourceDocument": "Ngoại Giao Việt Nam Trong Kháng Chiến Chống Mỹ",
    "dynasty": "Kháng chiến Chống Mỹ",
    "sectionTitle": "Ký kết Hiệp định Paris năm 1973 - Thắng lợi đỉnh cao của mặt trận ngoại giao",
    "evaluationFocus": "DIPLOMATIC_PEACE_ACCORD",
    "banner": "[Sử Liệu: Lịch Sử Ngoại Giao] [Kỷ/Triều Đại: Kháng chiến chống Mỹ] [Mục: Hiệp định Paris 1973] [Nhân Vật: Lê Đức Thọ, Nguyễn Thị Bình, Henry Kissinger] [Thời Gian: 27/1/1973]",
    "rawText": "Ngày 27 tháng 1 năm 1973, tại Trung tâm hội nghị quốc tế Kléber ở thủ đô Paris nước Pháp, Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam đã chính thức được ký kết giữa bốn bên tham chiến. Đây là kết quả của cuộc đàm phán ngoại giao dài nhất trong lịch sử kéo dài gần năm năm với hơn hai trăm phiên họp công khai và hàng chục cuộc tiếp xúc bí mật đầy bản lĩnh giữa Cố vấn đặc biệt Lê Đức Thọ và Tiến sĩ Henry Kissinger. Đoàn đại biểu Chính phủ Cách mạng lâm thời Cộng hòa miền Nam Việt Nam do Bộ trưởng Ngoại giao Nguyễn Thị Bình dẫn đầu đã kiên cường bảo vệ quyền lợi chính đáng của nhân dân miền Nam trên diễn đàn quốc tế. Hiệp định Paris ghi nhận điều khoản cốt tử: Hoa Kỳ và các nước cam kết tôn trọng độc lập, chủ quyền, thống nhất và toàn vẹn lãnh thổ của nước Việt Nam, đồng thời buộc quân đội Mỹ và các nước đồng minh phải rút hết quân về nước trong vòng sáu mươi ngày. Thắng lợi ngoại giao vẻ vang tại Paris đã tạo ra thời cơ chiến lược mang tính bước ngoặt đánh cho Mỹ cút tiến tới đánh cho Ngụy nhào để giải phóng hoàn toàn miền Nam thống nhất đất nước. Thắng lợi này là sự kết hợp nhuần nhuyễn giữa đấu tranh quân sự, chính trị và ngoại giao, đỉnh cao của nghệ thuật ngoại giao thời đại Hồ Chí Minh.",
    "wordCount": 268,
    "entities": [
      {
        "id": "person_le_duc_tho",
        "name": "Lê Đức Thọ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_thi_binh",
        "name": "Nguyễn Thị Bình",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_hiep_dinh_paris",
        "name": "Hiệp định Paris",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "subjectId": "doc_hiep_dinh_paris",
        "subjectName": "Hiệp định Paris",
        "relationType": "LED_BY",
        "objectId": "person_le_duc_tho",
        "objectName": "Lê Đức Thọ"
      }
    ]
  },
  {
    "id": "CHUNK_EP15_001_DOI_MOI_1986",
    "epochId": "EPOCH_15",
    "sourceDocument": "Văn Kiện Đại Hội VI & Lịch Sử Kinh Tế Việt Nam",
    "dynasty": "Thời kỳ Đổi Mới",
    "sectionTitle": "Đại hội Đảng lần thứ VI khởi xướng công cuộc Đổi Mới toàn diện năm 1986",
    "evaluationFocus": "SOCIO_ECONOMIC_POLICY",
    "banner": "[Sử Liệu: Văn Kiện Đảng] [Kỷ/Triều Đại: Thời kỳ Đổi Mới] [Mục: Khởi xướng Đổi Mới 1986] [Nhân Vật: Nguyễn Văn Linh, Trường Chinh] [Địa Danh: Hà Nội] [Thời Gian: Tháng 12/1986]",
    "rawText": "Tháng 12 năm 1986, Đại hội đại biểu toàn quốc lần thứ VI của Đảng Cộng sản Việt Nam họp tại thủ đô Hà Nội đã đưa ra quyết sách lịch sử mang tầm nhìn thời đại: Khởi xướng công cuộc Đổi Mới toàn diện đất nước. Dưới sự lãnh đạo của Tổng Bí thư Nguyễn Văn Linh và tinh thần nhìn thẳng vào sự thật, đánh giá đúng sự thật, nói rõ sự thật của đồng chí Trường Chinh, Đảng đã dũng cảm từ bỏ cơ chế quản lý kinh tế tập trung quan liêu bao cấp chuyển sang phát triển nền kinh tế hàng hóa nhiều thành phần vận hành theo cơ chế thị trường có sự quản lý của Nhà nước. Chính sách khoán 10 trong nông nghiệp đã giải phóng mạnh mẽ sức sản xuất của hàng triệu nông dân, đưa Việt Nam từ một quốc gia thiếu đói triền miên phải nhập khẩu lương thực trở thành một trong những quốc gia xuất khẩu gạo hàng đầu thế giới. Công cuộc Đổi Mới đã cứu nền kinh tế quốc gia thoát khỏi khủng hoảng trầm trọng, cải thiện đời sống vật chất tinh thần của nhân dân và mở đường cho quá trình hội nhập quốc tế sâu rộng của đất nước. Đường lối đổi mới đúng đắn và sáng tạo này đã mở ra một trang sử mới hào hùng cho công cuộc xây dựng và phát triển bền vững của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam trong thời đại mới.",
    "wordCount": 260,
    "entities": [
      {
        "id": "person_nguyen_van_linh",
        "name": "Nguyễn Văn Linh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_truong_chinh",
        "name": "Trường Chinh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_doi_moi",
        "name": "Đổi Mới",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "event_doi_moi",
        "subjectName": "Đổi Mới",
        "relationType": "LED_BY",
        "objectId": "person_nguyen_van_linh",
        "objectName": "Nguyễn Văn Linh"
      },
      {
        "subjectId": "event_doi_moi",
        "subjectName": "Đổi Mới",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_thang_long",
        "objectName": "Hà Nội"
      }
    ]
  },
  {
    "id": "CHUNK_EP15_002_VO_VAN_KIET_500KV_HOI_NHAP",
    "epochId": "EPOCH_15",
    "sourceDocument": "Lịch Sử Ngành Năng Lượng & Kinh Tế Việt Nam Hiện Đại",
    "dynasty": "Thời kỳ Đổi Mới",
    "sectionTitle": "Thủ tướng Võ Văn Kiệt chỉ đạo xây dựng thành công Đường dây 500kV Bắc Nam",
    "evaluationFocus": "NATIONAL_INFRASTRUCTURE_GLOBALIZATION",
    "banner": "[Sử Liệu: Lịch Sử Hiện Đại] [Kỷ/Triều Đại: Thời kỳ Đổi Mới] [Mục: Kỳ tích Đường dây 500kV] [Nhân Vật: Võ Văn Kiệt] [Thời Gian: Năm 1992 - 1994]",
    "rawText": "Đầu thập niên 1990, trong bối cảnh miền Bắc thừa điện từ nhà máy thủy điện Hòa Bình trong khi miền Trung và miền Nam thiếu điện nghiêm trọng làm tê liệt sản xuất, Thủ tướng Võ Văn Kiệt đã đưa ra quyết định chiến lược vô cùng táo bạo: Xây dựng công trình Đường dây tải điện siêu cao áp 500kV Bắc - Nam mạch 1 dài gần một nghìn năm trăm cây số nối liền từ Hòa Bình đến Thành phố Hồ Chí Minh. Vượt qua mọi hoài nghi về kỹ thuật và điều kiện thi công hiểm trở băng qua đèo cao vực sâu dọc dãy Trường Sơn, hàng vạn kỹ sư, công nhân và bộ đội ta đã hoàn thành công trình kỳ vĩ chỉ trong vòng hai năm (1992 - 1994). Việc đóng điện thành công đường dây 500kV đã thống nhất hệ thống lưới điện quốc gia, giải quyết triệt để cơn khát năng lượng của miền Nam, tạo xung lực phát triển kinh tế công nghiệp vượt bậc. Cùng với các chủ trương mở cửa ngoại giao bình thường hóa quan hệ với Hoa Kỳ và gia nhập ASEAN năm 1995 của Thủ tướng Võ Văn Kiệt, đất nước ta đã bứt phá ngoạn mục trên con đường công nghiệp hóa hiện đại hóa. Tinh thần dám nghĩ dám làm và quyết đoán vì lợi ích của nhân dân của người lãnh đạo tài ba Võ Văn Kiệt mãi mãi là tấm gương sáng ngời cho công cuộc kiến thiết non sông.",
    "wordCount": 259,
    "entities": [
      {
        "id": "person_vo_van_kiet",
        "name": "Võ Văn Kiệt",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_hoa_binh",
        "name": "Hòa Bình",
        "type": "LOCATION"
      },
      {
        "id": "loc_sai_gon",
        "name": "Thành phố Hồ Chí Minh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "subjectId": "person_vo_van_kiet",
        "subjectName": "Võ Văn Kiệt",
        "relationType": "HAPPENED_AT",
        "objectId": "loc_hoa_binh",
        "objectName": "Hòa Bình"
      }
    ]
  },
  {
    "id": "CHUNK_EP15_003_HOI_NHAP_WTO_2007",
    "epochId": "EPOCH_15",
    "sourceDocument": "Lịch Sử Kinh Tế Đối Ngoại Việt Nam Thế Kỷ XXI",
    "dynasty": "Thời kỳ Hiện Đại",
    "sectionTitle": "Việt Nam chính thức gia nhập Tổ chức Thương mại Thế giới WTO năm 2007",
    "evaluationFocus": "GLOBAL_ECONOMIC_INTEGRATION",
    "banner": "[Sử Liệu: Lịch Sử Ngoại Giao] [Kỷ/Triều Đại: Thời kỳ Hội nhập] [Mục: Gia nhập WTO] [Nhân Vật: Phan Văn Khải, Nguyễn Tấn Dũng] [Thời Gian: 11/1/2007]",
    "rawText": "Ngày 11 tháng 1 năm 2007, sau hơn mười một năm đàm phán kiên trì và vượt qua hàng trăm cuộc thương lượng song phương và đa phương phức tạp, Việt Nam chính thức trở thành thành viên thứ 150 của Tổ chức Thương mại Thế giới WTO. Sự kiện trọng đại này đánh dấu bước tiến hội nhập kinh tế quốc tế sâu rộng và toàn diện nhất của Việt Nam vào nền kinh tế toàn cầu. Việc gia nhập WTO mở ra cơ hội to lớn để hàng hóa xuất khẩu của Việt Nam như dệt may, da giày, thủy sản, nông sản tiếp cận bình đẳng với thị trường thế giới không bị áp đặt các rào cản phân biệt đối xử, đồng thời thu hút dòng vốn đầu tư trực tiếp nước ngoài khổng lồ chảy vào phát triển cơ sở hạ tầng và công nghệ. Vị thế uy tín quốc tế của Việt Nam không ngừng được nâng cao, khẳng định đất nước là bạn, là đối tác tin cậy và là thành viên có trách nhiệm trong cộng đồng quốc tế. Quá trình hội nhập kinh tế toàn cầu đã tạo động lực mạnh mẽ để hoàn thiện thể chế kinh tế thị trường định hướng xã hội chủ nghĩa, nâng cao năng lực cạnh tranh quốc gia và thúc đẩy tăng trưởng kinh tế bền vững trong thế kỷ XXI. Việc gia nhập Tổ chức Thương mại Thế giới WTO đã tạo động lực mạnh mẽ thúc đẩy công cuộc cải cách thể chế kinh tế trong nước theo hướng minh bạch, chuyên nghiệp và tiệm cận với các chuẩn mực quốc tế hiện đại. Hàng loạt luật kinh tế quan trọng như Luật Đầu tư, Luật Doanh nghiệp, Luật Thương mại đã được sửa đổi đồng bộ, tạo môi trường kinh doanh thuận lợi và thu hút mạnh mẽ các tập đoàn đa quốc gia hàng đầu thế giới đầu tư sản xuất tại Việt Nam, đưa đất nước chuyển mình thành một mắt xích quan trọng trong chuỗi cung ứng toàn cầu.",
    "wordCount": 351,
    "entities": [
      {
        "id": "org_wto",
        "name": "WTO",
        "type": "ORGANIZATION"
      }
    ],
    "triples": []
  },
  {
    "id": "CHUNK_EP15_004_CHIEN_LUOC_BIEN_VIET_NAM",
    "epochId": "EPOCH_15",
    "sourceDocument": "Nghị Quyết Hội Nghị Trung Ương 8 Khóa XII",
    "dynasty": "Thời kỳ Hiện Đại",
    "sectionTitle": "Chiến lược phát triển bền vững kinh tế biển Việt Nam đến năm 2030",
    "evaluationFocus": "MARITIME_ECONOMY_SECURITY",
    "banner": "[Sử Liệu: Văn Kiện Đảng] [Kỷ/Triều Đại: Thời kỳ Hiện đại] [Mục: Chiến lược Biển Việt Nam] [Địa Danh: Biển Đông, Hoàng Sa, Trường Sa] [Thời Gian: Năm 2018]",
    "rawText": "Tháng 10 năm 2018, Hội nghị lần thứ tám Ban Chấp hành Trung ương Đảng khóa XII đã ban hành Nghị quyết số 36 về Chiến lược phát triển bền vững kinh tế biển Việt Nam đến năm 2030, tầm nhìn đến năm 2045. Nghị quyết xác định mục tiêu đưa Việt Nam trở thành quốc gia biển mạnh, phát triển bền vững kinh tế biển gắn liền với bảo đảm vững chắc quốc phòng, an ninh và chủ quyền biển đảo thiêng liêng của tổ quốc trên Biển Đông, bao gồm hai quần đảo Hoàng Sa và Trường Sa. Chiến lược tập trung phát triển các ngành kinh tế biển then chốt như du lịch và dịch vụ biển, kinh tế hàng hải, khai thác dầu khí và tài nguyên khoáng sản biển, nuôi trồng thủy hải sản bền vững kết hợp với công tác bảo vệ môi trường sinh thái biển và thích ứng với biến đổi khí hậu. Đây là định hướng chiến lược sống còn khẳng định khát vọng vươn ra biển lớn và bảo vệ vững chắc từng tấc biển thiêng liêng của thế hệ người Việt Nam hôm nay và mai sau. Việc kết hợp chặt chẽ giữa phát triển kinh tế biển với thế trận an ninh nhân dân trên biển tạo nền tảng vững chắc để xây dựng một nước Việt Nam hòa bình, thịnh vượng và tự chủ trên trường quốc tế. Chiến lược phát triển bền vững kinh tế biển kết hợp chặt chẽ với nhiệm vụ bảo vệ vững chắc chủ quyền an ninh biển đảo là sự kế thừa sáng tạo tư duy hướng biển của ông cha ta trong bối cảnh địa chính trị mới của thế kỷ XXI. Với hơn 3.260 km bờ biển trải dài cùng hàng nghìn đảo và quần đảo lớn nhỏ, biển đảo không chỉ là không gian sinh tồn màu mỡ mà còn là lá chắn phòng thủ chiến lược tiền tiêu bảo vệ sự toàn vẹn của tổ quốc, khẳng định quyết tâm xây dựng Việt Nam thành quốc gia biển giàu mạnh, văn minh và hiện đại.",
    "wordCount": 358,
    "entities": [
      {
        "id": "loc_hoang_sa",
        "name": "Hoàng Sa",
        "type": "LOCATION"
      },
      {
        "id": "loc_truong_sa",
        "name": "Trường Sa",
        "type": "LOCATION"
      }
    ],
    "triples": []
  }
];
