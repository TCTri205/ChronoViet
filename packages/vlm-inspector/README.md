# `@chronoviet/vlm-inspector`

> **ChronoViet VLM Inspector Agent & Pure Visual Quality Gate (Mô-đun 3)**
> Gói mã nguồn chịu trách nhiệm **kiểm định chất lượng bối cảnh lịch sử** của các `candidatePool` hình ảnh đã được tìm về, loại bỏ nhiễu thị giác (watermark, logo, chữ đè) và thẩm định bản quyền tư liệu (Whitelisted License Filter).

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/vlm-inspector` đóng vai trò là **Tầng Kiểm Định Chất Lượng Thị Giác thuần túy (Deterministic Visual Quality Gate)** của hệ thống ChronoViet. **Gói này không thực hiện web search / crawl ảnh** — toàn bộ việc tìm kiếm và thu thập ứng viên ảnh (image candidates) được xử lý bởi **Research Agent** trong `@chronoviet/agent-orchestrator` (provider chain SerpAPI / Tavily / Brave / Wikimedia / Curated Catalog tại `packages/agent-orchestrator/src/research/`).

VLM Inspector nhận vào `candidatePool` đã research sẵn và thực hiện tuyến kiểm định khép kín:

1. **Pure Visual Inspection (`inspectSceneVisuals`):**
   - Nhận `(projectId, scene, candidatePool, options)` và chấm điểm từng ứng viên theo 3 trục: `historicalContextScore` (0–40), `visualNoiseScore` (0–30), `artisticFitScore` (0–30).
   - Nếu `candidatePool` **rỗng** → trả về ngay `PURE_CODE` layout fallback **mà không thực hiện bất kỳ network request nào** (deterministic, không phụ thuộc mạng).
   - Không còn logic crawl inline — mọi ứng viên đến từ Research Agent state `researchResults[sceneId]`.
2. **Dual-Layer Scoring & Visual Quality Gate:**
   - **Lớp 1 (Local Unified Multimodal VLM / Gemini Flash):** Đánh giá độ phù hợp trang phục, niên đại, bối cảnh lịch sử và phát hiện nhiễu thị giác (`vlm-scorer.ts`).
   - **Lớp 2 (Local CLIP ONNX Scorer):** Chấm điểm độ tương đồng ngữ nghĩa giữa văn bản phân cảnh và ảnh ứng viên (Vector Cosine Similarity) — `clip-scorer.ts`.
3. **Whitelisted License Filter:** Chỉ chấp nhận tư liệu có giấy phép hợp lệ `PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0` (ánh xạ qua `@chronoviet/shared-spec` LicenseType).
4. **Redis Cache Layer (`redis-cache.ts`):** Bộ nhớ đệm 2 tầng (SHA-256 + pHash) lưu kết quả chấm điểm, giảm độ trễ và tiết kiệm quota API.
5. **Asset Downloader (`asset-downloader.ts`):** Tải và xác thực ảnh đáp ứng kích thước tối thiểu lưu vào `/media/` khi cần sử dụng.
6. **Technical Visual Quality Gate (`visual-quality-gate.ts`):** Binary Header Dimension Reader (PNG/JPEG/WEBP) + Resolution / Aspect Ratio / Payload Guard trước khi encode Base64.

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/vlm-inspector/
├── src/
│   ├── inspector-pipeline.ts          # End-to-End VLM Inspection Pipeline & Pure Code Fallback
│   ├── vlm-scorer.ts                  # Local Unified VLM / Gemini Flash Scorer (Resilient JSON Parser)
│   ├── clip-scorer.ts                 # Local CLIP ONNX Cosine Similarity Scorer
│   ├── visual-quality-gate.ts         # Binary Header Dimension Reader & Technical Resolution Gate
│   ├── asset-downloader.ts            # Asset Downloader, Metadata & Latency Tracking
│   ├── redis-cache.ts                 # Redis Dual-Layer Cache (SHA-256 + pHash)
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 3
│   ├── README.md                      # Hướng dẫn đánh giá VLM Inspector
│   ├── runner.ts                      # Benchmark Runner (offline image scoring)
│   └── datasets/                      # Dataset ảnh kiểm thử & Ground Truth annotations
│
├── package.json
└── tsconfig.json
```

> **Lưu ý kiến trúc v4.0:** Search providers (SerpAPI/Tavily/Brave/Wikimedia/CuratedCatalog) và provider chain factory (`buildProviderChain`, `executeImageSearchTool`, `resolveImageCandidates`) **không còn nằm trong gói này** — chúng đã được chuyển sang `packages/agent-orchestrator/src/research/`.

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

### 3.1. Sử dụng trong mã nguồn TypeScript

```typescript
import { inspectSceneVisuals } from '@chronoviet/vlm-inspector';
import type { SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';

// Kiểm định danh sách ứng viên ảnh cho phân cảnh
const result = await inspectSceneVisuals(
  projectId,
  scene,
  candidatePool,
  { correlationId: 'corr_123' }
);

console.log('Selected Layout:', result.selectedLayoutMode);
console.log('Pure Code Fallback:', result.isPureCodeFallback);
console.log('Selected Candidate:', result.selectedCandidate?.title);
```

### 3.2. Bộ Lệnh CLI (Thực thi từ Root Monorepo hoặc Package)

```bash
# 0. Khởi động Local VLM / Primary LLM (Port 8092 - Qwen 3.5 9B):
pnpm ai:llm
# hoặc kiểm tra trạng thái: pnpm ai:status

# 1. Chạy benchmark offline đo lường KPI Mô-đun 3 (dùng candidate pool mock, không phụ thuộc mạng)
pnpm eval:vlm
# hoặc trong package:
pnpm --filter @chronoviet/vlm-inspector eval

# 2. Chạy Unit Tests (License Filter, Clip Scorer, Visual Quality Gate,...)
pnpm test:vlm
# hoặc trong package:
pnpm --filter @chronoviet/vlm-inspector test

# 3. Kiểm tra kiểu dữ liệu TypeScript (0 lỗi)
pnpm typecheck:vlm
# hoặc trong package:
pnpm --filter @chronoviet/vlm-inspector typecheck

# 4. Build gói mã nguồn
pnpm --filter @chronoviet/vlm-inspector build

# 5. Dừng AI model sau khi kiểm thử:
pnpm ai:stop
```

---

## 📄 4. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.