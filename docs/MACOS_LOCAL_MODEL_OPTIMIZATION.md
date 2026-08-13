# HƯỚNG DẪN TỐI ƯU HÓA MÔ HÌNH LOCAL TRÊN MACOS (APPLE SILICON)
## (Apple Silicon Local Model Acceleration & Historical Document Intelligence Architecture Spec for ChronoViet - 2026 Edition)

---

## 1. TỔNG QUAN HẠ TẦNG & TƯ DUY THIẾT KẾ CỐT LÕI (HISTORICAL DOCUMENT INTELLIGENCE SYSTEM)

Hệ thống **ChronoViet** xử lý đồng thời nhiều tác vụ AI phức tạp: từ trích xuất tri thức lịch sử (GraphRAG), tổng hợp giọng đọc di sản (VieNeu TTS), giải mã tư liệu cổ (Historical OCR Hán-Nôm & Quốc ngữ cổ), đến kiểm định tính xác thực của hình ảnh tư liệu (Visual Verification).

### 🌟 CHUYỂN ĐỔI TRIẾT LÝ NỀN TẢNG: HISTORICAL DOCUMENT INTELLIGENCE SYSTEM
> **ChronoViet KHÔNG ĐƯỢC thiết kế như một hệ thống "Qwen + RAG" thông thường. ChronoViet là một Hệ thống Trí tuệ Tư liệu Lịch sử (Historical Document Intelligence System).**

Sự khác biệt cốt lõi: Thay vì cố gắng chọn một mô hình LLM tổng quát duy nhất rồi xây dựng mọi thứ xung quanh nó, ChronoViet phân rã và gán **mỗi loại bằng chứng lịch sử** (văn bản Quốc ngữ cổ, triện ấn, văn bản Hán-Nôm, bản đồ cổ, hiện vật, âm thanh di sản) cho một **mô hình / engine chuyên trách tối ưu nhất**.

---

### 🌟 TIÊU CHUẨN HÓA NỀN TẢNG HẠ TẦNG: `llama.cpp` METAL ENGINE

ChronoViet chính thức lựa chọn **`llama.cpp` (Metal & GGML Ecosystem)** làm **công nghệ hạ tầng cốt lõi (Core Local AI Engine)** trên Apple Silicon nhờ tận dụng kiến trúc **Unified Memory Architecture (UMA)** (băng thông từ 100GB/s đến 800GB/s).

#### Lý do chọn `llama.cpp` làm Nền tảng Công nghệ Chuẩn:
1. **Hiệu năng Metal Native tối đa:** Tối ưu hóa sâu cho Apple Silicon thông qua Metal API (`GGML_USE_METAL`), ARM NEON vector instructions và Accelerate framework, khai thác trọn vẹn băng thông UMA.
2. **Hệ sinh thái Tính năng & API Endpoints Chuẩn:** Gateway hỗ trợ 3 chuẩn API Endpoints linh hoạt:
   * `POST /v1/chat/completions` (OpenAI Chat Completions format compatible).
   * `POST /v1/responses` (OpenAI Responses API format compatible).
   * `POST /v1/messages` (Anthropic Messages API format compatible).
   * Continuous Batching & Prompt Caching cho xử lý đa truy vấn.
   * Native Embedding & Reranking Endpoints (hỗ trợ GGUF quantized embeddings & rerankers).
   * Multimodal VLM Support (`mmproj` cho vision-language models như Qwen3.5/Qwen3-VL).
   * Structured JSON Schema Output & Function Calling cho Agentic workflows.
3. **Độ ổn định & Quản lý Bộ nhớ Production-Grade:** Quản lý RAM/VRAM chặt chẽ, hỗ trợ cơ chế tự động chuyển vùng (fallback) sang Cloud API (**`Agnes 2.0 Flash`**) khi tài nguyên local quá tải hoặc cạn kiệt RAM.

---

## 2. KIẾN TRÚC THỰC THI & QUẢN LÝ VÒNG ĐỜI BỘ NHỚ UMA (32GB RAM TARGET)

### 2.1. Phân định vai trò các Runtime trên macOS

ChronoViet duy trì lớp trừu tượng **Local Model Gateway** (`ModelProvider`) để linh hoạt điều phối các runtime backend và Cloud Fallback Provider:

```text
                                 ChronoViet Application Layer
                                              │
                                    LocalModelGateway API
                  (Endpoints: /v1/chat/completions | /v1/responses | /v1/messages)
                                              │
        ┌───────────────────┬────────────────┼───────────────────┬──────────────────┐
        │                   │                │                   │                  │
  LLM Provider      Embedding Provider Rerank Provider    Vision & OCR        TTS Provider
        │                   │                │                   │                  │
 ┌──────┴──────┐      ┌─────┴──────┐   ┌─────┴──────┐      ┌─────┴──────┐     ┌─────┴──────┐
 │             │      │            │   │            │      │            │     │            │
llama-server Agnes 2.0 llama-server MLX llama-server MLX SigLIP 2 Qwen3-VL  VieNeu   MPS/CPU
(Qwen3.5-27B-Q4) (Flash API) (llama.cpp)      (llama.cpp)      (CoreML) PaddleOCR (ONNX)   Benchmark
 (Primary)   (Fallback)
```

* **`llama-server` (`Qwen3.5-27B-Q4` Local Metal Engine) — PRIMARY PRODUCTION ENGINE:**
  Backend chính cho LLM Generation, Text Embedding, Reranking và VLM Inspection chạy cục bộ trên macOS.
* **`Agnes 2.0 Flash` (Remote API Fallback Engine) — ZERO-DOWNTIME CLOUD FALLBACK:**
  Chế độ dự phòng linh hoạt qua API Key (`AGNES_API_KEY`). Tự động kích hoạt khi local Metal OOM, server local bận hoặc khi truy vấn đòi hỏi tốc độ xử lý tức thì (Flash speed).
* **Ollama — DEVELOPMENT WRAPPER:**
  Công cụ đóng gói/quản lý model weights cho Developer trong quá trình phát triển (Dev UI / Quick Pull).
* **Apple MLX (`mlx-lm`) — RESEARCH & BENCHMARK CANDIDATE:**
  Backend tham chiếu để đo đạc và benchmark hiệu năng single-stream khi cần thiết.

---

### 2.2. Chiến lược Quản lý Bộ nhớ UMA (32GB RAM Target Benchmark Profile)

Khi vận hành nhiều mô hình AI đồng thời trên Mac 32GB RAM, tổng dung lượng RAM nếu nạp tất cả mô hình cùng lúc có thể đạt 36.5GB+, gây ra **Memory Swapping / Compression** và dẫn tới **Metal OOM Crash**. 

ChronoViet thiết kế chiến lược nạp mô hình phân tầng **Resident vs. On-Demand**:

