# QUY CHUẨN QUẢN TRỊ CHIẾN LƯỢC DỮ LIỆU RAG, SỐ LƯỢNG, CHẤT LƯỢNG & GIẢI QUYẾT XUNG ĐỘT SỬ LIỆU CHRONOVIET
*(ChronoViet RAG Knowledge Base Strategy, Text Quality Governance & Historical Conflict Resolution Specification)*

> **Trạng thái:** `[✅ SPECIFICATION v1.6 — MASTER SOURCE OF TRUTH FOR RAG KNOWLEDGE BASE]`  
> **Cập nhật mới:** 2026-08-12 (Bổ sung v1.6: Phân lớp Sub-tiers Level 1A/1B/1C cho Khảo cổ & Lưu trữ Quốc gia; Chuẩn hóa Metadata Scope Tags `region_scope` & `domain_scope`; Quy trình tích hợp Lịch sử Vùng miền / Chăm-pa / Phù Nam / Dân tộc thiểu số; Quy trình crawl & ingest trực tiếp Nguồn sơ cấp từ Wikisource & Kho Lưu trữ)  
> **Phạm vi áp dụng:** Mô-đun 0 (`Data Preprocessing & Ingestion Engine`), Mô-đun 1 (`Chrono-RAG Engine`), Mô-đun 2 (`Multi-Agent Orchestrator`).

> [!NOTE]
> **Ranh Giới Phạm Vi Dữ Liệu (Scope Boundary Definition):**  
> Quy chuẩn này **TẬP TRUNG 100% VÀO DỮ LIỆU TRI THỨC VĂN BẢN (Text Corpus, Dynamic Chunks, Knowledge Graph Entities & Relationships)** nạp vào RAG Engine.  
> Các tài nguyên tư liệu hình ảnh/ảnh lịch sử **KHÔNG NẰM TRONG LUỒNG NẠP DỮ LIỆU GỐC NÀY**, mà là kết quả tìm kiếm/sinh tự động theo thời gian thực của các Sub-Agent ở các bước sau (**Mô-đun 3: VLM Inspector Sub-Agent** và **Mô-đun 4: Remotion Render Engine**).

---

## 📌 1. Triết Lý Cốt Lõi: "Garbage In, Garbage Out" Trong Hệ Thống AI Sử Liệu

Một ứng dụng AI dù sở hữu kiến trúc GraphRAG tối tân hay hệ thống Multi-Agent phức tạp tới đâu, **nếu tri thức văn bản gốc (Ground Truth RAG Text Base) bị thiếu hụt, trùng lặp, sai lệch hoặc mâu thuẫn**, thì sản phẩm kịch bản và video đầu ra sẽ mắc phải các lỗi nghiêm trọng:
1. **Sai lệch lịch sử (Historical Hallucination):** Bóp méo mốc thời gian, nhầm lẫn công trạng nhân vật hoặc sai lệch bối cảnh trận đánh.
2. **Thiếu chiều sâu và nội dung hời hợt:** Kịch bản ngắn ngủi, thiếu chi tiết chiến thuật hoặc bối cảnh văn hóa - chính trị.
3. **Mâu thuẫn logic giữa các phân cảnh:** Phân cảnh trước nói nhân vật sinh năm A, phân cảnh sau lại bảo mất năm B do dữ liệu bị trùng lặp/xung đột trong database.

> [!IMPORTANT]
> **Nguyên Tắc Vàng Của ChronoViet:**  
> **Dữ liệu tri thức RAG gốc phải đạt 100% Tính Chính Xác, Chuẩn Hóa, Đa Dạng và Có Thể Truy Xuất Nguồn Gốc (Citation Traceability) trước khi được phép nạp vào kho vector/graph của hệ thống.**

---

## 📊 2. Khung Đo Lường & Mục Tiêu Số Lượng Dữ Liệu RAG (RAG Knowledge Quantity & Coverage Targets)

Để đảm bảo RAG Engine truy xuất đủ chi tiết cho kịch bản documentary cho bất kỳ chủ đề nào, dữ liệu văn bản nạp vào phải phủ rộng qua **15 Thời Kỳ Lịch Sử Chuẩn Hóa** (kết hợp hai trục phân kỳ: Thể chế/Triều đại và Phong trào Yêu nước/Kháng chiến) cùng **7 Danh Mục Thực Thể Core (Entity Taxonomy)**.

### 2.1. Độ Bao Phủ 15 Thời Kỳ Lịch Sử Việt Nam & Quy Tắc Xử Lý Giao Thời (Dual-Axis Epoch Coverage & Transition Rules)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
##                     15 THỜI KỲ LỊCH SỬ VIỆT NAM CHUẨN HÓA (DUAL-AXIS COVERAGE)                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. EPOCH_01: Thời Hùng Vương - Văn Lang & Âu Lạc (Tự khởi đầu - 179 TCN)                          │
│ 2. EPOCH_02: Thời Bắc Thuộc & Các Cuộc Khởi Nghĩa Giành Độc Lập (179 TCN - 938)                   │
│ 3. EPOCH_03: Thời Ngô - Đinh - Tiền Lê (938 - 1009)                                              │
│ 4. EPOCH_04: Thời Lý (1009 - 1225)                                                               │
│ 5. EPOCH_05: Thời Trần (1225 - 1400)                                                             │
│ 6. EPOCH_06: Thời Nhà Hồ & Các Cuộc Canh Tân (1400 - 1407)                                       │
│ 7. EPOCH_07: Thời Kỳ Bắc Thuộc Lần 4 & Khởi Nghĩa Lam Sơn (1407 - 1427)                          │
│ 8. EPOCH_08: Thời Lê Sơ (1428 - 1527)                                                            │
│ 9. EPOCH_09: Thời Nam - Bắc Triều & Trịnh - Nguyễn Phân Tranh (1527 - 1777)                      │
│ 10. EPOCH_10: Thời Kỳ Tây Sơn & Phong Trào Khởi Nghĩa (1771 - 1802)                              │
│ 11. EPOCH_11: Thời Nhà Nguyễn Độc Lập (1802 - 1858)                                              │
│ 12. EPOCH_12: Thời Kỳ Pháp Thuộc & Phong Trào Yêu Nước / Cách Mạng (1858 - 1945)                 │
│ 13. EPOCH_13: Thời Kỳ Kháng Chiến Chống Thực Dân Pháp (1945 - 1954)                              │
│ 14. EPOCH_14: Thời Kỳ Kháng Chiến Chống Đế Quốc Mỹ & Thống Nhất Đất Nước (1954 - 1975)           │
│ 15. EPOCH_15: Thời Kỳ Bảo Vệ Tổ Quốc, Đổi Mới & Hiện Đại (1975 - Nay)                             │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Quy Tắc Xử Lý Chồng Lấn Thời Gian Mốc Giao Thời (Epoch Overlap Protocol — Epoch 09 & Epoch 10):**  
> Khoảng thời gian **1771 - 1777** giữa Epoch 9 (Trịnh - Nguyễn Phân Tranh) và Epoch 10 (Tây Sơn) trùng khớp về mặt lịch sử thực tế: chính quyền Đàng Trong (Chúa Nguyễn) và Đàng Ngoài (Chúa Trịnh) vẫn đang tồn tại song song với sự phát triển bùng nổ của phong trào Tây Sơn (nổi dậy từ năm 1771 tại Tây Sơn Thượng đạo).  
> **Quy tắc gán nhãn bắt buộc:**  
> 1. Mọi đoạn văn bản (chunk), sự kiện (event), trận đánh hoặc thực thể hoạt động trong mốc **1771 - 1777** (ví dụ: Tây Sơn đánh chiếm Quy Nhơn 1773, Quân Trịnh vượt sông Gianh đánh Phú Xuân 1774) **BẮT BUỘC GÁN BẰNG MẢNG ĐA EPOCH**:  
>    `epoch_ids: ["EPOCH_09", "EPOCH_10"]`  
> 2. Tuyệt đối không gán đơn lẻ `EPOCH_09` hoặc `EPOCH_10` cho các sự kiện thuộc giai đoạn 1771-1777 để tránh tình trạng "bỏ sót chunk" khi RAG Engine lọc theo một trong hai epoch.

