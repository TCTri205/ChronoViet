# ChronoViet — Agent & Developer Instructions

Guidelines, operational constraints, and verification protocols for AI Agents and Developers in the ChronoViet codebase.

---

## 1. Architecture & Core Principles

1. **Documentation-First:**
   - Read relevant specification documents before planning or modifying code:
     - Architecture: [`docs/architecture/`](docs/architecture/)
     - Modules: [`docs/modules/`](docs/modules/)
     - Specifications: [`docs/SystemOverview.md`](docs/SystemOverview.md), [`docs/specs/REMOTION_CONTENT_FORMATS_SPEC.md`](docs/specs/REMOTION_CONTENT_FORMATS_SPEC.md), [`docs/specs/EVAL_REMOTION_TECHNICAL_SPEC.md`](docs/specs/EVAL_REMOTION_TECHNICAL_SPEC.md), [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
2. **Single Source of Truth (SSOT):**
   - Declare all cross-module data contracts, Zod schemas, and shared TypeScript interfaces centrally in [`packages/shared-spec`](packages/shared-spec). Never duplicate schemas across child packages. Encapsulate module-private types within their respective packages.
3. **Production-Ready & Anti-Overfitting:**
   - Ensure generic, robust, and performant implementations.
   - Do NOT hardcode logic, make narrow assumptions, or loosen test/eval assertions and fixtures to artificially inflate benchmark scores or force tests to pass.
4. **Stateless Runtime:**
   - Keep application state stateless. Persistent data resides in PostgreSQL (pgvector), Redis, and volume storage (`/media`).
5. **Language Boundary:**
   - Write all code, technical comments, TypeScript types, documentation, and commit messages in **English**.
   - Keep historical domain knowledge, video scripts, audio narration texts, and user-facing historical content in **Vietnamese**.

---

## 2. CodeGraph Exploration Protocol

- **Index Directory:** `.codegraph/`
- **Rule:** Use CodeGraph first to map structure and call paths before reading files. If CodeGraph CLI or index is unavailable in the environment, fallback to standard `grep_search` and `find_by_name`.
- **Scope:** Search classes, functions, interfaces, schemas, routes, components, and trace inter-package data flow. Do NOT use for `.env`, `package.json`, or Markdown documentation.
- **Commands:**
  - `codegraph explore "<intent>"`: Architectural queries & multi-hop data flow tracing.
  - `codegraph node <symbol-or-file>`: Inspect specific symbol definition, callers, and callees.
  - `codegraph query <text>`: Fast symbol name lookup.

---

## 3. Operational Agent Directives

- **Approval Before Execution:** Present an implementation summary (affected files, approach, risks) for user confirmation before executing non-trivial edits or structural refactors.
- **Clarification:** Ask for clarification immediately if requirements are ambiguous. Do NOT make unvalidated assumptions.
- **Minimal Scope:** Deliver the simplest maintainable solution. Modify only files strictly within the requested task scope.
- **Targeted Testing:** Execute only test runners relevant to the modified package (e.g., `pnpm --filter @chronoviet/remotion-engine eval` or targeted `vitest`) during active iteration.
- **Doc Synchronization:** Update corresponding Markdown documentation in `docs/` immediately when modifying public APIs, schemas, or module behaviors.

---

## 4. Multi-Tier Verification & Testing Protocol

- **Verification Tiers:**
  1. **Tier 1 (Fast Contract Check):** `pnpm --filter @chronoviet/shared-spec typecheck` (validate schema/contract changes).
  2. **Tier 2 (Monorepo Typecheck):** `pnpm typecheck` (zero TypeScript errors monorepo-wide required).
  3. **Tier 3 (Linting):** `pnpm lint` (formatting and lint compliance).
  4. **Tier 4 (Deterministic Tests):** `pnpm test` (deterministic unit & integration tests across `src/`).
  5. **Tier 5 (Local Benchmarks & Eval):** `pnpm --filter <package> eval` or granular package evals (non-deterministic quality evaluation).
- **Test vs. Eval Separation:**
  - **Deterministic Tests (`pnpm test`):** Executes `vitest run --dir src/ --passWithNoTests`. Must yield strict binary Pass/Fail results. This is the **ONLY** test suite executed in CI/CD pipelines.
  - **Evaluation Benchmarks (`pnpm test:eval` & `pnpm eval:*`):** Located in `eval/` (retrieval metrics, chunking quality, pacing, render fidelity). Run manually in local/benchmark environments. **NEVER run in CI/CD**.
- **Log-First Debugging:** Read execution logs before editing code to distinguish failure domains:
  - *Infrastructure/Runtime:* PostgreSQL, Redis, Network, Service Worker, Render Engines.
  - *AI/Prompt/Reasoning:* Zod schema validation failures, prompt constraints, hallucination.

---

## 5. Command Reference

### 1. Essential Daily Commands (Core 4)
```bash
pnpm dev             # 🚀 Smart 1-Click Dev: Auto Infra (DB+Redis) + Auto AI Detect + Web & Worker
pnpm data:setup      # 📦 1-Click Data: Docker Infra -> DB Init -> Ingest Knowledge -> Health Audit
pnpm ai              # 🤖 Interactive AI Dashboard: Inspect ports, start/stop Local AI stack
pnpm check           # ✅ Verification Gate: Typecheck -> Lint -> Test -> Build
```

### 2. Specialized Execution Modes
```bash
pnpm dev:full        # Full Stack: Docker Infra + AI Supervisor + TTS + Web + Worker
pnpm dev:cloud       # Fast Cloud mode: 0% local GPU/RAM overhead (Web + Worker with Cloud AI)
pnpm dev:data        # Data Ingestion Stack: Postgres + Redis + AI Lite (8090 + 8094)
pnpm remotion:studio # Remotion Studio UI (Port 9876)
```

### 3. AI & Infrastructure Management
```bash
pnpm ai:start        # Start Full Local AI Stack (8090, 8092, 8096, 8080 + TTS)
pnpm ai:lite         # Start Lightweight Pair (8090 + 8094) (~3.1 GB RAM)
pnpm ai:status       # Check AI port status (8090, 8092, 8094, 8096, 8080)
pnpm ai:stop         # Stop all background AI & TTS processes
pnpm stack:infra     # Start PostgreSQL (pgvector) & Redis
pnpm stack:down      # Stop all Docker containers
pnpm db:health       # Audit DB health (relationships, embeddings, indexes)
```

### 4. Granular Per-Package Commands (Dev, Test, Typecheck, Eval)
```bash
# Targeted Typecheck (Fast)
pnpm typecheck:spec | :infra | :ingest | :rag | :orchestrator | :vlm | :remotion | :web | :worker

# Targeted Deterministic Unit Tests
pnpm test:spec | :infra | :ingest | :rag | :orchestrator | :vlm | :remotion | :web | :worker

# Targeted Evaluation & Benchmarks
pnpm eval:ingest         # Data Ingestion (Vector, Graph, Triples, NER)
pnpm eval:rag            # RAG Engine Master Benchmark (C0 - C10 + SYS)
pnpm eval:rag:c0 .. :c10 # Discrete RAG Component Benchmarks (C0..C10)
pnpm eval:orchestrator   # Multi-Agent Orchestrator Benchmark (A0 - A5 + SYS)
pnpm eval:orchestrator:a0 .. :a5 # Discrete Agent Benchmarks (A0..A5)
pnpm eval:vlm            # VLM Visual Quality Inspector
pnpm eval:remotion       # Remotion Video Rendering Fidelity
pnpm eval:chat           # Historical Chatbot Dialogue Benchmark
pnpm eval:video          # Video Generation Master Pre-Render Benchmark
pnpm eval:video:stage1   # Video Gen Stage 1 (Script & Narrative Text-Only)
pnpm eval:video:stage2   # Video Gen Stage 2 (Visual Research & Curation)
pnpm eval:video:golden   # Video Gen Stage 2 on Golden Script Fixtures
pnpm eval:all            # Unified Master Evaluation (Chat + Video Gen)
```

---

## 6. CI/CD Requirements (GitHub Actions)

- **Mandatory Quality Gates:** `.github/workflows/ci.yml` executes `lint`, `typecheck`, `unit-tests` (`pnpm test`), `build`, `docker-build`, `audit`, and `integration` (`pnpm db:init` -> `verify-db-health.ts`).
- **CI Scope:** CI executes ONLY deterministic checks. All evaluation commands (`pnpm eval:*`, `pnpm test:eval`) are strictly excluded.
- **Pre-Push Requirement:** Run `pnpm check` (or `pnpm typecheck && pnpm lint && pnpm test && pnpm build`) locally and ensure 100% pass rate before pushing to `main` or opening PRs.