```text
                                 32GB UMA RAM ALLOCATION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ RESIDENT MODELS (Thường trực ~17.6 GB)                                                   │
│ ├── Qwen3.5-27B LLM (GGUF Q4_K_M): ~16.0 GB                                             │
│ ├── Qwen3-Embedding-0.6B (GGUF Q8_0): ~0.8 GB                                            │
│ └── Qwen3-Reranker-0.6B (GGUF Q8_0): ~0.8 GB                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ DYNAMIC WORKING MEMORY (Dynamic ~8.4 GB)                                                │
│ ├── KV Cache (Dynamic Context Buffer): ~4.0 – 6.0 GB                                    │
│ └── ON-DEMAND MODELS (Nạp khi cần / Giải phóng ngay): ~2.4 – 4.4 GB                      │
│     ├── SigLIP 2 ONNX Fast Filter: ~0.4 GB                                              │
│     ├── Qwen3-VL-8B / OCR Router: ~3.0 – 4.0 GB                                         │
│     └── VieNeu TTS ONNX Service: ~0.5 GB                                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ OS & CORE SYSTEM (Hệ điều hành macOS & App Core): ~6.0 GB                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Quy tắc Vận hành Concurrency:
1. **Resident Tier:** Giữ nguyên LLM Primary (`Qwen3.5-27B`), Embedding (`0.6B`) và Reranker (`0.6B`) thường trực trong UMA RAM.
2. **On-Demand Tier:** `SigLIP 2`, `Qwen3-VL-8B`, `Historical OCR Engine` và `VieNeu TTS` được nạp theo luồng công việc (job queue) và giải phóng bộ nhớ ngay sau khi hoàn tất tác vụ xử lý hình ảnh/âm thanh.
3. **Quantization Precision Hygiene:** Đối với domain lịch sử, các sai sót nhỏ về con số và danh xưng (như *1788 vs 1789*, *Nguyễn Huệ vs Nguyễn Nhạc*, *Lê sơ vs Lê Trung Hưng*) là không thể chấp nhận được. ChronoViet bắt buộc benchmark đối chiếu giữa `Q4_K_M` và `Q5_K_M` để đảm bảo độ chính xác dữ kiện cao nhất trước khi lựa chọn bản nén sản xuất.

---

## 3. RECOMMENDED MODEL STACK TIÊU CHUẨN CHO CHRONOVIET (2026 EDITION)

### 📊 BẢNG TỔNG HỢP SO SÁNH MA TRẬN MODEL STACK

| Thành phần | File Spec Cũ | Đánh giá / Cập nhật 2026 | Lựa chọn Chính thức (ChronoViet Spec 2026) |
| :--- | :--- | :--- | :--- |
| **LLM chính** | Qwen3.6-27B | 🟢 Cần ưu tiên model chuyên Historical & Multimodal Reasoning | **Qwen3.5-27B** (Primary) / **Qwen3.6-27B** (Benchmark Candidate) |
| **Embedding** | Qwen3-Embedding-0.6B | 🟡 Tốt nhưng cần tầng chất lượng cao cho tư liệu khó | **2-Tier: Qwen3-Embedding-0.6B** (Default) + **4B** (High-Quality Tier) |
| **Reranker** | Qwen3-Reranker-0.6B | 🟢 Rất tốt | **Qwen3-Reranker-0.6B** (Primary) / **4B** (Benchmark Candidate) |
| **VLM / Multimodal**| Qwen3-VL-8B | 🟡 Cần phân tầng lại vai trò | **Qwen3-VL-8B** (Fast/Medium Inspector) + **Qwen3.5-27B** (Deep Multimodal) |
| **Vision Filter** | SigLIP | 🟡 Cần nâng cấp lên chuẩn multilingual 2025/2026 | **SigLIP 2** (Multilingual Vision Encoder) |
| **Historical OCR** | Chưa có engine riêng | 🔴 Lỗ hổng lớn (VLM không thay được OCR tài liệu cổ) | **Historical OCR Pipeline riêng** (Layout Detection + ViOCR + Hán/Nôm + LLM Correction) |
| **Multimodal IR** | Chưa có | 🟡 Xu hướng mới 2026 | **Qwen3-VL-Embedding / Reranker** (Roadmap v2 Cross-modal Retrieval) |
| **TTS Engine** | VieNeu | 🟢 Đã triển khai | **VieNeu ONNX** (Mở rộng Benchmark Danh xưng Lịch sử & Thanh điệu) |
| **Runtime Engine** | llama.cpp Metal | 🟢 Rất hợp lý | **`llama-server` (`llama.cpp` Metal)** + **MLX Benchmark** |

---

### 3.1. LLM Historical Reasoning Tier (`Qwen3.5-27B` vs `Qwen3.6-27B`)

ChronoViet chọn **`Qwen3.5-27B` làm Mô hình Suy luận Lịch sử Primary Flagship**. 

#### Lý do lựa chọn `Qwen3.5-27B`:
* **Unified Vision-Language Foundation:** Qwen3.5-27B tích hợp trực tiếp vision encoder vào lõi model 27B dense parameters, có khả năng suy luận đồng thời trên cả văn bản và hình ảnh tư liệu mà không cần thông qua pipeline VLM phân mảnh.
* **Đa ngữ vượt trội (201 languages/dialects):** Hiểu sâu cấu trúc từ vựng Hán-Nôm, âm Hán-Việt, văn ngôn cổ và các bản dịch tiếng Pháp/Anh thời Nguyễn và Pháp thuộc.
* **Context Window dài (262K native, mở rộng 1M):** Hỗ trợ xử lý các bộ sử liệu lớn khi cần tổng hợp chuỗi sự kiện.
* **`Qwen3.6-27B` đóng vai trò Benchmark Candidate:** Qwen3.6-27B được định hướng mạnh vào agentic coding/reasoning. ChronoViet sẽ duy trì test suite để benchmark so sánh trực tiếp giữa Qwen3.5-27B và Qwen3.6-27B trên bộ dữ liệu câu hỏi lịch sử Việt Nam.

---

### 3.2. Embedding Tier Kiến trúc 2 Lớp (`Qwen3-Embedding 0.6B / 4B`)

Tư liệu lịch sử Việt Nam chứa nhiều từ Hán-Việt cổ, địa danh lịch sử đã thay đổi tên gọi, và các khái niệm triều đại. ChronoViet sử dụng **Kiến trúc Embedding 2 Lớp**:

1. **Default Tier (`Qwen3-Embedding-0.6B`):**
   * Sử dụng cho tác vụ indexing hàng loạt, truy xuất vector thường xuyên, batch processing.
   * Nhẹ (~800MB RAM ở bản Q8_0), tốc độ cực nhanh, tiết kiệm tài nguyên UMA.
2. **High-Quality Tier (`Qwen3-Embedding-4B`):**
   * Sử dụng cho các tài liệu lịch sử quan trọng, truy vấn phức tạp, đoạn văn bản mâu thuẫn nguồn hoặc giai đoạn re-retrieval chất lượng cao.
   * Cung cấp không gian biểu diễn dày dặn hơn cho các quan hệ thực thể lịch sử tinh vi.

---

### 3.3. Reranker Layer & Dynamic Candidate Retrieval

Sử dụng **`Qwen3-Reranker-0.6B`** làm lớp tinh lọc kết quả truy xuất trước khi đưa vào LLM.

#### Pipeline Truy xuất Động (Dynamic Candidate Retrieval):
```text
                         Query Lịch sử
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
Top 30 Dense Search     Top 30 BM25 Search      Top N Graph Subgraph
(Qwen3-Embedding)       (Lexical Matching)      (Entities & Relations)
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               ▼
               Deduplication & Candidate Merge
                        (40–80 Chunks)
                               │
                               ▼
                     Qwen3-Reranker-0.6B
                   (Reranking & Scoring)
                               │
                               ▼
               Top 5–12 Evidences Tinh Tỏ Nhất
