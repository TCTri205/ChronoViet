# CHI TIẾT MÔ-ĐUN 3: VLM INSPECTOR SUB-AGENT
## (Visual Quality Control, Whitelisted Licensing & Hybrid Fallback Sub-Agent Specification v4.1)

> **Trạng thái:** `[✅ IMPLEMENTED — Visual Quality Control, Local Unified VLM & Cloud Gemini Scorers v4.1]`
> **Cập nhật:** Eval Integrity & Telemetry Gates — tích hợp **Correlation ID propagation**, **Failure latency metrics**, **Resource Payload Guards (5MB)**, **Binary Header Dimension Inspection (Layer 2)** và **Resilient JSON Parser**. Khi `EVAL_STRICT=true`, VLM Inspector dùng **Local Unified Multimodal VLM (`qwen3.5-9b-instruct-q4_k_m` qua llama-server)** làm scorer bắt buộc.

---

## 1. Mục Đích & Định Vị Kiến Trúc

Mô-đun **VLM Inspector Sub-Agent** là tài liệu phân tích kỹ thuật chi tiết cho một **Sub-Agent / Tool Thẩm Định Thị Giác & Bản Quyền** thuộc hệ thống [Multi-Agent Orchestrator](02_MULTI_AGENT_ORCHESTRATOR.md).

Khi thu thập hình ảnh tư liệu lịch sử Việt Nam tự động từ Internet, các hệ thống AI thông thường đối mặt với 4 nguy cơ nghiêm trọng:
1. **Sai lệch bối cảnh văn hóa (Cultural Anachronism):** Crawl nhầm ảnh phim cổ trang Trung Quốc, Hàn Quốc, hoặc trang phục triều đại không đúng thời kỳ lịch sử Việt Nam.
2. **Nhiễu thị giác (Visual Noise):** Ảnh bị dính watermark, logo kênh truyền hình, chữ đè lung tung, hoặc ảnh chất lượng thấp, vỡ nét.
3. **Ảnh không phù hợp định dạng:** Tỉ lệ ảnh bị bóp méo, thiếu tự nhiên hoặc độ phân giải thấp (<720p).
4. **Rủi ro pháp lý & Bản quyền (Copyright/License Risks):** Sử dụng hình ảnh không rõ nguồn gốc hoặc vi phạm bản quyền thương mại.

**Quy tắc nguồn tư liệu cốt lõi:** Trong hệ thống ChronoViet:
- **NGUỒN ẢNH CHỈ DUY NHẤT LÀ CRAWL** (từ Wikimedia Commons, kho ảnh bảo tàng, Flickr Creative Commons, thư viện ảnh cổ). Hệ thống **tuyệt đối không sử dụng các mô hình Generative AI để sinh ảnh giả lập**.
- **Research Agent (Micro-Step 1C)** tìm ảnh online qua provider chain (SerpAPI / Tavily / Brave Search API → Wikimedia Commons → Curated Catalog) và chỉ chấp nhận ảnh từ **domain whitelist**; VLM Inspector chỉ chấm điểm/lọc candidate đã được research.
- **100% ẢNH CRAWL PHẢI THUỘC WHITELIST LICENSE** (`Public Domain`, `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`) và đi kèm thông tin `attribution`.
- **Quan sát & Phối hợp ngữ cảnh (Observability & Trace Context):** Mọi tác vụ tải ảnh, lưu metadata và chấm điểm VLM đều mang theo `correlationId` và `sceneId` xuyên suốt; đo đạc `latencyMs` trên cả luồng thành công lẫn lỗi.

VLM Inspector Sub-Agent hỗ trợ **3 tầng scorer** với thứ tự ưu tiên thay đổi theo chế độ:
- **Eval strict (`EVAL_STRICT=true`, mặc định):** **Local Unified VLM (`qwen3.5-9b-instruct-q4_k_m`) qua llama-server** (`LLM_BASE_URL`) là scorer bắt buộc. Local VLM fail → eval FAIL ngay, **không** rơi vào Gemini/CLIP.
- **Fast Dev Mode (`FAST_DEV_MODE=true` & `EVAL_STRICT=false`):** Tự động kích hoạt shortcut chấm điểm heuristic bằng CLIP cục bộ siêu tốc, giảm tối đa thời gian chờ đợi khi kiểm thử tính năng kịch bản.
- **Dev thông thường (`EVAL_STRICT=false`):** Gemini 3.6 Flash Cloud API (Primary, hỗ trợ xoay vòng luân phiên `GEMINI_API_KEYS` Round-Robin và tự động failover/quarantine khi chạm rate limit HTTP 429) → Local CLIP/SigLIP Cosine Similarity Scorer (Offline Fallback khi mất kết nối hoặc toàn bộ key hết quota).
- Dual-Cache Redis 2 lớp (SHA-256 + pHash) luôn được kiểm tra trước mọi scorer.

