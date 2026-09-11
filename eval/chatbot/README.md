# 💬 ChronoViet Historical Chatbot Evaluation Suite

Production-grade real runtime benchmark for the **Historical Chatbot Assistant** and **GraphRAG Dialogue Engine**.

---

## 1. Overview & Objectives

The Chatbot Evaluation Suite evaluates live multi-turn historical dialogue against actual LLMs and live PostgreSQL (`pgvector` + Graph Triples) knowledge bases. It validates:
1. **Historical Grounding & Accuracy**: Citations correctly reference primary historical chronicles (`Đại Việt Sử Ký Toàn Thư`, `Khâm Định Việt Sử Thông Giám Cương Mục`, etc.).
2. **Intent Classification**: Correctly differentiates `HISTORICAL_QUERY`, `ENTITY_IDENTITY`, `CHITCHAT`, `OUT_OF_DOMAIN`, and `VIDEO_INTENT`.
3. **Anti-Sycophancy & Trap Resistance**: Rejects leading questions containing historical fabrications without sycophantically agreeing with the user.
4. **Folklore vs. Orthodox History**: Clearly distinguishes folk legends (e.g., *Sơn Tinh - Thủy Tinh*, *Sự tích Hồ Gươm*) from canonical historical records.
5. **Streaming Latency & Quality**: Measures Time-to-First-Token (TTFT) and streaming token throughput (tokens/sec).

---

## 2. Test Datasets & Modular Suites (`datasets/`)

The evaluation datasets are modularized into 3 dedicated suites for targeted validation and fast developer iteration:

1. **Core Baseline Suite (`datasets/chatbot-core.json`)**:
   - 40 canonical test cases across 8 standard categories (`CANONICAL_QA`, `ENTITY_IDENTITY`, `MULTI_TURN`, `ANTI_SYCOPHANCY`, `FOLKLORE_MYTH`, `VIDEO_INTENT`, `CHITCHAT`, `OUT_OF_DOMAIN`).
   - Validates entity recall, primary source citations, and fundamental routing.

2. **Adversarial & Multi-Turn Suite (`datasets/chatbot-adversarial.json`)**:
   - 12 high-difficulty trap cases testing robust historical invariants:
     - **Cross-Era Surname Clashes (Multi-century gap):** Lê Lợi vs. Lê Độ, Nguyễn Trãi vs. Nguyễn Du, Trần Hưng Đạo vs. Trần Phú (must refute kinship due to multi-century gap).
     - **Authentic Kinship Affirmation:** Nguyễn Nhạc & Nguyễn Huệ, Trưng Trắc & Trưng Nhị, Trần Liễu & Trần Cảnh (must affirm true brotherhood/sisterhood, guarding against anti-sycophancy over-rejection).
     - **Verified vs. Fictitious Persons:** Lê Lợi vs. Lê Văn Tèo (refutes fake relative, identifies true brothers in annals).
     - **Sudden Topic Shifts:** Abrupt context shift from modern figures to medieval dynasties without context bleeding.
     - **Complex Coreference:** Disambiguating pronouns ("ai trong hai người") between primary and secondary historical figures.
     - **Persistence under Pressure:** Bot holds ground when users falsely insist on myths or internet rumors.

3. **Deep Analysis & Multi-Intent Suite (`datasets/chatbot-deep-analysis.json`)**:
   - 8 comprehensive synthesis cases requiring long-form analysis (>= 250-300 words) or handling compound intents:
     - **Comparative Military Analyses:** Evolution of the Bạch Đằng naval stake strategy across 938, 981, and 1288.
     - **Causal Historical Investigations:** Why Hồ Quý Ly's currency and administrative reforms failed before the Ming army.
     - **Historiographical Evaluations:** Comprehensive evaluation of King Gia Long (Nguyễn Ánh) across territory, sovereignty, and foreign entanglements.
     - **Geopolitical Studies:** Trịnh - Nguyễn phân tranh, sông Gianh, Lũy Thầy, and the southern territorial expansion.
     - **Compound Multi-Intents:** Combining historical queries with video generation requests, or chitchat greetings with complex inquiries.

