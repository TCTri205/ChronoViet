# CHI TIẾT MÔ-ĐUN 3: VLM INSPECTOR SUB-AGENT
## (Visual Quality Control, Whitelisted Licensing & Hybrid Fallback Sub-Agent Specification v3.3)

> **Trạng thái:** `[✅ IMPLEMENTED — Visual Quality Control, Local Unified VLM & Cloud Gemini Scorers v3.3]`
> **Cập nhật:** Eval Integrity Gates — khi `EVAL_STRICT=true`, VLM Inspector dùng **Local Unified Multimodal VLM (`qwen3.8-27b-instruct-q4_k_m` qua llama-server)** làm scorer bắt buộc; Gemini cloud & CLIP heuristic chỉ là chế độ dev (`EVAL_STRICT=false`).

---

## 1. Mục Đích & Định Vị Kiến Trúc

Mô-đun **VLM Inspector Sub-Agent** là tài liệu phân tích kỹ thuật chi tiết cho một **Sub-Agent / Tool Thẩm Định Thị Giác & Bản Quyền** thuộc hệ thống [Multi-Agent Orchestrator](02_MULTI_AGENT_ORCHESTRATOR.md).

Khi thu thập hình ảnh tư liệu lịch sử Việt Nam tự động từ Internet, các hệ thống AI thông thường đối mặt với 4 nguy cơ nghiêm trọng:
1. **Sai lệch bối cảnh văn hóa (Cultural Anachronism):** Crawl nhầm ảnh phim cổ trang Trung Quốc, Hàn Quốc, hoặc trang phục triều đại không đúng thời kỳ lịch sử Việt Nam.
2. **Nhiễu thị giác (Visual Noise):** Ảnh bị dính watermark, logo kênh truyền hình, chữ đè lung tung, hoặc ảnh chất lượng thấp, vỡ nét.
3. **Ảnh không phù hợp định dạng:** Tỉ lệ ảnh bị bóp méo, thiếu tự nhiên.
4. **Rủi ro pháp lý & Bản quyền (Copyright/License Risks):** Sử dụng hình ảnh không rõ nguồn gốc hoặc vi phạm bản quyền thương mại.

**Quy tắc nguồn tư liệu cốt lõi:** Trong hệ thống ChronoViet:
- **NGUỒN ẢNH CHỈ DUY NHẤT LÀ CRAWL** (từ Wikimedia Commons, kho ảnh bảo tàng, Flickr Creative Commons, thư viện ảnh cổ). Hệ thống **tuyệt đối không sử dụng các mô hình Generative AI để sinh ảnh giả lập**.
- **Research Agent (Micro-Step 1C)** tìm ảnh online qua provider chain (SerpAPI / Tavily / Brave Search API → Wikimedia Commons → Curated Catalog) và chỉ chấp nhận ảnh từ **domain whitelist**; VLM Inspector chỉ chấm điểm/lọc candidate đã được research.
- **100% ẢNH CRAWL PHẢI THUỘC WHITELIST LICENSE** (`Public Domain`, `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`) và đi kèm thông tin `attribution`.

VLM Inspector Sub-Agent hỗ trợ **3 tầng scorer** với thứ tự ưu tiên thay đổi theo chế độ:
- **Eval strict (`EVAL_STRICT=true`, mặc định):** **Local Unified VLM (`qwen3.8-27b-instruct-q4_k_m`) qua llama-server** (`LLM_BASE_URL`) là scorer bắt buộc. Local VLM fail → eval FAIL ngay, **không** rơi vào Gemini/CLIP.
- **Dev (`EVAL_STRICT=false`):** Gemini 2.5 Flash Cloud API (Primary, hỗ trợ xoay vòng luân phiên `GEMINI_API_KEYS` Round-Robin và tự động failover/quarantine khi chạm rate limit HTTP 429) → Local CLIP/SigLIP Cosine Similarity Scorer (Offline Fallback khi mất kết nối hoặc toàn bộ key hết quota).
- Dual-Cache Redis 2 lớp (SHA-256 + pHash) luôn được kiểm tra trước mọi scorer.

---

## 2. Quy Trình Kiểm Định 4 Lớp & Chiến Lược 3+3 Crawl Candidates (v4.1)