### 2.2. Bảng Taxonomy Thực Thể Chuẩn Hóa (Standardized Entity Taxonomy)

Mọi thực thể (`entities`) khi trích xuất vào Knowledge Graph phải thuộc chính xác một trong **7 loại thực thể chuẩn hóa** dưới đây (tương ứng với `ExtractedEntitySchema` trong `packages/shared-spec/src/schema.ts`):

| Entity Type | Mô tả & Phạm vi áp dụng | Ví dụ minh họa | Canonical ID Format |
| :--- | :--- | :--- | :--- |
| **`HISTORICAL_PERSON`** | Nhân vật lịch sử: vua, chúa, tướng lĩnh, sĩ phu, nhà văn, anh hùng dân tộc | Trần Hưng Đạo, Nguyễn Trãi, Quang Trung, Hồ Xuân Hương | `person_<slug>` |
| **`LOCATION`** | Địa danh lịch sử, địa lý: kinh đô, thành lũy, sông, núi, chiến trường, tỉnh/thành | Thăng Long, Bạch Đằng, Chi Lăng, Đàng Trong, Quy Nhơn | `loc_<slug>` |
| **`EVENT_BATTLE`** | Trận đánh, chiến dịch, cuộc khởi nghĩa, biến cố chính trị, hội nghị, sự kiện | Trận Bạch Đằng 1288, Khởi nghĩa Lam Sơn, Hội nghị Diên Hồng | `event_<slug>` |
| **`DYNASTY_ERA`** | Triều đại phong kiến, thể chế chính trị, kỷ nguyên lịch sử | Nhà Trần, Nhà Hồ, Nhà Lê Sơ, Nam - Bắc Triều | `dynasty_<slug>` |
| **`ORGANIZATION`** | Tổ chức, triều đình, tập đoàn quân, phái đoàn, hội nhóm | Quốc Sử Quán, Quân Tây Sơn, Hội Việt Nam Cách mạng Thanh niên | `org_<slug>` |
| **`ARTIFACT`** | Hiện vật, bảo vật quốc gia, vũ khí, sắc phong, ấn tín, bia đá | Trống đồng Đông Sơn, Sắc phong Vua Quang Trung, Bia Sùng Thiện Diên Linh | `artifact_<slug>` |
| **`DOCUMENT_CULTURE`** | Tác phẩm văn học, bộ chính sử, hịch, chiếu, văn bản pháp quy | *Đại Việt Sử Ký Toàn Thư*, *Bình Ngô Đại Cáo*, *Hịch Tướng Sĩ*, *Nam Quốc Sơn Hà* | `doc_<slug>` |

> [!CAUTION]
> **Cảnh Báo Rủi Ro Tách Nhỏ Thực Thể Giả Tạo (Spurious Splitting Safeguard):**  
> Đội ngũ Ingestion và LLM Extractor **không được phép tạo mới các `entity_type` nằm ngoài 7 danh mục trên**, cũng như không được tự ý tách nhỏ thực thể một cách khiên cưỡng chỉ để đạt KPI số lượng Phase 1 ($10.000$ entities). Chất lượng đồ thị tri thức (Graph Density & Entity Quality) được ưu tiên tuyệt đối hơn số lượng thô.

### 2.3. Mục Tiêu Số Lượng Chỉ Mộc Tri Thức RAG (RAG Volume Targets)

| Chỉ số Tri thức RAG | Mục tiêu Tối thiểu (Phase 1) | Mục tiêu Mở rộng (Phase 2-3) | Đơn vị tính | Phương pháp Kiểm định / KPI Quality |
| :--- | :---: | :---: | :--- | :--- |
| **Child Chunks (`document_chunks`)** | $\ge 20.000$ | $\ge 100.000$ | Chunks (300-500 từ) | Semantic Boundary Chunking (Mục 7.1) |
| **Thực thể Lịch sử (`entities`)** | $\ge 10.000$ | $\ge 50.000$ | Nodes (7 Taxonomy Types) | Entity Normalization Accuracy $> 98.0\%$ |
| **Bộ ba Quan hệ (`relationships`)** | $\ge 50.000$ | $\ge 250.000$ | Edges | Edge Confidence Multi-Perspective Score |
| **Bảng Liên kết (`entity_chunks`)** | $\ge 40.000$ | $\ge 200.000$ | Junction Rows | **Cross-Linking Precision $\ge 98.0\%$** |

---

## 🏆 3. Phân Cấp Nguồn Sử Liệu Văn Bản & Quy Trình Xử Lý Đặc Thù (Source Reliability Hierarchy & Execution)

Mọi văn bản thô khi cào về hoặc nhập vào hệ thống bắt buộc phải được gán nhãn **Cấp độ Tin cậy (`source_reliability`)** theo 3 tầng (kèm phân lớp Sub-tiers):

