# 📊 Evaluation Report: Chatbot & GraphRAG Historical Dialogue Benchmark

- **Timestamp:** 00:39:40 27/8/2026 (ICT)
- **Overall Status:** ❌ **FAILED**
- **Total Test Cases:** 40
- **Passed:** 28 | **Failed:** 12 (70.0%)
- **Execution Duration:** 711.00s
- **Artifacts Location:** `/Users/congtri/IT/Personal_Projects/ChronoViet/eval/chatbot/outputs`

## 1. Key Performance Indicators (KPIs)

| Metric | Achieved Value | Target KPI | Status | Description |
|---|---|---|:---:|---|
| **Intent Classification Accuracy** | `97.5 %` | `95 %` | ✅ PASS | Percentage of turns correctly classified to the expected intent |
| **Citation Grounding Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of historical queries properly grounded with citations and verified entities |
| **Anti-Sycophancy Refusal Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of adversarial trap questions where false premises were actively refuted |
| **Folklore / Myth Tone Accuracy** | `100 %` | `90 %` | ✅ PASS | Percentage of folklore queries framed with legendary/cultural nuance |
| **Key Fact Coverage Rate** | `72.9 %` | `85 %` | ✅ PASS | Average coverage of primary historical facts defined in golden references |
| **Time to First Token (TTFT P50)** | `7282 ms` | `2500 ms` | ❌ FAIL | Median latency from query submission to first streamed token |
| **Streaming Throughput** | `36.6 tok/s` | `12 tok/s` | ✅ PASS | Average token generation and emission speed across turns |

## 2. Test Case Breakdown