```
                       ┌───────────────────────────────┐
                       │   Crawl Batch 1 (3 Ảnh thô)   │
                       │   (Nguồn Crawl 100% Internet) │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ LỚP 0: LICENSE WHITELIST & ATTRIBUTION FILTER                              │
  │ - Chỉ nhận ảnh thuộc Public Domain, CC0, CC-BY-4.0, CC-BY-SA-4.0            │
  │ - Trích xuất metadata: author, sourceUrl, license                          │
  └────────────────────────────────────┬───────────────────────────────────────┘
                                       │ (Pass License)
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ LỚP 1: REDIS DUAL-LAYER CACHE CHECK (Exact Hash SHA-256 & pHash < 5)       │
  │ - Hit ➔ Trả ngay VLM Score & Verdict trong 1ms (Bỏ qua gọi VLM Engine)    │
  └────────────────────────────────────┬───────────────────────────────────────┘
                                       │ (Miss)
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ LỚP 2: METADATA & TECHNICAL FILTER                                         │
  │ - Kiểm tra độ phân giải: Resolution >= 600 x 600 px                        │
  │ - Kiểm tra định dạng file: JPEG, PNG, WEBP hợp lệ                         │
  │ - Kiểm tra tỉ lệ khung hình (Aspect Ratio check)                           │
  └────────────────────────────────────┬───────────────────────────────────────┘
                                       │ (Pass Technical)
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ LỚP 3: HYBRID VLM VISUAL & CONTEXT SCORING                                 │
  │ ├─ Eval strict: Local Unified VLM (qwen3.8-27b qua llama-server) — bắt buộc│
  │ ├─ Dev primary: Cloud Gemini 2.5 Flash API (khi có GEMINI_API_KEY)         │
  │ └─ Dev fallback (429/500/Timeout): Local CLIP/SigLIP Cosine Scorer        │
  │ - Historical Context Score (0-40): Đúng trang phục, cờ, kiến trúc VN?     │
  │ - Visual Noise Score (0-30): Có watermark, logo, chữ đè không?            │
  │ - Artistic & Resolution Fit (0-30): Độ sắc nét, phong cách nghệ thuật?   │
  └────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
       [Có ảnh điểm Max >= 60]                  [Tất cả 3 ảnh đợt 1 < 60]
                   │                                       │
                   ▼                                       ▼
       Duyệt ảnh tốt nhất Đợt 1               CRAWL BATCH 2 (3 ẢNH TỪ KHÓA MỞ RỘNG)
       (Lưu License & Attribution)            - Thử từ khóa Bản đồ/Sơ đồ/Di tích
                                              - VLM chấm điểm 3 ảnh Đợt 2
                                                           │
                                       ┌───────────────────┴───────────────────┐
                                       ▼                                       ▼
                           [Có ảnh điểm Max 6 ảnh >= 60]          [Cả 6 ảnh đều < 60 điểm]
                                       │                                       │
                                       ▼                                       ▼
                           Duyệt ảnh tốt nhất trong 6 ảnh       KÍCH HOẠT CODE RULES ENGINE:
                                                                Ép chuyển PURE_CODE & Xoay vòng
                                                                Layout (STAT_CARD, QUOTE...)
```

---

## 3. Chi Tiết Thuật Toán Chấm Điểm Hybrid VLM (Scoring Algorithm)