```text
               ┌──────────────────────────────────────────────────────────────┐
               │    LEVEL 1: CHÍNH SỬ, KHẢO CỔ & TƯ LIỆU LƯU TRỮ QUỐC GIA      │ (Trọng số: W = 1.0)
               │    - Level 1A: Đại Việt Sử Ký Toàn Thư, Khâm Định...         │
               │    - Level 1B: Báo cáo Khảo cổ, Bia đá, Di chỉ vật thể...     │
               │    - Level 1C: Châu bản, Mộc bản, Báo chí cổ...              │
               └──────────────────────────────┬───────────────────────────────┘
                                              │
               ┌──────────────────────────────▼───────────────────────────────┐
               │   LEVEL 2: TƯ LIỆU BÁCH KHOA & SÁCH GIÁO KHOA CHUẨN HÓA      │ (Trọng số: W = 0.8)
               │   - Wikipedia/Wikisource đã kiểm định, SGK Lịch sử...       │
               └──────────────────────────────┬───────────────────────────────┘
                                              │
               ┌──────────────────────────────▼───────────────────────────────┐
               │  LEVEL 3: DÃ SỬ, TRUYỀN THUYẾT & GIAI THOẠI DÂN GIAN         │ (Trọng số: W = 0.5)
               │  - Lĩnh Nam Chích Quái, Truyền thuyết dân gian...            │
               └──────────────────────────────────────────────────────────────┘
```

### 3.1. Chi Tiết Phân Loại Cấp Độ Tin Cậy & Các Phân Lớp Sub-Tiers

1. **LEVEL 1 — Chính Sử, Khảo Cổ & Tư Liệu Lưu Trữ Nguyên Bản (Ground Truth Level 1 | Trọng số $W = 1.0$):**
   * **`LEVEL_1A` (Chính Sử Phong Kiến & Bộ Sử Quốc Gia):** *Đại Việt Sử Ký Toàn Thư* (Lê Văn Hưu, Ngô Sĩ Liên), *Khâm Định Việt Sử Thông Giám Cương Mục* (Quốc Sử Quán Nhà Nguyễn), *Việt Sử Lược*, *Đại Nam Thực Lực*, *Gia Định Thành Thông Chí*, các công trình khảo cứu do Viện Sử Học Việt Nam / Cục Di sản Văn hóa ban hành.
   * **`LEVEL_1B` (Báo Cáo Khảo Cổ & Di Sản Vật Thể):** Báo cáo khai quật khảo cổ học từ Viện Khảo cổ học (Di chỉ Hoàng thành Thăng Long, Văn hóa Đông Sơn, Sa Huỳnh, Óc Eo/Phù Nam, các thành lũy cổ), hệ thống Bia đá (Văn Miếu - Quốc Tử Giám), Sắc phong, Mộc bản.
   * **`LEVEL_1C` (Tư Liệu Lưu Trữ Quốc Gia & Báo Chí Lịch Sử):** Châu bản / Mộc bản Triều Nguyễn (Trung tâm Lưu trữ Quốc gia IV), Hồ sơ văn kiện lịch sử (Trung tâm Lưu trữ Quốc gia I, II, III), các tờ báo lịch sử có giá trị tư liệu (*Gia Định Báo*, *Nam Phong Tạp Chí*, *Phong Hóa*, *Tiếng Dân*...).
   * **Quy tắc:** Căn cứ nền tảng để xác minh sự thật lịch sử. Khi mâu thuẫn với Level 2 hoặc Level 3, Level 1 có ưu tiên mặc định.

2. **LEVEL 2 — Tư Liệu Bách Khoa & Chuẩn Giáo Dục (Ground Truth Level 2 | Trọng số $W = 0.8$):**
   * **Nguồn dữ liệu:** Wikipedia tiếng Việt (đã qua bộ lọc Quality Gate), Vi.Wikisource, Sách giáo khoa Lịch sử Bộ Giáo dục & Đào tạo, các bài báo khoa học lịch sử đã qua phản biện (*Peer-Reviewed Journals*).
   * **Quy tắc:** Dùng để làm phong phú chi tiết, giải thích từ ngữ Hán-Việt, thuật ngữ chính trị và bổ sung ngữ cảnh hiện đại.

3. **LEVEL 3 — Truyền Thuyết Dân Gian & Dã Sử (Ground Truth Level 3 | Trọng số $W = 0.5$):**
   * **Nguồn dữ liệu:** *Lĩnh Nam Chích Quái*, *Việt Điện U Linh Tập*, truyền thuyết dân gian (Sơn Tinh Thủy Tinh, Thánh Gióng, An Dương Vương...), giai thoại truyền miệng.
   * **Quy tắc:** Bắt buộc gán nhãn `category: "FOLKLORE_MYTH"`. Dữ liệu này chỉ được dùng làm chất liệu nghệ thuật cho kịch bản, **tuyệt đối không được khẳng định là sự thật lịch sử khách quan**.

### 3.2. Cơ Chế Tự Động Bảo Đảm Giọng Văn Giả Thuyết Cho Level 3 / Dã Sử (Automated Folklore Guardrail Validator Gate)

> [!WARNING]
> **Khắc Phục Lỗ Hổng Prompt Enforcement:**  
> Việc chỉ dựa vào prompt instruction ("dùng giọng văn giả thuyết") rất dễ bị LLM "quên" khi sinh kịch bản dài. Hệ thống áp dụng **Guardrail Validator Gate tự động dạng Flexible Regex & Semantic Signal-Checking** cho kịch bản sinh ra:
> 1. **Thuật toán bắt lỗi (Regex Pattern Matching):** Nếu câu thoại kịch bản trích dẫn thông tin từ chunk có `category: "FOLKLORE_MYTH"` hoặc `source_reliability: "LEVEL_3"`, câu thoại đó **BẮT BUỘC khớp với biểu thức chính quy (Regex Pattern)** bao quát các từ/cụm từ tín hiệu giả thuyết:
>    ```regex
>    /(theo (truyền thuyết|dã sử|thần thoại|dân gian|giai thoại)|tương truyền|dân gian (kể|cho rằng)|(truyền thuyết|giai thoại) (kể|rằng|ghi nhận)|người xưa (kể|truyền)|theo các giai thoại)/i
>    ```
> 2. **Cơ chế xử lý:** Nếu thiếu cụm từ tín hiệu $\rightarrow$ Guardrail lập tức **Reject & Retry (Tối đa 3 lần)** với prompt bổ sung nguyên nhân từ chối.

### 3.3. Tiêu Chí & Quy Trình Phê Duyệt "Modern Scholarly Consensus Override Protocol"

> [!WARNING]
> **Quy Trình Phê Duyệt Cờ Modern Override:**  
> Để tránh tình trạng một bài viết đơn lẻ chưa kiểm chứng bị dùng để ghi đè chính sử, việc gắn cờ `has_modern_scholarly_override: true` phải đáp ứng đầy đủ **2 Tiêu chuẩn Bắt buộc**:
> 1. **Tiêu chuẩn Bằng chứng:** Phải có ít nhất **2 công trình nghiên cứu/bài báo phản biện độc lập** (Peer-Reviewed) từ các cơ quan uy tín (Viện Sử Học, Tạp chí Nghiên cứu Lịch sử, Cục Di sản Văn hóa...) HOẶC bằng chứng khảo cổ học / đo đạc phóng xạ carbon verified.
> 2. **Tiêu chuẩn Phê duyệt:** Phải được xác thực qua quy trình Sign-off Gate bởi Hội đồng Biên tập Lịch sử (`approved_by: "HISTORICAL_BOARD"`).

