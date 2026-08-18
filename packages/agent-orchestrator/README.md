# `@chronoviet/agent-orchestrator`

> **ChronoViet Multi-Agent Orchestrator & Guardrail Enforcement Pipeline**  
> Gói mã nguồn điều phối luồng Multi-Agent bằng LangGraph.js, chịu trách nhiệm biên tập kịch bản video lịch sử dài, phân chia phân cảnh, chọn layout trực quan, quản lý vòng đời Checkpoint và tích hợp hệ thống Guardrails tự động chống Hallucination & bảo vệ giọng văn Dã sử.

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/agent-orchestrator` đảm nhận nhiệm vụ biên tập kịch bản tự động từ ngữ cảnh RAG:

1. **Multi-Agent Pipeline (LangGraph.js StateGraph):**
   * Lập kịch bản video 100% Data-Driven tuân thủ `VideoProjectSchema` (SSOT) cho 5 thể loại lịch sử (*BIOGRAPHY*, *BATTLE*, *DYNASTY*, *MYSTERY*, *ARTIFACT*).
   * Phân cấp theo Chương/Hồi (`chapteringNode`) động theo thời lượng video (`Math.max(1, Math.round(totalTargetSec / 150))`).
   * Phân chia phân cảnh (`segmenterNode`), ánh xạ Layout Modes theo mẫu (`templateId`: *QUICK_SHORTS*, *MODERN_NEWS*, *HISTORICAL_DOCUMENTARY*).
   * Thực thi song song có kiểm soát Concurrency (Batching = 4): Tổng hợp âm thanh VieNeu TTS (`ttsSynthesisNode`) và Crawl ảnh trực quan (`researchNode` -> `vlmInspectionNode`).
   * Cân bằng thời lượng âm thanh và nhịp điệu hình ảnh (`durationReconciliationNode`), cam kết Pacing Error $< 3.0\%$.
   * Đóng gói JSON Schema Remotion hoàn chỉnh (`packagerNode`).
2. **Native Checkpointing & Human-In-The-Loop (HITL):**
   * Lưu trữ trạng thái đa tầng (PostgreSQL + Local Disk).
   * Hỗ trợ ngắt duyệt khi vi phạm nghiêm trọng (`NEEDS_HUMAN_REVIEW`) và tiếp tục luồng thực thi an toàn (`resumeOrchestratorPipeline`) mà không nhân bản dữ liệu hay chạy lại node tiền đề.
3. **Automated Guardrail Gates:**
   * **Folklore Guardrail Gate (`folklore-validator.ts`):** Tự động quét Regex Pattern Matching trên các câu thoại trích xuất từ nguồn Dã sử / Truyền thuyết (Level 3), ép dùng các cụm từ tín hiệu giả thuyết (*"theo truyền thuyết"*, *"tương truyền"*, *"dân gian kể"*...).
   * **NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts`):** Đánh giá điểm suy luận Entailment Score giữa câu thoại kịch bản và ngữ cảnh RAG gốc (Yêu cầu $\ge 0.80$, trả về `NEUTRAL` khi không có ground truth).

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/agent-orchestrator/
├── src/
│   ├── graph/                         # Điểm điều phối LangGraph.js Graph & State
│   │   ├── checkpointer.ts            # ChronoCheckpointer (Disk & Postgres persistence)
│   │   ├── orchestrator.ts            # Build & Execute StateGraph Pipeline
│   │   ├── state.ts                   # ChronoGraphAnnotation & Reducers
│   │   └── nodes/                     # Các Agent Nodes chuyên biệt
│   │       ├── chaptering-node.ts     # Micro-Step 0: Chapter Outline
│   │       ├── scriptwriter-node.ts   # Micro-Step 1A: Voiceover Narration
│   │       ├── fact-checker-node.ts   # Micro-Step 1A-Audit: Fact-Checking & Safe Alias
│   │       ├── segmenter-node.ts      # Micro-Step 1B: Scene Segmentation & Layouts
│   │       ├── keyword-node.ts        # Micro-Step 1C: Vietnamese Keyword Extractor
│   │       ├── research-node.ts       # Micro-Step 1C: Visual Asset Search (Batching = 4)
│   │       ├── tts-node.ts            # Worker A: VieNeu TTS Synthesis (Batching = 4)
│   │       ├── reconciler-node.ts     # Micro-Step 1B-Reconcile: Duration Engine
│   │       ├── vlm-node.ts            # Worker B: VLM Asset Inspector
│   │       └── packager-node.ts       # Micro-Step 4: JSON Schema Packager
│   │
│   ├── guardrails/                    # Tầng Guardrails Bảo vệ Nội dung
│   │   ├── folklore-validator.ts      # Automated Folklore Guardrail Validator Gate
│   │   └── nli-hallucination-judge.ts # NLI Entailment Judge chống Hallucination
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 2
│   ├── runner.ts                      # Benchmark Runner chính (State completion & Pacing error)
│   ├── research-runner.ts             # Benchmark Runner riêng cho Research Agent (Image candidate resolution)
│   └── __tests__/                     # Unit & Integration Tests cho Guardrails
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng (Usage)

### 3.1. Chạy Pipeline Đồng Bộ (Synchronous Run)

```typescript
import { runOrchestratorPipeline, ChronoGraphState } from '@chronoviet/agent-orchestrator';

const finalState = await runOrchestratorPipeline({
  projectId: 'proj_battle_bach_dang_938',
  userPrompt: 'Chiến thắng Bạch Đằng năm 938 của Ngô Quyền',
  targetDurationMinutes: 3,
  videoType: 'BATTLE',
  templateId: 'HISTORICAL_DOCUMENTARY',
  status: 'INIT',
  currentStep: 0,
} as ChronoGraphState);

console.log('Project Status:', finalState.status);
console.log('Total Scenes:', finalState.scenes.length);
console.log('Pacing Error:', finalState.pacingErrorPercentage, '%');
```

### 3.2. Chạy Pipeline Dạng Streaming (SSE Event Stream)

```typescript
import { streamOrchestratorPipeline, ChronoGraphState } from '@chronoviet/agent-orchestrator';

for await (const { nodeName, update } of streamOrchestratorPipeline(initialState)) {
  console.log(`Node [${nodeName}] completed with status: ${update.status}`);
}
```

### 3.3. Tiếp tục Pipeline Sau Khi Duyệt Kịch Bản (Resume HITL)

```typescript
import { resumeOrchestratorPipeline } from '@chronoviet/agent-orchestrator';

// Phê duyệt và tiếp tục từ node segmenter
const resumedState = await resumeOrchestratorPipeline('proj_battle_bach_dang_938');
```

### 3.4. Bộ Lệnh CLI Đánh Giá & Kiểm Thử (Benchmark & Testing)

```bash
# 1. Chạy đánh giá toàn diện Orchestrator (State machine completion, pacing & guardrails)
pnpm --filter @chronoviet/agent-orchestrator eval

# 2. Chạy đánh giá riêng Research Agent (Độ phân giải & bản quyền hình ảnh tư liệu)
pnpm --filter @chronoviet/agent-orchestrator eval:research

# 3. Chạy Unit Tests của module nguồn
pnpm --filter @chronoviet/agent-orchestrator test
```