```

---

### 3.4. Multi-Layer Visual Verification & Inspection Pipeline

ChronoViet nâng cấp quy trình kiểm tra và xác thực hình ảnh tư liệu thành **Kiến trúc Visual 3 Lớp (Tier 1 -> Tier 2 -> Deep Multimodal)**:

```text
                     Hình ảnh Tư liệu / Minh họa
                                │
                                ▼
               Tier 1: SigLIP 2 (Multilingual Fast Filter)
                 Lọc nhanh loại bỏ ảnh không liên quan (<10ms)
                                │
                                ▼
               Tier 2: Qwen3-VL-8B (Fast/Medium Inspector)
                 Kiểm tra sơ bộ layout, phân loại ảnh thật / AI / cổ trang
                                │
                                ▼ (Đối với tư liệu khó / mâu thuẫn sâu)
               Tier 3: Qwen3.5-27B (Deep Multimodal Reasoning)
                 Phân tích chuyên sâu y phục, niên đại, chi tiết kiến trúc
```

1. **Tier 1 (Fast Filter):** **`SigLIP 2` ONNX (INT8/FP16)** — Phiên bản thế hệ mới của Google với khả năng hỗ trợ đa ngữ (multilingual), zero-shot classification và dense visual representation tốt hơn hẳn SigLIP đời đầu.
2. **Tier 2 (Fast/Medium Inspector):** **`Qwen3-VL-8B`** — Mô hình VLM gọn nhẹ phục vụ kiểm tra visual nhanh, OCR văn bản hiện đại trên hình ảnh và nhận diện layout.
3. **Tier 3 (Deep Inspector):** **`Qwen3.5-27B`** — Nhận trách nhiệm phân tích đối chiếu lịch sử chuyên sâu khi hình ảnh đòi hỏi suy luận đa điều kiện.
4. **Roadmap v2 (Multimodal Retrieval):** Tích hợp dòng mô hình **Qwen3-VL-Embedding & Qwen3-VL-Reranker** cho phép truy tìm trực tiếp hình ảnh tư liệu / bản đồ cổ từ câu hỏi dạng văn bản trong cùng một không gian vector đại diện (cross-modal retrieval).

---

### 3.5. Historical OCR & Document Intelligence Pipeline (Mắt xích Chuyên biệt Hán-Nôm)

> **Lưu ý Kiến trúc Quan trọng:** VLM tổng quát (như Qwen3-VL) KHÔNG THỂ thay thế cho một OCR Engine chuyên dụng trong bài toán xử lý tài liệu cổ (Chữ Hán, Chữ Nôm, Văn ngôn, sách khắc gỗ nhòe, văn bản khắc đá, ấn triện, chữ viết tay, văn bản kẻ cột đứng).

ChronoViet xây dựng một **Historical OCR Pipeline độc lập**:

```text
                     Tư liệu Lịch sử (Scan / Photo)
                                │
                                ▼
                   Document & Layout Detection
                 (Phân lập khung chữ, dòng, cột)
                                │
                                ▼
                            OCR Router
                                │
      ┌─────────────────────────┼─────────────────────────┐
      ▼                         ▼                         ▼
