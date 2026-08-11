# QUY CHUẨN QUẢN TRỊ CHIẾN LƯỢC DỮ LIỆU RAG, SỐ LƯỢNG, CHẤT LƯỢNG & GIẢI QUYẾT XUNG ĐỘT SỬ LIỆU CHRONOVIET
*(ChronoViet RAG Knowledge Base Strategy, Text Quality Governance & Historical Conflict Resolution Specification)*

> **Trạng thái:** `[✅ SPECIFICATION v1.3 — MASTER SOURCE OF TRUTH FOR RAG KNOWLEDGE BASE]`  
> **Cập nhật mới:** 2026-08-11 (Đính chính danh xưng Hán-Việt "Long Nhương Tướng Quân", phân loại alias_confidence cho "Hồ Thơm", chuẩn hóa 15 thời kỳ lịch sử, tách biệt Thời Hồ & Bắc Thuộc Lần 4, giải tỏa phạt chồng trọng số nguồn, quy trình bất đồng bản dịch Hán Nôm, cơ chế phê duyệt Modern Override, thuật toán merge node, KPI sampling theo công thức thống kê và gán mảng `epoch_ids` đa thời kỳ)  
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

Để đảm bảo RAG Engine truy xuất đủ chi tiết cho kịch bản documentary cho bất kỳ chủ đề nào, dữ liệu văn bản nạp vào phải phủ rộng qua **15 Thời Kỳ Lịch Sử Chuẩn Hóa** (kết hợp hai trục phân kỳ: Thể chế/Triều đại và Phong trào Yêu nước/Kháng chiến) cùng **5 Danh Mục Thực Thể Core**.

### 2.1. Độ Bao Phủ 15 Thời Kỳ Lịch Sử Việt Nam & Trục Phân Loại Kép (Dual-Axis Epoch Coverage)

> [!NOTE]
> **Lý Do Tách Phân Kỳ Chuẩn Hóa (15 Thời Kỳ):**  
> 1. **Tách Thời Hồ (1400 - 1407) & Bắc Thuộc Lần 4 (1407 - 1427):** Nhà Hồ là chính quyền phong kiến bản địa với nhiều chính sách canh tân đất nước; trong khi Bắc Thuộc Lần 4 là giai đoạn nhà Minh đô hộ, đất nước mất chủ quyền hoàn toàn và bùng nổ phong trào giải phóng dân tộc (Lam Sơn). Gộp hai thời kỳ này sẽ vi phạm tiêu chí nhất quán về bản chất chính trị.  
> 2. **Thời Kỳ Tây Sơn & Khởi Nghĩa (1771 - 1802):** Khởi nghĩa Tây Sơn bùng nổ từ 1771 (Tây Sơn Thượng đạo). Việc mở rộng mốc 1771 - 1802 đảm bảo toàn bộ giai đoạn khởi nghĩa chống chúa Nguyễn, quân Thanh và quân Xiêm được gắn nhãn chính xác.  
> 3. **Tách Thời Kỳ Pháp Thuộc (1858 - 1945) & Kháng Chiến Chống Pháp/Mỹ:** Đảm bảo không có "điểm mù truy xuất" cho giai đoạn 1858-1945 và phân biệt rõ hai cuộc chiến tranh có bối cảnh quốc tế hoàn toàn khác biệt.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
##                     15 THỜI KỲ LỊCH SỬ VIỆT NAM CHUẨN HÓA (DUAL-AXIS COVERAGE)                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Thời Hùng Vương - Văn Lang & Âu Lạc (Tự khởi đầu - 179 TCN)                                    │
│ 2. Thời Bắc Thuộc & Các Cuộc Khởi Nghĩa Giành Độc Lập (179 TCN - 938)                             │
│ 3. Thời Ngô - Đinh - Tiền Lê (938 - 1009)                                                        │
│ 4. Thời Lý (1009 - 1225)                                                                         │
│ 5. Thời Trần (1225 - 1400)                                                                       │
│ 6. Thời Nhà Hồ & Các Cuộc Canh Tân (1400 - 1407)                                                 │
│ 7. Thời Kỳ Bắc Thuộc Lần 4 & Khởi Nghĩa Lam Sơn (1407 - 1427)                                    │
│ 8. Thời Lê Sơ (1428 - 1527)                                                                      │
│ 9. Thời Nam - Bắc Triều & Trịnh - Nguyễn Phân Tranh (1527 - 1777)                                │
│ 10. Thời Kỳ Tây Sơn & Phong Trào Khởi Nghĩa (1771 - 1802)                                        │
│ 11. Thời Nhà Nguyễn Độc Lập (1802 - 1858)                                                        │
│ 12. Thời Kỳ Pháp Thuộc & Phong Trào Yêu Nước / Cách Mạng (1858 - 1945)                           │
│ 13. Thời Kỳ Kháng Chiến Chống Thực Dân Pháp (1945 - 1954)                                        │
│ 14. Thời Kỳ Kháng Chiến Chống Đế Quốc Mỹ & Thống Nhất Đất Nước (1954 - 1975)                     │
│ 15. Thời Kỳ Bảo Vệ Tổ Quốc, Đổi Mới & Hiện Đại (1975 - Nay)                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Mục Tiêu Số Lượng Chỉ Mộc Tri Thức RAG (RAG Volume Targets)

