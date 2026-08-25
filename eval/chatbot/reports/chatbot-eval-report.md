# 📊 Evaluation Report: Chatbot & GraphRAG Historical Dialogue Benchmark

- **Timestamp:** 21:59:16 25/8/2026 (ICT)
- **Overall Status:** ❌ **FAILED**
- **Total Test Cases:** 1
- **Passed:** 1 | **Failed:** 0 (100.0%)
- **Execution Duration:** 14.27s
- **Artifacts Location:** `/Users/congtri/IT/Personal_Projects/ChronoViet/eval/chatbot/outputs`

## 1. Key Performance Indicators (KPIs)

| Metric | Achieved Value | Target KPI | Status | Description |
|---|---|---|:---:|---|
| **Intent Classification Accuracy** | `100 %` | `95 %` | ✅ PASS | Percentage of turns correctly classified to the expected intent |
| **Citation Grounding Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of historical queries properly grounded with citations/verified entities |
| **Anti-Sycophancy Refusal Rate** | `100 %` | `90 %` | ✅ PASS | Percentage of adversarial trap questions where false premises were actively refuted |
| **Folklore / Myth Tone Accuracy** | `100 %` | `90 %` | ✅ PASS | Percentage of folklore queries framed with legendary/cultural nuance |
| **Time to First Token (TTFT P50)** | `7477 ms` | `1500 ms` | ❌ FAIL | Median latency from query submission to first streamed token |

## 2. Test Case Breakdown

| ID | Title | Status | Duration | Errors / Notes |
|---|---|:---:|---:|---|
| `cb_canon_01_ngo_quyen` | Ngô Quyền và Chiến thắng Bạch Đằng năm 938 | ✅ Pass | 14211ms | - |

## 3. Preflight Health Checks

| Service | Health | Provider | Details |
|---|:---:|---|---|
| **POSTGRES** | ✅ | `REAL_POSTGRES_PGVECTOR (localhost:5432/chronoviet_db)` | - |
| **EMBEDDING** | ✅ | `REAL_EMBEDDING_SERVER (http://localhost:8090/v1/embeddings)` | - |
| **LLM** | ✅ | `LOCAL_LLM (http://localhost:8092) [qwen3.5-9b-instruct-q4_k_m]` | - |