Quốc ngữ Cổ Engine       Hán / Nôm Engine           Ấn triện / VLM
(ViOCR Fine-tuned)   (Fine-tuned PaddleOCRv5/  (Qwen3-VL / Deep Vision)
                      NomOCR Models)
      │                         │                         │
      └─────────────────────────┼─────────────────────────┘
                                ▼
                     OCR Text Candidates + BBox
                                │
                                ▼
              Historical LLM Post-OCR Correction
         (Qwen3.5-27B khôi phục dấu, từ cổ & ngữ cảnh)
                                │
                                ▼
             Văn bản Sạch + Độ tin cậy + Provenance
```

#### Các giai đoạn trong Historical OCR Pipeline:
1. **Layout & Reading Order Detection:** Phân tích trang tư liệu cổ, xác định hướng đọc (ngang/dọc, từ phải sang trái đối với sách Hán-Nôm).
2. **OCR Router & Specialized Engines:**
   * Văn bản Chữ Quốc ngữ cổ: Sử dụng ViOCR / Tesseract fine-tuned.
   * Văn bản Chữ Hán / Chữ Nôm: Sử dụng mô hình **PaddleOCRv5 fine-tuned trên tập dữ liệu Hán-Nôm cổ** (giúp nâng cao accuracy vượt trội so với OCR tiêu chuẩn).
3. **Historical LLM Post-OCR Processing:** Áp dụng phương pháp nghiên cứu tiên tiến (AAAI 2025), đưa văn bản đầu ra của OCR qua `Qwen3.5-27B` để tự động sửa lỗi ký tự diacritic, khôi phục từ cổ bị nhòe dựa vào ngữ cảnh câu và tri thức lịch sử.
4. **Provenance & Confidence Metadata:** Mỗi từ/dòng OCR thu được đều đi kèm điểm độ tin cậy (`confidence_score`) và tọa độ bounding box để bảo tồn nguồn gốc tư liệu.

---

### 3.6. VieNeu TTS Engine & Heritage Speech Evaluation (`services/vieneu-tts`)

Dịch vụ tổng hợp giọng đọc di sản đã được triển khai hoàn chỉnh tại [`services/vieneu-tts`](file:///Users/congtri/IT/Personal_Projects/ChronoViet/services/vieneu-tts) với kiến trúc 2 lớp phòng thủ **Dual-Layer Architecture (Zero-Downtime Fallback)**:

```mermaid
flowchart TD
    App[Remotion Render Engine / Agent Orchestrator] -->|POST /api/v1/synthesize| Wrapper[VieNeuEngine Node.js Wrapper]
    Wrapper -->|HTTP Req / Port 8080| Check{Python ONNX Service Online?}
    Check -->|Có - HTTP 200| Neural[Python FastAPI - VieNeu ONNX Neural Engine]
    Check -->|Không / Timeout 60s| Fallback[SyntheticTTSFallbackEngine - 480Hz Sine Wave]
    Neural -->|24kHz WAV + Word Timestamps| Output[Audio File & Remotion Captions]
    Fallback -->|Synthetic Audio + Word Timestamps| Output
```

#### Mở rộng Tiêu chí Đánh giá Giọng đọc Lịch sử (Heritage TTS Evaluation):
Không chỉ đo lường bằng chỉ số **Real-Time Factor (RTF)**, ChronoViet mở rộng bộ tiêu chí đánh giá giọng đọc di sản:

$$\text{RTF} = \frac{\text{Thời gian tổng hợp (sec)}}{\text{Thời lượng file âm thanh đầu ra (sec)}}$$

* **Tone & Prosody Accuracy:** Độ chính xác thanh điệu tiếng Việt và nhịp ngắt nghỉ câu văn biền ngẫu / lịch sử.
* **Historical Proper-Name Pronunciation Benchmark:** Đánh giá riêng khả năng phát âm chính xác các danh xưng, địa danh và niên hiệu lịch sử khó:
  $$\text{Các từ bắt buộc benchmark:} \quad \text{Nguyễn Huệ, Quang Trung, Đại Việt, Vạn Kiếp, Thuận Hóa, Gia Long, Minh Mạng, Thiệu Trị...}$$

---

## 4. LUỒNG TRUY XUẤT HISTORICAL RAG, TEMPORAL GRAPHRAG & SOURCE-AWARE GROUNDING

### 4.1. Ngân sách Ngữ cảnh Động (Dynamic Evidence Budget)

ChronoViet **hủy bỏ việc hard-code cố định 5K–15K tokens context**. Hệ thống áp dụng **Ngân sách Ngữ cảnh Động (Dynamic Evidence Budget)** dựa trên độ phức tạp của câu hỏi:

```text
                              Phân loại Truy vấn Lịch sử
                                           │
         ┌───────────────────┬─────────────┴─────────────┬───────────────────┐
         ▼                   ▼                           ▼                   ▼
 Truy vấn Factual       Hỏi Đa nguồn               Suy luận Temporal     Đối chiếu Sử liệu Gốc
  (Ví dụ: Năm sinh)   (Sự kiện phức tạp)         (Nhiều mốc thời gian)    (Primary Sources)
         │                   │                           │                   │
  Target Context:     Target Context:             Target Context:     Target Context:
    2K – 4K tok         5K – 10K tok               10K – 20K tok       20K – 40K tok