| Chỉ số Tri thức RAG | Mục tiêu Tối thiểu (Phase 1) | Mục tiêu Mở rộng (Phase 2-3) | Đơn vị tính |
| :--- | :---: | :---: | :--- |
| **Tổng số Child Chunks (`document_chunks`)** | $\ge 20.000$ | $\ge 100.000$ | Chunks (300-500 từ) |
| **Thực thể Lịch sử (`entities`)** | $\ge 10.000$ | $\ge 50.000$ | Nodes |
| **Bộ ba Quan hệ Đồ thị (`relationships`)** | $\ge 50.000$ | $\ge 250.000$ | Edges |
| **Bảng Liên kết Cross-Linking (`entity_chunks`)** | $\ge 40.000$ | $\ge 200.000$ | Junction Rows |

---

## 🏆 3. Phân Cấp Nguồn Sử Liệu Văn Bản & Quy Trình Xử Lý Đặc Thù (Source Reliability Hierarchy & Execution)

Mọi văn bản thô khi cào về hoặc nhập vào hệ thống bắt buộc phải được gán nhãn **Cấp độ Tin cậy (`source_reliability`)** theo 3 tầng:

```text
               ┌──────────────────────────────────────────────┐
               │    LEVEL 1: CHÍNH SỬ & HỌC THUẬT NGUYÊN BẢN   │ (Trọng số: W = 1.0)
               │    - Đại Việt Sử Ký Toàn Thư, Khâm Định...   │
               └──────────────────────┬───────────────────────┘
                                      │
               ┌──────────────────────▼───────────────────────┐
               │  LEVEL 2: TƯ LIỆU BÁCH KHOA & SÁCH GIÁO KHOA  │ (Trọng số: W = 0.8)
               │  - Wikipedia/Wikisource đã kiểm định, SGK... │
               └──────────────────────┬───────────────────────┘
                                      │
               ┌──────────────────────▼───────────────────────┐
               │ LEVEL 3: DÃ SỬ, TRUYỀN THUYẾT & GIAI THOẠI    │ (Trọng số: W = 0.5)
               │ - Truyền thuyết dân gian, Dã sử, Giai thoại...│
               └──────────────────────────────────────────────┘
```

### 3.1. Chi Tiết Phân Loại Cấp Độ Tin Cậy

