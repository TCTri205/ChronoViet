# Báo Cáo Đánh Giá Chất Lượng Dịch Vụ VieNeu TTS Service
**Thời gian chạy:** 2026-08-11T13:08:52.401Z
**Tổng số mẫu câu:** 18
**Kết quả chung:** ✅ PASS (ĐẠT CHUẨN KPI)

## 📊 Tổng Hợp Chỉ Số KPI Core Metrics
| Chỉ Số KPI | Mục Tiêu Chuẩn | Kết Quả Thực Tế | Trạng Thái |
| :--- | :---: | :---: | :---: |
| **Inference Real-Time Factor (RTF)** | $< 0.3\text{x}$ | **0.0013x** (Max: 0.0064x) | ✅ PASS |
| **Word Timestamp Alignment Error** | $< 50\text{ms}$ | **0.00ms** (Max: 0.00ms) | ✅ PASS |
| **Duration Frame Calculation Error** | $< 1\text{ frame}$ | **0.00 frames** | ✅ PASS |

## 📋 Bảng Chi Tiết 50 Mẫu Câu Lịch Sử Tiếng Việt
| ID | Danh Mục | Độ Dài Audio | Frames (30fps) | Số Từ | RTF | Max Alignment Error | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| biography_quang_trung_s1 | BIOGRAPHY | 4800ms | 153f | 18 | 0.006x | 0.0ms | ✅ PASS |
| biography_quang_trung_s2 | BIOGRAPHY | 4740ms | 152f | 19 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s3 | BIOGRAPHY | 5560ms | 176f | 23 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s4 | BIOGRAPHY | 2200ms | 75f | 9 | 0.002x | 0.0ms | ✅ PASS |
| biography_quang_trung_s5 | BIOGRAPHY | 5560ms | 176f | 23 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s6 | BIOGRAPHY | 4360ms | 140f | 17 | 0.002x | 0.0ms | ✅ PASS |
| biography_quang_trung_s7 | BIOGRAPHY | 2900ms | 96f | 12 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s8 | BIOGRAPHY | 4880ms | 156f | 20 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s9 | BIOGRAPHY | 4540ms | 146f | 19 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s10 | BIOGRAPHY | 1960ms | 68f | 8 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s11 | BIOGRAPHY | 4580ms | 147f | 19 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s12 | BIOGRAPHY | 4420ms | 142f | 18 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s13 | BIOGRAPHY | 1780ms | 63f | 7 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s14 | BIOGRAPHY | 4980ms | 159f | 20 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s15 | BIOGRAPHY | 4900ms | 156f | 20 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s16 | BIOGRAPHY | 2620ms | 88f | 11 | 0.001x | 0.0ms | ✅ PASS |
| biography_quang_trung_s17 | BIOGRAPHY | 4740ms | 152f | 20 | 0.000x | 0.0ms | ✅ PASS |
| biography_quang_trung_s18 | BIOGRAPHY | 5480ms | 174f | 22 | 0.001x | 0.0ms | ✅ PASS |

---
*Báo cáo được sinh tự động bởi `services/vieneu-tts/eval/runner.ts`*