```

---

### 4.2. Chuẩn hóa Mốc Thời gian (Temporal Normalization) trong GraphRAG

Các tư liệu lịch sử Việt Nam ghi nhận thời gian dưới nhiều hệ thống khác nhau. ChronoViet GraphRAG tích hợp bộ **Temporal Normalizer** để quy đổi tất cả mốc thời gian về một chỉ số biểu diễn thống nhất:

$$\text{Ví dụ Chuẩn hóa:} \quad \left. \begin{array}{l} \text{Dương lịch: 1788} \\ \text{Âm lịch / Can Chi: Mậu Thân} \\ \text{Niên hiệu: Năm Quang Trung thứ 1} \end{array} \right\} \implies \text{Normalized Index: } \mathbf{1788 \text{ CE (Epoch: 1788-01-01)}}$$

---

### 4.3. Source-Aware RAG & Điểm Xác thực Lịch sử Đa chiều (Multi-Factor Evidence Score)

Mỗi chunk dữ liệu trong cơ sở tri thức của ChronoViet bắt buộc chứa thông tin nguồn gốc đầy đủ (**Source Provenance Metadata**):
* `chunk_id`, `embedding`, `source_name`, `author`, `publication_date`, `historical_period`, `document_type`, `OCR_confidence`, `entity_ids`, `temporal_range`.

Khi LLM đưa ra câu trả lời, mô hình phải đánh giá điểm bằng chứng dựa trên **Công thức Điểm Xác thực Lịch sử Đa chiều (Historical Evidence Score)**:

$$\text{Historical Evidence Score} = 0.20 \times S_{\text{Visual}} + 0.30 \times S_{\text{SourceReliability}} + 0.20 \times S_{\text{TemporalConsistency}} + 0.15 \times S_{\text{EntityConsistency}} + 0.15 \times S_{\text{CrossSourceAgreement}}$$

#### Yêu cầu Enforce Structured Output đối với LLM:
Bản trả lời của LLM phải phân rã cấu trúc câu trả lời theo ma trận:
* **`FACT`**: Dữ kiện lịch sử có nguồn xác thực rõ ràng.
* **`SOURCE`**: Trích dẫn tài liệu gốc (tên sách, trang, niên đại).
* **`INFERENCE`**: Suy luận logic dựa trên các dữ kiện sẵn có.
* **`UNCERTAIN`**: Các yếu tố chưa đủ căn cứ khẳng định chắc chắn.
* **`CONFLICT`**: Mâu thuẫn giữa các nguồn sử liệu (VD: *Nguồn A ghi X, Nguồn B ghi Y*).

---

## 5. MA TRẬN CÔNG NGHỆ CHÍNH THỨC & BENCHMARK HARNESS

### 5.1. Ma trận Công nghệ Chính thức (Recommended Stack Matrix 2026)

| Tác vụ AI | Primary Backend | Secondary Backend | Không khuyến nghị |
| :--- | :--- | :--- | :--- |
| **LLM Historical Reasoning** | **`Qwen3.5-27B` (`llama-server` Metal)** | `Qwen3.6-27B` / `MLX` | vLLM (Chỉ tối ưu CUDA), Hardcode CoreML |
| **Text Embedding Tier 1** | **`Qwen3-Embedding-0.6B` (`llama-server`)**| ONNX CoreML EP | Model tiếng Việt generic cũ (`e5-base`) |
| **Text Embedding Tier 2** | **`Qwen3-Embedding-4B` (`llama-server`)**  | MLX | Embedding quá nhỏ không hiểu từ Hán-Việt |
| **Reranking Layer** | **`Qwen3-Reranker-0.6B` (`llama-server`)**   | `Qwen3-Reranker-4B` | Bỏ qua lớp Reranker |
| **Vision Fast Filter** | **`SigLIP 2` ONNX (CoreML/MPS)** | FastEmbed | SigLIP v1 cũ |
| **Vision General Inspector** | **`Qwen3-VL-8B` (`llama.cpp` mmproj / MLX)** | CoreML | Bắt Heavy VLM làm toàn bộ OCR |
| **Historical OCR Engine** | **PaddleOCRv5 Hán-Nôm + ViOCR + LLM** | Tesseract | Tin tưởng tuyệt đối vào VLM OCR |
| **Heritage TTS Engine** | **VieNeu ONNX (`services/vieneu-tts`)** | MPS / CoreML | Giả định sai về ANE Hardware |

---

### 5.2. ChronoViet Historical Model Benchmark Suite Requirement

Để loại bỏ định kiến từ các benchmark chung (như MTEB/MMEB), ChronoViet quy định xây dựng **Bộ Benchmark Lịch sử Việt Nam (ChronoViet Historical Benchmark Suite)** gồm 300 – 1,000 bộ câu hỏi/tư liệu thực tế.

#### Khung Ma trận Benchmark Harness:

| Model ID | Backend Runtime | Quant / Precision | Context Size | Target Metrics | UMA RAM Peak | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| Qwen3.5-27B | llama-server | Q4_K_M vs Q5_K_M | 8,192 tok | tok/s & Fact Acc % | ~16 - 18 GB | Active Flagship |
| Qwen3.6-27B | llama-server | Q4_K_M | 8,192 tok | tok/s & Agentic Score | ~16 GB | Candidate |
| Qwen3-Embed-0.6B | llama-server | GGUF Q8_0 | 512 tok | Recall@10 & Latency | ~0.8 GB | Active Default |
| Qwen3-Embed-4B | llama-server | GGUF Q4_K_M | 512 tok | Recall@10 & Latency | ~2.5 GB | Active High-Tier |
| SigLIP 2 | ONNX CoreML | FP16 | Image 384x384 | Zero-shot Acc & Latency | ~0.4 GB | Active Filter |
| PaddleOCRv5 Hán-Nôm| ONNX / PyTorch | FP16 | Scan Page | Exact Character Acc % | ~0.8 GB | Active OCR Engine |
| VieNeu-TTS | ONNX MPS | FP32 | 10s Audio | RTF & Proper-Name Acc | ~0.5 GB | Active Heritage TTS |

---

## 6. CẤU HÌNH & THỰC THI CHO DEVELOPER (SPEC UPDATES)

### Bước 1: Khai báo Biến Môi Trường (`.env`)
```env
# Cấu hình Local Model Gateway & Endpoints
USE_LOCAL_LLM=true
LOCAL_LLM_BACKEND=llama_cpp # Lựa chọn: llama_cpp | ollama | mlx
LLM_BASE_URL=http://localhost:8080