### 3.1. Primary Scorer: System Prompt Template Cho Gemini 2.5 Flash
```text
Bạn là chuyên gia thẩm định mỹ thuật và lịch sử Việt Nam thuộc hệ thống ChronoViet.
Hãy phân tích bức ảnh crawl này dựa trên ngữ cảnh sự kiện lịch sử: "{event_description}".

Hãy chấm điểm bức ảnh theo thang điểm 100 dựa trên 3 tiêu chí sau và trả về JSON:

1. historical_context_score (0-40): 
   - Ảnh có đúng bối cảnh lịch sử Việt Nam không? 
   - Có bị nhầm sang phim cổ trang Trung Quốc/Hàn Quốc (kiểm tra trang phục, mũ mão, cờ hiệu, kiến trúc)?
2. visual_noise_score (0-30):
   - 30 điểm nếu ảnh sạch hoàn toàn.
   - Trừ điểm nặng nếu dính watermark, logo kênh TV, chữ đè quá lớn.
3. artistic_fit_score (0-30):
   - Ảnh có bị vỡ nét, mờ câm không? Tỉ lệ thẩm mỹ có tốt cho video không?

JSON Output format:
{
  "historical_context_score": number,
  "visual_noise_score": number,
  "artistic_fit_score": number,
  "total_score": number,
  "verdict": "APPROVED" | "REJECTED",
  "reason": "string",
  "recommended_fallback": "RE_CRAWL_BATCH_2" | "PURE_CODE"
}
```

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
| **Ảnh không thuộc Whitelisted License** | Loại bỏ ngay ở Lớp 0, không gọi VLM | Chuyển sang candidate tiếp theo hoặc Crawl Batch 2 |
| **Local VLM (strict) lỗi / server down** | **FAIL eval ngay** (`[EVAL_STRICT] Local VLM failed`) — không dùng Gemini/CLIP | Không xuất report PASS |
| **Dev: Cloud VLM API bị Rate Limit (HTTP 429/500)** | Tự động chuyển sang **Local CLIP Cosine Scorer** (Offline, chỉ khi `EVAL_STRICT=false`) | Gắn cờ `vlmScorerType: "LOCAL_CLIP"` vào Scene Props |
| **Ảnh đợt 1 dính watermark / vỡ nét / điểm < 60** | Kích hoạt Crawl Batch 2 (3 ảnh mở rộng về **Sơ đồ trận đánh / Bản đồ cổ / Di tích**) | VLM so sánh toàn bộ 6 ảnh ứng viên để chọn ảnh đạt score cao nhất |
| **Cả 6 ảnh ứng viên đều < 60 điểm (hoặc nhầm bối cảnh văn hóa)** | Loại bỏ hoàn toàn hình ảnh, kích hoạt **PURE_CODE Layout Rotation Engine** | Xóa `assetUrl`, Code Rules Engine tự chọn layout xoay vòng (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`...) |
| **Crawl 404 / Không có dữ liệu mạng** | Ép chuyển thẳng sang **Pure Code LayoutMode** (Render 100% bằng Code) | Xóa `assetUrl`, chọn trong 11 Pure Code LayoutModes mà KHÔNG cần tốn token gọi lại LLM |

### 4.1. Cơ Chế Hoạt Động & Cơ Sở Kỹ Thuật Của Pure Code Fallback Engine
Khi cả 6 ảnh ứng viên đợt 1 & đợt 2 đều không đạt ngưỡng 60 điểm, hệ thống **không nhắm mắt sử dụng ảnh kém chất lượng** (để tránh rủi ro vi phạm bản quyền, dính watermark VTV/K+, nhầm trang phục phim cổ trang Trung Quốc/Hàn Quốc). 

Thay vào đó, hệ thống kích hoạt **Pure Code Fallback** chuyển giao cho Remotion Render Engine xử lý dựa trên các nguyên tắc:
1. **Thiết kế sẵn 11 Pure Code Components:** Remotion đã xây dựng sẵn 11 mẫu Layout UI bằng React (`STAT_CARD`, `QUOTE_SLIDE`, `TIMELINE_CHRONO`, `VERSUS_CARD`, `BULLET_HIGHLIGHT`, `MUSEUM_TAG`, `SPLIT_THEORY`...).
2. **Code Rules Engine Mapping:** Master Orchestrator tự động trích xuất thuộc tính `overlayData` của phân cảnh (trích dẫn, mốc năm, quân số, điểm diễn biến) để ánh xạ 1:1 sang Layout Pure Code tương ứng mà không tốn thêm token gọi LLM.
3. **Tiêu chuẩn thẩm mỹ Documentary:** Xen kẽ các phân cảnh Data Visualization / Motion Graphics giúp duy trì nhịp độ thị giác chuyên nghiệp (tương tự phong cách các kênh tin tức / tài liệu lớn như Vox, Kurzgesagt).

---

## 5. Tương Tác Giữa VLM Sub-Agent Và Multi-Agent Orchestrator

**Đầu vào candidate:** VLM Inspector **nhận candidate pool từ Research Agent (Micro-Step 1C)** qua state `researchResults[sceneId]`. Research Agent dùng provider chain online (SerpAPI / Tavily / Brave Search API → Wikimedia Commons → Curated Catalog) và chỉ chấp nhận ảnh từ domain whitelist, nên VLM Inspector không phải lọc nguồn rác — chỉ tập trung chấm điểm bối cảnh lịch sử, nhiễu thị giác và thẩm mỹ.

```json
// Output trả về từ VLM Sub-Agent gửi đến Master Orchestrator:
{
  "scene_id": "scene-03-battle",
  "asset_url": "https://upload.wikimedia.org/.../tran-bach-dang.jpg",
  "license_info": {
    "license": "CC_BY_SA_4_0",
    "author": "Bảo tàng Lịch sử Quốc gia",
    "source_url": "https://commons.wikimedia.org/wiki/File:Tran_Bach_Dang.jpg"
  },
  "vlm_inspection": {
    "total_score": 85,
    "verdict": "APPROVED",
    "scorer_type": "LOCAL_VLM", // hoặc GEMINI_CLOUD khi EVAL_STRICT=false
    "reason": "Ảnh sắc nét, chuẩn bối cảnh trận Bạch Đằng 1288, thuộc giấy phép CC-BY-SA-4.0 hợp lệ."
  },
  "action_taken": "USE_IMAGE",
  "updated_scene_props": {
    "layoutMode": "BLUR_BG",
    "assetUrl": "https://upload.wikimedia.org/.../tran-bach-dang.jpg",
    "license": "CC_BY_SA_4_0",
    "attribution": {
      "author": "Bảo tàng Lịch sử Quốc gia",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tran_Bach_Dang.jpg",
      "license": "CC_BY_SA_4_0"
    },
    "requiresAttribution": true
  }
}
```

---

## 6. Ý Nghĩa Kỹ Thuật Của VLM Inspector Sub-Agent (v3.3)

Nhờ Sub-Agent VLM Inspector (Local Unified Multimodal VLM `qwen3.8-27b-instruct-q4_k_m` cho eval strict, Hybrid Gemini + Local CLIP cho dev, License Whitelist Filter và Redis Caching) và cơ chế Fallback Pure Code, ChronoViet giải quyết triệt để rủi ro lớn nhất của các hệ thống tự động hóa video: **Hệ thống luôn luôn render xuất ra được video hoàn chỉnh, đẹp mắt, an toàn về mặt văn hóa/lịch sử và tuân thủ bản quyền thương mại 100% ngay cả khi nguồn dữ liệu crawl trên internet bị thiếu sót hoặc cloud API gặp sự cố.**