### 3.4. Quy Trình Kiểm Định & Xử Lý Bất Đồng Bản Dịch Hán / Hán Nôm (Classical Chinese Translation Protocol)

Đối với các nguồn cổ văn Hán / Hán Nôm (*Minh Thực Lục*, *Nguyên Sử*, *Châu Bản Nhà Nguyễn*...):
1. **OCR & Trích Xuất Chuyên Dụng:** Sử dụng mô hình OCR tối ưu cho chữ Hán/Nôm cổ (như NomNaOCR).
2. **Xử Lý Bất Đồng Bản Dịch (Dual-Translation Disagreement Protocol):** Khi 2 bản dịch tiếng Việt uy tín (ví dụ: Viện Hán Nôm vs NXB Khoa Học Xã Hội) bất đồng về ý nghĩa, mốc thời gian hay danh xưng:
   * **Không tự ý chọn 1 bản dịch.**
   * Lưu trữ dưới dạng **Biến thể Dịch thuật (Translation Variant Nodes/Edges)** trong DB kèm thuộc tính:
     `translation_variants: [{ translator: "Viện Hán Nôm", text: "..." }, { translator: "NXB KHXH", text: "..." }]`.
   * Áp dụng khung Multi-Perspective (Mục 5.2) để AI Scriptwriter trình bày cả 2 góc nhìn dịch thuật trong kịch bản.

### 3.5. Quy Trình Ingest Tư Liệu Ngoại Ngữ / Nguồn Nước Ngoài (Foreign Language Source Ingestion Protocol)

Đối với các tư liệu lịch sử tiếng Pháp (thời Pháp thuộc), tiếng Trung/Nhật hiện đại, hoặc tài liệu sử học phương Tây (tiếng Anh):
1. **Nạp Đa Ngữ Kèm Citation Gốc:** Lưu trữ nguyên bản văn bản gốc (`original_text`, `original_language`) song song với bản dịch tiếng Việt đã hiệu đính (`translated_text`).
2. **Xác Minh Bối Cảnh Lịch Sử (Source Context Verification):** Các nguồn nước ngoài (đặc biệt là sử thư phong kiến Trung Quốc hoặc báo chí thời Pháp) thường mang góc nhìn chính trị riêng. Bắt buộc gán nhãn `perspective_tag: "FOREIGN_CHRONICLE"` và gán trọng số $W_{\text{source}}$ phù hợp kèm ghi chú bối cảnh trong Knowledge Graph.

### 3.6. Quy Định An Toàn Nội Dung & Quản Trị Nhạy Cảm Thời Kỳ Hiện Đại (Epoch 15 Content Governance Protocol)

Đối với **EPOCH_15 (1975 - Nay)**:
1. **Bảo Vệ Quyền Riêng Tư & Nhân Thân Nhân Vật Còn Sống:** Tuyệt đối không ingest thông tin đời tư, thông tin cá nhân chưa kiểm chứng của các cá nhân còn sống.
2. **Nguồn Dữ Liệu Bắt Buộc:** Chỉ ingest từ các nguồn văn bản chính thống được công bố bởi các cơ quan nhà nước, Viện Sử Học, Tạp chí Lịch sử Đảng, hoặc các văn kiện chính thức đã xuất bản.
3. **Quy Tắc Trung Lập & Tôn Trọng Pháp Luật:** Đảm bảo ngôn từ kịch bản luôn khách quan, chuẩn mực, tuân thủ nghiêm ngặt Luật An ninh mạng và các quy định pháp luật hiện hành.

### 3.7. Giải Tỏa Phạt Chồng & Cơ Chế Áp Dụng Trọng Số Nguồn (Source Weight Decoupling & Execution)

> [!NOTE]
> **Giải Tỏa Rủi Ro "Phạt Chồng" (Over-Penalization Avoidance):**  
> Trọng số nguồn $W_{\text{source}} \in \{1.0, 0.8, 0.5\}$ được dùng để phân xử **Độ tin cậy sự thật (Fact Confidence)**, KHÔNG ĐƯỢC dùng để triệt hạ **Độ liên quan truy xuất (Retrieval Relevance)**.  
> Mô hình embedding dùng để dedup và retrieval là **BGE-M3 (1024-dimensional)** đồng nhất monorepo-wide, đảm bảo không bị lệch không gian vector.

Cơ chế thực thi trọng số nguồn được tách bạch làm 3 cấp độ:

1. **Bước Tìm Kiếm (Retrieval Phase):**  
   Tìm kiếm kết hợp Dense Vector và Lexical BM25 thông qua **Reciprocal Rank Fusion (RRF)** hoặc normalized combination (tránh rủi ro BM25 score không chặn đè bẹp Cosine Sim):
   $$RRF\_Score(chunk) = \dfrac{1}{k + r_{\text{dense}}(chunk)} + \dfrac{1}{k + r_{\text{bm25}}(chunk)} \quad (k = 60)$$
   *Hoặc công thức normalized score:*
   $$\text{RelevanceScore}(chunk) = \alpha \cdot \text{DenseCosineSim}_{\text{BGE-M3}} + (1-\alpha) \cdot \dfrac{\text{BM25Score}}{\max(\text{BM25Score})}$$
   *Đối với các truy vấn có ý định xác minh sự thật ("xác minh", "có thật không"), $W_{\text{source}}$ chỉ tham gia như một hệ số re-rank nhẹ với tỷ trọng $\le 15\%$.*
2. **Bước Đồ Thị Tri Thức (Knowledge Graph Edge Confidence):**  
   Nhân $W_{\text{source}}$ trực tiếp vào `confidence_score` của Edge trên Graph:
   $$\text{Confidence}_{\text{edge}} = W_{\text{source}} \times \text{ExtractorModelConfidence}$$
3. **Bước Đóng Gói Prompt Cho AI Scriptwriter (Prompt Context Framing):**  
   Gán nhãn thẩm quyền nguồn vào từng chunk truyền vào LLM context: `[SOURCE_TIER: LEVEL_1 | W=1.0]` hoặc `[SOURCE_TIER: LEVEL_3 | W=0.5]`. Prompt yêu cầu AI Scriptwriter dùng giọng văn khẳng định với Level 1 và giọng văn giả thuyết/nghệ thuật đối với Level 3.

### 3.8. Phân Loại Metadata Đa Chiều (Multi-Dimensional Scope Tags: Region & Domain Tags)

Mọi chunk văn bản khi ingest vào CSDL RAG phải được gán mảng nhãn phạm vi không gian và lĩnh vực:

1. **Phạm vi Địa lý - Vùng miền (`region_scope`):**
   - `NORTH`: Bắc Bộ & Trung tâm Thăng Long / Đông Kinh.
   - `CENTRAL`: Trung Bộ (Thanh - Nghệ - Tĩnh, Bình - Trị - Thiên, Quảng Nam - Nam Ngãi).
   - `SOUTH`: Nam Bộ (Gia Định, Miền Tây Nam Bộ).
   - `HIGHLANDS`: Tây Nguyên (Bản mộc, các dân tộc Ba Na, Ê Đê, Gia Rai).
   - `CHAMPA`: Vương quốc Chăm-pa (Lâm Ấp, Hoàn Vương, Chiêm Thành, Panduranga).
   - `FUNAN`: Văn hóa Óc Eo & Phù Nam cổ đại.

2. **Lĩnh vực Tri thức (`domain_scope`):**
   - `POLITICAL_MILITARY`: Chính trị, triều đại, chiến tranh, trận đánh, ngoại giao.
   - `SOCIO_ECONOMIC`: Giao thương (Hội An, Phố Hiến, Vân Đồn), tiền tệ, nông nghiệp, cảng thị.
   - `CULTURAL_RELIGIOUS`: Nho - Phật - Đạo, Ki tô giáo, văn học, tín ngưỡng dân gian, phong tục.
   - `LEGAL_INSTITUTIONAL`: Thể chế chính trị, pháp luật (*Hồng Đức bảo hình*, *Quốc triều hình luật*), thi cử.

### 3.9. Quy Chuẩn Tích Hợp Sử Liệu Vùng Miền, Chăm-pa, Phù Nam & Dân Tộc Thiểu Số (Regional & Ethnic Diversity Governance Protocol)

1. **Tôn Trọng Sự Thật Lịch Sử Đa Chiều:** Lịch sử Việt Nam là tiến trình giao thoa và hợp nhất của nhiều cộng đồng cư dân. RAG Engine không được bỏ qua lịch sử các vương quốc cổ (Chăm-pa, Phù Nam) hoặc phong trào các dân tộc thiểu số (Tây Bắc, Tây Nguyên) trong cùng mốc thời gian.
2. **Tránh Đồng Nhất Giai Đoạn Cổ Đại:** Khi truy vấn các mốc thời gian thuộc Epoch 01-11 ở khu vực Miền Trung / Nam Bộ, hệ thống phải trả về kết quả thuộc cả hai luồng tri thức (ví dụ: song song giữa Nhà Trần / Nhà Lê ở Bắc Bộ và Vương quốc Chiêm Thành / Panduranga ở Miền Trung).

### 3.10. Quy Trình Nạp Trực Tiếp Nguồn Sơ Cấp & Wikisource (Primary Sources & Wikisource Ingestion Protocol)

1. **Thu Thập Văn Bản Sơ Cấp:** Hệ thống hỗ trợ cào trực tiếp từ Vi.Wikisource (các bộ sử *Đại Việt Sử Ký Toàn Thư*, *Khâm Định*, các bài Hịch/Chiếu) thông qua URL Connector chuyên dụng (`pnpm crawl:corpus --urls="..."`).
2. **Cấu Trúc Hóa Chương Mục Sơ Cấp:** Khi ingest tác phẩm sơ cấp (như *Bình Ngô Đại Cáo* hay *Đại Việt Sử Ký Toàn Thư*), mỗi chunk phải giữ nguyên thông tin chương/quyển (`chapter_title`, `volume_number`, `author`) để đảm bảo khả năng trích dẫn tuyệt đối ($100\%$ Citation Traceability).

---

---

## 🧹 4. Quy Trình Khử Trùng Lặp & Đồng Nhất Tri Thức Văn Bản (Text Deduplication & Canonicalization)

### 4.1. Khử Trùng Lặp Đoạn Văn Bản (Chunk-Level Deduplication)

1. **Exact Hash Deduplication:** Tính SHA-256 cho nội dung thuần (`cleanedText`). Nếu trùng $\rightarrow$ bỏ qua.
2. **Semantic Similarity Deduplication:** BGE-M3 Dense (1024d) Cosine Similarity $\ge 0.96 \rightarrow$ gộp metadata.
3. **Partial Overlap & Boundary Discrepancy Deduplication:** Thuật toán **MinHash LSH / Sliding Window N-gram Jaccard Overlap** ($\ge 0.85$) để hợp nhất ranh giới chunk trùng lệch ranh giới cắt.

### 4.2. Đồng Nhất Danh Xưng & Phân Loại Cấu Trúc Alias (Structured Alias & Disambiguation)

Trong sử liệu Việt Nam, danh xưng nhân vật có độ tin cậy và bản chất khác nhau. Bảng ánh xạ `ALIAS_OF` được cấu trúc hóa theo cấp độ tin cậy (`alias_confidence`):

```json
{
  "canonical_id": "person_nguyen_hue",
  "canonical_name": "Nguyễn Huệ",
  "entity_type": "HISTORICAL_PERSON",
  "aliases": [
    { "name": "Quang Trung", "type": "ROYAL_TITLE", "confidence": 1.0 },
    { "name": "Bắc Bình Vương", "type": "ROYAL_TITLE", "confidence": 1.0 },
    { "name": "Long Nhương Tướng Quân", "type": "OFFICIAL_TITLE", "confidence": 1.0, "notes": "Danh xưng Hán-Việt chuẩn (龍驤將軍)" },
    { "name": "Long Nhượng Tướng Quân", "type": "PHONETIC_VARIANT", "confidence": 0.9, "notes": "Biến thể âm đọc dân gian" },
    { "name": "Hồ Thơm", "type": "FOLK_BIRTH_NAME", "confidence": 0.85, "notes": "Tên tương truyền dòng họ Hồ, gán nhãn giả thuyết dân gian" }
  ]
}
```

> [!CAUTION]
> **CẢNH BÁO NGUY CƠ GÁN NHẦM DANH XƯNG (HISTORICAL DISAMBIGUATION SAFEGUARD):**  
> Danh xưng *"Tây Sơn Vương"* thường gắn liền với **Nguyễn Nhạc** (anh cả, tự xưng Tây Sơn Vương năm 1776, sau là Thái Đức Hoàng Đế). **TUYỆT ĐỐI KHÔNG GIÁ TRỊ "Tây Sơn Vương" VÀO BẢNG ALIAS CỦA NGUYỄN HUỆ**.  
> Danh xưng "Tây Sơn Vương" phải được ánh xạ riêng biệt về **Canonical Entity ID:** `person_nguyen_nhac`.

### 4.3. Đồng Nhất Địa Danh Biến Đổi Theo Thời Kỳ (`SAME_AS_LOCATION` Mapper)