# Supported Gateway Endpoints:
# - POST /v1/chat/completions  (OpenAI Format)
# - POST /v1/responses         (OpenAI Responses API)
# - POST /v1/messages          (Anthropic Messages API)

# LLM Primary Local & Cloud Fallback Strategy
LOCAL_LLM_PRIMARY_MODEL=qwen3.5-27b-instruct-q4_k_m
LOCAL_LLM_BENCHMARK_MODEL=qwen3.6-27b-instruct-q4_k_m

# Cloud API Fallback Configuration (Agnes 2.0 Flash)
ENABLE_CLOUD_FALLBACK=true
REMOTE_FALLBACK_MODEL=agnes-2.0-flash
AGNES_API_KEY=your_agnes_api_key_here
REMOTE_FALLBACK_TIMEOUT_MS=15000

# Embedding & Rerank Strategy
LOCAL_EMBEDDING_DEFAULT=qwen3-embedding-0.6b
LOCAL_EMBEDDING_HIGH_QUALITY=qwen3-embedding-4b
LOCAL_RERANK_MODEL=qwen3-reranker-0.6b

# Vision & Historical OCR Settings
LOCAL_VISION_FILTER=siglip-2-multilingual-onnx
LOCAL_VLM_INSPECTOR=qwen3-vl-8b
HISTORICAL_OCR_ENGINE=paddleocr_v5_hannom

# TTS Provider
TTS_BACKEND_PROVIDER=auto
```

---

### Bước 2: Khởi chạy Llama-Server Backend trên macOS

```bash
# 1. Khởi chạy llama-server Metal Engine cho Primary LLM (Qwen3.5-27B)
llama-server \
  --model ./models/qwen3.5-27b-instruct-q4_k_m.gguf \
  --alias qwen3.5-27b \
  --ctx-size 16384 \
  --n-gpu-layers 99 \
  --port 8080

# 2. Khởi chạy Embedding & Rerank Server phụ (Nếu chạy riêng instance)
llama-server \
  --model ./models/qwen3-embedding-0.6b-q8_0.gguf \
  --alias qwen3-embedding \
  --embedding \
  --port 8081