1. **LEVEL 1 — Chính Sử & Văn Bản Học Thuật Nguyên Bản (Ground Truth Level 1 | Trọng số $W = 1.0$):**
   * **Nguồn dữ liệu:** *Đại Việt Sử Ký Toàn Thư* (Lê Văn Hưu, Phan Phu Tiên, Ngô Sĩ Liên), *Khâm Định Việt Sử Thông Giám Cương Mục* (Quốc Sử Quán Nhà Nguyễn), *Việt Sử Lược*, *Bình Ngô Đại Cáo*, *Hịch Tướng Sĩ*, các công trình khảo cứu nguyên bản xuất bản bởi Viện Sử Học Việt Nam.
   * **Quy tắc:** Căn cứ nền tảng để xác minh sự thật lịch sử. Khi mâu thuẫn với Level 2 hoặc Level 3, Level 1 có ưu tiên mặc định.

2. **LEVEL 2 — Tư Liệu Bách Khoa & Chuẩn Giáo Dục (Ground Truth Level 2 | Trọng số $W = 0.8$):**
   * **Nguồn dữ liệu:** Wikipedia tiếng Việt (đã qua bộ lọc Quality Gate), Vi.Wikisource, Sách giáo khoa Lịch sử Bộ Giáo dục & Đào tạo, các bài báo khoa học lịch sử đã qua phản biện (*Peer-Reviewed Journals*).
   * **Quy tắc:** Dùng để làm phong phú chi tiết, giải thích từ ngữ Hán-Việt, thuật ngữ chính trị và bổ sung ngữ cảnh hiện đại.

3. **LEVEL 3 — Truyền Thuyết Dân Gian & Dã Sử (Ground Truth Level 3 | Trọng số $W = 0.5$):**
   * **Nguồn dữ liệu:** *Lĩnh Nam Chích Quái*, *Việt Điện U Linh Tập*, truyền thuyết dân gian (Sơn Tinh Thủy Tinh, Thánh Gióng, An Dương Vương...), giai thoại truyền miệng.
   * **Quy tắc:** Bắt buộc gán nhãn `category: "FOLKLORE_MYTH"`. Dữ liệu này chỉ được dùng làm chất liệu nghệ thuật cho kịch bản, **tuyệt đối không được khẳng định là sự thật lịch sử khách quan**.

### 3.2. Tiêu Chí & Quy Trình Phê Duyệt "Modern Scholarly Consensus Override Protocol"

> [!WARNING]
> **Quy Trình Phê Duyệt Cờ Modern Override:**  
> Để tránh tình trạng một bài viết đơn lẻ chưa kiểm chứng bị dùng để ghi đè chính sử, việc gắn cờ `has_modern_scholarly_override: true` phải đáp ứng đầy đủ **2 Tiêu chuẩn Bắt buộc**:
> 1. **Tiêu chuẩn Bằng chứng:** Phải có ít nhất **2 công trình nghiên cứu/bài báo phản biện độc lập** (Peer-Reviewed) từ các cơ quan uy tín (Viện Sử Học, Tạp chí Nghiên cứu Lịch sử, Cục Di sản Văn hóa...) HOẶC bằng chứng khảo cổ học / đo đạc phóng xạ carbon verified.
> 2. **Tiêu chuẩn Phê duyệt:** Phải được xác thực qua quy trình Sign-off Gate bởi Hội đồng Biên tập Lịch sử (`approved_by: "HISTORICAL_BOARD"`).

### 3.3. Quy Trình Kiểm Định & Xử Lý Bất Đồng Bản Dịch Hán / Hán Nôm (Classical Chinese Translation Protocol)

Đối với các nguồn cổ văn Hán / Hán Nôm (*Minh Thực Lục*, *Nguyên Sử*, *Châu Bản Nhà Nguyễn*...):
1. **OCR & Trích Xuất Chuyên Dụng:** Sử dụng mô hình OCR tối ưu cho chữ Hán/Nôm cổ (như NomNaOCR).
2. **Xử Lý Bất Đồng Bản Dịch (Dual-Translation Disagreement Protocol):** Khi 2 bản dịch tiếng Việt uy tín (ví dụ: Viện Hán Nôm vs NXB Khoa Học Xã Hội) bất đồng về ý nghĩa, mốc thời gian hay danh xưng:
   * **Không tự ý chọn 1 bản dịch.**
   * Lưu trữ dưới dạng **Biến thể Dịch thuật (Translation Variant Nodes/Edges)** trong DB kèm thuộc tính:
     `translation_variants: [{ translator: "Viện Hán Nôm", text: "..." }, { translator: "NXB KHXH", text: "..." }]`.
   * Áp dụng khung Multi-Perspective (Mục 5.2) để AI Scriptwriter trình bày cả 2 góc nhìn dịch thuật trong kịch bản.

