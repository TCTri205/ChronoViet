# 🛠️ ChronoViet Evaluation Shared Framework

Shared reporting, scorecard formatting, percentile calculations, and evaluation types across all ChronoViet benchmark suites.

---

## 1. Overview

The `eval/shared/` module provides shared utilities used by the Chatbot (`eval/chatbot`) and Video Generation (`eval/video-gen`) benchmark suites, as well as the master evaluation dispatcher (`eval/runner.ts`).

---

## 2. Core Modules

| File | Purpose | Key Exports |
|---|---|---|
| [`types.ts`](file:///Users/congtri/IT/Personal_Projects/ChronoViet/eval/shared/types.ts) | Central TypeScript definitions for evaluation suites | `BaseSuiteReport`, `MetricScorecard`, `CaseExecutionSummary`, `PreflightCheckResult` |
| [`reporter.ts`](file:///Users/congtri/IT/Personal_Projects/ChronoViet/eval/shared/reporter.ts) | Markdown scorecard generator, JSON persistence, CLI summary table formatter | `saveJsonArtifact`, `generateMarkdownReport`, `printCliSummaryTable`, `calculatePercentile`, `ensureDirectory` |
| [`index.ts`](file:///Users/congtri/IT/Personal_Projects/ChronoViet/eval/shared/index.ts) | Public module exports | Re-exports all shared types and reporter functions |

---

## 3. Key Utilities

### Markdown & CLI Scorecard Generator (`generateMarkdownReport`, `printCliSummaryTable`)
Generates standardized Markdown and ASCII CLI tables comparing measured metrics against target KPIs and hard failure pass/fail gates.

### Percentile Calculator (`calculatePercentile`)
Calculates deterministic P50, P90, and P99 percentiles for streaming token latencies (TTFT) and processing times:
```ts
import { calculatePercentile } from './reporter.js';

const p50 = calculatePercentile(latencies, 50);
const p90 = calculatePercentile(latencies, 90);
const p99 = calculatePercentile(latencies, 99);
```

### JSON Artifact Persistence (`saveJsonArtifact`)
Safely writes per-case and aggregated evaluation traces to disk, creating parent directories on demand.