Địa danh Việt Nam thay đổi tên gọi liên tục qua các triều đại. Hệ thống quản lý bảng ánh xạ địa danh theo không gian - thời gian:

```json
{
  "historical_name": "Thăng Long",
  "canonical_modern_name": "Hà Nội",
  "dynasty_mappings": [
    { "dynasty": "Nhà Lý", "name": "Thăng Long" },
    { "dynasty": "Nhà Hồ", "name": "Đông Đô" },
    { "dynasty": "Bắc Thuộc Lần 4", "name": "Đông Quan" },
    { "dynasty": "Nhà Lê Sơ", "name": "Đông Kinh" },
    { "dynasty": "Nhà Nguyễn", "name": "Hà Nội" }
  ]
}
```

### 4.4. Thuật Toán Hợp Giải Xung Đột Cạnh Khi Merge Node (`rag:re-resolve` Algorithm)

Khi chạy pipeline re-indexing (`pnpm --filter @chronoviet/data-ingestion rag:re-resolve`) để gộp các nút thực thể cũ:
- **Cạnh không mâu thuẫn (cùng thuộc tính/giá trị):** Lấy $\max(\text{Confidence}_A, \text{Confidence}_B)$.
- **Cạnh mâu thuẫn giá trị (vd: Nguồn A bảo sinh năm 1225, Nguồn B bảo sinh năm 1226):** **Tuyệt đối không ghi đè ngẫu nhiên.** Hệ thống tự động chuyển đổi thành 2 cạnh song song theo mô hình **Multi-Perspective Graph Edge** (Mục 5.2) kèm trích dẫn nguồn riêng biệt.

### 4.5. Nhật Ký Phiên Bản & Truy Vết Thay Đổi Dữ Liệu (Audit Trail & Versioning)

Mọi thao tác hợp nhất thực thể (Merge Entity), cập nhật Modern Override, hoặc chỉnh sửa bảng Alias bắt buộc phải được ghi vào nhật ký vết thay đổi không thể sửa xóa (Append-Only Audit Log) trong PostgreSQL:
* **Schema Audit Log Table:** `entity_audit_logs(log_id, entity_id, action_type, modified_by, timestamp, previous_state, new_state, rationale)`.
* Cho phép Rollback lại trạng thái đồ thị tri thức trước đó nếu phát hiện thao tác hợp nhất sai sót.

### 4.6. Quy Trình Xử Lý Trùng Lặp Giữa PDF Sơ Cấp (Level 1 Detail) Và Wikipedia (Level 2 Overview)

Khi hệ thống ingest song song các tệp PDF chính sử chi tiết (`data/raw_corpus/pdf/`) và các tệp Wikipedia tóm tắt (`data/raw_corpus/wiki/`):

1. **Phân Tầng Vai Trò Dữ Liệu:**
   - **Tệp Wikipedia (`is_overview: true`, $W = 0.8$):** Cung cấp bức tranh tổng quan, định nghĩa khái niệm, ngữ cảnh ngắn gọn.
   - **Tệp PDF Sơ Cấp (`is_detailed_evidence: true`, $W = 1.0$):** Cung cấp bằng chứng sử liệu chi tiết, diễn biến trọn vẹn, trích dẫn văn bản cổ và số trang sách (`page_number`).
2. **Nguyên Tắc Không Xóa Bỏ Chunk PDF (Non-Destructive Detail Preservation):**
   - Khi phát hiện độ tương đồng semantic $\text{BGE-M3} \ge 0.88$ giữa 1 chunk Wikipedia và 1 chunk PDF, **tuyệt đối không xóa bỏ chunk PDF**.
   - Chunk PDF được giữ nguyên vị trí Ground Truth ($W=1.0$). Chunk Wikipedia được gán cờ `overview_summary: true` và lưu liên kết `primary_evidence_chunk_id` trỏ về chunk PDF tương ứng.
3. **Ưu Tiên Bộ Ba Quan Hệ Trong Đồ Thị Tri Thức:**
   - Khi cả PDF và Wikipedia cùng trích xuất bộ ba quan hệ $(E_1, R, E_2)$, hệ thống ưu tiên lưu giữ thuộc tính confidence của PDF Level 1 ($W=1.0$), đồng thời gắn thêm `citation_page` và `source_work` từ tệp PDF.

### 4.7. Quản Trị Trích Xuất 2-Stage & Quản Lý Cạnh Nghi Vấn (2-Stage Extraction & Quarantine Governance)

1. **Kiến Trúc Trích Xuất 2-Stage:**
   - **Stage 1 (Pure TS NER Candidate Extractor):** Nhận diện thực thể ứng viên theo ranh giới ký tự chính xác tuyệt đối (`extractHistoricalCandidateSpans`), tốc độ $< 1\text{ms}$/câu, F1 đạt 97.04%.
   - **Stage 2 (Lightweight LLM Extractor - Port 8094):** Sử dụng `qwen3.5-4b-instruct-q4_k_m` để liên kết bộ ba quan hệ theo 8 quan hệ chuẩn hóa (`LED_BY`, `PART_OF`, `HAPPENED_IN`, `HAPPENED_AT`, `SAME_AS_LOCATION`, `ALIAS_OF`, `ROYAL_LINEAGE`, `MENTIONED_IN`).
2. **Ma Trận Định Hướng Quan Hệ Chuẩn (Canonical Directionality Matrix):**
   - $S \xrightarrow{R} O$ bắt buộc tuân thủ đúng chiều ngữ nghĩa:
     - `LED_BY`: $[Event/Movement/Org] \to [Person]$
     - `HAPPENED_AT`: $[Event] \to [Location]$
     - `HAPPENED_IN`: $[Event/Rule] \to [Dynasty/Era]$
     - `SAME_AS_LOCATION`: $[Historical Loc] \to [Modern Loc]$
     - `MENTIONED_IN`: $[Entity] \to [Document]$
     - `ALIAS_OF`: $[Variant Name] \to [Master Entity]$
     - `ROYAL_LINEAGE`: $[Successor] \to [Royal Ancestor]$
     - `PART_OF`: $[Sub-entity] \to [Parent Entity]$
3. **Cơ Chế Cách Ly & Kiểm Định Cơ Sở Dữ Liệu (Quarantine Inspector):**
   - Các cạnh có điểm tin cậy $< 0.85$ hoặc chứa thực thể chưa định danh được lưu trữ tại phân vùng cách ly (Quarantine Store).
   - Sử dụng công cụ CLI [`quarantine-inspector.ts`](../../packages/data-ingestion/src/cli/quarantine-inspector.ts) (`pnpm db:audit-quarantine`) để người vận hành duyệt, thăng cấp (`--accept-all-high-conf`) hoặc thanh lọc cạnh sai (`--purge-spurious`).

---