---

## 3. Evaluated Metrics & Target KPIs

### A. Functional Correctness Quality Gates (Strict 100% Pass)
| Metric | Target KPI | Failure Threshold (Pass Gate) | Method |
|---|:---:|:---:|---|
| **Intent Accuracy** | $\ge 95.0\%$ | $< 90.0\%$ | Exact match or compound match against expected intent(s) |
| **Citation Grounding Rate** | $\ge 90.0\%$ | $< 80.0\%$ | Percentage of turns with valid primary source citations and key entities |
| **Anti-Sycophancy Pass Rate** | $\ge 90.0\%$ | $< 80.0\%$ | Detection and refusal of false historical premises and forbidden claims |
| **Folklore Demarcation Rate** | $\ge 90.0\%$ | $< 75.0\%$ | Explicit qualification of folkloric / mythical elements |
| **Key Fact Coverage Rate** | $\ge 85.0\%$ | $< 70.0\%$ | Semantic overlap against curated golden historical summaries |
| **Deep Analysis Aspect Coverage** | $\ge 80.0\%$ | $< 60.0\%$ | Coverage of required thematic aspects in long-form synthesis cases |

### B. Hardware Latency & Streaming Performance Profile
| Metric | Target KPI | Pass Gate Threshold | Method |
|---|:---:|:---:|---|
| **Time-to-First-Token (TTFT P50)** | $< 2500\text{ ms}$ | $\le 5000\text{ ms}$ | Measured latency to first streamed token chunk |
| **Streaming Throughput** | $\ge 12.0\text{ tok/s}$ | $\ge 8.0\text{ tok/s}$ | Average token generation and emission speed |
| **Turn Duration (P50/P90)** | $< 5000\text{ ms}$ | $\le 15000\text{ ms}$ | Total turn round-trip duration |

---

## 4. How to Run

### Command Line Interface:

```bash
# Run Core Baseline Suite (default, 40 cases)
pnpm eval:chat
pnpm eval:chat:core

# Run High-Difficulty Adversarial & Multi-Turn Suite (12 cases)
pnpm eval:chat:adversarial

# Run Deep Analysis & Long-Form Suite (8 cases)
pnpm eval:chat:deep

# Run All Suites (60 cases total)
pnpm eval:chat:all

# Fast check with limit on any suite
pnpm eval:chat:adversarial -- --limit 3
pnpm eval:chat:deep -- --limit 2

# Run a specific category only
pnpm eval:chat -- --category CANONICAL_QA
pnpm eval:chat -- --category ENTITY_IDENTITY
pnpm eval:chat -- --category MULTI_TURN
pnpm eval:chat -- --category ANTI_SYCOPHANCY
pnpm eval:chat -- --category FOLKLORE_MYTH
pnpm eval:chat -- --category VIDEO_INTENT
pnpm eval:chat -- --category CHITCHAT
pnpm eval:chat -- --category OUT_OF_DOMAIN

# Run in strict mode (fails immediately if PostgreSQL or Ollama LLM is unreachable)
pnpm eval:chat -- --strict

# Verbose streaming logs in terminal
pnpm eval:chat -- --verbose
```

---

## 5. Outputs and Reports

- **Raw Traces (`outputs/<id>.json`)**:
  - Full execution JSON for every test case.
  - Contains per-turn user query, retrieved context chunks, intent categorization, full streamed assistant response, and token timings.
- **Aggregated Reports (`reports/`)**:
  - `chatbot-eval-report.json`: Machine-readable summary with overall KPI pass/fail status and P50/P90/P99 latencies.
  - `chatbot-eval-report.md`: Formatted Markdown scorecard with category breakdown and failure diagnostics.
