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

## 2. Test Datasets (`datasets/chatbot-test-cases.json`)

Contains 40 curated multi-turn dialogue test cases across 8 distinct categories:

| Category | Description | Primary Verification Target |
|---|---|---|
| `CANONICAL_QA` | Standard historical inquiries on key figures, battles, and epochs (Ngô Quyền, Đinh Bộ Lĩnh, Lê Hoàn, Lý Thường Kiệt, Trần Hưng Đạo, etc.). | Entity recall, historical fidelity, citation grounding. |
| `ENTITY_IDENTITY` | Questions asking to disambiguate historical personages, reign titles, and aliases (e.g. Mai Thúc Loan vs. Mai Hắc Đế, Quang Trung vs. Nguyễn Huệ). | Canonical entity resolution, alias mapping. |
| `MULTI_TURN` | Complex 2–4 turn dialogues testing context continuity, antecedent memory, and pronoun resolution across turns. | Context retention, co-reference resolution across turns. |
| `ANTI_SYCOPHANCY` | Adversarial trap questions with subtle historical falsehoods, false anachronisms, or leading biased claims. | Anti-sycophancy refusal, factual correction rate without sycophancy. |
| `FOLKLORE_MYTH` | Questions about legends, mythological traditions, and folkloric figures (Sơn Tinh - Thủy Tinh, An Dương Vương, Thánh Gióng, Lê Lợi trả gươm). | Clear demarcation between historical fact and mythological tradition. |
| `VIDEO_INTENT` | User prompts indicating an explicit desire to create/render historical educational videos. | Intent classification accuracy (`VIDEO_INTENT` / `VIDEO_GENERATION_INTENT`). |
| `CHITCHAT` | Conversational greetings and general inquiries. | Friendly historical assistant persona without hallucinating historical claims. |
| `OUT_OF_DOMAIN` | Irrelevant non-historical questions (modern cooking, programming, general banter). | Graceful boundary management and redirect to Vietnamese history. |

---

## 3. Evaluated Metrics & Target KPIs

### A. Functional Correctness Quality Gates (Strict 100% Pass)
| Metric | Target KPI | Failure Threshold (Pass Gate) | Method |
|---|:---:|:---:|---|
| **Intent Accuracy** | $\ge 95.0\%$ | $< 90.0\%$ | Exact match against expected intent enum (`OUT_OF_DOMAIN`, `CHITCHAT`, `VIDEO_INTENT`, `HISTORICAL_QUERY`, `ENTITY_IDENTITY`) |
| **Citation Grounding Rate** | $\ge 90.0\%$ | $< 80.0\%$ | Percentage of turns with valid primary source citations and key entities |
| **Anti-Sycophancy Pass Rate** | $\ge 90.0\%$ | $< 80.0\%$ | Detection and refusal of false historical premises and forbidden claims |
| **Folklore Demarcation Rate** | $\ge 90.0\%$ | $< 75.0\%$ | Explicit qualification of folkloric / mythical elements |
| **Key Fact Coverage Rate** | $\ge 85.0\%$ | $< 70.0\%$ | Semantic overlap against curated golden historical summaries |

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
# Run full chatbot evaluation suite
pnpm eval:chat

# Run with limited number of test cases (fast check)
pnpm eval:chat -- --limit 3

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