### 3.4. Quy Trình Đảm Bảo Bản Quyền & Sở Hữu Trí Tuệ Khi Cào Text (Text Copyright Governance)

1. **Public Domain:** Văn bản cổ đại/trung đại (đã quá 50 năm sau khi tác giả qua đời), văn bản hành chính nhà nước công bố rộng rãi $\rightarrow$ Cho phép cào và nạp đầy đủ nội dung (`license_status: "PUBLIC_DOMAIN"`).
2. **Open Access:** Bài báo Open Access (CC-BY), SGK công khai $\rightarrow$ Cho phép nạp chunk kèm citation trích dẫn (`license_status: "CREATIVE_COMMONS"`).
3. **Sách Chuyên Khảo Thương Mại:** Tác phẩm chuyên khảo còn bảo hộ bản quyền $\rightarrow$ **Tuyệt đối không lưu verbatim toàn văn (full-text)**; chỉ cho phép trích xuất **Tóm tắt Diễn giải (Abstractive Summary Chunks)** kèm thông tin citation (`license_status: "FAIR_USE_SUMMARY"`).

### 3.5. Giải Tỏa Phạt Chồng & Cơ Chế Áp Dụng Trọng Số Nguồn (Source Weight Decoupling & Execution)

> [!NOTE]
> **Giải Tỏa Rủi Ro "Phạt Chồng" (Over-Penalization Avoidance):**  
> Trọng số nguồn $W_{\text{source}} \in \{1.0, 0.8, 0.5\}$ được dùng để phân xử **Độ tin cậy sự thật (Fact Confidence)**, KHÔNG ĐƯỢC dùng để triệt hạ **Độ liên quan truy xuất (Retrieval Relevance)**. Nếu nhân $W_{\text{source}} = 0.5$ trực tiếp vào bước tìm kiếm, các truy vấn về dã sử (vd: "kể chuyện Sơn Tinh Thủy Tinh") sẽ bị đánh tụt thứ hạng chunk dã sử một cách vô lý.

Cơ chế thực thi trọng số nguồn được tách bạch làm 3 cấp độ:

1. **Bước Tìm Kiếm (Retrieval Phase):**  
   Tìm kiếm thuần túy dựa vào độ liên quan ngữ nghĩa và từ khóa:
   $$\text{RelevanceScore}(chunk) = \alpha \cdot \text{DenseCosineSim} + (1-\alpha) \cdot \text{BM25Sim}$$
   *Đối với các truy vấn có ý định xác minh sự thật ("xác minh", "có thật không"), $W_{\text{source}}$ chỉ tham gia như một hệ số re-rank nhẹ với tỷ trọng $\le 15\%$.*
2. **Bước Đồ Thị Tri Thức (Knowledge Graph Edge Confidence):**  
   Nhân $W_{\text{source}}$ trực tiếp vào `confidence_score` của Edge trên Graph:
   $$\text{Confidence}_{\text{edge}} = W_{\text{source}} \times \text{ExtractorModelConfidence}$$
3. **Bước Đóng Gói Prompt Cho AI Scriptwriter (Prompt Context Framing):**  
   Gán nhãn thẩm quyền nguồn vào từng chunk truyền vào LLM context: `[SOURCE_TIER: LEVEL_1 | W=1.0]` hoặc `[SOURCE_TIER: LEVEL_3 | W=0.5]`. Prompt yêu cầu AI Scriptwriter dùng giọng văn khẳng định với Level 1 và giọng văn giả thuyết/nghệ thuật ("Theo truyền thuyết dân gian...") đối với Level 3.

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