---

## 2. Quy Trình Thẩm Định Lazy Sequential & Quản Lý Giấy Phép Bản Quyền (v4.2)

```
                       ┌───────────────────────────────┐
                       │   Research Agent cung cấp      │
                       │   Candidate Pool (Đa nguồn)   │
                       │   (Nguồn ảnh 100% Crawl Internet│
                       │    qua provider chain)          │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ BƯỚC 1: PRE-DOWNLOAD LICENSE FILTER & PROVENANCE RANKING                  │
  │ - Tiền lọc qua metadata: Chỉ duyệt Public Domain, CC0, CC-BY, CC-BY-SA     │
  │ - Loại bỏ trước khi tải file: Ngăn lãng phí băng thông và tài nguyên I/O   │
  │ - Xếp hạng nguồn gốc (Provenance Ranking):                                 │
  │     * Curated Catalog (Rank 3) > Wikimedia (Rank 2) > Web Search (Rank 1)  │
  └────────────────────────────────────┬───────────────────────────────────────┘
                                       │ (Đã sắp xếp theo độ tin cậy)
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ BƯỚC 2: LAZY SEQUENTIAL CURATION (Đánh giá tuần tự từng ứng viên)          │
  │ ┌────────────────────────────────────────────────────────────────────────┐ │
  │ │ Ứng viên #1 (Nguồn uy tín cao nhất)                                    │ │
  │ │ 1. Redis Dual-Cache (SHA-256 / pHash)                                  │ │
  │ │ 2. Technical Quality Gate (Sharp Resizer <=1920x1080, Binary Header)   │ │
  │ │ 3. VLM Inspection (Local Qwen3.5-9B VLM / Cloud Gemini)                │ │
  │ └────────────────────────────────┬───────────────────────────────────────┘ │
  └────────────────────────────────────┼───────────────────────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
       [Ứng viên #1 PASS (>= 60)]              [Ứng viên #1 FAIL (< 60/Lỗi Tech)]
                   │                                       │
                   ▼                                       ▼
       CHỌN NGAY & DỪNG KIỂM TRA               Thẩm định Ứng viên #2
       (Chỉ tốn đúng 1 lượt gọi VLM)          (Quy trình tương tự Bước 2)
                                                           │
                                       ┌───────────────────┴───────────────────┐
                                       ▼                                       ▼
                           [Ứng viên #2 PASS (>= 60)]              [Cả 2 ứng viên đều FAIL]
                                       │                                       │
                                       ▼                                       ▼
                           CHỌN ỨNG VIÊN #2                        KÍCH HOẠT CODE RULES ENGINE:
                                                                   Ép chuyển PURE_CODE & Xoay vòng
                                                                   Layout (STAT_CARD, QUOTE...)
```

---

## 3. Chi Tiết Thuật Toán Chấm Điểm Hybrid VLM (Scoring Algorithm)

### 3.1. Primary Scorer: System Prompt Template Cho Gemini 3.6 Flash / Local Unified VLM
```text
Bạn là chuyên gia thẩm định mỹ thuật và lịch sử Việt Nam thuộc hệ thống ChronoViet.
Hãy phân tích bức ảnh crawl này dựa trên ngữ cảnh sự kiện lịch sử: "{event_description}".

Hãy chấm điểm bức ảnh theo thang điểm 100 dựa trên 3 tiêu chí sau và trả về JSON thuần túy (camelCase):

1. historicalContextScore (0-40): 
   - Ảnh có đúng bối cảnh lịch sử Việt Nam không? 
   - Có bị nhầm sang phim cổ trang Trung Quốc/Hàn Quốc (kiểm tra trang phục, mũ mão, cờ hiệu, kiến trúc)?
2. visualNoiseScore (0-30):
   - 30 điểm nếu ảnh sạch hoàn toàn.
   - Trừ điểm nặng nếu dính watermark, logo kênh TV, chữ đè quá lớn.
3. artisticFitScore (0-30):
   - Ảnh có bị vỡ nét, mờ câm không? Tỉ lệ thẩm mỹ có tốt cho video không?

JSON Output format:
{
  "historicalContextScore": number,
  "visualNoiseScore": number,
  "artisticFitScore": number,
  "reasons": ["string"]
}
```