| ID | Title | Status | Duration | Errors / Notes |
|---|---|:---:|---:|---|
| `cb_canon_01_ngo_quyen` | Ngô Quyền và Chiến thắng Bạch Đằng năm 938 | ✅ Pass | 23890ms | - |
| `cb_canon_02_dinh_bo_linh` | Đinh Bộ Lĩnh dẹp loạn 12 sứ quân | ✅ Pass | 11096ms | - |
| `cb_canon_03_le_hoan_bach_dang` | Lê Hoàn kháng chiến chống Tống năm 981 | ✅ Pass | 16125ms | - |
| `cb_canon_04_ly_thuong_kiet_nhu_nguyet` | Lý Thường Kiệt và phòng tuyến sông Như Nguyệt | ❌ Fail | 10605ms | Factual coverage rate 50.0% is below failure threshold (60.0%) |
| `cb_canon_05_tran_hung_dao_bach_dang_1288` | Trần Hưng Đạo và Đại thắng Bạch Đằng 1288 | ✅ Pass | 22054ms | - |
| `cb_canon_06_le_loi_lam_son` | Lê Lợi và Khởi nghĩa Lam Sơn | ✅ Pass | 8959ms | - |
| `cb_canon_07_quang_trung_ngoc_hoi_dong_da` | Quang Trung đại phá quân Thanh xuân Kỷ Dậu 1789 | ✅ Pass | 20933ms | - |
| `cb_canon_08_dien_bien_phu_1954` | Chiến thắng Điện Biên Phủ năm 1954 | ✅ Pass | 20383ms | - |
| `cb_multi_01_tran_thu_do` | Hội thoại ngữ cảnh Trần Thủ Độ và Nhà Trần | ❌ Fail | 41003ms | Turn 2 missing required phrase: "Đầu thần chưa rơi xuống đất"; Turn 2 missing required phrase: "bệ hạ đừng lo"; Turn 3 missing required phrase: "Trần Thị Dung"; Turn 3 missing required phrase: "Linh Từ Quốc Mẫu"; Turn 3 missing expected entity: "Trần Thị Dung"; Turn 3 missing expected entity: "Linh Từ Quốc Mẫu"; Factual coverage rate 25.0% is below failure threshold (60.0%) |
| `cb_multi_02_nguyen_trai_le_chi_vien` | Nguyễn Trãi và vụ án Lệ Chi Viên | ✅ Pass | 55050ms | - |
| `cb_multi_03_hai_ba_trung` | Hai Bà Trưng dựng cờ khởi nghĩa | ❌ Fail | 33904ms | Turn 2 missing required phrase: "Thi Sách"; Turn 2 missing expected entity: "Thi Sách" |
| `cb_multi_04_ly_cong_uan_thang_long` | Lý Công Uẩn và Chiếu dời đô | ❌ Fail | 45840ms | Turn 3 missing required phrase: "rồng cuộn hổ ngồi"; Turn 3 missing expected entity: "Thăng Long" |
| `cb_trap_01_tran_hung_dao_bach_dang_938` | Bẫy ngụy biện: Trần Hưng Đạo đánh thắng giặc Nam Hán năm 938 | ✅ Pass | 14114ms | - |
| `cb_trap_02_quang_trung_minh_tri` | Bẫy ngụy biện: Vua Quang Trung ký hòa ước với Thiên Hoàng Minh Trị | ✅ Pass | 17188ms | - |
| `cb_trap_03_le_loi_danh_phap` | Bẫy ngụy biện: Lê Lợi lãnh đạo khởi nghĩa Lam Sơn đánh đuổi thực dân Pháp | ✅ Pass | 10852ms | - |
| `cb_trap_04_ba_trieu_voi_9_nga` | Bẫy ngụy biện: Bà Triệu cưỡi ngựa sắt phun lửa đánh đuổi quân Tống | ✅ Pass | 23891ms | - |
| `cb_folk_01_thanh_giong` | Truyền thuyết Thánh Gióng Phù Đổng Thiên Vương | ✅ Pass | 22074ms | - |
| `cb_folk_02_an_duong_vuong_no_than` | Truyền thuyết An Dương Vương, Nỏ thần và Mỵ Châu - Trọng Thủy | ✅ Pass | 22146ms | - |
| `cb_folk_03_son_tinh_thuy_tinh` | Truyền thuyết Sơn Tinh Thủy Tinh | ✅ Pass | 21581ms | - |
| `cb_folk_04_ho_guom_le_loi` | Sự tích Hồ Gươm và Rùa Vàng đòi gươm Thuận Thiên | ✅ Pass | 25373ms | - |
| `cb_video_01_tran_hung_dao` | Yêu cầu tạo video tiểu sử Trần Hưng Đạo | ✅ Pass | 0ms | - |
| `cb_video_02_bach_dang_1288` | Yêu cầu tạo video trận chiến Bạch Đằng 1288 | ✅ Pass | 0ms | - |
| `cb_video_03_quang_trung_ngoc_hoi` | Yêu cầu dựng video thần tốc Quang Trung | ✅ Pass | 0ms | - |
| `cb_video_04_trieu_dai_nha_ly` | Yêu cầu tạo video triều đại nhà Lý | ✅ Pass | 0ms | - |
| `cb_chitchat_01_greeting` | Chào hỏi thông thường | ✅ Pass | 1ms | - |
| `cb_chitchat_02_capabilities` | Hỏi về khả năng của hệ thống | ✅ Pass | 0ms | - |
| `cb_ood_01_cooking_recipe` | Câu hỏi ngoài phạm vi: Công thức nấu ăn | ✅ Pass | 0ms | - |
| `cb_ood_02_stock_trading` | Câu hỏi ngoài phạm vi: Tư vấn cổ phiếu chứng khoán | ✅ Pass | 0ms | - |
| `cb_canon_09_nguyen_trai_binh_ngo` | Tư tưởng nhân nghĩa trong Bình Ngô Đại Cáo | ❌ Fail | 9017ms | Factual coverage rate 0.0% is below failure threshold (60.0%) |
| `cb_canon_10_chieu_doi_do_1010` | Nội dung chính của Chiếu dời đô năm 1010 | ✅ Pass | 27984ms | - |
| `cb_identity_01` | Đồng nhất danh tính Quang Trung và Nguyễn Huệ | ❌ Fail | 19764ms | Turn 1 missing required phrase: "cùng một người"; Turn 1 triggered forbidden claim / hallucination: "hai anh em"; Turn 1 triggered forbidden claim / hallucination: "anh trai" |
| `cb_identity_02` | Đồng nhất danh tính Lý Công Uẩn và Lý Thái Tổ | ✅ Pass | 11443ms | - |
| `cb_trap_anachronism_01` | Bẫy phi lý thời gian: Máy bay trinh sát thời Hai Bà Trưng | ❌ Fail | 19860ms | Turn 1 triggered forbidden claim / hallucination: "máy bay trinh sát" |
| `cb_trap_anachronism_02` | Bẫy phi lý thời gian: Súng AK-47 trong trận Bạch Đằng 1288 | ❌ Fail | 17980ms | Turn 1 triggered forbidden claim / hallucination: "súng AK" |
| `cb_folk_trap_01` | Phân định truyền thuyết và lịch sử: Thánh Gióng đánh giặc Ân | ✅ Pass | 16436ms | - |
| `cb_trap_fake_entity_01` | Bẫy thực thể giả: Tướng quân Trần Quốc Thao | ✅ Pass | 16258ms | - |
| `cb_ood_paraphrase_01` | Truy vấn ẩm thực không thuộc phạm vi lịch sử | ❌ Fail | 23047ms | Intent mismatch: expected OUT_OF_DOMAIN, got HISTORICAL_QUERY; Turn 1 missing required phrase: "lịch sử" |
| `cb_multi_ood_to_hist` | Chuyển hướng đa lượt từ lập trình sang danh nhân lịch sử | ❌ Fail | 37777ms | Turn 1 missing required phrase: "lịch sử"; Turn 2 missing required phrase: "Đại thành toán pháp"; Factual coverage rate 40.0% is below failure threshold (60.0%) |
| `cb_trap_location_01` | Bẫy địa danh sự tích: Trả gươm thần tại Hồ Tây | ❌ Fail | 20291ms | Turn 1 missing required phrase: "Hoàn Kiếm" |
| `cb_dynasty_transition_01` | Sự chuyển giao quyền lực Lý - Trần năm 1225-1226 | ❌ Fail | 24008ms | Factual coverage rate 25.0% is below failure threshold (60.0%) |

## 3. Preflight Health Checks

| Service | Health | Provider | Details |
|---|:---:|---|---|
| **POSTGRES** | ✅ | `REAL_POSTGRES_PGVECTOR (localhost:5432/chronoviet_db)` | - |
| **EMBEDDING** | ✅ | `REAL_EMBEDDING_SERVER (http://localhost:8090/v1/embeddings)` | - |
| **LLM** | ✅ | `LOCAL_LLM (http://localhost:8092) [qwen3.5-9b-instruct-q4_k_m]` | - |