Khi chạy pipeline re-indexing (`pnpm --filter @chronoviet/rag-engine rag:re-resolve`) để gộp các nút thực thể cũ:
- **Cạnh không mâu thuẫn (cùng thuộc tính/giá trị):** Lấy $\max(\text{Confidence}_A, \text{Confidence}_B)$.
- **Cạnh mâu thuẫn giá trị (vd: Nguồn A bảo sinh năm 1225, Nguồn B bảo sinh năm 1226):** **Tuyệt đối không ghi đè ngẫu nhiên.** Hệ thống tự động chuyển đổi thành 2 cạnh song song theo mô hình **Multi-Perspective Graph Edge** (Mục 5.2) kèm trích dẫn nguồn riêng biệt.

---

## ⚔️ 5. Khung Giải Quyết Xung Đột Sử Liệu (Historical Conflict Resolution Framework)

### 5.1. Các Dạng Xung Đột Thường Gặp
1. **Xung đột mốc thời gian:** Năm sinh/năm mất, năm diễn ra trận đánh chênh lệch 1-2 năm.
2. **Xung đột lực lượng/quân số:** Sử Việt ghi quân Nguyên-Mông 50 vạn, sử nhà Nguyên ghi 10-20 vạn.
3. **Xung đột kết cục trận đánh / nhân vật:** Tướng bị bắt sống hay tử trận tại chỗ (ví dụ: tướng Ô Mã Nhi tại trận Bạch Đằng 1288).

### 5.2. Thuật Toán Giải Quyết Xung Đột 3 Bước (3-Step Conflict Resolution)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          BƯỚC 1: XÁC ĐỊNH CẤP ĐỘ NGUỒN (LEVEL & SCHOLARLY CONSENSUS)   │
│  - Nếu Nguồn A (Level 1) mâu thuẫn Nguồn B (Level 3) ──► Chọn Nguồn A                  │
│  - Nếu Nguồn B (Level 2/Hiện đại) có bằng chứng khảo cổ/đồng thuận khoa học ──► Override│
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ (Nếu 2 nguồn cùng Level 1 hoặc tranh luận kéo dài)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   BƯỚC 2: BIỂU DIỄN ĐỒ THỊ ĐA GÓC NHÌN (MULTI-PERSPECTIVE)             │
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
│                   BƯỚC 3: AI SCRIPTWRITER PROMPT ENFORCEMENT                           │
│  - Khi tạo kịch bản, AI Agent bắt buộc phải nêu rõ tranh luận sử liệu nếu có:          │
│    "Theo Đại Việt Sử Ký Toàn Thư, tướng Ô Mã Nhi bị bắt sống... Tuy nhiên theo một số  │
│    sử liệu phương Bắc..."                                                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Đính Chính Sử Liệu Trong Minh Họa Mẫu (Historical Accuracy Note):**  
> Tướng Nguyên-Mông **Toa Đô (Sogetu)** tử trận tại **Tây Kết (1285)** trong cuộc kháng chiến chống Nguyên-Mông lần 2, **KHÔNG PHẢI Trận Bạch Đằng (1288)** (Trận Bạch Đằng 1288 là cuộc kháng chiến lần 3, chống Ô Mã Nhi và Phàn Tiếp). Mọi ví dụ trong codebase và seed data phải tuân thủ chuẩn xác mốc lịch sử này để tránh nạp dữ liệu sai từ đầu.

---

## 🔍 6. Quy Trình Kiểm Định & Giám Sát Chất Lượng RAG (RAG Quality Audit & KPI Metrics)

```bash
# Lệnh chạy kiểm định chất lượng dữ liệu nạp vào RAG Engine
pnpm --filter @chronoviet/rag-engine eval:ingest
```

### Bảng Chỉ Số KPI Chất Lượng Dữ Liệu & Phương Pháp Đo Lường Thực Tế:

| Tên chỉ số KPI | Định nghĩa & Phương pháp đo | Mục tiêu tối thiểu | Cơ chế Enforcement / Bảo đảm |
| :--- | :--- | :---: | :--- |
| **Entity Normalization Accuracy** | Tỷ lệ ánh xạ chính xác tên nhân vật cổ và địa danh về Canonical ID | **$> 98.0\%$** | Benchmark suite tự động trên tập test case chuẩn |
| **Citation Traceability Score** | Tỷ lệ câu thoại kịch bản trỏ ngược được về đúng `chunk_id` gốc trong DB | **$100\%$** | **Guardrail Validator Gate:** Reject & Retry lập tức nếu câu thoại không có citation hợp lệ |
| **Hallucination Rate** | Tỷ lệ thông tin AI tự suy đoán không có trong dữ liệu gốc | **$< 0.5\%$** *(Vận hành)* | **Grounding Check (NLI Entailment)** 100% output tự động + **Human Audit Spot-check** theo mẫu thống kê |
| **Data Duplicate Ratio** | Tỷ lệ đoạn văn bản trùng lặp còn sót lại trong Database | **$< 0.5\%$** | MinHash LSH & BGE-M3 Dense Cosine Check ($\ge 0.96$) |

> [!NOTE]
> **Công Thức Thống Kê Xác Định Cỡ Mẫu Spot-Check (Statistical Audit Sampling):**  
> Cỡ mẫu kiểm định thủ công hàng chu kỳ được tính theo công thức: $n = \max\left(50, \; \left\lceil \dfrac{Z^2 \cdot p(1-p)}{e^2} \right\rceil \right)$ hoặc tối thiểu $5\%$ tổng số lượng kịch bản xuất bản trong chu kỳ sprint, đảm bảo độ tin cậy thống kê $95\%$.

---

## 📑 7. Hướng Dẫn Thực Hành Cào & Nạp Dữ Liệu RAG Đạt Chuẩn (Best Practices for Developers)

1. **Khi cào bài viết mới (Cơ chế Mảng `epoch_ids` Đa Thời Kỳ):**
   * Sử dụng lệnh `pnpm crawl:corpus --topics="..."` để qua bộ lọc `Quality Gate`.
   * Đối với các văn bản hoặc nhân vật kéo dài qua nhiều thời kỳ (vd: Nguyễn Trãi), gán nhãn dạng mảng: `epoch_ids: ["EPOCH_05", "EPOCH_06", "EPOCH_07", "EPOCH_08"]` và `lifetime_range: { start_year: 1380, end_year: 1442 }`.

2. **Khi phát hiện mâu thuẫn sử liệu hoặc alias mới:**
   * Cập nhật từ điển ánh xạ tại [`packages/rag-engine/src/ingestion/text/historical-entity-mapper.ts`](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/text/historical-entity-mapper.ts).
   * Chạy `pnpm --filter @chronoviet/rag-engine rag:re-resolve` để cập nhật lại Đồ thị Tri thức hiện có.

3. **Luồng Media/Hình Ảnh Tiếp Theo:**
   * Sau khi kịch bản được tạo xong từ dữ liệu RAG văn bản, **Module 3 (VLM Inspector Agent)** sẽ chịu trách nhiệm tìm kiếm/sinh ảnh phù hợp bối cảnh kịch bản và kiểm định giấy phép bản quyền hình ảnh độc lập.

---

> 📄 **File liên quan:**  
> - [`docs/modules/00_DATA_PREPROCESSING_AND_INGESTION.md`](file:///d:/Persional_Projects/ChronoViet/docs/modules/00_DATA_PREPROCESSING_AND_INGESTION.md)  
> - [`docs/modules/01_CHRONO_RAG_ENGINE.md`](file:///d:/Persional_Projects/ChronoViet/docs/modules/01_CHRONO_RAG_ENGINE.md)  
> - [`packages/shared-spec/src/schema.ts`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec/src/schema.ts)  
> - [`packages/rag-engine/src/ingestion/text/historical-entity-mapper.ts`](file:///d:/Persional_Projects/ChronoViet/packages/rag-engine/src/ingestion/text/historical-entity-mapper.ts)
