# `@chronoviet/agent-orchestrator`

> **ChronoViet Multi-Agent Orchestrator & Guardrail Enforcement Pipeline**  
> Gói mã nguồn điều phối luồng Multi-Agent (Mô-đun 2) bằng LangGraph.js, chịu trách nhiệm biên tập kịch bản video lịch sử dài, phân chia phân cảnh, chọn layout trực quan và tích hợp hệ thống Guardrails tự động chống Hallucination & bảo vệ giọng văn Dã sử.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/agent-orchestrator` đảm nhận nhiệm vụ biên tập kịch bản tự động từ ngữ cảnh RAG:

1. **Multi-Agent Pipeline (LangGraph.js):**
   * Lập kịch bản video 100% Data-Driven tuân thủ Schema Production v4.1 cho 5 miền lịch sử (*BIOGRAPHY*, *BATTLE*, *DYNASTY*, *MYSTERY*, *ARTIFACT*).
   * Phân chia phân cảnh (scenes), tính toán khoảng thời gian (`durationInFrames`), gán nhãn layout modes (31 LayoutModes) và chuyển cảnh (19 TransitionTypes).
2. **Automated Guardrail Gates:**
   * **Folklore Guardrail Gate (`folklore-validator.ts`):** Tự động quét Regex Pattern Matching trên các câu thoại trích xuất từ nguồn Dã sử / Truyền thuyết (Level 3), ép LLM phải dùng các cụm từ tín hiệu giả thuyết (*"theo truyền thuyết"*, *"tương truyền"*, *"dân gian kể"*...).
   * **NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts`):** Đánh giá điểm suy luận Entailment Score giữa câu thoại kịch bản và ngữ cảnh RAG gốc (Yêu cầu $\ge 0.80$).

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/agent-orchestrator/
├── src/
│   ├── graph/                         # Điểm điều phối LangGraph.js Graph & State
│   ├── guardrails/                    # Tầng Guardrails Bảo vệ Nội dung
│   │   ├── folklore-validator.ts      # Automated Folklore Guardrail Validator Gate
│   │   └── nli-hallucination-judge.ts # NLI Entailment Judge chống Hallucination
│   └── index.ts                       # Entrypoint export public APIs
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng (Usage)

```typescript
import {
  validateFolkloreHypothesisTone,
  evaluateNliEntailmentScore,
} from '@chronoviet/agent-orchestrator';

// 1. Kiểm định giọng văn Dã sử cho nguồn Level 3
const folkloreResult = validateFolkloreHypothesisTone(scriptText, isLevel3Source);
if (!folkloreResult.isValid) {
  console.warn(folkloreResult.feedbackPrompt);
}

// 2. Kiểm định Entailment chống Hallucination
const nliResult = evaluateNliEntailmentScore({ scriptClaim, groundTruthChunks });
console.log(`Entailment score: ${nliResult.entailmentScore}, Pass: ${!nliResult.isHallucinated}`);
```
