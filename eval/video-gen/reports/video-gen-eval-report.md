# 📊 Evaluation Report: Video Generation Pre-Render Pipeline Benchmark

- **Timestamp:** 23:11:16 25/8/2026 (ICT)
- **Overall Status:** ❌ **FAILED**
- **Total Test Cases:** 1
- **Passed:** 1 | **Failed:** 0 (100.0%)
- **Execution Duration:** 245.86s
- **Artifacts Location:** `/Users/congtri/IT/Personal_Projects/ChronoViet/eval/video-gen/outputs`

## 1. Key Performance Indicators (KPIs)

| Metric | Achieved Value | Target KPI | Status | Description |
|---|---|---|:---:|---|
| **Script Pacing Deviation** | `20 %` | `8 %` | ❌ FAIL | Deviation of spoken narration WPM against target 130-160 WPM benchmark |
| **Historical Fact-Check Pass Rate** | `100 %` | `95 %` | ✅ PASS | Percentage of video scripts passing multi-tier historical fact-check and guardrails |
| **Historical Entity Recall Rate** | `60 %` | `80 %` | ❌ FAIL | Percentage of expected canonical historical entities covered in the generated voiceover script |
| **Image Asset Download Success Rate** | `100 %` | `80 %` | ✅ PASS | Percentage of visual candidates successfully downloaded, decoded and saved to disk |
| **License Whitelist Compliance Rate** | `100 %` | `100 %` | ✅ PASS | Percentage of selected image assets matching CC0 / CC-BY / Public Domain licenses |
| **VLM Visual Quality Score** | `8 /10` | `7.5 /10` | ✅ PASS | Mean historical relevance and visual aesthetic score rated by VLM inspector |

## 2. Test Case Breakdown

| ID | Title | Status | Duration | Errors / Notes |
|---|---|:---:|---:|---|
| `vg_01_hong_bang_hung_vuong` | Thời đại Hùng Vương và Nhà nước Văn Lang | ✅ Pass | 245318ms | - |

## 3. Preflight Health Checks

| Service | Health | Provider | Details |
|---|:---:|---|---|
| **POSTGRES** | ✅ | `REAL_POSTGRES_PGVECTOR (localhost:5432/chronoviet_db)` | - |
| **EMBEDDING** | ✅ | `REAL_EMBEDDING_SERVER (http://localhost:8090/v1/embeddings)` | - |
| **LLM** | ✅ | `LOCAL_LLM (http://localhost:8092) [qwen3.5-9b-instruct-q4_k_m]` | - |
| **VLM** | ✅ | `LOCAL_VLM (http://localhost:8092) [qwen3.5-9b-instruct-q4_k_m]` | - |
| **SEARCH** | ✅ | `ONLINE_SEARCH (serpapi, tavily, brave)` | - |

