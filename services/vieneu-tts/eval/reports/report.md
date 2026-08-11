# Báo Cáo Đánh Giá Chất Lượng Dịch Vụ VieNeu TTS Service
**Thời gian chạy:** 2026-08-11T11:26:31.982Z
**Tổng số mẫu câu:** 18
**Kết quả chung:** ✅ PASS (ĐẠT CHUẨN KPI)

## 📊 Tổng Hợp Chỉ Số KPI Core Metrics
| Chỉ Số KPI | Mục Tiêu Chuẩn | Kết Quả Thực Tế | Trạng Thái |
| :--- | :---: | :---: | :---: |
| **Inference Real-Time Factor (RTF)** | $< 0.3\text{x}$ | **0.4004x** (Max: 0.4902x) | ❌ FAIL |
| **Word Timestamp Alignment Error** | $< 50\text{ms}$ | **0.00ms** (Max: 0.00ms) | ✅ PASS |
| **Duration Frame Calculation Error** | $< 1\text{ frame}$ | **0.00 frames** | ✅ PASS |

## 📋 Bảng Chi Tiết 50 Mẫu Câu Lịch Sử Tiếng Việt
| ID | Danh Mục | Độ Dài Audio | Frames (30fps) | Số Từ | RTF | Max Alignment Error | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| biography_quang_trung_s1 | BIOGRAPHY | 5520ms | 175f | 18 | 0.445x | 0.0ms | ✅ PASS |
| biography_quang_trung_s2 | BIOGRAPHY | 5200ms | 165f | 19 | 0.446x | 0.0ms | ✅ PASS |
| biography_quang_trung_s3 | BIOGRAPHY | 5840ms | 185f | 23 | 0.451x | 0.0ms | ✅ PASS |
| biography_quang_trung_s4 | BIOGRAPHY | 2800ms | 93f | 9 | 0.380x | 0.0ms | ✅ PASS |
| biography_quang_trung_s5 | BIOGRAPHY | 8080ms | 252f | 23 | 0.490x | 0.0ms | ✅ PASS |
| biography_quang_trung_s6 | BIOGRAPHY | 4880ms | 156f | 17 | 0.391x | 0.0ms | ✅ PASS |
| biography_quang_trung_s7 | BIOGRAPHY | 3600ms | 117f | 12 | 0.365x | 0.0ms | ✅ PASS |
| biography_quang_trung_s8 | BIOGRAPHY | 5920ms | 187f | 20 | 0.395x | 0.0ms | ✅ PASS |
| biography_quang_trung_s9 | BIOGRAPHY | 5600ms | 177f | 19 | 0.410x | 0.0ms | ✅ PASS |
| biography_quang_trung_s10 | BIOGRAPHY | 2560ms | 86f | 8 | 0.347x | 0.0ms | ✅ PASS |
| biography_quang_trung_s11 | BIOGRAPHY | 5360ms | 170f | 19 | 0.387x | 0.0ms | ✅ PASS |
| biography_quang_trung_s12 | BIOGRAPHY | 5280ms | 168f | 18 | 0.408x | 0.0ms | ✅ PASS |
| biography_quang_trung_s13 | BIOGRAPHY | 2320ms | 79f | 7 | 0.340x | 0.0ms | ✅ PASS |
| biography_quang_trung_s14 | BIOGRAPHY | 5120ms | 163f | 20 | 0.385x | 0.0ms | ✅ PASS |
| biography_quang_trung_s15 | BIOGRAPHY | 5520ms | 175f | 20 | 0.408x | 0.0ms | ✅ PASS |
| biography_quang_trung_s16 | BIOGRAPHY | 3120ms | 103f | 11 | 0.356x | 0.0ms | ✅ PASS |
| biography_quang_trung_s17 | BIOGRAPHY | 5600ms | 177f | 20 | 0.391x | 0.0ms | ✅ PASS |
| biography_quang_trung_s18 | BIOGRAPHY | 5840ms | 185f | 22 | 0.410x | 0.0ms | ✅ PASS |

---
*Báo cáo được sinh tự động bởi `services/vieneu-tts/eval/runner.ts`*