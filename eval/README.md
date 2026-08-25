# 📊 ChronoViet Real Runtime Evaluation Suites

Production-grade, non-mocked evaluation benchmarks for the **Historical Chatbot Assistant** and **Pre-Render Video Generation Pipeline**.

---

## 1. Overview

ChronoViet eval suites test the actual end-to-end multi-agent pipelines against real LLMs/VLMs, live PostgreSQL (`pgvector`) embeddings, and live Wikimedia/Web research APIs.

### Directory Organization: `outputs/` vs `reports/` Separation

- **`eval/chatbot/`**:
  - `datasets/`: 30+ curated test cases covering canonical history, multi-turn continuity, adversarial trap questions, folklore vs history, and video intent.
  - `metrics/`: Intent accuracy, citation grounding rate, anti-sycophancy refusal rate, folklore tone, and streaming latency (TTFT & throughput).
  - `outputs/`: Per-case raw execution traces & SSE token stream JSON dumps.
  - `reports/`: Aggregated benchmark scorecards (`chatbot-eval-report.json` and `chatbot-eval-report.md`).
  - `runner.ts`: Standalone & programmatic test runner.
- **`eval/video-gen/`**:
  - `datasets/`: 20 historical topics across 5 video types (`BIOGRAPHY`, `BATTLE`, `DYNASTY`, `MYSTERY`, `ARTIFACT`) with durations from 1 to 5 minutes.
  - `metrics/`: Script pacing (WPM vs 130-160 WPM), factuality pass rate, disk image download %, license whitelist compliance %, VLM visual quality score (1-10), and pure code fallback rate.
  - `outputs/`: Per-project full state snapshots, scripts, scene segmentation, and candidate image metadata JSON dumps.
  - `reports/`: Aggregated benchmark scorecards (`video-gen-eval-report.json` and `video-gen-eval-report.md`).
  - `runner.ts`: Standalone & programmatic test runner.
- **`eval/shared/`**:
  - Shared types, latency percentiles (P50/P90/P99), Markdown report generator, and terminal scorecard printer.
- **`eval/runner.ts`**:
  - Master CLI runner orchestrating both suites.

---

## 2. Running Evaluation Suites

### Quick Execution via npm scripts:

```bash
# 1. Run all evaluation suites (Chatbot + Video Gen)
pnpm eval:all

# 2. Run only Chatbot evaluation suite
pnpm eval:chat

# 3. Run only Video Generation evaluation suite
pnpm eval:video

# 4. Limit to first N cases for quick verification
pnpm eval:all -- --limit 2
pnpm eval:chat -- --limit 5
pnpm eval:video -- --limit 1

# 5. Filter by category / type
pnpm eval:chat -- --category ANTI_SYCOPHANCY
pnpm eval:video -- --type BATTLE

# 6. Strict mode (fails fast if any required service is down)
pnpm eval:all -- --strict

# 7. Asset Retention Policy:
# By default, downloaded images are preserved in media/projects/eval_proj_<topic_id>/assets/
# When re-running evaluation on the same topic, the old workspace is automatically cleaned
# and replaced with fresh downloads.
# To purge all eval workspaces immediately after a run:
pnpm eval:video -- --clean
```

---

## 3. Target Quality KPIs & Failure Thresholds

| Metric | Target KPI | Failure Threshold | Evaluation Domain |
|---|:---:|:---:|---|
| **Chatbot Intent Accuracy** | $\ge 95\%$ | $< 90\%$ | `eval/chatbot` |
| **Chatbot Citation Grounding Rate** | $\ge 90\%$ | $< 80\%$ | `eval/chatbot` |
| **Chatbot Anti-Sycophancy Pass Rate** | $\ge 90\%$ | $< 80\%$ | `eval/chatbot` |
| **Chatbot TTFT (Time-to-First-Token)** | $< 1500\text{ms}$ | $> 3000\text{ms}$ | `eval/chatbot` |
| **Script Pacing Deviation** | $\le 8\%$ | $> 15\%$ | `eval/video-gen` |
| **Historical Fact-Check Pass Rate** | $\ge 95\%$ | $< 90\%$ | `eval/video-gen` |
| **Historical Entity Recall Rate** | $\ge 80\%$ | $< 65\%$ | `eval/video-gen` |
| **Asset Download Success Rate** | $\ge 80\%$ | $< 65\%$ | `eval/video-gen` |
| **License Whitelist Compliance** | $100\%$ | $< 100\%$ | `eval/video-gen` |
| **VLM Visual Quality Score** | $\ge 7.5 / 10$ | $< 6.5 / 10$ | `eval/video-gen` |

---

## 4. Preflight Health Gate (`assertEvalPreflight`)

Before any benchmark executes, `assertEvalPreflight` verifies connectivity to:
- **PostgreSQL (`pgvector`)**: Database and vector extension readiness.
- **Embedding Service**: Local or remote embedding inference.
- **LLM Gateway**: Primary instruction LLM.
- **VLM Inspector**: Local vision model or cloud fallback.
- **Search Provider**: Wikimedia Commons / SerpAPI / Brave / Tavily.

If services are offline in `--strict` mode, the eval process exits immediately with an actionable error.
