# `@chronoviet/vlm-inspector`

> **ChronoViet VLM Inspector Agent & Visual Quality Gate (Mô-đun 3)**  
> Gói mã nguồn chịu trách nhiệm tìm kiếm, kiểm định chất lượng bối cảnh lịch sử, loại bỏ nhiễu thị giác (watermark, logo, chữ đè) và thẩm định bản quyền tư liệu hình ảnh lịch sử (Whitelisted License Filter).

---

## 📌 1. Tổng Quan Chức Năng (Package Overview)

Gói `@chronoviet/vlm-inspector` đóng vai trò là Tầng Kiểm Định Chất Lượng Thị Giác của hệ thống ChronoViet:

1. **Multi-Provider Image Search Chain (`search/`):** Tự động tìm kiếm ảnh tư liệu lịch sử qua chuỗi nhà cung cấp ưu tiên: SerpAPI $\rightarrow$ Tavily $\rightarrow$ Brave $\rightarrow$ Wikimedia Commons $\rightarrow$ Curated Catalog, kết hợp bộ lọc Domain Whitelist.
2. **Dual-Layer Scoring & Visual Quality Gate:**
   - **Lớp 1 (Local Unified Multimodal VLM / Gemini Flash):** Đánh giá độ phù hợp trang phục, niên đại, bối cảnh lịch sử và phát hiện nhiễu thị giác (watermark, text overlay).
   - **Lớp 2 (Local CLIP ONNX Scorer):** Chấm điểm độ tương đồng ngữ nghĩa giữa văn bản phân cảnh và ảnh ứng viên (Vector Cosine Similarity).
3. **Whitelisted License Filter (`license-filter.ts`):** Chỉ chấp nhận các tư liệu có giấy phép bản quyền hợp lệ: `PUBLIC_DOMAIN`, `CC0`, `CC_BY_4_0`, `CC_BY_SA_4_0`.
4. **Redis Cache Layer (`redis-cache.ts`):** Bộ nhớ đệm 2 tầng lưu kết quả chấm điểm ảnh đã thẩm định, giảm độ trễ và tiết kiệm quota API.
5. **Asset Downloader & Local Storage (`asset-downloader.ts`):** Tải và xác thực ảnh đáp ứng kích thước tối thiểu ($\ge 600 \times 600\text{ px}$) lưu vào `/media/raw-assets/`.

---

## 🏗️ 2. Cấu Trúc Thư Mục (Directory Architecture)

```text
packages/vlm-inspector/
├── src/
│   ├── search/                        # Multi-Provider Search Chain (SerpAPI, Tavily, Brave...)
│   │   ├── image-search-provider.ts   # Base Provider Interface & Domain Whitelist
│   │   ├── serpapi-provider.ts        # SerpAPI Image Search
│   │   ├── tavily-provider.ts         # Tavily Image Search
│   │   ├── brave-provider.ts          # Brave Search
│   │   └── index.ts                   # Provider Chain Coordinator
│   ├── wikimedia-search.ts            # Wikimedia Commons API Scraper
│   ├── license-filter.ts              # Whitelisted License Verifier
│   ├── visual-quality-gate.ts         # Visual Noise & Context Match Gate
│   ├── gemini-scorer.ts               # Gemini 2.5 Flash / Local VLM Scorer
│   ├── clip-scorer.ts                 # Local CLIP ONNX Semantic Scorer
│   ├── asset-downloader.ts            # Download & Dimension Validator (>= 600x600px)
│   ├── redis-cache.ts                 # Redis Cache Manager cho VLM scores
│   ├── inspector-pipeline.ts          # End-to-End VLM Inspection Pipeline
│   └── index.ts                       # Entrypoint export public APIs
│
├── eval/                              # Tầng Đánh Giá & Benchmark Module 3
│   ├── README.md                      # Hướng dẫn đánh giá VLM Inspector
│   ├── runner.ts                      # Benchmark Runner (200 ảnh benchmark)
│   └── datasets/                      # Dataset ảnh kiểm thử & Ground Truth annotations
│
├── package.json
└── tsconfig.json
```

---

## ⚡ 3. Hướng Dẫn Sử Dụng & Bộ Lệnh CLI (CLI Commands)

### 3.1. Sử dụng trong mã nguồn TypeScript

```typescript
import { inspectImageCandidate, inspectCandidatePool } from '@chronoviet/vlm-inspector';

// Kiểm định một ảnh ứng viên
const result = await inspectImageCandidate({
  imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
  promptContext: 'Tượng đài Trần Hưng Đạo tại Nam Định',
  historicalDynasty: 'Nhà Trần',
  sceneLayoutMode: 'HISTORICAL_FRAME',
});

console.log('Passed Quality Gate:', result.passed);
console.log('Historical Match Score:', result.historicalMatchScore);
console.log('License Type:', result.license);
```

### 3.2. Bộ Lệnh CLI (Thực thi từ Root Monorepo)

```bash
# 1. Chạy bộ kiểm thử Benchmark đo lường KPI Mô-đun 3 (200 ảnh benchmark)
pnpm --filter @chronoviet/vlm-inspector eval

# 2. Chạy Unit Tests (Bao gồm Image Search Providers & License Filter)
pnpm --filter @chronoviet/vlm-inspector test

# 3. Kiểm tra kiểu dữ liệu TypeScript (0 lỗi)
pnpm --filter @chronoviet/vlm-inspector typecheck

# 4. Build gói mã nguồn
pnpm --filter @chronoviet/vlm-inspector build
```

---

## 📄 4. Giấy Phép (License)

Gói thuộc sở hữu nội bộ của **ChronoViet Monorepo**.