> **Lưu ý tính toán chuẩn xác:** Điểm tổng hợp `totalScore` ($historicalContextScore + visualNoiseScore + artisticFitScore$) và kết luận `verdict` (`PASS` khi $totalScore \ge 60$, ngược lại `REJECT`) được tính toán **thuần túy tất định trong TypeScript** tại `vlm-scorer.ts` để đảm bảo độ tin cậy và không phụ thuộc vào khả năng số học của mô hình.

### 3.2. Offline Fallback Scorer: Local CLIP/SigLIP Cosine Similarity Model
Khi Gemini Cloud API ngắt kết nối hoặc vượt ngưỡng rate-limit:
- **Công cụ:** Model ONNX `open_clip` / `SigLIP` chạy local.
- **Phương pháp:** Tính cosine similarity giữa Embedding của Lời thoại/Prompt Lịch sử $E_{\text{text}}$ và Embedding của bức ảnh $E_{\text{image}}$:
  $$\text{score} = \max(0, \min(100, \text{cosine\_similarity}(E_{\text{text}}, E_{\text{image}}) \times 100))$$
- Đảm bảo hệ thống visual QC 100% không bị ngưng trệ ngay cả khi mất mạng internet ngoài.

---

## 4. Cơ Chế Dự Phòng Tự Động (Strategy 3+3, Licensing & Fallback PURE_CODE)

VLM Inspector Sub-Agent phối hợp cùng Orchestrator theo chiến lược 3+3 Candidates:

| Trường Hợp Thất Bại | Chiến Lược Xử Lý (Strategy 3+3 & Fallback) | Cập Nhật JSON Kịch Bản |
| :--- | :--- | :--- |
| **Ảnh không thuộc Whitelisted License** | Loại bỏ ngay ở Lớp 0, không gọi VLM | Chuyển sang candidate tiếp theo hoặc Research Batch 2 |
| **Local VLM (strict) lỗi / server down** | **FAIL eval ngay** (`[EVAL_STRICT] Local VLM failed`) — không dùng Gemini/CLIP | Không xuất report PASS |
| **Dev: Cloud VLM API bị Rate Limit (HTTP 429/500)** | Tự động chuyển sang **Local CLIP Cosine Scorer** (Offline, chỉ khi `EVAL_STRICT=false`) | Gắn cờ `vlmScorerType: "LOCAL_CLIP"` vào Scene Props |
| **Ảnh đợt 1 dính watermark / vỡ nét / điểm < 60** | Kích hoạt Research Batch 2 (3 ảnh mở rộng về **Sơ đồ trận đánh / Bản đồ cổ / Di tích** do Research Agent thực hiện) | VLM so sánh toàn bộ 6 ảnh ứng viên để chọn ảnh đạt score cao nhất |
| **Cả 6 ảnh ứng viên đều < 60 điểm (hoặc nhầm bối cảnh văn hóa)** | Loại bỏ hoàn toàn hình ảnh, kích hoạt **PURE_CODE Layout Rotation Engine** | Xóa `assetUrl`, Code Rules Engine tự chọn layout xoay vòng (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`...) |
| **Research 404 / Không có dữ liệu mạng** | Ép chuyển thẳng sang **Pure Code LayoutMode** (Render 100% bằng Code) | Xóa `assetUrl`, chọn trong 20 Pure Code LayoutModes mà KHÔNG cần tốn token gọi lại LLM |

### 4.1. Cơ Chế Hoạt Động & Cơ Sở Kỹ Thuật Của Pure Code Fallback Engine
Khi cả 6 ảnh ứng viên đợt 1 & đợt 2 đều không đạt ngưỡng 60 điểm, hệ thống **không nhắm mắt sử dụng ảnh kém chất lượng** (để tránh rủi ro vi phạm bản quyền, dính watermark VTV/K+, nhầm trang phục phim cổ trang Trung Quốc/Hàn Quốc). 

Thay vào đó, hệ thống kích hoạt **Pure Code Fallback** chuyển giao cho Remotion Render Engine xử lý dựa trên các nguyên tắc:
1. **Thiết kế sẵn 20 Pure Code Components:** Remotion đã xây dựng sẵn 20 mẫu Layout UI bằng React (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`, `VERSUS_CARD`, `BULLET_HIGHLIGHT`, `MUSEUM_TAG`, `SPLIT_THEORY`, `ARTICLE_UI`, `SPONSOR_UI`, `OUTRO_CARD`, `TITLE_CARD`, `HERO_SPOTLIGHT`, `MAP_TACTICAL`, `ARMY_STRENGTH`, `CHARACTER_PROFILE`, `ROYAL_DECREE`, `ARTIFACT_INSPECT`, `POEM_RECITING`, `QUOTE_CANVAS`...).
2. **Code Rules Engine Mapping:** Master Orchestrator tự động trích xuất thuộc tính `overlayData` của phân cảnh (trích dẫn, mốc năm, quân số, điểm diễn biến) để ánh xạ 1:1 sang Layout Pure Code tương ứng mà không tốn thêm token gọi LLM.
3. **Tiêu chuẩn thẩm mỹ Documentary:** Xen kẽ các phân cảnh Data Visualization / Motion Graphics giúp duy trì nhịp độ thị giác chuyên nghiệp (tương tự phong cách các kênh tin tức / tài liệu lớn như Vox, Kurzgesagt).

