import { SnippetInput } from '../benchmark-builder-utils.js';

export const GOLDEN_TRIPLES_DATA: SnippetInput[] = [
  {
    "id": "TC_EP01_001",
    "epochId": "EPOCH_01",
    "sourceText": "Vua An Dương Vương xây thành Cổ Loa tại Đông Anh để củng cố phòng thủ nhà nước Âu Lạc.",
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
        "id": "loc_thanh_co_loa",
        "name": "thành Cổ Loa",
        "type": "LOCATION",
        "aliases": [
          "Cổ Loa"
        ]
      },
      {
        "id": "loc_dong_anh",
        "name": "Đông Anh",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_au_lac",
        "name": "nhà nước Âu Lạc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_au_lac"
      },
      {
        "sourceEntityId": "loc_thanh_co_loa",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_dong_anh"
      },
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_co_loa"
      }
    ],
    "notes": "An Duong Vuong and Co Loa fortress"
  },
  {
    "id": "TC_EP01_002",
    "epochId": "EPOCH_01",
    "sourceText": "Nỏ Liên Châu do Cao Lỗ chế tạo giúp nhà nước Âu Lạc đánh lui quân Triệu Đà.",
    "entities": [
      {
        "id": "artifact_no_lien_chau",
        "name": "Nỏ Liên Châu",
        "type": "ARTIFACT",
        "aliases": [
          "Nỏ thần"
        ]
      },
      {
        "id": "person_cao_lo",
        "name": "Cao Lỗ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_au_lac",
        "name": "nhà nước Âu Lạc",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_trieu_da",
        "name": "Triệu Đà",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_cao_lo",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_au_lac"
      },
      {
        "sourceEntityId": "artifact_no_lien_chau",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_au_lac"
      }
    ],
    "notes": "Cao Lo and Crossbow against Trieu Da"
  },
  {
    "id": "TC_EP01_003",
    "epochId": "EPOCH_01",
    "sourceText": "Trống đồng Đông Sơn là biểu tượng văn minh thời đại Văn Lang được tìm thấy ở Thanh Hóa.",
    "entities": [
      {
        "id": "artifact_trong_dong_dong_son",
        "name": "Trống đồng Đông Sơn",
        "type": "ARTIFACT"
      },
      {
        "id": "dynasty_van_lang",
        "name": "Văn Lang",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "artifact_trong_dong_dong_son",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_van_lang"
      },
      {
        "sourceEntityId": "artifact_trong_dong_dong_son",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Dong Son Drum in Van Lang"
  },
  {
    "id": "TC_EP01_004",
    "epochId": "EPOCH_01",
    "sourceText": "Thục Phán tức vua An Dương Vương đã hợp nhất các bộ tộc để dựng nên nhà nước Âu Lạc.",
    "entities": [
      {
        "id": "person_thuc_phan",
        "name": "Thục Phán",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_an_duong_vuong",
        "name": "An Dương Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_au_lac",
        "name": "nhà nước Âu Lạc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_thuc_phan",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_an_duong_vuong"
      },
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_au_lac"
      }
    ],
    "notes": "Thuc Phan alias of An Duong Vuong and part of Au Lac"
  },
  {
    "id": "TC_EP01_005",
    "epochId": "EPOCH_01",
    "sourceText": "Kinh Dương Vương sinh ra Lạc Long Quân rồi truyền ngôi báu cho dòng dõi Hùng Vương nối nghiệp.",
    "entities": [
      {
        "id": "person_kinh_duong_vuong",
        "name": "Kinh Dương Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_lac_long_quan",
        "name": "Lạc Long Quân",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_hung_vuong",
        "name": "Hùng Vương",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_lac_long_quan",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_kinh_duong_vuong"
      },
      {
        "sourceEntityId": "person_hung_vuong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_lac_long_quan"
      }
    ],
    "notes": "Hong Bang royal lineage succession"
  },
  {
    "id": "TC_EP01_006",
    "epochId": "EPOCH_01",
    "sourceText": "Đất Phong Khê kinh đô nước Âu Lạc xưa nay thuộc huyện Đông Anh của thành phố Hà Nội.",
    "entities": [
      {
        "id": "loc_phong_khe",
        "name": "Phong Khê",
        "type": "LOCATION"
      },
      {
        "id": "loc_dong_anh",
        "name": "Đông Anh",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Hà Nội",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_au_lac",
        "name": "Âu Lạc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_phong_khe",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_dong_anh"
      },
      {
        "sourceEntityId": "loc_dong_anh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Ancient Phong Khe corresponds to modern Dong Anh Hanoi"
  },
  {
    "id": "TC_EP01_007",
    "epochId": "EPOCH_01",
    "sourceText": "Sách Lĩnh Nam Chích Quái ghi chép lại truyền thuyết Thánh Gióng dẹp giặc Ân tại núi Sóc Sơn.",
    "entities": [
      {
        "id": "doc_linh_nam_chich_quai",
        "name": "Lĩnh Nam Chích Quái",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_thanh_giong",
        "name": "Thánh Gióng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Phù Đổng Thiên Vương"
        ]
      },
      {
        "id": "loc_soc_son",
        "name": "núi Sóc Sơn",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_thanh_giong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_linh_nam_chich_quai"
      },
      {
        "sourceEntityId": "person_thanh_giong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_soc_son"
      }
    ],
    "notes": "Thanh Giong in Linh Nam Chich Quai chronicle"
  },
  {
    "id": "TC_EP01_008",
    "epochId": "EPOCH_01",
    "sourceText": "Vùng châu thổ sông Hồng mùa hạ mưa nhiều khiến nước sông dâng cao bồi đắp phù sa cho đồng bằng.",
    "entities": [
      {
        "id": "loc_song_hong",
        "name": "sông Hồng",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Pure distractor case: Geographic description in Bronze Age, ZERO battle or political triples"
  },
  {
    "id": "TC_EP01_009_OCR_SPACING",
    "epochId": "EPOCH_01",
    "sourceText": "Sử cũ ghi chép vua An Dương Vương xây thành Cổ Loa hình xoáy trôn ốc ở đất Phong Khê nay thuộc Đông Anh.",
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
        "id": "loc_thanh_co_loa",
        "name": "thành Cổ Loa",
        "type": "LOCATION",
        "aliases": [
          "Cổ Loa"
        ]
      },
      {
        "id": "loc_dong_anh",
        "name": "Đông Anh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_co_loa"
      },
      {
        "sourceEntityId": "loc_thanh_co_loa",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_dong_anh"
      }
    ],
    "notes": "OCR spacing and multi-location relationship"
  },
  {
    "id": "TC_EP01_010_METADATA_NOISE",
    "epochId": "EPOCH_01",
    "sourceText": "Tựa sách: Lĩnh Nam Chích Quái ghi truyền tích vua Hùng dựng nước Văn Lang thuở sơ khai tại Phong Châu.",
    "entities": [
      {
        "id": "doc_linh_nam_chich_quai",
        "name": "Lĩnh Nam Chích Quái",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_hung_vuong",
        "name": "Hùng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_van_lang",
        "name": "Văn Lang",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_phong_chau",
        "name": "Phong Châu",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_hung_vuong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_van_lang"
      },
      {
        "sourceEntityId": "person_hung_vuong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_linh_nam_chich_quai"
      },
      {
        "sourceEntityId": "person_hung_vuong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phong_chau"
      },
      {
        "sourceEntityId": "doc_linh_nam_chich_quai",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_van_lang"
      },
      {
        "sourceEntityId": "doc_linh_nam_chich_quai",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phong_chau"
      }
    ],
    "notes": "Bibliographic metadata prefix filter test"
  },
  {
    "id": "TC_EP02_001",
    "epochId": "EPOCH_02",
    "sourceText": "Hai Bà Trưng phất cờ khởi nghĩa tại Mê Linh lật đổ ách đô hộ của nhà Đông Hán.",
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
        "id": "dynasty_dong_han",
        "name": "nhà Đông Hán",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_hai_ba_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_me_linh"
      }
    ],
    "notes": "Hai Ba Trung uprising at Me Linh"
  },
  {
    "id": "TC_EP02_002",
    "epochId": "EPOCH_02",
    "sourceText": "Bà Triệu tên thật là Triệu Thị Trinh lãnh đạo nghĩa quân tại căn cứ Phú Điền thuộc Thanh Hóa.",
    "entities": [
      {
        "id": "person_ba_trieu",
        "name": "Bà Triệu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_trieu_thi_trinh",
        "name": "Triệu Thị Trinh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_phu_dien",
        "name": "Phú Điền",
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
        "sourceEntityId": "person_trieu_thi_trinh",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_ba_trieu"
      },
      {
        "sourceEntityId": "person_ba_trieu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phu_dien"
      },
      {
        "sourceEntityId": "loc_phu_dien",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Lady Trieu alias and base in Thanh Hoa"
  },
  {
    "id": "TC_EP02_003",
    "epochId": "EPOCH_02",
    "sourceText": "Lý Nam Đế thành lập nhà Tiền Lý và đặt tên nước là Vạn Xuân.",
    "entities": [
      {
        "id": "person_ly_nam_de",
        "name": "Lý Nam Đế",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lý Bí"
        ]
      },
      {
        "id": "dynasty_nha_tien_ly",
        "name": "nhà Tiền Lý",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "dynasty_van_xuan",
        "name": "Vạn Xuân",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_nam_de",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tien_ly"
      },
      {
        "sourceEntityId": "person_ly_nam_de",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_van_xuan"
      }
    ],
    "notes": "Ly Nam De founds Van Xuan"
  },
  {
    "id": "TC_EP02_004",
    "epochId": "EPOCH_02",
    "sourceText": "Khởi nghĩa Mai Thúc Loan bùng nổ tại Hoan Châu do Mai Hắc Đế lãnh đạo chống nhà Đường.",
    "entities": [
      {
        "id": "event_khoi_nghia_mai_thuc_loan",
        "name": "Khởi nghĩa Mai Thúc Loan",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "person_mai_thuc_loan",
        "name": "Mai Hắc Đế",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Mai Thúc Loan"
        ]
      },
      {
        "id": "loc_hoan_chau",
        "name": "Hoan Châu",
        "type": "LOCATION",
        "aliases": [
          "Nghệ An"
        ]
      },
      {
        "id": "dynasty_nha_duong",
        "name": "nhà Đường",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoi_nghia_mai_thuc_loan",
        "relationType": "LED_BY",
        "targetEntityId": "person_mai_thuc_loan"
      },
      {
        "sourceEntityId": "event_khoi_nghia_mai_thuc_loan",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoan_chau"
      }
    ],
    "notes": "Mai Thuc Loan in Hoan Chau"
  },
  {
    "id": "TC_EP02_005",
    "epochId": "EPOCH_02",
    "sourceText": "Phùng Hưng dấy binh khởi nghĩa tại Đường Lâm giành quyền tự chủ được xưng tôn Bố Cái Đại Vương.",
    "entities": [
      {
        "id": "person_phung_hung",
        "name": "Phùng Hưng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_bo_cai_dai_vuong",
        "name": "Bố Cái Đại Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_duong_lam",
        "name": "Đường Lâm",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_bo_cai_dai_vuong",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_phung_hung"
      },
      {
        "sourceEntityId": "person_phung_hung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_duong_lam"
      }
    ],
    "notes": "Phung Hung alias Bo Cai Dai Vuong at Duong Lam"
  },
  {
    "id": "TC_EP02_006",
    "epochId": "EPOCH_02",
    "sourceText": "Vùng đất Ái Châu thời Bắc thuộc nay là địa giới hành chính của tỉnh Thanh Hóa.",
    "entities": [
      {
        "id": "loc_ai_chau",
        "name": "Ái Châu",
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
        "sourceEntityId": "loc_ai_chau",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Ai Chau corresponds to modern Thanh Hoa"
  },
  {
    "id": "TC_EP02_007",
    "epochId": "EPOCH_02",
    "sourceText": "Sử gia Lê Văn Hưu trong Đại Việt Sử Ký hết lời ca ngợi khí phách anh dũng của Hai Bà Trưng.",
    "entities": [
      {
        "id": "person_le_van_huu",
        "name": "Lê Văn Hưu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky",
        "name": "Đại Việt Sử Ký",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_hai_ba_trung",
        "name": "Hai Bà Trưng",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_van_huu",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky"
      },
      {
        "sourceEntityId": "person_hai_ba_trung",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky"
      }
    ],
    "notes": "Historian Le Van Huu praising Hai Ba Trung in Dai Viet Su Ky"
  },
  {
    "id": "TC_EP02_008",
    "epochId": "EPOCH_02",
    "sourceText": "Đầm Dạ Trạch lau sậy um tùm sương mù bao phủ quanh năm tạo địa hình đầm lầy hiểm trở.",
    "entities": [
      {
        "id": "loc_da_trach",
        "name": "Dạ Trạch",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Pure swamp terrain description, zero triples"
  },
  {
    "id": "TC_EP02_009_OCR_SPACING",
    "epochId": "EPOCH_02",
    "sourceText": "Nữ tướng Triệu Thị Trinh dựng căn cứ tại núi Nưa thuộc Nông Cống Thanh Hóa chống lại giặc Đông Ngô.",
    "entities": [
      {
        "id": "person_ba_trieu",
        "name": "Triệu Thị Trinh",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Bà Triệu"
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
        "sourceEntityId": "person_ba_trieu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_nong_cong"
      },
      {
        "sourceEntityId": "loc_nong_cong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Sino-Vietnamese title and multi-tier geographical containment"
  },
  {
    "id": "TC_EP02_010_DANGLING_HEADING",
    "epochId": "EPOCH_02",
    "sourceText": "Lý Bí khởi nghĩa đánh đuổi Thứ sử Tiêu Tư giải phóng thành Long Biên. #### Cổ Tích",
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
        "id": "loc_long_bien",
        "name": "Long Biên",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_nam_de",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_long_bien"
      }
    ],
    "notes": "Markdown heading bleed-in artifact test"
  },
  {
    "id": "TC_EP03_001",
    "epochId": "EPOCH_03",
    "sourceText": "Trận Bạch Đằng năm 938 do Ngô Quyền chỉ huy trên sông Bạch Đằng đánh tan quân Nam Hán.",
    "entities": [
      {
        "id": "event_bach_dang_938",
        "name": "Trận Bạch Đằng năm 938",
        "type": "EVENT_BATTLE"
      },
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
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nam_han",
        "name": "quân Nam Hán",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_bach_dang_938",
        "relationType": "LED_BY",
        "targetEntityId": "person_ngo_quyen"
      },
      {
        "sourceEntityId": "event_bach_dang_938",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_bach_dang"
      }
    ],
    "notes": "Ngo Quyen at Bach Dang 938"
  },
  {
    "id": "TC_EP03_002",
    "epochId": "EPOCH_03",
    "sourceText": "Đinh Bộ Lĩnh dẹp loạn 12 sứ quân, lên ngôi Đinh Tiên Hoàng đóng đô tại Cố đô Hoa Lư.",
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Bộ Lĩnh",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đinh Tiên Hoàng",
          "Vạn Thắng Vương"
        ]
      },
      {
        "id": "event_dep_loan_12_su_quan",
        "name": "dẹp loạn 12 sứ quân",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_hoa_lu",
        "name": "Cố đô Hoa Lư",
        "type": "LOCATION",
        "aliases": [
          "Ninh Bình"
        ]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_dep_loan_12_su_quan",
        "relationType": "LED_BY",
        "targetEntityId": "person_dinh_tien_hoang"
      },
      {
        "sourceEntityId": "person_dinh_tien_hoang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoa_lu"
      }
    ],
    "notes": "Dinh Bo Linh unifies nation at Hoa Lu"
  },
  {
    "id": "TC_EP03_003",
    "epochId": "EPOCH_03",
    "sourceText": "Ngô Quyền lập nên nhà Ngô và quyết định đóng đô tại thành Cổ Loa.",
    "entities": [
      {
        "id": "person_ngo_quyen",
        "name": "Ngô Quyền",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ngo",
        "name": "nhà Ngô",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thanh_co_loa",
        "name": "thành Cổ Loa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_quyen",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ngo"
      },
      {
        "sourceEntityId": "person_ngo_quyen",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_co_loa"
      }
    ],
    "notes": "Ngo Quyen founds Ngo dynasty at Co Loa"
  },
  {
    "id": "TC_EP03_004",
    "epochId": "EPOCH_03",
    "sourceText": "Vua Đinh Tiên Hoàng lập con trai là Đinh Liễn làm Nam Việt Vương giúp sức cai trị nhà Đinh.",
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Tiên Hoàng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_dinh_lien",
        "name": "Đinh Liễn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_dinh",
        "name": "nhà Đinh",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_dinh_lien",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_dinh_tien_hoang"
      },
      {
        "sourceEntityId": "person_dinh_lien",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_dinh"
      }
    ],
    "notes": "Dinh Lien royal lineage under Dinh Tien Hoang"
  },
  {
    "id": "TC_EP03_005",
    "epochId": "EPOCH_03",
    "sourceText": "Đinh Bộ Lĩnh trước khi lên ngôi hoàng đế từng được tôn xưng danh hiệu Vạn Thắng Vương.",
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Bộ Lĩnh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_van_thang_vuong",
        "name": "Vạn Thắng Vương",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_van_thang_vuong",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_dinh_tien_hoang"
      }
    ],
    "notes": "Van Thang Vuong alias of Dinh Bo Linh"
  },
  {
    "id": "TC_EP03_006",
    "epochId": "EPOCH_03",
    "sourceText": "Kinh đô Hoa Lư của triều Đinh và Tiền Lê nay thuộc địa phận tỉnh Ninh Bình.",
    "entities": [
      {
        "id": "loc_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      },
      {
        "id": "loc_ninh_binh",
        "name": "Ninh Bình",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_hoa_lu",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_ninh_binh"
      }
    ],
    "notes": "Hoa Lu corresponds to modern Ninh Binh"
  },
  {
    "id": "TC_EP03_007",
    "epochId": "EPOCH_03",
    "sourceText": "Sử thần Ngô Sĩ Liên trong Đại Việt Sử Ký Toàn Thư ghi chép ca ngợi tài thao lược của vua Lê Đại Hành.",
    "entities": [
      {
        "id": "person_ngo_si_lien",
        "name": "Ngô Sĩ Liên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky_toan_thu",
        "name": "Đại Việt Sử Ký Toàn Thư",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_le_dai_hanh",
        "name": "Lê Đại Hành",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      },
      {
        "sourceEntityId": "person_le_dai_hanh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      }
    ],
    "notes": "Ngo Si Lien records Le Dai Hanh in Toan Thu"
  },
  {
    "id": "TC_EP03_008",
    "epochId": "EPOCH_03",
    "sourceText": "Cố đô Hoa Lư được bao bọc bởi núi đá vôi hiểm trở tạo thế phòng thủ tự nhiên vững chắc.",
    "entities": [
      {
        "id": "loc_hoa_lu",
        "name": "Cố đô Hoa Lư",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Pure limestone geography, zero military conflict triples"
  },
  {
    "id": "TC_EP03_009_OCR_SPACING",
    "epochId": "EPOCH_03",
    "sourceText": "Tiền Ngô Vương Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng kết thúc nghìn năm Bắc thuộc.",
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
        "type": "LOCATION"
      },
      {
        "id": "dynasty_bac_thuoc",
        "name": "Bắc thuộc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_quyen",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_bach_dang"
      }
    ],
    "notes": "Classical royal honorific and naval decisive battle"
  },
  {
    "id": "TC_EP03_010_TRUNCATED_CHRONICLE",
    "epochId": "EPOCH_03",
    "sourceText": "Vua Đinh Tiên Hoàng dẹp loạn mười hai sứ quân thống nhất đất nước lên ngôi hoàng đế tại Hoa Lư.",
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Tiên Hoàng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đinh Bộ Lĩnh"
        ]
      },
      {
        "id": "loc_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_dinh_tien_hoang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoa_lu"
      }
    ],
    "notes": "Chronicle truncation tolerance test"
  },
  {
    "id": "TC_EP04_001",
    "epochId": "EPOCH_04",
    "sourceText": "Năm 1010, Lý Thái Tổ ban Chiếu dời đô dời kinh đô từ Hoa Lư về Thăng Long.",
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
        "id": "doc_chieu_doi_do",
        "name": "Chiếu dời đô",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "loc_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION",
        "aliases": [
          "Đại La",
          "Hà Nội"
        ]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_thai_to",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_chieu_doi_do"
      },
      {
        "sourceEntityId": "person_ly_thai_to",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      },
      {
        "sourceEntityId": "person_ly_thai_to",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoa_lu"
      },
      {
        "sourceEntityId": "doc_chieu_doi_do",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoa_lu"
      },
      {
        "sourceEntityId": "doc_chieu_doi_do",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Ly Thai To moving capital to Thang Long"
  },
  {
    "id": "TC_EP04_002",
    "epochId": "EPOCH_04",
    "sourceText": "Thái úy Lý Thường Kiệt chỉ huy Trận phòng tuyến sông Như Nguyệt đánh lui quân Tống.",
    "entities": [
      {
        "id": "person_ly_thuong_kiet",
        "name": "Lý Thường Kiệt",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Ngô Tuấn"
        ]
      },
      {
        "id": "event_phong_tuyen_nhu_nguyet",
        "name": "Trận phòng tuyến sông Như Nguyệt",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "dynasty_tong",
        "name": "quân Tống",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_song_nhu_nguyet",
        "name": "sông Như Nguyệt",
        "type": "LOCATION",
        "aliases": []
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_phong_tuyen_nhu_nguyet",
        "relationType": "LED_BY",
        "targetEntityId": "person_ly_thuong_kiet"
      },
      {
        "sourceEntityId": "event_phong_tuyen_nhu_nguyet",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_nhu_nguyet"
      }
    ],
    "notes": "Ly Thuong Kiet on Nhu Nguyet River"
  },
  {
    "id": "TC_EP04_003",
    "epochId": "EPOCH_04",
    "sourceText": "Bài thơ Nam quốc sơn hà được vang lên bên sông Như Nguyệt khích lệ tướng sĩ nhà Lý.",
    "entities": [
      {
        "id": "doc_nam_quoc_son_ha",
        "name": "Nam quốc sơn hà",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "loc_song_nhu_nguyet",
        "name": "sông Như Nguyệt",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "nhà Lý",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "doc_nam_quoc_son_ha",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ly"
      },
      {
        "sourceEntityId": "doc_nam_quoc_son_ha",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_nhu_nguyet"
      }
    ],
    "notes": "Nam Quoc Son Ha poem"
  },
  {
    "id": "TC_EP04_004",
    "epochId": "EPOCH_04",
    "sourceText": "Thái úy Lý Thường Kiệt có tên khai sinh là Ngô Tuấn lập nhiều công lao hiển hách cho nhà Lý.",
    "entities": [
      {
        "id": "person_ly_thuong_kiet",
        "name": "Lý Thường Kiệt",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ngo_tuan",
        "name": "Ngô Tuấn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "nhà Lý",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_tuan",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_ly_thuong_kiet"
      },
      {
        "sourceEntityId": "person_ly_thuong_kiet",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ly"
      }
    ],
    "notes": "Ngo Tuan alias of Ly Thuong Kiet"
  },
  {
    "id": "TC_EP04_005",
    "epochId": "EPOCH_04",
    "sourceText": "Vua Lý Thái Tổ truyền ngôi báu cho con trai trưởng là thái tử Lý Phật Mã tức vua Lý Thái Tông.",
    "entities": [
      {
        "id": "person_ly_thai_to",
        "name": "Lý Thái Tổ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ly_thai_tong",
        "name": "Lý Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ly_phat_ma",
        "name": "Lý Phật Mã",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_thai_tong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_ly_thai_to"
      },
      {
        "sourceEntityId": "person_ly_phat_ma",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_ly_thai_tong"
      }
    ],
    "notes": "Ly Thai Tong succession from Ly Thai To"
  },
  {
    "id": "TC_EP04_006",
    "epochId": "EPOCH_04",
    "sourceText": "Kinh thành Thăng Long được vua Lý Công Uẩn định đô năm 1010 nay là thủ đô Hà Nội.",
    "entities": [
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      },
      {
        "id": "person_ly_thai_to",
        "name": "Lý Công Uẩn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_ha_noi",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_thang_long",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_ha_noi"
      },
      {
        "sourceEntityId": "person_ly_thai_to",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Thang Long corresponds to modern Ha Noi"
  },
  {
    "id": "TC_EP04_007",
    "epochId": "EPOCH_04",
    "sourceText": "Sử gia Ngô Sĩ Liên trong Đại Việt Sử Ký Toàn Thư khen ngợi vua Lý Nhân Tông là bậc vua hiền triết.",
    "entities": [
      {
        "id": "person_ngo_si_lien",
        "name": "Ngô Sĩ Liên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky_toan_thu",
        "name": "Đại Việt Sử Ký Toàn Thư",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_ly_nhan_tong",
        "name": "Lý Nhân Tông",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      },
      {
        "sourceEntityId": "person_ly_nhan_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      }
    ],
    "notes": "Ngo Si Lien praise for Ly Nhan Tong in Toan Thu"
  },
  {
    "id": "TC_EP04_008",
    "epochId": "EPOCH_04",
    "sourceText": "Nghệ thuật làm gốm men ngọc và điêu khắc rồng thời Lý mang nét uyển chuyển thanh thoát trên gốm sứ Thăng Long.",
    "entities": [
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Ly art and pottery description, zero triples"
  },
  {
    "id": "TC_EP04_009_OCR_SPACING",
    "epochId": "EPOCH_04",
    "sourceText": "Thái sư Lê Văn Thịnh đỗ thủ khoa thi Minh kinh bác học đời vua Lý Nhân Tông tại Thăng Long.",
    "entities": [
      {
        "id": "person_le_van_thinh",
        "name": "Lê Văn Thịnh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ly_nhan_tong",
        "name": "Lý Nhân Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_van_thinh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Imperial examination rank and royal administration"
  },
  {
    "id": "TC_EP04_010_BIBLIO_METADATA",
    "epochId": "EPOCH_04",
    "sourceText": "Sách Thiền Uyển Tập Anh ghi lại hành trạng của quốc sư Vạn Hạnh phò tá triều nhà Lý tại Thăng Long.",
    "entities": [
      {
        "id": "doc_thien_uyen_tap_anh",
        "name": "Thiền Uyển Tập Anh",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_van_hanh",
        "name": "Vạn Hạnh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "nhà Lý",
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
        "sourceEntityId": "person_van_hanh",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ly"
      },
      {
        "sourceEntityId": "person_van_hanh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_thien_uyen_tap_anh"
      },
      {
        "sourceEntityId": "person_van_hanh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Buddhist chronicle historiography test"
  },
  {
    "id": "TC_EP05_001",
    "epochId": "EPOCH_05",
    "sourceText": "Trần Hưng Đạo viết Hịch tướng sĩ khích lệ quân dân nhà Trần trước cuộc kháng chiến chống quân Nguyên.",
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Hưng Đạo",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trần Quốc Tuấn"
        ]
      },
      {
        "id": "doc_hich_tuong_si",
        "name": "Hịch tướng sĩ",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "org_quan_nguyen_mong",
        "name": "quân Nguyên",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hich_tuong_si"
      },
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "doc_hich_tuong_si",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_tran"
      }
    ],
    "notes": "Hich Tuong Si by Tran Hung Dao"
  },
  {
    "id": "TC_EP05_002",
    "epochId": "EPOCH_05",
    "sourceText": "Trận Bạch Đằng năm 1288 do Hưng Đạo Đại Vương chỉ huy trên sông Bạch Đằng đánh tan quân Nguyên.",
    "entities": [
      {
        "id": "event_bach_dang_1288",
        "name": "Trận Bạch Đằng năm 1288",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "person_tran_hung_dao",
        "name": "Hưng Đạo Đại Vương",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trần Quốc Tuấn"
        ]
      },
      {
        "id": "loc_song_bach_dang",
        "name": "sông Bạch Đằng",
        "type": "LOCATION"
      },
      {
        "id": "org_quan_nguyen_mong",
        "name": "quân Nguyên",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_bach_dang_1288",
        "relationType": "LED_BY",
        "targetEntityId": "person_tran_hung_dao"
      },
      {
        "sourceEntityId": "event_bach_dang_1288",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_bach_dang"
      }
    ],
    "notes": "Battle of Bach Dang 1288"
  },
  {
    "id": "TC_EP05_003",
    "epochId": "EPOCH_05",
    "sourceText": "Trần Quốc Tuấn được triều đình nhà Trần tôn phong danh hiệu Hưng Đạo Đại Vương.",
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Quốc Tuấn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_hung_dao_dai_vuong",
        "name": "Hưng Đạo Đại Vương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "nhà Trần",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_hung_dao_dai_vuong",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_tran_hung_dao"
      },
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      }
    ],
    "notes": "Hung Dao Dai Vuong alias of Tran Quoc Tuan"
  },
  {
    "id": "TC_EP05_004",
    "epochId": "EPOCH_05",
    "sourceText": "Vua Trần Thái Tông truyền ngôi cho con trai là thái tử Trần Hoảng tức vua Trần Thánh Tông.",
    "entities": [
      {
        "id": "person_tran_thai_tong",
        "name": "Trần Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_tran_thanh_tong",
        "name": "Trần Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_tran_hoang",
        "name": "Trần Hoảng",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_thanh_tong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_tran_thai_tong"
      },
      {
        "sourceEntityId": "person_tran_hoang",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_tran_thanh_tong"
      }
    ],
    "notes": "Tran Thanh Tong succession from Tran Thai Tong"
  },
  {
    "id": "TC_EP05_005",
    "epochId": "EPOCH_05",
    "sourceText": "Vùng đất Vạn Kiếp bản doanh của Trần Hưng Đạo thời Trần nay thuộc thành phố Chí Linh tỉnh Hải Dương.",
    "entities": [
      {
        "id": "loc_van_kiep",
        "name": "Vạn Kiếp",
        "type": "LOCATION"
      },
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Hưng Đạo",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "thời Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_chi_linh",
        "name": "Chí Linh",
        "type": "LOCATION"
      },
      {
        "id": "loc_hai_duong",
        "name": "Hải Dương",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_van_kiep"
      },
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "loc_van_kiep",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_chi_linh"
      },
      {
        "sourceEntityId": "loc_chi_linh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hai_duong"
      }
    ],
    "notes": "Van Kiep military headquarters in Chi Linh Hai Duong"
  },
  {
    "id": "TC_EP05_006",
    "epochId": "EPOCH_05",
    "sourceText": "Trần Nhân Tông lên núi Yên Tử tu hành và sáng lập Thiền phái Trúc Lâm thời nhà Trần.",
    "entities": [
      {
        "id": "person_tran_nhan_tong",
        "name": "Trần Nhân Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_yen_tu",
        "name": "núi Yên Tử",
        "type": "LOCATION",
        "aliases": [
          "Yên Tử"
        ]
      },
      {
        "id": "org_thien_phai_truc_lam",
        "name": "Thiền phái Trúc Lâm",
        "type": "ORGANIZATION"
      },
      {
        "id": "dynasty_nha_tran",
        "name": "nhà Trần",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_nhan_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_yen_tu"
      },
      {
        "sourceEntityId": "person_tran_nhan_tong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "org_thien_phai_truc_lam",
        "relationType": "LED_BY",
        "targetEntityId": "person_tran_nhan_tong"
      },
      {
        "sourceEntityId": "person_tran_nhan_tong",
        "relationType": "PART_OF",
        "targetEntityId": "org_thien_phai_truc_lam"
      },
      {
        "sourceEntityId": "org_thien_phai_truc_lam",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "org_thien_phai_truc_lam",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_yen_tu"
      }
    ],
    "notes": "Tran Nhan Tong founds Truc Lam Zen at Yen Tu"
  },
  {
    "id": "TC_EP05_007",
    "epochId": "EPOCH_05",
    "sourceText": "Sử thần Lê Văn Hưu dâng bộ sách Đại Việt Sử Ký lên vua Trần Thánh Tông ghi chép chính sử nước nhà.",
    "entities": [
      {
        "id": "person_le_van_huu",
        "name": "Lê Văn Hưu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky",
        "name": "Đại Việt Sử Ký",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_tran_thanh_tong",
        "name": "Trần Thánh Tông",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_van_huu",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky"
      },
      {
        "sourceEntityId": "person_tran_thanh_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky"
      }
    ],
    "notes": "Le Van Huu presents Dai Viet Su Ky to Tran Thanh Tong"
  },
  {
    "id": "TC_EP05_008",
    "epochId": "EPOCH_05",
    "sourceText": "Bãi cọc gỗ lim trên sông Bạch Đằng được chôn sâu dưới lớp bùn lầy tạo cạm bẫy thủy chiến hiểm hóc.",
    "entities": [
      {
        "id": "loc_song_bach_dang",
        "name": "sông Bạch Đằng",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Archeological description of wooden stakes, zero battle triples"
  },
  {
    "id": "TC_EP05_009_OCR_SPACING",
    "epochId": "EPOCH_05",
    "sourceText": "Vua Trần Nhân Tông nhường ngôi cho thái tử Trần Anh Tông rồi xuất gia tu hành tại núi Yên Tử.",
    "entities": [
      {
        "id": "person_tran_nhan_tong",
        "name": "Trần Nhân Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_tran_anh_tong",
        "name": "Trần Anh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_yen_tu",
        "name": "núi Yên Tử",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_anh_tong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_tran_nhan_tong"
      },
      {
        "sourceEntityId": "person_tran_nhan_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_yen_tu"
      }
    ],
    "notes": "Royal abdication lineage and Zen Buddhist mountain monastery"
  },
  {
    "id": "TC_EP05_010_HEADING_BLEED",
    "epochId": "EPOCH_05",
    "sourceText": "Trần Quốc Tuấn thống lĩnh quân đội nhà Trần ba lần đánh tan quân xâm lược phương Bắc. #### Chiến Trận",
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Quốc Tuấn",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Trần Hưng Đạo"
        ]
      },
      {
        "id": "dynasty_nha_tran",
        "name": "nhà Trần",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      }
    ],
    "notes": "Heading bleed-in during military command narrative"
  },
  {
    "id": "TC_EP06_001",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Quý Ly lập ra triều đại nhà Hồ và cho xây dựng Thành Tây Đô tại Thanh Hóa.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Quý Ly"
        ]
      },
      {
        "id": "dynasty_nha_ho",
        "name": "nhà Hồ",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thanh_tay_do",
        "name": "Thành Tây Đô",
        "type": "LOCATION",
        "aliases": [
          "Thành nhà Hồ"
        ]
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_quy_ly",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ho"
      },
      {
        "sourceEntityId": "loc_thanh_tay_do",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      },
      {
        "sourceEntityId": "person_ho_quy_ly",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_tay_do"
      }
    ],
    "notes": "Ho Quy Ly and Citadel of Ho Dynasty"
  },
  {
    "id": "TC_EP06_002",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Quý Ly vốn mang tên khai sinh là Lê Quý Ly trước khi đổi sang họ Hồ.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_quy_ly",
        "name": "Lê Quý Ly",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_quy_ly",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_ho_quy_ly"
      }
    ],
    "notes": "Le Quy Ly alias of Ho Quy Ly"
  },
  {
    "id": "TC_EP06_003",
    "epochId": "EPOCH_06",
    "sourceText": "Vua Hồ Quý Ly nhường ngôi cho con trai là Hồ Hán Thương nối nghiệp trị vì nhà Hồ.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_ho_han_thuong",
        "name": "Hồ Hán Thương",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_han_thuong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_ho_quy_ly"
      },
      {
        "sourceEntityId": "person_ho_han_thuong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ho"
      }
    ],
    "notes": "Ho Han Thuong succession from Ho Quy Ly"
  },
  {
    "id": "TC_EP06_004",
    "epochId": "EPOCH_06",
    "sourceText": "Di tích Thành Tây Đô của nhà Hồ nay nằm trên địa phận huyện Vĩnh Lộc tỉnh Thanh Hóa.",
    "entities": [
      {
        "id": "loc_thanh_tay_do",
        "name": "Thành Tây Đô",
        "type": "LOCATION"
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
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_thanh_tay_do",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_vinh_loc"
      },
      {
        "sourceEntityId": "loc_vinh_loc",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Citadel of Ho corresponds to modern Vinh Loc Thanh Hoa"
  },
  {
    "id": "TC_EP06_005",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Nguyên Trừng sáng chế súng Thần cơ tăng cường hỏa lực phòng thủ cho nhà Hồ.",
    "entities": [
      {
        "id": "person_ho_nguyen_trung",
        "name": "Hồ Nguyên Trừng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_sung_than_co",
        "name": "súng Thần cơ",
        "type": "ARTIFACT",
        "aliases": [
          "Súng thần cơ"
        ]
      },
      {
        "id": "dynasty_nha_ho",
        "name": "nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_nguyen_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ho"
      },
      {
        "sourceEntityId": "artifact_sung_than_co",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ho"
      }
    ],
    "notes": "Ho Nguyen Trung invents fire cannon"
  },
  {
    "id": "TC_EP06_006",
    "epochId": "EPOCH_06",
    "sourceText": "Trận thành Đa Bang bùng nổ khi quân Minh do Trương Phụ chỉ huy tấn công phòng tuyến nhà Hồ.",
    "entities": [
      {
        "id": "event_thanh_da_bang",
        "name": "Trận thành Đa Bang",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "person_truong_phu",
        "name": "Trương Phụ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_thanh_da_bang",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ho"
      }
    ],
    "notes": "Battle of Da Bang citadel"
  },
  {
    "id": "TC_EP06_007",
    "epochId": "EPOCH_06",
    "sourceText": "Sử quan Ngô Sĩ Liên trong sách Đại Việt Sử Ký Toàn Thư luận bàn về việc phát hành tiền giấy thời nhà Hồ.",
    "entities": [
      {
        "id": "person_ngo_si_lien",
        "name": "Ngô Sĩ Liên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky_toan_thu",
        "name": "Đại Việt Sử Ký Toàn Thư",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_ho",
        "name": "nhà Hồ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      }
    ],
    "notes": "Ngo Si Lien commentary on Ho currency in Toan Thu"
  },
  {
    "id": "TC_EP06_008",
    "epochId": "EPOCH_06",
    "sourceText": "Những khối đá vôi Thanh Hóa được cắt gọt vuông vức xếp khít vào nhau mà không cần vôi vữa.",
    "entities": [
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Stone masonry architectural description, zero triples"
  },
  {
    "id": "TC_EP06_009_OCR_SPACING",
    "epochId": "EPOCH_06",
    "sourceText": "Vua Hồ Quý Ly cho đắp thành Tây Đô bằng đá khối kiên cố tại vùng đất Vĩnh Lộc thuộc Thanh Hóa.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_thanh_tay_do",
        "name": "thành Tây Đô",
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
        "sourceEntityId": "person_ho_quy_ly",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_tay_do"
      },
      {
        "sourceEntityId": "loc_thanh_tay_do",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Stone citadel construction and provincial location mapping"
  },
  {
    "id": "TC_EP06_010_TRUNCATED_CHRONICLE",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Nguyên Trừng nghiên cứu chế tạo súng thần cơ và thuyền chiến cổ lâu tăng cường phòng thủ quốc gia.",
    "entities": [
      {
        "id": "person_ho_nguyen_trung",
        "name": "Hồ Nguyên Trừng",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [],
    "notes": "Technological defense invention without relational target"
  },
  {
    "id": "TC_EP07_001",
    "epochId": "EPOCH_07",
    "sourceText": "Lê Lợi xưng Bình Định Vương lãnh đạo Khởi nghĩa Lam Sơn tại vùng núi Lam Sơn Thanh Hóa.",
    "entities": [
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Thái Tổ",
          "Bình Định Vương"
        ]
      },
      {
        "id": "event_khoi_nghia_lam_son",
        "name": "Khởi nghĩa Lam Sơn",
        "type": "EVENT_BATTLE"
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
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoi_nghia_lam_son",
        "relationType": "LED_BY",
        "targetEntityId": "person_le_loi"
      },
      {
        "sourceEntityId": "loc_lam_son",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      },
      {
        "sourceEntityId": "event_khoi_nghia_lam_son",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_lam_son"
      }
    ],
    "notes": "Le Loi launches Lam Son Uprising"
  },
  {
    "id": "TC_EP07_002",
    "epochId": "EPOCH_07",
    "sourceText": "Nguyễn Trãi dâng Bình Ngô sách vạch ra chiến lược đánh vào lòng người giúp nghĩa quân Lam Sơn.",
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
        "id": "doc_binh_ngo_sach",
        "name": "Bình Ngô sách",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "org_nghia_quan_lam_son",
        "name": "nghĩa quân Lam Sơn",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_binh_ngo_sach"
      },
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "PART_OF",
        "targetEntityId": "org_nghia_quan_lam_son"
      }
    ],
    "notes": "Nguyen Trai presents Binh Ngo Sach"
  },
  {
    "id": "TC_EP07_003",
    "epochId": "EPOCH_07",
    "sourceText": "Trận Tốt Động Chúc Động do nghĩa quân Lam Sơn chỉ huy đánh tan quân Minh tại Hà Tây.",
    "entities": [
      {
        "id": "event_tot_dong_chuc_dong",
        "name": "Trận Tốt Động Chúc Động",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "org_nghia_quan_lam_son",
        "name": "nghĩa quân Lam Sơn",
        "type": "ORGANIZATION"
      },
      {
        "id": "loc_ha_tay",
        "name": "Hà Tây",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_tot_dong_chuc_dong",
        "relationType": "LED_BY",
        "targetEntityId": "org_nghia_quan_lam_son"
      },
      {
        "sourceEntityId": "event_tot_dong_chuc_dong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_tay"
      }
    ],
    "notes": "Battle of Tot Dong Chuc Dong"
  },
  {
    "id": "TC_EP07_004",
    "epochId": "EPOCH_07",
    "sourceText": "Trận Chi Lăng Xương Giang chém Liễu Thăng tại Chi Lăng thuộc Lạng Sơn.",
    "entities": [
      {
        "id": "event_chi_lang_xuong_giang",
        "name": "Trận Chi Lăng Xương Giang",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "person_lieu_thang",
        "name": "Liễu Thăng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_chi_lang",
        "name": "Chi Lăng",
        "type": "LOCATION"
      },
      {
        "id": "loc_lang_son",
        "name": "Lạng Sơn",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_chi_lang_xuong_giang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_chi_lang"
      },
      {
        "sourceEntityId": "loc_chi_lang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_lang_son"
      }
    ],
    "notes": "Battle of Chi Lang Xuong Giang"
  },
  {
    "id": "TC_EP07_005",
    "epochId": "EPOCH_07",
    "sourceText": "Nguyễn Trãi soạn thảo Bình Ngô đại cáo bố cáo cho thiên hạ về nền độc lập của Đại Việt.",
    "entities": [
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_binh_ngo",
        "name": "Bình Ngô đại cáo",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_dai_viet",
        "name": "Đại Việt",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_binh_ngo"
      },
      {
        "sourceEntityId": "doc_binh_ngo",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_dai_viet"
      }
    ],
    "notes": "Nguyen Trai writes Binh Ngo Dai Cao"
  },
  {
    "id": "TC_EP07_006",
    "epochId": "EPOCH_07",
    "sourceText": "Căn cứ Lam Sơn nơi phát tích cuộc khởi nghĩa của vua Lê Lợi nay thuộc huyện Thọ Xuân tỉnh Thanh Hóa.",
    "entities": [
      {
        "id": "loc_lam_son",
        "name": "Lam Sơn",
        "type": "LOCATION"
      },
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_tho_xuan",
        "name": "Thọ Xuân",
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
        "sourceEntityId": "loc_lam_son",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_tho_xuan"
      },
      {
        "sourceEntityId": "loc_tho_xuan",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_lam_son"
      }
    ],
    "notes": "Lam Son corresponds to modern Tho Xuan Thanh Hoa"
  },
  {
    "id": "TC_EP07_007",
    "epochId": "EPOCH_07",
    "sourceText": "Nguyễn Trãi biên soạn tác phẩm Lam Sơn thực lục ghi lại chi tiết mười năm kháng chiến của vua Lê Thái Tổ.",
    "entities": [
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_lam_son_thuc_luc",
        "name": "Lam Sơn thực lục",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_le_loi",
        "name": "Lê Thái Tổ",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_lam_son_thuc_luc"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_lam_son_thuc_luc"
      }
    ],
    "notes": "Nguyen Trai writes Lam Son Thuc Luc for Le Thai To"
  },
  {
    "id": "TC_EP07_008",
    "epochId": "EPOCH_07",
    "sourceText": "Vùng núi Chí Linh hiểm trở cây rừng rậm rạp là nơi nghĩa quân từng chịu cảnh tuyệt lương ba lần.",
    "entities": [
      {
        "id": "loc_chi_linh",
        "name": "núi Chí Linh",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Rugged mountain terrain description, zero triples"
  },
  {
    "id": "TC_EP07_009_OCR_SPACING",
    "epochId": "EPOCH_07",
    "sourceText": "Nguyễn Trãi theo Bình Định Vương Lê Lợi dấy binh Khởi nghĩa Lam Sơn tại đất Thanh Hóa.",
    "entities": [
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Bình Định Vương"
        ]
      },
      {
        "id": "event_khoi_nghia_lam_son",
        "name": "Khởi nghĩa Lam Sơn",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_thanh_hoa",
        "name": "Thanh Hóa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoi_nghia_lam_son",
        "relationType": "LED_BY",
        "targetEntityId": "person_le_loi"
      },
      {
        "sourceEntityId": "event_khoi_nghia_lam_son",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_hoa"
      }
    ],
    "notes": "Insurrection leadership and strategist participation"
  },
  {
    "id": "TC_EP07_010_METADATA_PREFIX",
    "epochId": "EPOCH_07",
    "sourceText": "Tựa sách: Lam Sơn thực lục ghi công tích tướng quân Lê Lai liều mình cứu chúa tại núi Chí Linh.",
    "entities": [
      {
        "id": "doc_lam_son_thuc_luc",
        "name": "Lam Sơn thực lục",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_le_lai",
        "name": "Lê Lai",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_chi_linh",
        "name": "Chí Linh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_lai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_lam_son_thuc_luc"
      },
      {
        "sourceEntityId": "person_le_lai",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_chi_linh"
      }
    ],
    "notes": "Martyr narrative and royal chronicle record"
  },
  {
    "id": "TC_EP08_001",
    "epochId": "EPOCH_08",
    "sourceText": "Lê Thái Tổ lên ngôi hoàng đế sáng lập triều đại nhà Lê Sơ và định đô tại Thăng Long.",
    "entities": [
      {
        "id": "person_le_loi",
        "name": "Lê Thái Tổ",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Lê Lợi"
        ]
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION",
        "aliases": [
          "Đông Kinh"
        ]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Le Thai To establishes Le So dynasty"
  },
  {
    "id": "TC_EP08_002",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thánh Tông ban hành Bộ luật Hồng Đức nhằm kiện toàn thể chế nhà Lê Sơ.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_luat_hong_duc",
        "name": "Bộ luật Hồng Đức",
        "type": "DOCUMENT_CULTURE",
        "aliases": [
          "Quốc triều hình luật"
        ]
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_luat_hong_duc"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      }
    ],
    "notes": "Le Thánh Tông and Hong Duc Code"
  },
  {
    "id": "TC_EP08_003",
    "epochId": "EPOCH_08",
    "sourceText": "Lê Lợi sau khi quét sạch giặc Minh lên ngôi hoàng đế lấy tôn hiệu là Lê Thái Tổ.",
    "entities": [
      {
        "id": "person_le_loi",
        "name": "Lê Lợi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_thai_to",
        "name": "Lê Thái Tổ",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thai_to",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_le_loi"
      }
    ],
    "notes": "Le Loi alias Le Thai To"
  },
  {
    "id": "TC_EP08_004",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thái Tổ truyền ngôi cho con trai thứ là thái tử Lê Nguyên Long tức vua Lê Thái Tông.",
    "entities": [
      {
        "id": "person_le_loi",
        "name": "Lê Thái Tổ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_thai_tong",
        "name": "Lê Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_nguyen_long",
        "name": "Lê Nguyên Long",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thai_tong",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_le_loi"
      },
      {
        "sourceEntityId": "person_le_nguyen_long",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_le_thai_tong"
      }
    ],
    "notes": "Le Thai Tong succession from Le Thai To"
  },
  {
    "id": "TC_EP08_005",
    "epochId": "EPOCH_08",
    "sourceText": "Kinh thành Đông Kinh của triều đại Lê Sơ ngày xưa nay là thủ đô Hà Nội.",
    "entities": [
      {
        "id": "loc_dong_kinh",
        "name": "Đông Kinh",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Lê Sơ",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_ha_noi",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_dong_kinh",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_ha_noi"
      }
    ],
    "notes": "Dong Kinh corresponds to modern Ha Noi"
  },
  {
    "id": "TC_EP08_006",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thánh Tông sáng lập Hội Tao Đàn tại Thăng Long quy tụ hai mươi tám vị tiến sĩ tài hoa.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_hoi_tao_dan",
        "name": "Hội Tao Đàn",
        "type": "ORGANIZATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "PART_OF",
        "targetEntityId": "org_hoi_tao_dan"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Tao Dan literary society under Le Thanh Tong"
  },
  {
    "id": "TC_EP08_007",
    "epochId": "EPOCH_08",
    "sourceText": "Sử thần Ngô Sĩ Liên vâng mệnh vua Lê Thánh Tông hoàn thành bộ quốc sử Đại Việt Sử Ký Toàn Thư.",
    "entities": [
      {
        "id": "person_ngo_si_lien",
        "name": "Ngô Sĩ Liên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky_toan_thu",
        "name": "Đại Việt Sử Ký Toàn Thư",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      }
    ],
    "notes": "Ngo Si Lien completes Toan Thu under Le Thanh Tong"
  },
  {
    "id": "TC_EP08_008",
    "epochId": "EPOCH_08",
    "sourceText": "Tấm bia đá tiến sĩ tại Văn Miếu Thăng Long được dựng trên lưng rùa đá sừng sững qua hàng thế kỷ.",
    "entities": [
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Stone steles description, zero triples"
  },
  {
    "id": "TC_EP08_009_OCR_SPACING",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thánh Tông đích thân sáng lập Hội Tao Đàn xướng họa thi ca tại kinh thành Thăng Long.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_hoi_tao_dan",
        "name": "Hội Tao Đàn",
        "type": "ORGANIZATION"
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "org_hoi_tao_dan",
        "relationType": "LED_BY",
        "targetEntityId": "person_le_thanh_tong"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Literary academy foundation by monarch"
  },
  {
    "id": "TC_EP08_010_HEADING_BLEED",
    "epochId": "EPOCH_08",
    "sourceText": "Ngô Sĩ Liên biên soạn xong bộ Đại Việt Sử Ký Toàn Thư dưới triều đại nhà Lê Sơ. #### Quốc Sử",
    "entities": [
      {
        "id": "person_ngo_si_lien",
        "name": "Ngô Sĩ Liên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_dai_viet_su_ky_toan_thu",
        "name": "Đại Việt Sử Ký Toàn Thư",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "nhà Lê Sơ",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_dai_viet_su_ky_toan_thu"
      },
      {
        "sourceEntityId": "person_ngo_si_lien",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      }
    ],
    "notes": "Historiographer dynastic attribution and heading bleed"
  },
  {
    "id": "TC_EP09_001",
    "epochId": "EPOCH_09",
    "sourceText": "Mạc Đăng Dung lập ra nhà Mạc định đô tại Thăng Long mở đầu thời kỳ Nam Bắc Triều.",
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
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nam_bac_trieu",
        "name": "Nam Bắc Triều",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_mac_dang_dung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_mac"
      },
      {
        "sourceEntityId": "person_mac_dang_dung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Mac Dang Dung founds Mac dynasty in Thang Long"
  },
  {
    "id": "TC_EP09_002",
    "epochId": "EPOCH_09",
    "sourceText": "Nguyễn Hoàng vào trấn thủ xứ Thuận Hóa mở mang bờ cõi đặt nền móng cho Đàng Trong.",
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
        "id": "loc_thuan_hoa",
        "name": "Thuận Hóa",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_dang_trong",
        "name": "Đàng Trong",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_hoang",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_dang_trong"
      },
      {
        "sourceEntityId": "person_nguyen_hoang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thuan_hoa"
      }
    ],
    "notes": "Nguyen Hoang enters Thuan Hoa establishing Dang Trong"
  },
  {
    "id": "TC_EP09_003",
    "epochId": "EPOCH_09",
    "sourceText": "Trịnh Kiểm phụ chính triều đình Lê Trung Hưng tạo lập quyền lực cho dòng Chúa Trịnh ở Đàng Ngoài.",
    "entities": [
      {
        "id": "person_trinh_kiem",
        "name": "Trịnh Kiểm",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_chua_trinh",
        "name": "Chúa Trịnh",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "dynasty_dang_ngoai",
        "name": "Đàng Ngoài",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_trinh_kiem",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_chua_trinh"
      },
      {
        "sourceEntityId": "person_trinh_kiem",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_dang_ngoai"
      }
    ],
    "notes": "Trinh Kiem founds Trinh lords dominance"
  },
  {
    "id": "TC_EP09_004",
    "epochId": "EPOCH_09",
    "sourceText": "Chúa Nguyễn Hoàng truyền lại cơ nghiệp Đàng Trong cho con trai là chúa Nguyễn Phúc Nguyên.",
    "entities": [
      {
        "id": "person_nguyen_hoang",
        "name": "Nguyễn Hoàng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_phuc_nguyen",
        "name": "Nguyễn Phúc Nguyên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_dang_trong",
        "name": "Đàng Trong",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_phuc_nguyen",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_nguyen_hoang"
      },
      {
        "sourceEntityId": "person_nguyen_phuc_nguyen",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_dang_trong"
      }
    ],
    "notes": "Nguyen Phuc Nguyen succession from Nguyen Hoang"
  },
  {
    "id": "TC_EP09_005",
    "epochId": "EPOCH_09",
    "sourceText": "Chúa Nguyễn Hoàng được quân dân Đàng Trong tôn kính gọi bằng danh xưng Chúa Tiên.",
    "entities": [
      {
        "id": "person_nguyen_hoang",
        "name": "Nguyễn Hoàng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_chua_tien",
        "name": "Chúa Tiên",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_chua_tien",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_nguyen_hoang"
      }
    ],
    "notes": "Chua Tien alias of Nguyen Hoang"
  },
  {
    "id": "TC_EP09_006",
    "epochId": "EPOCH_09",
    "sourceText": "Phủ Gia Định do Lễ Thành Hầu Nguyễn Hữu Cảnh kinh lược thiết lập nay là Thành phố Hồ Chí Minh.",
    "entities": [
      {
        "id": "loc_gia_dinh",
        "name": "Gia Định",
        "type": "LOCATION"
      },
      {
        "id": "person_nguyen_huu_canh",
        "name": "Nguyễn Hữu Cảnh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_sai_gon",
        "name": "Thành phố Hồ Chí Minh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_gia_dinh",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_sai_gon"
      },
      {
        "sourceEntityId": "person_nguyen_huu_canh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_gia_dinh"
      }
    ],
    "notes": "Gia Dinh corresponds to modern Ho Chi Minh City"
  },
  {
    "id": "TC_EP09_007",
    "epochId": "EPOCH_09",
    "sourceText": "Bác học Lê Quý Đôn biên soạn sách Phủ Biên Tạp Lục khảo cứu chi tiết về địa lý Đàng Trong.",
    "entities": [
      {
        "id": "person_le_quy_don",
        "name": "Lê Quý Đôn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_phu_bien_tap_luc",
        "name": "Phủ Biên Tạp Lục",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_dang_trong",
        "name": "Đàng Trong",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_quy_don",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_phu_bien_tap_luc"
      }
    ],
    "notes": "Le Quy Don writes Phu Bien Tap Luc"
  },
  {
    "id": "TC_EP09_008",
    "epochId": "EPOCH_09",
    "sourceText": "Hệ thống lũy Thầy kiên cố ngăn cách đôi bờ sông Gianh chia cắt đất nước suốt nhiều thập kỷ.",
    "entities": [
      {
        "id": "loc_song_gianh",
        "name": "sông Gianh",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Defensive wall description along Gianh River, zero triples"
  },
  {
    "id": "TC_EP09_009_OCR_SPACING",
    "epochId": "EPOCH_09",
    "sourceText": "Chúa Nguyễn Phúc Nguyên nối nghiệp chúa Nguyễn Hoàng xây dựng lũy Thầy tại Quảng Bình kiên cố.",
    "entities": [
      {
        "id": "person_nguyen_phuc_nguyen",
        "name": "Nguyễn Phúc Nguyên",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_hoang",
        "name": "Nguyễn Hoàng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_quang_binh",
        "name": "Quảng Bình",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_phuc_nguyen",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_nguyen_hoang"
      },
      {
        "sourceEntityId": "person_nguyen_phuc_nguyen",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_quang_binh"
      }
    ],
    "notes": "Lord succession lineage and defensive wall construction"
  },
  {
    "id": "TC_EP09_010_BIBLIO_METADATA",
    "epochId": "EPOCH_09",
    "sourceText": "Sách Phủ Biên Tạp Lục của Lê Quý Đôn khảo tả tường tận xứ Đàng Trong và quần đảo Hoàng Sa.",
    "entities": [
      {
        "id": "doc_phu_bien_tap_luc",
        "name": "Phủ Biên Tạp Lục",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_le_quy_don",
        "name": "Lê Quý Đôn",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_hoang_sa",
        "name": "quần đảo Hoàng Sa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_quy_don",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_phu_bien_tap_luc"
      }
    ],
    "notes": "Sovereignty survey documentation by polymath"
  },
  {
    "id": "TC_EP10_001",
    "epochId": "EPOCH_10",
    "sourceText": "Vua Quang Trung chỉ huy Trận Ngọc Hồi Đống Đa đại phá hai mươi vạn quân Thanh tại Thăng Long.",
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nguyễn Huệ"
        ]
      },
      {
        "id": "event_ngoc_hoi_dong_da",
        "name": "Trận Ngọc Hồi Đống Đa",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "dynasty_nha_thanh",
        "name": "quân Thanh",
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
        "sourceEntityId": "event_ngoc_hoi_dong_da",
        "relationType": "LED_BY",
        "targetEntityId": "person_quang_trung"
      },
      {
        "sourceEntityId": "event_ngoc_hoi_dong_da",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Quang Trung at Ngoc Hoi Dong Da battle"
  },
  {
    "id": "TC_EP10_002",
    "epochId": "EPOCH_10",
    "sourceText": "Nguyễn Huệ chỉ huy Trận Rạch Gầm Xoài Mút tiêu diệt năm vạn quân Xiêm trên sông Tiền Giang.",
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
        "id": "event_rach_gam_xoai_mut",
        "name": "Trận Rạch Gầm Xoài Mút",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "dynasty_xiem_la",
        "name": "quân Xiêm",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_tien_giang",
        "name": "sông Tiền Giang",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_rach_gam_xoai_mut",
        "relationType": "LED_BY",
        "targetEntityId": "person_quang_trung"
      },
      {
        "sourceEntityId": "event_rach_gam_xoai_mut",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_tien_giang"
      }
    ],
    "notes": "Rach Gam Xoai Mut battle led by Nguyen Hue"
  },
  {
    "id": "TC_EP10_003",
    "epochId": "EPOCH_10",
    "sourceText": "Nguyễn Huệ xưng hoàng đế lấy niên hiệu là Quang Trung thống lĩnh vương triều nhà Tây Sơn.",
    "entities": [
      {
        "id": "person_nguyen_hue",
        "name": "Nguyễn Huệ",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "nhà Tây Sơn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_hue",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_quang_trung"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tay_son"
      }
    ],
    "notes": "Nguyen Hue alias Quang Trung in Tay Son dynasty"
  },
  {
    "id": "TC_EP10_004",
    "epochId": "EPOCH_10",
    "sourceText": "Vua Quang Trung truyền ngôi báu cho con trai là thái tử Nguyễn Quang Toản tức vua Cảnh Thịnh.",
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_quang_toan",
        "name": "Nguyễn Quang Toản",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_canh_thinh",
        "name": "Cảnh Thịnh",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_quang_toan",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_quang_trung"
      },
      {
        "sourceEntityId": "person_canh_thinh",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_nguyen_quang_toan"
      }
    ],
    "notes": "Nguyen Quang Toan succession from Quang Trung"
  },
  {
    "id": "TC_EP10_005",
    "epochId": "EPOCH_10",
    "sourceText": "Kinh thành Phú Xuân tổng hành dinh của phong trào Tây Sơn xưa nay là thành phố Huế.",
    "entities": [
      {
        "id": "loc_phu_xuan",
        "name": "Phú Xuân",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Tây Sơn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_hue",
        "name": "Huế",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_phu_xuan",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_hue"
      }
    ],
    "notes": "Phu Xuan corresponds to modern Hue"
  },
  {
    "id": "TC_EP10_006",
    "epochId": "EPOCH_10",
    "sourceText": "Danh sĩ Ngô Thì Nhậm dốc lòng phò tá vua Quang Trung xây dựng nền văn trị thời Tây Sơn.",
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
        "name": "Tây Sơn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ngo_thi_nham",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tay_son"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tay_son"
      }
    ],
    "notes": "Ngo Thi Nham in Tay Son administration"
  },
  {
    "id": "TC_EP10_007",
    "epochId": "EPOCH_10",
    "sourceText": "Tiểu thuyết lịch sử Hoàng Lê Nhất Thống Chí do Ngô Gia Văn Phái biên soạn mô tả chiến thắng của vua Quang Trung.",
    "entities": [
      {
        "id": "doc_hoang_le_nhat_thong_chi",
        "name": "Hoàng Lê Nhất Thống Chí",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "org_ngo_gia_van_phai",
        "name": "Ngô Gia Văn Phái",
        "type": "ORGANIZATION"
      },
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "org_ngo_gia_van_phai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hoang_le_nhat_thong_chi"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hoang_le_nhat_thong_chi"
      }
    ],
    "notes": "Ngo Gia Van Phai and Hoang Le Nhat Thong Chi"
  },
  {
    "id": "TC_EP10_008",
    "epochId": "EPOCH_10",
    "sourceText": "Đội tượng binh Tây Sơn được huấn luyện thuần thục mang đại bác nã đạn xé toạc phòng tuyến địch.",
    "entities": [
      {
        "id": "org_tuong_binh_tay_son",
        "name": "tượng binh Tây Sơn",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: War elephant tactics description, zero triples"
  },
  {
    "id": "TC_EP10_009_OCR_SPACING",
    "epochId": "EPOCH_10",
    "sourceText": "Quang Trung Nguyễn Huệ thống lĩnh đại quân thần tốc tiến ra Thăng Long đại phá hai mươi vạn quân Thanh.",
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
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Speedy campaign liberation of Thang Long"
  },
  {
    "id": "TC_EP10_010_HEADING_BLEED",
    "epochId": "EPOCH_10",
    "sourceText": "Hoàng Lê Nhất Thống Chí miêu tả chi tiết chiến thắng Ngọc Hồi Đống Đa của vua Quang Trung. #### Hồi 14",
    "entities": [
      {
        "id": "doc_hoang_le_nhat_thong_chi",
        "name": "Hoàng Lê Nhất Thống Chí",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_quang_trung",
        "name": "Quang Trung",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hoang_le_nhat_thong_chi"
      }
    ],
    "notes": "Historical novel documentation with chapter heading bleed"
  },
  {
    "id": "TC_EP11_001",
    "epochId": "EPOCH_11",
    "sourceText": "Nguyễn Ánh lên ngôi Hoàng đế Gia Long lập nên triều đại nhà Nguyễn và định đô ở Phú Xuân.",
    "entities": [
      {
        "id": "person_nguyen_anh",
        "name": "Nguyễn Ánh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_gia_long",
        "name": "Gia Long",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "nhà Nguyễn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_phu_xuan",
        "name": "Phú Xuân",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_anh",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_gia_long"
      },
      {
        "sourceEntityId": "person_gia_long",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      },
      {
        "sourceEntityId": "person_gia_long",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phu_xuan"
      }
    ],
    "notes": "Gia Long establishes Nguyen dynasty in Phu Xuan"
  },
  {
    "id": "TC_EP11_002",
    "epochId": "EPOCH_11",
    "sourceText": "Vua Minh Mạng tiến hành cải cách hành chính chia đất nước thành ba mươi tỉnh thời nhà Nguyễn.",
    "entities": [
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "nhà Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      }
    ],
    "notes": "Minh Mang administrative reform"
  },
  {
    "id": "TC_EP11_003",
    "epochId": "EPOCH_11",
    "sourceText": "Vua Gia Long truyền ngôi báu triều Nguyễn cho con trai thứ tư là hoàng tử Nguyễn Phúc Đảm tức vua Minh Mạng.",
    "entities": [
      {
        "id": "person_gia_long",
        "name": "Gia Long",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_phuc_dam",
        "name": "Nguyễn Phúc Đảm",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "triều Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_gia_long"
      },
      {
        "sourceEntityId": "person_nguyen_phuc_dam",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_minh_mang"
      },
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      }
    ],
    "notes": "Minh Mang succession from Gia Long"
  },
  {
    "id": "TC_EP11_004",
    "epochId": "EPOCH_11",
    "sourceText": "Kinh đô Phú Xuân của vương triều nhà Nguyễn nay là thành phố Huế tỉnh Thừa Thiên Huế.",
    "entities": [
      {
        "id": "loc_phu_xuan",
        "name": "Phú Xuân",
        "type": "LOCATION"
      },
      {
        "id": "loc_hue",
        "name": "Huế",
        "type": "LOCATION"
      },
      {
        "id": "loc_thua_thien_hue",
        "name": "Thừa Thiên Huế",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_phu_xuan",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_hue"
      },
      {
        "sourceEntityId": "loc_hue",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thua_thien_hue"
      }
    ],
    "notes": "Phu Xuan corresponds to modern Hue"
  },
  {
    "id": "TC_EP11_005",
    "epochId": "EPOCH_11",
    "sourceText": "Đại thi hào Nguyễn Du sáng tác tác phẩm Truyện Kiều dưới thời vua Gia Long triều nhà Nguyễn.",
    "entities": [
      {
        "id": "person_nguyen_du",
        "name": "Nguyễn Du",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_truyen_kieu",
        "name": "Truyện Kiều",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_gia_long",
        "name": "Gia Long",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "nhà Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_du",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_truyen_kieu"
      },
      {
        "sourceEntityId": "doc_truyen_kieu",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_nguyen"
      },
      {
        "sourceEntityId": "person_gia_long",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      }
    ],
    "notes": "Nguyen Du authors Truyen Kieu in Nguyen dynasty"
  },
  {
    "id": "TC_EP11_006",
    "epochId": "EPOCH_11",
    "sourceText": "Vua Tự Đức cho xây dựng Khiêm Lăng tại Huế làm nơi an nghỉ ngàn thu.",
    "entities": [
      {
        "id": "person_tu_duc",
        "name": "Tự Đức",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_khiem_lang",
        "name": "Khiêm Lăng",
        "type": "LOCATION"
      },
      {
        "id": "loc_hue",
        "name": "Huế",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_khiem_lang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hue"
      },
      {
        "sourceEntityId": "person_tu_duc",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_khiem_lang"
      }
    ],
    "notes": "Tu Duc builds Khiem Tomb in Hue"
  },
  {
    "id": "TC_EP11_007",
    "epochId": "EPOCH_11",
    "sourceText": "Quốc Sử Quán triều Nguyễn biên soạn bộ chính sử đồ sộ Khâm Định Việt Sử Thông Giám Cương Mục.",
    "entities": [
      {
        "id": "org_quoc_su_quan",
        "name": "Quốc Sử Quán",
        "type": "ORGANIZATION"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "triều Nguyễn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "doc_kham_dinh_viet_su_thong_giam_cuong_muc",
        "name": "Khâm Định Việt Sử Thông Giám Cương Mục",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "org_quoc_su_quan",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      },
      {
        "sourceEntityId": "org_quoc_su_quan",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_kham_dinh_viet_su_thong_giam_cuong_muc"
      }
    ],
    "notes": "Quoc Su Quan compiles Cuong Muc"
  },
  {
    "id": "TC_EP11_008",
    "epochId": "EPOCH_11",
    "sourceText": "Chín đỉnh đồng khổng lồ được đúc thủ công tinh xảo đặt trang nghiêm trước sân Thế Miếu kinh thành Huế.",
    "entities": [
      {
        "id": "loc_hue",
        "name": "Huế",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Nine dynastic urns description in Hue citadel, zero triples"
  },
  {
    "id": "TC_EP11_009_OCR_SPACING",
    "epochId": "EPOCH_11",
    "sourceText": "Vua Minh Mạng cho đúc Cửu Đỉnh đặt trước sân Thế Miếu tại kinh thành Huế tôn nghiêm.",
    "entities": [
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_the_mieu",
        "name": "Thế Miếu",
        "type": "LOCATION"
      },
      {
        "id": "loc_hue",
        "name": "Huế",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_the_mieu"
      },
      {
        "sourceEntityId": "loc_the_mieu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hue"
      }
    ],
    "notes": "Nine Dynastic Urns casting and imperial temple complex"
  },
  {
    "id": "TC_EP11_010_METADATA_CHRONICLE",
    "epochId": "EPOCH_11",
    "sourceText": "Tựa sách: Khâm Định Việt Sử Thông Giám Cương Mục do Quốc Sử Quán triều Nguyễn biên soạn đồ sộ.",
    "entities": [
      {
        "id": "doc_kham_dinh_viet_su_thong_giam_cuong_muc",
        "name": "Khâm Định Việt Sử Thông Giám Cương Mục",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "org_quoc_su_quan",
        "name": "Quốc Sử Quán",
        "type": "ORGANIZATION"
      },
      {
        "id": "dynasty_nha_nguyen",
        "name": "triều Nguyễn",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "org_quoc_su_quan",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_kham_dinh_viet_su_thong_giam_cuong_muc"
      },
      {
        "sourceEntityId": "org_quoc_su_quan",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_nguyen"
      }
    ],
    "notes": "Imperial bureau historical compilation metadata"
  },
  {
    "id": "TC_EP12_001",
    "epochId": "EPOCH_12",
    "sourceText": "Trương Định lãnh đạo khởi nghĩa chống thực dân Pháp tại Tân An và Gò Công.",
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
        "id": "loc_tan_an",
        "name": "Tân An",
        "type": "LOCATION"
      },
      {
        "id": "loc_go_cong",
        "name": "Gò Công",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_truong_dinh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_tan_an"
      },
      {
        "sourceEntityId": "person_truong_dinh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_go_cong"
      }
    ],
    "notes": "Truong Dinh anti-French uprising in Go Cong"
  },
  {
    "id": "TC_EP12_002",
    "epochId": "EPOCH_12",
    "sourceText": "Phan Bội Châu khởi xướng Phong trào Đông Du đưa du học sinh sang Nhật Bản tìm đường cứu nước.",
    "entities": [
      {
        "id": "person_phan_boi_chau",
        "name": "Phan Bội Châu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_dong_du",
        "name": "Phong trào Đông Du",
        "type": "ORGANIZATION",
        "aliases": [
          "Đông Du"
        ]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_phan_boi_chau",
        "relationType": "PART_OF",
        "targetEntityId": "org_dong_du"
      }
    ],
    "notes": "Phan Boi Chau founds Dong Du movement"
  },
  {
    "id": "TC_EP12_003",
    "epochId": "EPOCH_12",
    "sourceText": "Phan Chu Trinh chủ xướng Phong trào Duy Tân nhằm khai dân trí, chấn dân khí, hậu dân sinh.",
    "entities": [
      {
        "id": "person_phan_chau_trinh",
        "name": "Phan Chu Trinh",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Phan Châu Trinh"
        ]
      },
      {
        "id": "org_hoi_duy_tan",
        "name": "Phong trào Duy Tân",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_phan_chau_trinh",
        "relationType": "PART_OF",
        "targetEntityId": "org_hoi_duy_tan"
      }
    ],
    "notes": "Phan Chau Trinh leads Duy Tan reform movement"
  },
  {
    "id": "TC_EP12_004",
    "epochId": "EPOCH_12",
    "sourceText": "Nguyễn Thái Học lãnh đạo Việt Nam Quốc Dân Đảng tổ chức Khởi nghĩa Yên Bái năm 1930.",
    "entities": [
      {
        "id": "person_nguyen_thai_hoc",
        "name": "Nguyễn Thái Học",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_viet_nam_quoc_dan_dang",
        "name": "Việt Nam Quốc Dân Đảng",
        "type": "ORGANIZATION"
      },
      {
        "id": "event_khoi_nghia_yen_bai",
        "name": "Khởi nghĩa Yên Bái",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_thai_hoc",
        "relationType": "PART_OF",
        "targetEntityId": "org_viet_nam_quoc_dan_dang"
      },
      {
        "sourceEntityId": "event_khoi_nghia_yen_bai",
        "relationType": "LED_BY",
        "targetEntityId": "person_nguyen_thai_hoc"
      }
    ],
    "notes": "Nguyen Thai Hoc and Yen Bai uprising"
  },
  {
    "id": "TC_EP12_005",
    "epochId": "EPOCH_12",
    "sourceText": "Phan Đình Phùng chỉ huy Khởi nghĩa Hương Khê tại căn cứ Vụ Quang thuộc tỉnh Hà Tĩnh.",
    "entities": [
      {
        "id": "person_phan_dinh_phung",
        "name": "Phan Đình Phùng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_khoi_nghia_huong_khe",
        "name": "Khởi nghĩa Hương Khê",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_vu_quang",
        "name": "Vụ Quang",
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
        "sourceEntityId": "event_khoi_nghia_huong_khe",
        "relationType": "LED_BY",
        "targetEntityId": "person_phan_dinh_phung"
      },
      {
        "sourceEntityId": "event_khoi_nghia_huong_khe",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_vu_quang"
      },
      {
        "sourceEntityId": "loc_vu_quang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_tinh"
      }
    ],
    "notes": "Phan Dinh Phung leads Huong Khe uprising"
  },
  {
    "id": "TC_EP12_006",
    "epochId": "EPOCH_12",
    "sourceText": "Vùng đất Thủ Dầu Một thời Pháp thuộc nay thuộc địa giới hành chính của tỉnh Bình Dương.",
    "entities": [
      {
        "id": "loc_thu_dau_mot",
        "name": "Thủ Dầu Một",
        "type": "LOCATION"
      },
      {
        "id": "loc_binh_duong",
        "name": "Bình Dương",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_thu_dau_mot",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_binh_duong"
      }
    ],
    "notes": "Thu Dau Mot corresponds to Binh Duong province"
  },
  {
    "id": "TC_EP12_007",
    "epochId": "EPOCH_12",
    "sourceText": "Chí sĩ Phan Bội Châu viết cuốn sách Hải Ngoại Huyết Thư kêu gọi đồng bào đứng lên cứu nước.",
    "entities": [
      {
        "id": "person_phan_boi_chau",
        "name": "Phan Bội Châu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_hai_ngoai_huyet_thu",
        "name": "Hải Ngoại Huyết Thư",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_phan_boi_chau",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hai_ngoai_huyet_thu"
      }
    ],
    "notes": "Phan Boi Chau writes Hai Ngoai Huyet Thu"
  },
  {
    "id": "TC_EP12_008",
    "epochId": "EPOCH_12",
    "sourceText": "Rừng rậm Yên Thế hiểm trở có nhiều hang đá tự nhiên và lối mòn hiểm hóc giữa các cánh rừng lim.",
    "entities": [
      {
        "id": "loc_yen_the",
        "name": "Yên Thế",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Rugged forest terrain description, zero triples"
  },
  {
    "id": "TC_EP12_009_OCR_SPACING",
    "epochId": "EPOCH_12",
    "sourceText": "Chí sĩ Phan Bội Châu khởi xướng phong trào Đông Du đưa thanh niên sang Nhật Bản cầu học.",
    "entities": [
      {
        "id": "person_phan_boi_chau",
        "name": "Phan Bội Châu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_phong_trao_dong_du",
        "name": "phong trào Đông Du",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_nhat_ban",
        "name": "Nhật Bản",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_phong_trao_dong_du",
        "relationType": "LED_BY",
        "targetEntityId": "person_phan_boi_chau"
      },
      {
        "sourceEntityId": "person_phan_boi_chau",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_nhat_ban"
      }
    ],
    "notes": "Modernization movement and overseas study initiative"
  },
  {
    "id": "TC_EP12_010_TRUNCATED_CHRONICLE",
    "epochId": "EPOCH_12",
    "sourceText": "Khởi nghĩa Yên Bái do Nguyễn Thái Học lãnh đạo bùng nổ vang dội tại miền Bắc năm 1930.",
    "entities": [
      {
        "id": "event_khoi_nghia_yen_bai",
        "name": "Khởi nghĩa Yên Bái",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "person_nguyen_thai_hoc",
        "name": "Nguyễn Thái Học",
        "type": "HISTORICAL_PERSON"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoi_nghia_yen_bai",
        "relationType": "LED_BY",
        "targetEntityId": "person_nguyen_thai_hoc"
      }
    ],
    "notes": "Anti-colonial rebellion leadership"
  },
  {
    "id": "TC_EP13_001",
    "epochId": "EPOCH_13",
    "sourceText": "Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình Hà Nội ngày 2 tháng 9 năm 1945.",
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_tuyen_ngon_doc_lap",
        "name": "Tuyên ngôn Độc lập",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "loc_ba_dinh",
        "name": "Quảng trường Ba Đình",
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
        "sourceEntityId": "person_ho_chi_minh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_tuyen_ngon_doc_lap"
      },
      {
        "sourceEntityId": "person_ho_chi_minh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ba_dinh"
      },
      {
        "sourceEntityId": "loc_ba_dinh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Ho Chi Minh reads Declaration of Independence"
  },
  {
    "id": "TC_EP13_002",
    "epochId": "EPOCH_13",
    "sourceText": "Đại tướng Võ Nguyên Giáp chỉ huy Chiến dịch Điện Biên Phủ giành toàn thắng tại Điện Biên Phủ.",
    "entities": [
      {
        "id": "person_vo_nguyen_giap",
        "name": "Võ Nguyên Giáp",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_dien_bien_phu",
        "name": "Chiến dịch Điện Biên Phủ",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_dien_bien_phu",
        "name": "Điện Biên Phủ",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_nguyen_giap"
      },
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_dien_bien_phu"
      }
    ],
    "notes": "Vo Nguyen Giap in Dien Bien Phu campaign"
  },
  {
    "id": "TC_EP13_003",
    "epochId": "EPOCH_13",
    "sourceText": "Chủ tịch Hồ Chí Minh thời trẻ mang tên Nguyễn Tất Thành khi rời bến cảng Nhà Rồng.",
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_tat_thanh",
        "name": "Nguyễn Tất Thành",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_nha_rong",
        "name": "Nhà Rồng",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_tat_thanh",
        "relationType": "ALIAS_OF",
        "targetEntityId": "person_ho_chi_minh"
      },
      {
        "sourceEntityId": "person_ho_chi_minh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_nha_rong"
      }
    ],
    "notes": "Nguyen Tat Thanh alias of Ho Chi Minh at Nha Rong"
  },
  {
    "id": "TC_EP13_004",
    "epochId": "EPOCH_13",
    "sourceText": "Chiến khu Tân Trào thủ đô kháng chiến thời Cách mạng Tháng Tám nay thuộc tỉnh Tuyên Quang.",
    "entities": [
      {
        "id": "loc_tan_trao",
        "name": "Tân Trào",
        "type": "LOCATION"
      },
      {
        "id": "loc_tuyen_quang",
        "name": "Tuyên Quang",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_tan_trao",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_tuyen_quang"
      }
    ],
    "notes": "Tan Trao base in Tuyen Quang"
  },
  {
    "id": "TC_EP13_005",
    "epochId": "EPOCH_13",
    "sourceText": "Đại tướng Võ Nguyên Giáp chỉ huy Chiến dịch Biên Giới năm 1950 mở thông đường liên lạc tại Cao Bằng.",
    "entities": [
      {
        "id": "person_vo_nguyen_giap",
        "name": "Võ Nguyên Giáp",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_bien_gioi_1950",
        "name": "Chiến dịch Biên Giới",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_cao_bang",
        "name": "Cao Bằng",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_bien_gioi_1950",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_nguyen_giap"
      },
      {
        "sourceEntityId": "event_bien_gioi_1950",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_cao_bang"
      }
    ],
    "notes": "Border Campaign 1950 in Cao Bang"
  },
  {
    "id": "TC_EP13_006",
    "epochId": "EPOCH_13",
    "sourceText": "Chính phủ Việt Nam Dân Chủ Cộng Hòa cử phái đoàn tham gia đàm phán ký kết Hiệp định Genève năm 1954.",
    "entities": [
      {
        "id": "dynasty_viet_nam_dan_chu_cong_hoa",
        "name": "Việt Nam Dân Chủ Cộng Hòa",
        "type": "ORGANIZATION"
      },
      {
        "id": "doc_hiep_dinh_geneve_1954",
        "name": "Hiệp định Genève năm 1954",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "dynasty_viet_nam_dan_chu_cong_hoa",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hiep_dinh_geneve_1954"
      }
    ],
    "notes": "Geneva Accords 1954 signing"
  },
  {
    "id": "TC_EP13_007",
    "epochId": "EPOCH_13",
    "sourceText": "Chủ tịch Hồ Chí Minh soạn thảo Lời kêu gọi toàn quốc kháng chiến phát động cuộc chiến đấu bảo vệ tổ quốc.",
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_loi_keu_goi_toan_quoc_khang_chien",
        "name": "Lời kêu gọi toàn quốc kháng chiến",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_chi_minh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_loi_keu_goi_toan_quoc_khang_chien"
      }
    ],
    "notes": "Ho Chi Minh writes National Resistance Appeal"
  },
  {
    "id": "TC_EP13_008",
    "epochId": "EPOCH_13",
    "sourceText": "Rừng nứa Việt Bắc mùa đông phủ sương mù dày đặc che chở cho các cơ quan đầu não kháng chiến.",
    "entities": [
      {
        "id": "loc_viet_bac",
        "name": "Việt Bắc",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Viet Bac natural environment description, zero triples"
  },
  {
    "id": "TC_EP13_009_OCR_SPACING",
    "epochId": "EPOCH_13",
    "sourceText": "Chủ tịch Hồ Chí Minh cùng Đại tướng Võ Nguyên Giáp chỉ đạo Chiến dịch Điện Biên Phủ toàn thắng.",
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
        "id": "event_dien_bien_phu",
        "name": "Chiến dịch Điện Biên Phủ",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_nguyen_giap"
      },
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "LED_BY",
        "targetEntityId": "person_ho_chi_minh"
      }
    ],
    "notes": "Supreme command and strategic campaign victory"
  },
  {
    "id": "TC_EP13_010_HEADING_BLEED",
    "epochId": "EPOCH_13",
    "sourceText": "Bản Tuyên ngôn Độc lập khẳng định chủ quyền của nước Việt Nam Dân Chủ Cộng Hòa. #### Lịch Sử",
    "entities": [
      {
        "id": "doc_tuyen_ngon_doc_lap",
        "name": "Tuyên ngôn Độc lập",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_viet_nam_dan_chu_cong_hoa",
        "name": "Việt Nam Dân Chủ Cộng Hòa",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "dynasty_viet_nam_dan_chu_cong_hoa",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_tuyen_ngon_doc_lap"
      }
    ],
    "notes": "Declaration of independence constitutional document with heading bleed"
  },
  {
    "id": "TC_EP14_001",
    "epochId": "EPOCH_14",
    "sourceText": "Đại tướng Văn Tiến Dũng chỉ huy Bộ Tư lệnh Chiến dịch Hồ Chí Minh giải phóng Sài Gòn năm 1975.",
    "entities": [
      {
        "id": "person_van_tien_dung",
        "name": "Văn Tiến Dũng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_chien_dich_ho_chi_minh",
        "name": "Chiến dịch Hồ Chí Minh",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "LED_BY",
        "targetEntityId": "person_van_tien_dung"
      },
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      }
    ],
    "notes": "Van Tien Dung leads Ho Chi Minh campaign"
  },
  {
    "id": "TC_EP14_002",
    "epochId": "EPOCH_14",
    "sourceText": "Sự kiện 30 tháng 4 năm 1975 kết thúc khi xe tăng húc đổ cổng Dinh Độc Lập tại Sài Gòn.",
    "entities": [
      {
        "id": "event_30_thang_4_1975",
        "name": "Sự kiện 30 tháng 4 năm 1975",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_dinh_doc_lap",
        "name": "Dinh Độc Lập",
        "type": "LOCATION"
      },
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_30_thang_4_1975",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_dinh_doc_lap"
      },
      {
        "sourceEntityId": "loc_dinh_doc_lap",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      }
    ],
    "notes": "Fall of Saigon at Independence Palace"
  },
  {
    "id": "TC_EP14_003",
    "epochId": "EPOCH_14",
    "sourceText": "Tuyến đường Trường Sơn còn được gọi là Đường mòn Hồ Chí Minh vận chuyển quân lương cho tiền tuyến.",
    "entities": [
      {
        "id": "loc_duong_truong_son",
        "name": "đường Trường Sơn",
        "type": "LOCATION"
      },
      {
        "id": "loc_duong_mon_ho_chi_minh",
        "name": "Đường mòn Hồ Chí Minh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_duong_truong_son",
        "relationType": "ALIAS_OF",
        "targetEntityId": "loc_duong_mon_ho_chi_minh"
      }
    ],
    "notes": "Truong Son trail alias Ho Chi Minh trail"
  },
  {
    "id": "TC_EP14_004",
    "epochId": "EPOCH_14",
    "sourceText": "Thành phố Sài Gòn sau ngày đất nước hoàn toàn thống nhất được đổi tên thành Thành phố Hồ Chí Minh.",
    "entities": [
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION"
      },
      {
        "id": "loc_ho_chi_minh",
        "name": "Thành phố Hồ Chí Minh",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_sai_gon",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_ho_chi_minh"
      }
    ],
    "notes": "Saigon corresponds to modern Ho Chi Minh City"
  },
  {
    "id": "TC_EP14_005",
    "epochId": "EPOCH_14",
    "sourceText": "Đoàn 559 được thành lập để mở tuyến đường vận tải chiến lược chi viện cho chiến trường miền Nam.",
    "entities": [
      {
        "id": "org_doan_559",
        "name": "Đoàn 559",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [],
    "notes": "Strategic Transport Group 559"
  },
  {
    "id": "TC_EP14_006",
    "epochId": "EPOCH_14",
    "sourceText": "Bà Nguyễn Thị Bình đại diện Chính phủ Cách mạng Lâm thời ký kết Hiệp định Paris năm 1973.",
    "entities": [
      {
        "id": "person_nguyen_thi_binh",
        "name": "Nguyễn Thị Bình",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_chinh_phu_cach_mang_lam_thoi",
        "name": "Chính phủ Cách mạng Lâm thời",
        "type": "ORGANIZATION"
      },
      {
        "id": "doc_hiep_dinh_paris",
        "name": "Hiệp định Paris năm 1973",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_thi_binh",
        "relationType": "PART_OF",
        "targetEntityId": "org_chinh_phu_cach_mang_lam_thoi"
      },
      {
        "sourceEntityId": "person_nguyen_thi_binh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hiep_dinh_paris"
      }
    ],
    "notes": "Nguyen Thi Binh signs Paris Peace Accords"
  },
  {
    "id": "TC_EP14_007",
    "epochId": "EPOCH_14",
    "sourceText": "Chủ tịch Hồ Chí Minh để lại bản Di chúc thiêng liêng dặn dò toàn Đảng và nhân dân trước khi qua đời.",
    "entities": [
      {
        "id": "person_ho_chi_minh",
        "name": "Hồ Chí Minh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_di_chuc_ho_chi_minh",
        "name": "Di chúc",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_chi_minh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_di_chuc_ho_chi_minh"
      }
    ],
    "notes": "Ho Chi Minh Testament document"
  },
  {
    "id": "TC_EP14_008",
    "epochId": "EPOCH_14",
    "sourceText": "Cây cầu Hiền Lương bắc qua sông Bến Hải sơn hai màu sơn đối lập biểu tượng cho nỗi đau chia cắt.",
    "entities": [
      {
        "id": "loc_song_ben_hai",
        "name": "sông Bến Hải",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Hien Luong bridge description, zero triples"
  },
  {
    "id": "TC_EP14_009_OCR_SPACING",
    "epochId": "EPOCH_14",
    "sourceText": "Đại tướng Văn Tiến Dũng chỉ huy Chiến dịch Hồ Chí Minh tiến vào giải phóng Sài Gòn thống nhất non sông.",
    "entities": [
      {
        "id": "person_van_tien_dung",
        "name": "Văn Tiến Dũng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_chien_dich_ho_chi_minh",
        "name": "Chiến dịch Hồ Chí Minh",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "LED_BY",
        "targetEntityId": "person_van_tien_dung"
      },
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      }
    ],
    "notes": "Ho Chi Minh Campaign liberation of Saigon"
  },
  {
    "id": "TC_EP14_010_METADATA_NOISE",
    "epochId": "EPOCH_14",
    "sourceText": "Tài liệu lưu trữ: Hiệp định Paris năm 1973 ký kết lập lại hòa bình tại Việt Nam.",
    "entities": [
      {
        "id": "doc_hiep_dinh_paris",
        "name": "Hiệp định Paris năm 1973",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_viet_nam",
        "name": "Việt Nam",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "dynasty_viet_nam",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hiep_dinh_paris"
      }
    ],
    "notes": "Archival peace agreement metadata test"
  },
  {
    "id": "TC_EP15_001",
    "epochId": "EPOCH_15",
    "sourceText": "Tổng Bí thư Nguyễn Văn Linh khởi xướng đường lối Đổi Mới tại Đại hội Đảng lần thứ VI tại Hà Nội.",
    "entities": [
      {
        "id": "person_nguyen_van_linh",
        "name": "Nguyễn Văn Linh",
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
        "sourceEntityId": "event_doi_moi",
        "relationType": "LED_BY",
        "targetEntityId": "person_nguyen_van_linh"
      },
      {
        "sourceEntityId": "person_nguyen_van_linh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Nguyen Van Linh initiates Doi Moi at 6th National Congress"
  },
  {
    "id": "TC_EP15_002",
    "epochId": "EPOCH_15",
    "sourceText": "Thủ tướng Võ Văn Kiệt trực tiếp chỉ đạo xây dựng Đường dây 500kV Bắc Nam kết nối nguồn điện quốc gia.",
    "entities": [
      {
        "id": "person_vo_van_kiet",
        "name": "Võ Văn Kiệt",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_duong_day_500kv",
        "name": "Đường dây 500kV Bắc Nam",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_duong_day_500kv",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_van_kiet"
      }
    ],
    "notes": "Vo Van Kiet builds 500kV North-South grid"
  },
  {
    "id": "TC_EP15_003",
    "epochId": "EPOCH_15",
    "sourceText": "Việt Nam chính thức gia nhập Tổ chức Thương mại Thế giới WTO mở ra thời kỳ hội nhập sâu rộng.",
    "entities": [
      {
        "id": "dynasty_viet_nam",
        "name": "Việt Nam",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "org_wto",
        "name": "Tổ chức Thương mại Thế giới WTO",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "dynasty_viet_nam",
        "relationType": "PART_OF",
        "targetEntityId": "org_wto"
      }
    ],
    "notes": "Vietnam joins WTO in modern era"
  },
  {
    "id": "TC_EP15_004",
    "epochId": "EPOCH_15",
    "sourceText": "Thành phố Cần Thơ trung tâm kinh tế của vùng Tây Nam Bộ trước đây từng mang tên gọi Tây Đô.",
    "entities": [
      {
        "id": "loc_tay_do",
        "name": "Tây Đô",
        "type": "LOCATION"
      },
      {
        "id": "loc_can_tho",
        "name": "Cần Thơ",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_tay_do",
        "relationType": "SAME_AS_LOCATION",
        "targetEntityId": "loc_can_tho"
      }
    ],
    "notes": "Tay Do moniker corresponds to modern Can Tho city"
  },
  {
    "id": "TC_EP15_005",
    "epochId": "EPOCH_15",
    "sourceText": "Việt Nam và Hoa Kỳ ký kết Hiệp định Thương mại Song phương BTA thúc đẩy quan hệ kinh tế.",
    "entities": [
      {
        "id": "dynasty_viet_nam",
        "name": "Việt Nam",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "doc_hiep_dinh_bta",
        "name": "Hiệp định Thương mại Song phương BTA",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "dynasty_viet_nam",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hiep_dinh_bta"
      }
    ],
    "notes": "Vietnam-US BTA Trade Agreement"
  },
  {
    "id": "TC_EP15_006",
    "epochId": "EPOCH_15",
    "sourceText": "Nhà máy Thủy điện Hòa Bình được khánh thành trên dòng sông Đà cung cấp nguồn năng lượng khổng lồ.",
    "entities": [
      {
        "id": "loc_thuy_dien_hoa_binh",
        "name": "Nhà máy Thủy điện Hòa Bình",
        "type": "LOCATION"
      },
      {
        "id": "loc_song_da",
        "name": "sông Đà",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "loc_thuy_dien_hoa_binh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_da"
      }
    ],
    "notes": "Hoa Binh Hydroelectric Plant on Da River"
  },
  {
    "id": "TC_EP15_007",
    "epochId": "EPOCH_15",
    "sourceText": "Đảng Cộng sản Việt Nam lãnh đạo nhân dân cả nước vượt qua khủng hoảng kinh tế bước vào thời kỳ phát triển.",
    "entities": [
      {
        "id": "org_dang_cong_san_vn",
        "name": "Đảng Cộng sản Việt Nam",
        "type": "ORGANIZATION"
      },
      {
        "id": "dynasty_viet_nam",
        "name": "Việt Nam",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "org_dang_cong_san_vn",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_viet_nam"
      }
    ],
    "notes": "Communist Party of Vietnam in national leadership"
  },
  {
    "id": "TC_EP15_008",
    "epochId": "EPOCH_15",
    "sourceText": "Vùng kinh tế trọng điểm miền Nam có mạng lưới giao thông cao tốc và khu công nghiệp phát triển sôi động.",
    "entities": [
      {
        "id": "loc_mien_nam",
        "name": "miền Nam",
        "type": "LOCATION"
      }
    ],
    "triples": [],
    "notes": "Distractor case: Southern economic zone infrastructure description, zero triples"
  },
  {
    "id": "TC_EP15_009_OCR_SPACING",
    "epochId": "EPOCH_15",
    "sourceText": "Tổng Bí thư Nguyễn Văn Linh cùng tập thể lãnh đạo khởi xướng công cuộc Đổi Mới tại thủ đô Hà Nội.",
    "entities": [
      {
        "id": "person_nguyen_van_linh",
        "name": "Nguyễn Văn Linh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_doi_moi",
        "name": "Đổi Mới",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_ha_noi",
        "name": "Hà Nội",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_doi_moi",
        "relationType": "LED_BY",
        "targetEntityId": "person_nguyen_van_linh"
      },
      {
        "sourceEntityId": "person_nguyen_van_linh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_noi"
      }
    ],
    "notes": "National economic reform leadership in Hanoi"
  },
  {
    "id": "TC_EP15_010_HEADING_BLEED",
    "epochId": "EPOCH_15",
    "sourceText": "Thủ tướng Võ Văn Kiệt chỉ đạo xây dựng thành công Đường dây 500kV Bắc Nam. #### Hiện Đại Hóa",
    "entities": [
      {
        "id": "person_vo_van_kiet",
        "name": "Võ Văn Kiệt",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_duong_day_500kv",
        "name": "Đường dây 500kV Bắc Nam",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_duong_day_500kv",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_van_kiet"
      }
    ],
    "notes": "National 500kV grid infrastructure project with heading bleed"
  },
  {
    "id": "TC_EP01_L5_001",
    "epochId": "EPOCH_01",
    "sourceText": "Vua An Dương Vương dời đô về vùng đất Phong Khê. Tại đây, Thục Vương hạ lệnh cho quân dân ngày đêm xây đắp Loa Thành chín vòng kiên cố để bảo vệ cõi bờ nhà nước Âu Lạc.",
    "entities": [
      {
        "id": "person_an_duong_vuong",
        "name": "An Dương Vương",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Thục Vương",
          "Thục Phán"
        ]
      },
      {
        "id": "loc_phong_khe",
        "name": "Phong Khê",
        "type": "LOCATION"
      },
      {
        "id": "loc_thanh_co_loa",
        "name": "Loa Thành",
        "type": "LOCATION",
        "aliases": [
          "Cổ Loa"
        ]
      },
      {
        "id": "dynasty_au_lac",
        "name": "nhà nước Âu Lạc",
        "type": "DYNASTY_ERA"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_au_lac"
      },
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phong_khe"
      },
      {
        "sourceEntityId": "person_an_duong_vuong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thanh_co_loa"
      },
      {
        "sourceEntityId": "loc_thanh_co_loa",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_phong_khe"
      },
      {
        "sourceEntityId": "loc_thanh_co_loa",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_au_lac"
      }
    ],
    "notes": "Level 5 Co-reference: Thục Vương -> An Dương Vương, Loa Thành -> Co Loa"
  },
  {
    "id": "TC_EP02_L5_001",
    "epochId": "EPOCH_02",
    "sourceText": "Bà Trưng Trắc cùng em gái phất cờ khởi nghĩa tại cửa sông Hát Môn. Sau khi đánh đuổi giặc ngoại xâm, Nữ Vương đóng đô tại Mê Linh và ban lệnh miễn thuế cho trăm họ.",
    "entities": [
      {
        "id": "person_hai_ba_trung",
        "name": "Trưng Trắc",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nữ Vương",
          "Trưng Nữ Vương"
        ]
      },
      {
        "id": "loc_me_linh",
        "name": "Mê Linh",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_hai_ba_trung",
        "name": "Nữ Vương",
        "type": "DYNASTY_ERA",
        "aliases": [
          "Trưng Nữ Vương"
        ]
      },
      {
        "id": "loc_hat_mon",
        "name": "Hát Môn",
        "type": "LOCATION",
        "aliases": []
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_hai_ba_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_me_linh"
      },
      {
        "sourceEntityId": "person_hai_ba_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hat_mon"
      },
      {
        "sourceEntityId": "person_hai_ba_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_hai_ba_trung"
      }
    ],
    "notes": "Level 5 Co-reference: Nữ Vương -> Trưng Trắc"
  },
  {
    "id": "TC_EP03_L5_001",
    "epochId": "EPOCH_03",
    "sourceText": "Đinh Bộ Lĩnh dẹp tan loạn 12 sứ quân thu giang sơn về một mối. Sau khi đăng quang hoàng đế tại Hoa Lư, Vạn Thắng Vương đặt quốc hiệu là Đại Cồ Việt và đúc tiền Thái Bình Hưng Bảo.",
    "entities": [
      {
        "id": "person_dinh_tien_hoang",
        "name": "Đinh Bộ Lĩnh",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đinh Tiên Hoàng",
          "Vạn Thắng Vương"
        ]
      },
      {
        "id": "loc_hoa_lu",
        "name": "Hoa Lư",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_dai_co_viet",
        "name": "Đại Cồ Việt",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "artifact_tien_thai_binh",
        "name": "Thái Bình Hưng Bảo",
        "type": "ARTIFACT"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_dinh_tien_hoang",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_dai_co_viet"
      },
      {
        "sourceEntityId": "person_dinh_tien_hoang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoa_lu"
      },
      {
        "sourceEntityId": "artifact_tien_thai_binh",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_dai_co_viet"
      }
    ],
    "notes": "Level 5 Co-reference: Vạn Thắng Vương -> Đinh Bộ Lĩnh"
  },
  {
    "id": "TC_EP04_L5_001",
    "epochId": "EPOCH_04",
    "sourceText": "Thái úy Lý Thường Kiệt lập phòng tuyến chiến lược trên sông Như Nguyệt để chặn quân Tống. Tại chiến lũy này, vị danh tướng đã cho ngâm bài thơ Nam Quốc Sơn Hà khích lệ tinh thần ba quân Đại Việt.",
    "entities": [
      {
        "id": "person_ly_thuong_kiet",
        "name": "Lý Thường Kiệt",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Thái úy",
          "vị danh tướng"
        ]
      },
      {
        "id": "loc_song_nhu_nguyet",
        "name": "sông Như Nguyệt",
        "type": "LOCATION"
      },
      {
        "id": "doc_nam_quoc_son_ha",
        "name": "Nam Quốc Sơn Hà",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Đại Việt",
        "type": "DYNASTY_ERA",
        "aliases": [
          "Nhà Lý"
        ]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_thuong_kiet",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_nhu_nguyet"
      },
      {
        "sourceEntityId": "person_ly_thuong_kiet",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ly"
      },
      {
        "sourceEntityId": "doc_nam_quoc_son_ha",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ly"
      },
      {
        "sourceEntityId": "person_ly_thuong_kiet",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_nam_quoc_son_ha"
      },
      {
        "sourceEntityId": "doc_nam_quoc_son_ha",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_song_nhu_nguyet"
      }
    ],
    "notes": "Level 5 Co-reference: vị danh tướng -> Lý Thường Kiệt"
  },
  {
    "id": "TC_EP05_L5_001",
    "epochId": "EPOCH_05",
    "sourceText": "Trần Quốc Tuấn được giao quyền Tiết chế thống lĩnh toàn bộ quân đội nhà Trần chống giặc Mông Cổ. Tại Vạn Kiếp, Hưng Đạo Đại Vương đã hoàn thành cuốn Binh Thư Yếu Lược để truyền thụ bí quyết quân sự cho các tướng lĩnh.",
    "entities": [
      {
        "id": "person_tran_hung_dao",
        "name": "Trần Quốc Tuấn",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Hưng Đạo Đại Vương",
          "Trần Hưng Đạo"
        ]
      },
      {
        "id": "dynasty_nha_tran",
        "name": "nhà Trần",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_van_kiep",
        "name": "Vạn Kiếp",
        "type": "LOCATION"
      },
      {
        "id": "doc_binh_thu_yeu_luoc",
        "name": "Binh Thư Yếu Lược",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_van_kiep"
      },
      {
        "sourceEntityId": "person_tran_hung_dao",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_binh_thu_yeu_luoc"
      },
      {
        "sourceEntityId": "doc_binh_thu_yeu_luoc",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_tran"
      },
      {
        "sourceEntityId": "doc_binh_thu_yeu_luoc",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_van_kiep"
      }
    ],
    "notes": "Level 5 Co-reference: Hưng Đạo Đại Vương -> Trần Quốc Tuấn"
  },
  {
    "id": "TC_EP06_L5_001",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Quý Ly truất ngôi nhà Trần lập nên triều đại Đại Ngu. Bấy giờ, nhà vua hạ lệnh cho con trưởng Hồ Nguyên Trừng đốc suất thợ giỏi ngày đêm chế tạo súng Thần cơ trang bị cho toàn quân đội.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "nhà vua"
        ]
      },
      {
        "id": "dynasty_nha_ho",
        "name": "Đại Ngu",
        "type": "DYNASTY_ERA",
        "aliases": [
          "nhà Hồ"
        ]
      },
      {
        "id": "person_ho_nguyen_trung",
        "name": "Hồ Nguyên Trừng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_sung_than_co",
        "name": "súng Thần cơ",
        "type": "ARTIFACT"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_quy_ly",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ho"
      },
      {
        "sourceEntityId": "person_ho_nguyen_trung",
        "relationType": "ROYAL_LINEAGE",
        "targetEntityId": "person_ho_quy_ly"
      },
      {
        "sourceEntityId": "person_ho_nguyen_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ho"
      },
      {
        "sourceEntityId": "artifact_sung_than_co",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ho"
      }
    ],
    "notes": "Level 5 Co-reference: nhà vua -> Hồ Quý Ly"
  },
  {
    "id": "TC_EP07_L5_001",
    "epochId": "EPOCH_07",
    "sourceText": "Lê Lợi lãnh đạo khởi nghĩa Lam Sơn chống quân xâm lược nhà Minh. Sau đại thắng tại Chi Lăng, Bình Định Vương lên ngôi hoàng đế sáng lập triều đại Lê Sơ và sai Nguyễn Trãi thảo bài cáo Bình Ngô.",
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
        "id": "event_khoi_nghia_lam_son",
        "name": "khởi nghĩa Lam Sơn",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_chi_lang",
        "name": "Chi Lăng",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Lê Sơ",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "person_nguyen_trai",
        "name": "Nguyễn Trãi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_binh_ngo_dai_cao",
        "name": "bài cáo Bình Ngô",
        "type": "DOCUMENT_CULTURE",
        "aliases": ["Bình Ngô đại cáo"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoi_nghia_lam_son",
        "relationType": "LED_BY",
        "targetEntityId": "person_le_loi"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_chi_lang"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      },
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      },
      {
        "sourceEntityId": "person_nguyen_trai",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_binh_ngo_dai_cao"
      },
      {
        "sourceEntityId": "person_le_loi",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_binh_ngo_dai_cao"
      },
      {
        "sourceEntityId": "doc_binh_ngo_dai_cao",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_le_so"
      }
    ],
    "notes": "Level 5 Co-reference: Bình Định Vương -> Lê Lợi"
  },
  {
    "id": "TC_EP08_L5_001",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thánh Tông ban hành Bộ luật Hồng Đức để chấn chỉnh kỷ cương xã tắc. Hoàng đế còn sáng lập Hội Tao Đàn và cùng Thân Nhân Trung xướng họa thi ca ca ngợi thái bình.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Hoàng đế",
          "Vua Lê Thánh Tông"
        ]
      },
      {
        "id": "doc_luat_hong_duc",
        "name": "Bộ luật Hồng Đức",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "person_than_nhan_trung",
        "name": "Thân Nhân Trung",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "org_hoi_tao_dan",
        "name": "Hội Tao Đàn",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_luat_hong_duc"
      },
      {
        "sourceEntityId": "org_hoi_tao_dan",
        "relationType": "LED_BY",
        "targetEntityId": "person_le_thanh_tong"
      },
      {
        "sourceEntityId": "person_than_nhan_trung",
        "relationType": "PART_OF",
        "targetEntityId": "org_hoi_tao_dan"
      }
    ],
    "notes": "Level 5 Co-reference: Hoàng đế -> Lê Thánh Tông"
  },
  {
    "id": "TC_EP09_L5_001",
    "epochId": "EPOCH_09",
    "sourceText": "Nguyễn Hoàng nghe lời khuyên của Trạng Trình bèn xin vào trấn thủ đất Thuận Hóa. Tại dải đất phương Nam này, Chúa Tiên đã gây dựng cơ nghiệp vững chắc cho các đời Chúa Nguyễn.",
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
        "id": "person_nguyen_binh_khiem",
        "name": "Trạng Trình",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Nguyễn Bỉnh Khiêm"
        ]
      },
      {
        "id": "loc_thuan_hoa",
        "name": "Thuận Hóa",
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
        "sourceEntityId": "person_nguyen_hoang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thuan_hoa"
      },
      {
        "sourceEntityId": "person_nguyen_hoang",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_chua_nguyen"
      }
    ],
    "notes": "Level 5 Co-reference: Chúa Tiên -> Nguyễn Hoàng, Trạng Trình -> Nguyễn Bỉnh Khiêm"
  },
  {
    "id": "TC_EP10_L5_001",
    "epochId": "EPOCH_10",
    "sourceText": "Nguyễn Huệ lên ngôi hoàng đế tại núi Bân lấy hiệu là Quang Trung. Vị anh hùng áo vải lập tức chỉ huy đại quân Tây Sơn tiến ra Thăng Long đại phá hai mươi chín vạn quân Thanh.",
    "entities": [
      {
        "id": "person_quang_trung",
        "name": "Nguyễn Huệ",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Quang Trung",
          "Vị anh hùng áo vải"
        ]
      },
      {
        "id": "loc_nui_ban",
        "name": "núi Bân",
        "type": "LOCATION"
      },
      {
        "id": "dynasty_nha_tay_son",
        "name": "Tây Sơn",
        "type": "DYNASTY_ERA",
        "aliases": [
          "nhà Tây Sơn"
        ]
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_tay_son"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_nui_ban"
      },
      {
        "sourceEntityId": "person_quang_trung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Level 5 Co-reference: Vị anh hùng áo vải -> Nguyễn Huệ / Quang Trung"
  },
  {
    "id": "TC_EP11_L5_001",
    "epochId": "EPOCH_11",
    "sourceText": "Vua Minh Mạng tiến hành đại cải cách hành chính chia đất nước thành ba mươi tỉnh. Hoàng đế cũng phê duyệt chỉ dụ phái thủy quân cắm mốc chủ quyền tại Hoàng Sa và Trường Sa.",
    "entities": [
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Hoàng đế"
        ]
      },
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
    "triples": [
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoang_sa"
      },
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_truong_sa"
      }
    ],
    "notes": "Level 5 Co-reference: Hoàng đế -> Minh Mạng"
  },
  {
    "id": "TC_EP12_L5_001",
    "epochId": "EPOCH_12",
    "sourceText": "Phan Đình Phùng lãnh đạo cuộc khởi nghĩa Hương Khê chống lại thực dân Pháp. Vị thủ lĩnh Cần Vương đã cùng Cao Thắng xây dựng hệ thống đồn lũy vững chắc tại căn cứ Vụ Quang Hà Tĩnh.",
    "entities": [
      {
        "id": "person_phan_dinh_phung",
        "name": "Phan Đình Phùng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Vị thủ lĩnh Cần Vương"
        ]
      },
      {
        "id": "person_cao_thang",
        "name": "Cao Thắng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_khoi_nghia_huong_khe",
        "name": "khởi nghĩa Hương Khê",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_vu_quang",
        "name": "Vụ Quang",
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
        "sourceEntityId": "event_khoi_nghia_huong_khe",
        "relationType": "LED_BY",
        "targetEntityId": "person_phan_dinh_phung"
      },
      {
        "sourceEntityId": "person_phan_dinh_phung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_vu_quang"
      },
      {
        "sourceEntityId": "person_phan_dinh_phung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_tinh"
      },
      {
        "sourceEntityId": "person_cao_thang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_vu_quang"
      },
      {
        "sourceEntityId": "person_cao_thang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_tinh"
      },
      {
        "sourceEntityId": "loc_vu_quang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_ha_tinh"
      },
      {
        "sourceEntityId": "person_cao_thang",
        "relationType": "PART_OF",
        "targetEntityId": "event_khoi_nghia_huong_khe"
      }
    ],
    "notes": "Level 5 Co-reference: Vị thủ lĩnh Cần Vương -> Phan Đình Phùng"
  },
  {
    "id": "TC_EP13_L5_001",
    "epochId": "EPOCH_13",
    "sourceText": "Đại tướng Võ Nguyên Giáp trực tiếp chỉ huy Chiến dịch Điện Biên Phủ năm 1954. Tại sở chỉ huy Mường Phăng, Tổng Tư lệnh đã quyết định chuyển phương châm tác chiến sang đánh chắc tiến chắc.",
    "entities": [
      {
        "id": "person_vo_nguyen_giap",
        "name": "Võ Nguyên Giáp",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đại tướng",
          "Tổng Tư lệnh"
        ]
      },
      {
        "id": "event_dien_bien_phu",
        "name": "Chiến dịch Điện Biên Phủ",
        "type": "EVENT_BATTLE",
        "aliases": [
          "Chiến dịch Điện Biên Phủ",
          "event_chien_dich_dien_bien_phu"
        ]
      },
      {
        "id": "loc_muong_phang",
        "name": "Mường Phăng",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_nguyen_giap"
      },
      {
        "sourceEntityId": "person_vo_nguyen_giap",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_muong_phang"
      },
      {
        "sourceEntityId": "event_dien_bien_phu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_muong_phang"
      }
    ],
    "notes": "Level 5 Co-reference: Tổng Tư lệnh -> Võ Nguyên Giáp"
  },
  {
    "id": "TC_EP14_L5_001",
    "epochId": "EPOCH_14",
    "sourceText": "Đại tướng Văn Tiến Dũng giữ chức Tư lệnh Chiến dịch Hồ Chí Minh giải phóng Sài Gòn. Vị tư lệnh đã chỉ đạo năm cánh quân đồng loạt tiến công húc đổ cổng Dinh Độc Lập ngày 30 tháng 4 năm 1975.",
    "entities": [
      {
        "id": "person_van_tien_dung",
        "name": "Văn Tiến Dũng",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Đại tướng",
          "Vị tư lệnh"
        ]
      },
      {
        "id": "event_chien_dich_ho_chi_minh",
        "name": "Chiến dịch Hồ Chí Minh",
        "type": "EVENT_BATTLE"
      },
      {
        "id": "loc_sai_gon",
        "name": "Sài Gòn",
        "type": "LOCATION"
      },
      {
        "id": "loc_dinh_doc_lap",
        "name": "Dinh Độc Lập",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "LED_BY",
        "targetEntityId": "person_van_tien_dung"
      },
      {
        "sourceEntityId": "event_chien_dich_ho_chi_minh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      },
      {
        "sourceEntityId": "loc_dinh_doc_lap",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      },
      {
        "sourceEntityId": "person_van_tien_dung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_sai_gon"
      },
      {
        "sourceEntityId": "person_van_tien_dung",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_dinh_doc_lap"
      }
    ],
    "notes": "Level 5 Co-reference: Vị tư lệnh -> Văn Tiến Dũng"
  },
  {
    "id": "TC_EP15_L5_001",
    "epochId": "EPOCH_15",
    "sourceText": "Thủ tướng Võ Văn Kiệt quyết định khởi công xây dựng công trình Đường dây 500kV Bắc Nam. Dưới sự chỉ đạo quyết liệt của người đứng đầu chính phủ, đại công trình đã hoàn thành xuất sắc nối liền nguồn điện cả nước.",
    "entities": [
      {
        "id": "person_vo_van_kiet",
        "name": "Võ Văn Kiệt",
        "type": "HISTORICAL_PERSON",
        "aliases": [
          "Thủ tướng",
          "người đứng đầu chính phủ"
        ]
      },
      {
        "id": "event_duong_day_500kv",
        "name": "Đường dây 500kV Bắc Nam",
        "type": "EVENT_BATTLE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_duong_day_500kv",
        "relationType": "LED_BY",
        "targetEntityId": "person_vo_van_kiet"
      }
    ],
    "notes": "Level 5 Co-reference: người đứng đầu chính phủ -> Võ Văn Kiệt"
  },

  // =========================================================================
  // ENRICHED GOLDEN TRIPLE SNIPPETS (LEGAL, ECONOMIC, MARITIME & CULTURE)
  // =========================================================================
  {
    "id": "TC_ENRICH_001_HINH_THU",
    "epochId": "EPOCH_04",
    "sourceText": "Năm 1042, vua Lý Thái Tông sai san định luật lệnh làm thành sách Hình thư của Đại Việt và đổi niên hiệu là Minh Đạo.",
    "entities": [
      {
        "id": "person_ly_thai_tong",
        "name": "Lý Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_hinh_thu",
        "name": "Hình thư",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "dynasty_nha_ly",
        "name": "Đại Việt",
        "type": "DYNASTY_ERA",
        "aliases": ["nhà Lý", "dynasty_dai_viet"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ly_thai_tong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_ly"
      },
      {
        "sourceEntityId": "person_ly_thai_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hinh_thu"
      },
      {
        "sourceEntityId": "doc_hinh_thu",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_ly"
      }
    ],
    "notes": "Ly Thai Tong and Hinh Thu legal code"
  },
  {
    "id": "TC_ENRICH_002_TAM_KHOI_NGUYEN_HIEN",
    "epochId": "EPOCH_05",
    "sourceText": "Năm 1247, vua Trần Thái Tông mở khoa thi Tam khôi lấy đỗ Trạng nguyên Nguyễn Hiền và Bảng nhãn Lê Văn Hưu.",
    "entities": [
      {
        "id": "person_tran_thai_tong",
        "name": "Trần Thái Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_hien",
        "name": "Nguyễn Hiền",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_le_van_huu",
        "name": "Lê Văn Hưu",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "event_khoa_thi_tam_khoi",
        "name": "Tam khôi",
        "type": "EVENT_BATTLE",
        "aliases": ["khoa thi Tam khôi"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "event_khoa_thi_tam_khoi",
        "relationType": "LED_BY",
        "targetEntityId": "person_tran_thai_tong"
      },
      {
        "sourceEntityId": "person_nguyen_hien",
        "relationType": "PART_OF",
        "targetEntityId": "event_khoa_thi_tam_khoi"
      },
      {
        "sourceEntityId": "person_le_van_huu",
        "relationType": "PART_OF",
        "targetEntityId": "event_khoa_thi_tam_khoi"
      }
    ],
    "notes": "Tran Thai Tong examination and Nguyen Hien Trang Nguyen"
  },
  {
    "id": "TC_ENRICH_003_TIEN_GIAY_NHA_HO",
    "epochId": "EPOCH_06",
    "sourceText": "Hồ Quý Ly ban hành tiền giấy Thông bảo hội sao năm 1396 và tập trung tiền đồng về kho Ngao Trì tại Thăng Long.",
    "entities": [
      {
        "id": "person_ho_quy_ly",
        "name": "Hồ Quý Ly",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "artifact_thong_bao_hoi_sao",
        "name": "Thông bảo hội sao",
        "type": "ARTIFACT",
        "aliases": ["tiền giấy"]
      },
      {
        "id": "loc_thang_long",
        "name": "Thăng Long",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_ho_quy_ly",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      },
      {
        "sourceEntityId": "artifact_thong_bao_hoi_sao",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Ho Quy Ly and Thong bao hoi sao paper currency"
  },
  {
    "id": "TC_ENRICH_004_LUAT_HONG_DUC",
    "epochId": "EPOCH_08",
    "sourceText": "Vua Lê Thánh Tông ban hành bộ Quốc triều hình luật thường gọi là Luật Hồng Đức năm 1483 để củng cố phép nước Đại Việt.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_luat_hong_duc",
        "name": "Quốc triều hình luật",
        "type": "DOCUMENT_CULTURE",
        "aliases": ["Luật Hồng Đức"]
      },
      {
        "id": "dynasty_nha_le_so",
        "name": "Đại Việt",
        "type": "DYNASTY_ERA",
        "aliases": ["nhà Lê Sơ", "Lê Sơ", "dynasty_dai_viet"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_nha_le_so"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_luat_hong_duc"
      },
      {
        "sourceEntityId": "doc_luat_hong_duc",
        "relationType": "HAPPENED_IN",
        "targetEntityId": "dynasty_nha_le_so"
      }
    ],
    "notes": "Le Thanh Tong and Hong Duc Code"
  },
  {
    "id": "TC_ENRICH_005_BIA_TIEN_SI_1442",
    "epochId": "EPOCH_08",
    "sourceText": "Năm 1484, Lê Thánh Tông khởi xướng dựng bia tiến sĩ tại Văn Miếu Quốc Tử Giám ghi danh các tiến sĩ khoa Nhâm Tuất 1442.",
    "entities": [
      {
        "id": "person_le_thanh_tong",
        "name": "Lê Thánh Tông",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "loc_van_mieu",
        "name": "Văn Miếu",
        "type": "LOCATION",
        "aliases": ["Văn Miếu Quốc Tử Giám"]
      },
      {
        "id": "loc_thang_long",
        "name": "Quốc Tử Giám",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_van_mieu"
      },
      {
        "sourceEntityId": "person_le_thanh_tong",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      },
      {
        "sourceEntityId": "loc_van_mieu",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_thang_long"
      }
    ],
    "notes": "Le Thanh Tong erects 1442 doctoral stele at Quoc Tu Giam"
  },
  {
    "id": "TC_ENRICH_006_NGUYEN_HUU_CANH",
    "epochId": "EPOCH_09",
    "sourceText": "Lễ Thành Hầu Nguyễn Hữu Cảnh vâng mệnh chúa Nguyễn vào kinh lược phương Nam và lập phủ Gia Định năm 1698.",
    "entities": [
      {
        "id": "person_nguyen_huu_canh",
        "name": "Nguyễn Hữu Cảnh",
        "type": "HISTORICAL_PERSON",
        "aliases": ["Lễ Thành Hầu"]
      },
      {
        "id": "dynasty_chua_nguyen",
        "name": "chúa Nguyễn",
        "type": "DYNASTY_ERA"
      },
      {
        "id": "loc_gia_dinh",
        "name": "phủ Gia Định",
        "type": "LOCATION",
        "aliases": ["Gia Định"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_nguyen_huu_canh",
        "relationType": "PART_OF",
        "targetEntityId": "dynasty_chua_nguyen"
      },
      {
        "sourceEntityId": "person_nguyen_huu_canh",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_gia_dinh"
      }
    ],
    "notes": "Nguyen Huu Canh establishes Gia Dinh prefecture"
  },
  {
    "id": "TC_ENRICH_007_LUAT_GIA_LONG",
    "epochId": "EPOCH_11",
    "sourceText": "Năm 1815, vua Gia Long ban hành Hoàng Việt luật lệ do Tổng trấn Bắc Thành Nguyễn Văn Thành chủ trì biên soạn.",
    "entities": [
      {
        "id": "person_gia_long",
        "name": "Gia Long",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_nguyen_van_thanh",
        "name": "Nguyễn Văn Thành",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_hoang_viet_luat_le",
        "name": "Hoàng Việt luật lệ",
        "type": "DOCUMENT_CULTURE",
        "aliases": ["Luật Gia Long"]
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_gia_long",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hoang_viet_luat_le"
      },
      {
        "sourceEntityId": "person_nguyen_van_thanh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_hoang_viet_luat_le"
      }
    ],
    "notes": "Gia Long and Hoang Viet luat le by Nguyen Van Thanh"
  },
  {
    "id": "TC_ENRICH_008_HOANG_SA_PHAM_HUU_NHAT",
    "epochId": "EPOCH_11",
    "sourceText": "Năm 1836, vua Minh Mạng phái Thủy quân Suất đội Phạm Hữu Nhật dẫn thuyền chiến ra quần đảo Hoàng Sa đo đạc hải trình và dựng bia mốc chủ quyền.",
    "entities": [
      {
        "id": "person_minh_mang",
        "name": "Minh Mạng",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_pham_huu_nhat",
        "name": "Phạm Hữu Nhật",
        "type": "HISTORICAL_PERSON",
        "aliases": ["Suất đội Phạm Hữu Nhật"]
      },
      {
        "id": "loc_hoang_sa",
        "name": "Hoàng Sa",
        "type": "LOCATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_pham_huu_nhat",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoang_sa"
      },
      {
        "sourceEntityId": "person_minh_mang",
        "relationType": "HAPPENED_AT",
        "targetEntityId": "loc_hoang_sa"
      }
    ],
    "notes": "Minh Mang and Pham Huu Nhat expedition to Hoang Sa"
  },
  {
    "id": "TC_ENRICH_009_PHONG_TRAO_THO_MOI",
    "epochId": "EPOCH_12",
    "sourceText": "Phan Khôi mở đầu phong trào Thơ Mới năm 1932 bằng bài thơ Tình già, sau đó nhà phê bình Hoài Thanh tổng kết phong trào qua cuốn Thi nhân Việt Nam.",
    "entities": [
      {
        "id": "person_phan_khoi",
        "name": "Phan Khôi",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "person_hoai_thanh",
        "name": "Hoài Thanh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_tinh_gia",
        "name": "Tình già",
        "type": "DOCUMENT_CULTURE",
        "aliases": ["bài thơ Tình già"]
      },
      {
        "id": "doc_thi_nhan_viet_nam",
        "name": "Thi nhân Việt Nam",
        "type": "DOCUMENT_CULTURE"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_phan_khoi",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_tinh_gia"
      },
      {
        "sourceEntityId": "person_hoai_thanh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_thi_nhan_viet_nam"
      }
    ],
    "notes": "Phan Khoi and Hoai Thanh in Tho Moi movement"
  },
  {
    "id": "TC_ENRICH_010_DE_CUONG_VAN_HOA_1943",
    "epochId": "EPOCH_12",
    "sourceText": "Năm 1943, Tổng Bí thư Trường Chinh soạn thảo Đề cương Văn hóa Việt Nam và lãnh đạo thành lập Hội Văn hóa Cứu quốc Việt Nam.",
    "entities": [
      {
        "id": "person_truong_chinh",
        "name": "Trường Chinh",
        "type": "HISTORICAL_PERSON"
      },
      {
        "id": "doc_de_cuong_van_hoa_1943",
        "name": "Đề cương Văn hóa Việt Nam",
        "type": "DOCUMENT_CULTURE"
      },
      {
        "id": "org_hoi_van_hoa_cuu_quoc",
        "name": "Hội Văn hóa Cứu quốc Việt Nam",
        "type": "ORGANIZATION"
      }
    ],
    "triples": [
      {
        "sourceEntityId": "person_truong_chinh",
        "relationType": "MENTIONED_IN",
        "targetEntityId": "doc_de_cuong_van_hoa_1943"
      },
      {
        "sourceEntityId": "person_truong_chinh",
        "relationType": "PART_OF",
        "targetEntityId": "org_hoi_van_hoa_cuu_quoc"
      },
      {
        "sourceEntityId": "org_hoi_van_hoa_cuu_quoc",
        "relationType": "LED_BY",
        "targetEntityId": "person_truong_chinh"
      }
    ],
    "notes": "Truong Chinh drafts Cultural Outline 1943"
  }
];