```

---

## 7. SƠ ĐỒ KIẾN TRÚC TỔNG THỂ (SYSTEM ARCHITECTURE MERMAID)

### 7.1. Sơ đồ Luồng Xử lý Tổng thể (Historical Document Intelligence Architecture)

```mermaid
flowchart TD
    subgraph AppLayer [ChronoViet Core Orchestrator]
        UserQuery[Query Lịch sử / Tư liệu Đầu vào]
    end

    subgraph Gateway [Local Model Gateway & Memory Controller]
        Router{API Router: /v1/chat/completions | /v1/responses | /v1/messages}
    end

    subgraph LLM_Tier [LLM Primary Reasoning & Fallback Tier]
        LlamaServer[llama-server Metal Engine]
        Qwen35[Qwen3.5-27B-Q4 Local Primary Model]
        Qwen36[Qwen3.6-27B Benchmark Candidate]
        AgnesFlash[Agnes 2.0 Flash API Cloud Fallback]
        LlamaServer --> Qwen35
        LlamaServer -.-> Qwen36
        Router -.->|Fallback on Local OOM/Busy| AgnesFlash
    end

    subgraph Retrieval_Tier [Retrieval & Temporal Knowledge Tier]
        QEmbed06[Qwen3-Embedding-0.6B Default]
        QEmbed4B[Qwen3-Embedding-4B High-Quality]
        QRerank[Qwen3-Reranker-0.6B]
        GraphEngine[(Temporal GraphRAG + Source Metadata)]
    end

    subgraph Vision_OCR_Tier [Vision & Historical OCR Subsystem]
        SigLIP2[SigLIP 2 Multilingual Fast Filter]
        OCRRouter{Historical OCR Router}
        ViOCR[ViOCR Quốc ngữ Cổ]
        HanNomOCR[PaddleOCRv5 Hán-Nôm]
        LLMCorrect[Qwen3.5-27B Post-OCR Correction]
        QwenVL[Qwen3-VL-8B Fast Inspector]
    end

    subgraph Voice_Tier [Speech Synthesis Tier]
        VieNeu[VieNeu TTS Engine]
        Harness{Benchmark Harness: RTF & Proper Names}
        VieNeu --> Harness
    end

    UserQuery --> Router
    Router -->|LLM Tasks| LLM_Tier
    Router -->|Retrieval & Rerank| Retrieval_Tier
    Router -->|Visual Verification & OCR| Vision_OCR_Tier
    Router -->|Heritage Voice| Voice_Tier

    OCRRouter --> ViOCR
    OCRRouter --> HanNomOCR
    ViOCR --> LLMCorrect
    HanNomOCR --> LLMCorrect
```

---

### 7.2. Sơ đồ Chi tiết Quy trình Historical Verification & Provenance Grounding

```mermaid
flowchart LR
    DocInput[Hình ảnh / Bản ghi Sử liệu] --> SigLIP2Filter[SigLIP 2 Fast Filter]
    SigLIP2Filter -->|Pass| OCRPipeline[Historical OCR Pipeline]
    OCRPipeline --> TextExtract[Candidate Text + BBox]
    TextExtract --> PostCorrection[Qwen3.5-27B LLM Correction]

    PostCorrection --> ScoreCalc[Điểm Xác thực Historical Evidence Score]
    
    ScoreCalc --> StructEnforce[Enforce Output Matrix]
    StructEnforce --> FACT[FACT: Dữ kiện chuẩn]
    StructEnforce --> SOURCE[SOURCE: Nguồn tài liệu gốc]
    StructEnforce --> INFERENCE[INFERENCE: Suy luận logic]
    StructEnforce --> UNCERTAIN[UNCERTAIN: Yếu tố chưa chắc chắn]
    StructEnforce --> CONFLICT[CONFLICT: Mâu thuẫn sử liệu]
```

---

> **Tóm lại:** Bản thiết kế cập nhật năm 2026 này nâng tầm ChronoViet từ một hệ thống RAG cơ bản thành một **Historical Document Intelligence System** thực sự: đặt **Qwen3.5-27B làm mô hình suy luận cốt lõi**, phân tầng **2-Tier Embedding**, nâng cấp **SigLIP 2**, xây dựng **Historical OCR Pipeline chuyên biệt cho chữ Hán-Nôm và Quốc ngữ cổ**, áp dụng **Temporal Normalization trong GraphRAG**, và quản lý bộ nhớ UMA 32GB RAM tối ưu, sẵn sàng cho sản xuất và nghiên cứu lịch sử chuyên sâu.
