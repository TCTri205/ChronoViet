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
   * **Deterministic Sequential Pipeline:** Khử hoàn toàn Race Condition Fan-in với luồng thực thi: `segmenter` $\rightarrow$ `keyword` $\rightarrow$ `research` $\rightarrow$ `vlm_inspection` $\rightarrow$ `tts_synthesis` $\rightarrow$ `duration_reconciliation` $\rightarrow$ `packager` $\rightarrow$ `END`. Đảm bảo mỗi node chạy đúng 1 lần duy nhất, `project_schema.json` được đóng gói hoàn chỉnh.
   * Cân bằng thời lượng âm thanh và nhịp điệu hình ảnh (`durationReconciliationNode`), cam kết Pacing Error $< 3.0\%$.
2. **Observability & Prometheus RED Metrics:**
   * **Context-Bound Child Loggers (`getNodeLogger`):** Truyền `correlationId` và metadata `projectId`, `node` vào 100% dòng log.
   * **Prometheus Metrics:** Đo lường độ trễ từng node (`chronoviet_orchestrator_node_duration_seconds`) và phân phối sai số nhịp độ (`chronoviet_orchestrator_pacing_error_percent`).
   * **Telemetry Audit (`telemetryAudit`):** Lưu vết các cảnh báo fallback (RAG offline fallback, LLM self-correction, TTS synthetic fallback) trong state.
3. **Native Checkpointing & Human-In-The-Loop (HITL):**
   * Lưu trữ trạng thái không đồng bộ (Non-blocking async file I/O + PostgreSQL) với cơ chế ghi log chẩn đoán khi mất kết nối.
   * Hỗ trợ ngắt duyệt khi vi phạm nghiêm trọng (`NEEDS_HUMAN_REVIEW`) và tiếp tục luồng thực thi an toàn (`resumeOrchestratorPipeline`) mà không nhân bản dữ liệu hay chạy lại node tiền đề.
4. **Automated Guardrail Gates:**
   * **Folklore Guardrail Gate (`folklore-validator.ts`):** Tự động quét Regex Pattern Matching trên các câu thoại trích xuất từ nguồn Dã sử / Truyền thuyết (Level 3), ép dùng các cụm từ tín hiệu giả thuyết (*"theo truyền thuyết"*, *"tương truyền"*, *"dân gian kể"*...) theo ngữ cảnh đoạn văn mở đầu (Paragraph-Aware).
   * **NLI Entailment Hallucination Judge (`nli-hallucination-judge.ts`):** Đánh giá điểm suy luận Entailment Score giữa câu thoại kịch bản và ngữ cảnh RAG gốc với bộ lọc Stopword Tiếng Việt để bảo toàn trọng số thực thể lịch sử (Yêu cầu $\ge 0.80$, trả về `NEUTRAL` khi không có ground truth).

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
│   ├── research/                      # Research Agent: Provider Chain Tìm kiếm Ảnh
│   │   ├── index.ts                   # buildProviderChain, executeImageSearchTool, resolveImageCandidates
│   │   └── providers/                 # Image Search Providers: image-search-provider.ts, serpapi, tavily, brave, wikimedia (gồm CuratedCatalog)
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
# 0. Khởi động hạ tầng CSDL & Model AI cục bộ (Port 8092, 8080):
pnpm stack:infra                                # Bật PostgreSQL (Checkpoints) & Redis
pnpm ai:llm                                     # Bật Primary LLM Port 8092 (Qwen-9B)
pnpm ai:tts                                     # Bật VieNeu TTS Port 8080 (hoặc dùng synthetic fallback)
# Hoặc bật toàn bộ: pnpm ai:start | Kiểm tra: pnpm ai:status

# 1. Chạy đánh giá toàn diện Orchestrator (State machine completion, pacing & guardrails)
pnpm eval:orchestrator
# hoặc trong package:
pnpm --filter @chronoviet/agent-orchestrator eval

# 2. Chạy đánh giá nhanh (sampling)
pnpm --filter @chronoviet/agent-orchestrator eval:quick

# 3. Chạy từng tầng benchmark con (A0 - A5 & SYS):
pnpm --filter @chronoviet/agent-orchestrator eval:a0        # A0: Chat Understanding & Brief
pnpm --filter @chronoviet/agent-orchestrator eval:a1        # A1: Chaptering & Outline
pnpm --filter @chronoviet/agent-orchestrator eval:a2        # A2: Historical Scriptwriting & Tone
pnpm --filter @chronoviet/agent-orchestrator eval:a3        # A3: Guardrails, Anti-Sycophancy & Auditing
pnpm --filter @chronoviet/agent-orchestrator eval:a4        # A4: Scene Segmentation & Visual Direction
pnpm --filter @chronoviet/agent-orchestrator eval:a5        # A5: Research Agent & Whitelist Licensing
pnpm --filter @chronoviet/agent-orchestrator eval:sys       # SYS: StateGraph Orchestration

# 4. Chạy đánh giá riêng Research Agent (Độ phân giải & bản quyền hình ảnh tư liệu)
pnpm --filter @chronoviet/agent-orchestrator eval:research

# 5. Chạy Unit Tests của module nguồn (chạy trong CI)
pnpm test:orchestrator
# hoặc trong package:
pnpm --filter @chronoviet/agent-orchestrator test

# 6. Kiểm tra TypeScript
pnpm typecheck:orchestrator

# 7. Dừng các model AI sau khi kiểm thử:
pnpm ai:stop
```