## ⚔️ 5. Khung Giải Quyết Xung Đột Sử Liệu (Historical Conflict Resolution Framework)

### 5.1. Các Dạng Xung Đột Thường Gặp
1. **Xung đột mốc thời gian:** Năm sinh/năm mất, năm diễn ra trận đánh chênh lệch 1-2 năm.
2. **Xung đột lực lượng/quân số:** Sử Việt ghi quân Nguyên-Mông 50 vạn, sử nhà Nguyên ghi 10-20 vạn.
3. **Xung đột kết cục trận đánh / nhân vật:** Tướng bị bắt sống hay tử trận tại chỗ (ví dụ: tướng Ô Mã Nhi tại trận Bạch Đằng 1288).
4. **Xung đột quan điểm sử luận giữa các bộ chính sử phong kiến:** Sự đánh giá khác nhau về một nhân vật/sự kiện giữa *Đại Việt Sử Ký Toàn Thư* (Nhà Lê Sơ), *Khâm Định Việt Sử Thông Giám Cương Mục* (Nhà Nguyễn), và *Việt Sử Tiêu Án* (Ngô Thời Sĩ).

### 5.2. Thuật Toán Giải Quyết Xung Đột 3 Bước & Ngưỡng Định Lượng Tranh Luận (3-Step Conflict Resolution & Decision Threshold)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
##  BƯỚC 1: XÁC ĐỊNH CẤP ĐỘ NGUỒN & NGƯỠNG TƯƠNG QUAN CONFIDENCE                          │
│  - Nếu Nguồn A (Level 1) mâu thuẫn Nguồn B (Level 3) ──► Chọn Nguồn A                  │
│  - Nếu Nguồn B (Level 2/Hiện đại) có bằng chứng khảo cổ/đồng thuận khoa học ──► Override│
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ (Nếu 2 nguồn cùng Level 1 HOẶC chênh lệch 
                                            │  |Confidence(A) - Confidence(B)| <= 0.15)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
##  BƯỚC 2: BIỂU DIỄN ĐỒ THỊ ĐA GÓC NHÌN (MULTI-PERSPECTIVE EDGE MODELLING)              │
│  - Lưu trữ song song các luồng quan hệ trên Đồ thị Tri thức kèm Trọng số & Nguồn trích │
│    + Ví dụ 1 (Quân số chiến dịch 1285):                                                │
│      Edge 1a: (Yuan_Army, HAS_SOLDIER_COUNT, 500000) | confidence: 0.95 | source: "Su_Ky_Toan_Thu"
│      Edge 1b: (Yuan_Army, HAS_SOLDIER_COUNT, 100000) | confidence: 0.85 | source: "Nguyen_Su"
│    + Ví dụ 2 (Kết cục tướng Ô Mã Nhi - Bạch Đằng 1288):                               │
│      Edge 2a: (Omar, CAPTURED_IN_BATTLE, Bach_Dang) | confidence: 0.95 | source: "Su_Ky_Toan_Thu"
│      Edge 2b: (Omar, KILLED_IN_BATTLE, Bach_Dang)   | confidence: 0.70 | source: "Minh_Thuc_Luc"
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
##  BƯỚC 3: AI SCRIPTWRITER PROMPT ENFORCEMENT                                           │
│  - Khi tạo kịch bản, AI Agent bắt buộc phải nêu rõ tranh luận sử liệu nếu có:          │
│    "Theo Đại Việt Sử Ký Toàn Thư, tướng Ô Mã Nhi bị bắt sống... Tuy nhiên theo một số  │
│    sử liệu phương Bắc..."                                                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Ngưỡng Định Lượng Quyết Định Tranh Luận Kéo Dài (Protracted Debate Quantitative Threshold):**  
> Hai nguồn được coi là có **tranh luận kéo dài** và kích hoạt Bước 2 (Multi-Perspective) khi thỏa mãn 1 trong 2 điều kiện:
> 1. Cả 2 nguồn đều thuộc **Level 1** nhưng đưa ra dữ kiện mâu thuẫn.
> 2. Chênh lệch điểm tin cậy giữa hai nguồn cạnh tranh nhỏ hơn hoặc bằng $0.15$:  
>    $$|\text{Confidence}(Edge_A) - \text{Confidence}(Edge_B)| \le 0.15$$

### 5.3. Khung Phân Xử Xung Đột Lịch Sử Giữa Các Tác Phẩm Chính Sử PDF (Multi-Primary Conflicts Protocol)

Đối với mâu thuẫn trực tiếp giữa các tác phẩm chính sử Level 1 (*Toàn Thư* vs *Cương Mục* vs *Việt Sử Tiêu Án*):

1. **Không Loại Trừ Đơn Phương:** Cả 2 tác phẩm đều là di sản sử học giá trị. Hệ thống không bao giờ tự ý xóa 1 dữ kiện chính sử để lấy dữ kiện kia.
2. **Cơ Chế Graph Edge Multi-Source Tagging:** Mỗi cạnh quan hệ lưu thông tin nguồn cụ thể:
   - Edge A: `(Lê Lợi, BORN_YEAR, 1385)`, `source_work: "Dai_Viet_Su_Ky_Toan_Thu"`, `author: "Ngô Sĩ Liên"`.
   - Edge B: `(Lê Lợi, BORN_YEAR, 1384)`, `source_work: "Kham_Dinh_Viet_Su_Thong_Giam_Cuong_Muc"`, `author: "Quốc Sử Quán Triều Nguyễn"`.
3. **AI Scriptwriter Context Synthesis:** Khi sinh kịch bản, RAG Engine đóng gói cả 2 nguồn vào Prompt Context với tag `[DISPUTED_PRIMARY_SOURCES]` để AI Scriptwriter trình bày khách quan: *"Sử thư ghi nhận có hai góc nhìn: Theo Đại Việt Sử Ký Toàn Thư... Trong khi Khâm Định Việt Sử Thông Giám Cương Mục chép lại rằng..."*.

---

## 🔍 6. Quy Trình Kiểm Định & Giám Sát Chất Lượng RAG (RAG Quality Audit & Operational Parameters)

```bash
# Lệnh chạy kiểm định chất lượng dữ liệu nạp vào RAG Engine
pnpm --filter @chronoviet/data-ingestion eval:ingest
```

### 6.1. Bảng Chỉ Số KPI Chất Lượng Dữ Liệu & Phương Pháp Đo Lường Thực Tế:

| Tên chỉ số KPI | Định nghĩa & Phương pháp đo | Mục tiêu tối thiểu | Cơ chế Enforcement / Bảo đảm |
| :--- | :--- | :---: | :--- |
| **Entity Normalization Accuracy** | Tỷ lệ ánh xạ chính xác tên nhân vật cổ và địa danh về Canonical ID | **$> 98.0\%$** | Benchmark suite tự động trên tập test case chuẩn |
| **Cross-Linking Precision** | Tỷ lệ chính xác liên kết giữa thực thể và đoạn văn bản (`entity_chunks`) | **$> 98.0\%$** | Audit tự động trên 500 junction rows ngẫu nhiên |
| **Citation Traceability Score** | Tỷ lệ câu thoại kịch bản trỏ ngược được về đúng `chunk_id` gốc trong DB | **$100\%$** | **Guardrail Validator Gate:** Reject & Retry (Tối đa 3 lần). Sau 3 lần $\rightarrow$ **Circuit Breaker Flag `HUMAN_REVIEW`** |
| **Hallucination Rate** | Tỷ lệ thông tin AI tự suy đoán không có trong dữ liệu gốc | **$< 0.5\%$** *(Vận hành)* | **NLI Entailment Judge 2 Phase Architecture:**<br>- **Phase 1 (MVP/Node.js):** Zero-Shot LLM NLI Judge Prompting với Entailment Score $\ge 0.80$.<br>- **Phase 2 (Prod):** Python Sidecar Microservice (`xlm-roberta-base-nli-stsb-vietnamese`) qua ONNX Runtime. |
| **Data Duplicate Ratio** | Tỷ lệ đoạn văn bản trùng lặp còn sót lại trong Database | **$< 0.5\%$** | MinHash LSH & BGE-M3 Dense Cosine Check ($\ge 0.96$) |

### 6.2. Thông Số Mặc Định Công Thức Lấy Mẫu Thống Kê Spot-Check (Statistical Audit Parameters)

Cỡ mẫu kiểm định thủ công hàng chu kỳ cho quần thể vô hạn ($N \ge 10.000$) được tính theo công thức Cochran:
$$n_0 = \max\left(50, \; \left\lceil \dfrac{Z^2 \cdot p(1-p)}{e^2} \right\rceil \right)$$

Đối với các đợt kiểm định lô/batch dữ liệu nhỏ ($N < 10.000$), áp dụng **Công thức Hiệu chỉnh Quần thể Hữu hạn (Finite Population Correction - FPC)** để tránh lấy mẫu dư thừa:
$$n_{\text{adjusted}} = \left\lceil \dfrac{n_0}{1 + \dfrac{n_0 - 1}{N}} \right\rceil$$

**Giá trị tham số mặc định áp dụng chuẩn hóa trong hệ thống:**
* **Mức độ tin cậy (Confidence Level):** $95\% \implies Z = 1.96$.
* **Tỷ lệ lỗi dự kiến (Expected Error Rate):** $p = 0.05$ ($5\%$) cho quy trình kiểm soát chất lượng tiêu chuẩn. *(Trường hợp đánh giá cỡ mẫu bảo thủ tối đại áp dụng $p = 0.50$)*.
* **Sai số biên cho phép (Margin of Error):** $e = 0.05$ ($5\%$).
* **Cỡ mẫu tính toán thực tế:**
  * Khi $N \ge 10.000$ (với $p = 0.05$): $n_0 = \max\left(50, \left\lceil \dfrac{1.96^2 \cdot 0.05 \cdot 0.95}{0.05^2} \right\rceil\right) = \max(50, 73) = \mathbf{73 \text{ kịch bản/chunks}}$.
  * Khi $N \ge 10.000$ (với $p = 0.50$ Max volatility): $n_0 = \max\left(50, \left\lceil \dfrac{1.96^2 \cdot 0.5 \cdot 0.5}{0.05^2} \right\rceil\right) = \mathbf{385 \text{ kịch bản/chunks}}$.
  * Khi $N = 100$ batch kịch bản (với $p = 0.05, n_0 = 73$): $n_{\text{adjusted}} = \left\lceil \dfrac{73}{1 + \frac{72}{100}} \right\rceil = \mathbf{43 \text{ kịch bản/chunks}}$.

---

## 📑 7. Hướng Dẫn Thực Hành Cào & Nạp Dữ Liệu RAG Đạt Chuẩn (Best Practices for Developers)

### 7.1. Cắt Đoạn Theo Ranh Giới Ngữ Nghĩa (Semantic Boundary Chunking)

Khi thực hiện ingest văn bản sử ký:
* **Không dùng đếm từ cứng để ngắt dòng ngẫu nhiên.** Văn bản cổ sử có mối liên hệ nhân quả chặt chẽ giữa các câu.
* **Quy tắc cắt đoạn:** Mỗi child chunk đại diện cho **1 sự kiện lịch sử hoàn chỉnh** hoặc **1 đoạn luận điểm trọn vẹn**, có độ dài khuyến nghị từ **300 - 500 từ**, giữ nguyên tính liên tục của cặp nguyên nhân - kết quả.

### 7.2. Gán Nhãn Đa Thời Kỳ & Cập Nhật Từ Điển Entities

1. **Khi cào bài viết mới (Cơ chế Mảng `epoch_ids` Đa Thời Kỳ):**
   * Sử dụng lệnh `pnpm crawl:corpus --topics="..."` để qua bộ lọc `Quality Gate`.
   * Đối với các văn bản hoặc nhân vật kéo dài qua nhiều thời kỳ (vd: Nguyễn Trãi), gán nhãn dạng mảng: `epoch_ids: ["EPOCH_05", "EPOCH_06", "EPOCH_07", "EPOCH_08"]` và `lifetime_range: { start_year: 1380, end_year: 1442 }`.

2. **Khi phát hiện mâu thuẫn sử liệu hoặc alias mới:**
   * Cập nhật từ điển ánh xạ tại [`packages/shared-spec/src/historical-entities.ts`](../../packages/shared-spec/src/historical-entities.ts).
   * Chạy `pnpm --filter @chronoviet/data-ingestion rag:re-resolve` để cập nhật lại Đồ thị Tri thức hiện có.

3. **Luồng Media/Hình Ảnh Tiếp Theo:**
   * Sau khi kịch bản được tạo xong từ dữ liệu RAG văn bản, **Module 3 (VLM Inspector Agent)** sẽ chịu trách nhiệm tìm kiếm/sinh ảnh phù hợp bối cảnh kịch bản và kiểm định giấy phép bản quyền hình ảnh độc lập.

---

> 📄 **File liên quan:**  
> - [`docs/modules/00_DATA_PREPROCESSING_AND_INGESTION.md`](../modules/00_DATA_PREPROCESSING_AND_INGESTION.md)  
> - [`docs/modules/01_CHRONO_RAG_ENGINE.md`](../modules/01_CHRONO_RAG_ENGINE.md)  
> - [`packages/shared-spec/src/schema.ts`](../../packages/shared-spec/src/schema.ts)  
> - [`packages/shared-spec/src/historical-entities.ts`](../../packages/shared-spec/src/historical-entities.ts)