---

## 5. Tương Tác Giữa VLM Sub-Agent Và Multi-Agent Orchestrator

**Đầu vào candidate:** VLM Inspector **nhận candidate pool từ Research Agent (Micro-Step 1C)** qua state `researchResults[sceneId]`. Research Agent gọi công cụ **`executeImageSearchTool`** với đầu vào **`ImageSearchToolInput`** chuẩn (`primaryQuery`, `englishQuery`, `visualType`, `historicalPeriod`, `aspectRatio`, `minResolution`), kích hoạt provider chain online (SerpAPI / Tavily / Brave Search API → Wikimedia Commons Live → Curated Catalog 14 assets verified) và chỉ chấp nhận ảnh từ domain whitelist, bảo đảm ảnh tải về được tự động tối ưu qua **Sharp Resizer (1080p, <=2MB)** trước khi VLM Inspector tiến hành chấm điểm bối cảnh lịch sử, nhiễu thị giác và thẩm mỹ.

```json
// Output trả về từ VLM Sub-Agent gửi đến Master Orchestrator (InspectSceneResult):
{
  "updatedScene": {
    "sceneId": "scene-03-battle",
    "layoutMode": "BLUR_BG",
    "contentType": "IMAGE",
    "selectedAsset": {
      "candidateId": "cand_scene-03-battle_01",
      "imageUrl": "https://upload.wikimedia.org/.../tran-bach-dang.jpg",
      "license": "CC_BY_SA_4_0",
      "author": "Bảo tàng Lịch sử Quốc gia",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tran_Bach_Dang.jpg",
      "score": {
        "historicalContextScore": 35,
        "visualNoiseScore": 25,
        "artisticFitScore": 25,
        "overallScore": 85
      },
      "verdict": "PASS"
    }
  },
  "selectedCandidate": {
    "candidateId": "cand_scene-03-battle_01",
    "imageUrl": "https://upload.wikimedia.org/.../tran-bach-dang.jpg",
    "license": "CC_BY_SA_4_0",
    "author": "Bảo tàng Lịch sử Quốc gia",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tran_Bach_Dang.jpg"
  },
  "isPureCodeFallback": false,
  "selectedLayoutMode": "BLUR_BG"
}
```

---

## 6. Ý Nghĩa Kỹ Thuật Của VLM Inspector Sub-Agent (v4.1)

Nhờ Sub-Agent VLM Inspector (Local Unified Multimodal VLM `qwen3.5-9b-instruct-q4_k_m` cho eval strict, Hybrid Gemini + Local CLIP cho dev, License Whitelist Filter và Redis Caching) và cơ chế Fallback Pure Code, ChronoViet giải quyết triệt để rủi ro lớn nhất của các hệ thống tự động hóa video: **Hệ thống luôn luôn render xuất ra được video hoàn chỉnh, đẹp mắt, an toàn về mặt văn hóa/lịch sử và tuân thủ bản quyền thương mại 100% ngay cả khi nguồn dữ liệu crawl trên internet bị thiếu sót hoặc cloud API gặp sự cố.**

---

## 7. Khung Đánh Giá & Benchmark Mô-đun (Evaluation Framework)

Mô-đun được đánh giá qua cả benchmark nội bộ lẫn quy trình Curation Ảnh & VLM Stage 2:

```bash
# Đánh giá nội bộ VLM Scorer & Cache
pnpm eval:vlm

# Đánh giá Curation Ảnh & Thẩm định VLM Stage 2 (Vision preflight: llm + vlm + search)
pnpm eval:video:stage2       # Chạy nối tiếp kịch bản từ Stage 1
pnpm eval:video:golden       # Chạy độc lập trên bộ Golden Script Fixtures (5 thời kỳ)
```

👉 *Xem chi tiết tiêu chí KPI tại:* [`eval/README.md`](../../eval/README.md)
