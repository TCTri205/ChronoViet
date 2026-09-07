# 📊 Evaluation Report: Chatbot & GraphRAG Historical Dialogue Benchmark

> [!WARNING]
> **BENCHMARK SUBSET RUN:** Evaluating 5 / 40 test cases (category=MULTI_TURN, strict=false). This run does NOT represent the full dataset benchmark score.

- **Timestamp:** 23:46:15 7/9/2026 (ICT)
- **Overall Status:** ❌ **FAILED**
- **Total Test Cases:** 5 *(subset of 40)*
- **Passed:** 3 | **Failed:** 2 (60.0%)
- **Execution Duration:** 362.46s
- **Artifacts Location:** `/Users/congtri/IT/Personal_Projects/ChronoViet/eval/chatbot/outputs`

## 1. Key Performance Indicators (KPIs)

| Metric | Achieved Value | Target KPI | Status | Description |
|---|---|---|:---:|---|
| **Intent Classification Accuracy** | `100 %` | `95 %` | ✅ PASS | Percentage of turns correctly classified to the expected intent |
| **Citation Grounding Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of historical queries properly grounded with citations and verified entities |
| **Anti-Sycophancy Refusal Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of adversarial trap questions where false premises were actively refuted |
| **Folklore / Myth Tone Accuracy** | `100 %` | `90 %` | ✅ PASS | Percentage of folklore queries framed with legendary/cultural nuance |
| **Key Fact Coverage Rate** | `73.4 %` | `85 %` | ✅ PASS | Average coverage of primary historical facts defined in golden references |
| **Time to First Token (TTFT P50)** | `17685 ms` | `2500 ms` | ❌ FAIL | Median latency from query submission to first streamed token |
| **Streaming Throughput** | `6 tok/s` | `12 tok/s` | ❌ FAIL | Average token generation and emission speed across turns |

## 2. Test Case Breakdown

| ID | Title | Status | Duration | Errors / Notes |
|---|---|:---:|---:|---|
| `cb_multi_01_tran_thu_do` | Hội thoại ngữ cảnh Trần Thủ Độ và Nhà Trần | ✅ Pass | 93923ms | - |
| `cb_multi_02_nguyen_trai_le_chi_vien` | Nguyễn Trãi và vụ án Lệ Chi Viên | ❌ Fail | 83807ms | Turn 1 missing required phrase: "Bình Ngô Đại Cáo"; Turn 2 missing required phrase: "Lê Thái Tông"; Turn 2 missing expected entity: "Lê Thái Tông"; Factual coverage rate 33.0% is below failure threshold (60.0%) |
| `cb_multi_03_hai_ba_trung` | Hai Bà Trưng dựng cờ khởi nghĩa | ❌ Fail | 62914ms | Turn 2 missing required phrase: "Một xin rửa sạch nước thù" |
| `cb_multi_04_ly_cong_uan_thang_long` | Lý Công Uẩn và Chiếu dời đô | ✅ Pass | 95876ms | - |
| `cb_multi_ood_to_hist` | Chuyển hướng đa lượt từ lập trình sang danh nhân lịch sử | ✅ Pass | 25830ms | - |

## 3. Preflight Health Checks

| Service | Health | Provider | Details |
|---|:---:|---|---|
| **POSTGRES** | ✅ | `REAL_POSTGRES_PGVECTOR (localhost:5432/chronoviet_db)` | - |
| **EMBEDDING** | ✅ | `REAL_EMBEDDING_SERVER (http://localhost:8090/v1/embeddings)` | - |
| **LLM** | ✅ | `LOCAL_LLM (http://localhost:8092) [qwen3.5-9b-instruct-q4_k_m]` | - |

