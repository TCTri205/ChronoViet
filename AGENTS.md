# ChronoViet — AI Agent & Developer Guidelines

This document outlines the core principles, development workflows, and tool usage guidelines for AI Agents and Developers working on the **ChronoViet** codebase.

---

## 1. Core Development Principles & Documentation First

1. **Read Relevant Documentation Before Planning and Coding:**
   - Agents and Developers **must thoroughly read domain-relevant specification documents** matching the task in the project to understand the architecture and processing workflows before creating implementation plans or writing code:
     - **System Architecture Docs:** [`docs/architecture/`](file:///d:/Persional_Projects/ChronoViet/docs/architecture/)
     - **Detailed Module Docs:** [`docs/modules/`](file:///d:/Persional_Projects/ChronoViet/docs/modules/)
     - **System Overview & Specs:** [`docs/SystemOverview.md`](file:///d:/Persional_Projects/ChronoViet/docs/SystemOverview.md), [`docs/REMOTION_CONTENT_FORMATS_SPEC.md`](file:///d:/Persional_Projects/ChronoViet/docs/REMOTION_CONTENT_FORMATS_SPEC.md), [`docs/EVAL_REMOTION_TECHNICAL_SPEC.md`](file:///d:/Persional_Projects/ChronoViet/docs/EVAL_REMOTION_TECHNICAL_SPEC.md), [`docs/IMPLEMENTATION_PLAN.md`](file:///d:/Persional_Projects/ChronoViet/docs/IMPLEMENTATION_PLAN.md)

2. **Strict Type-Safety & SSOT (Single Source of Truth):**
   - All cross-module Data Contracts, Zod Schemas, and shared TypeScript Interfaces MUST be declared centrally in [`packages/shared-spec`](file:///d:/Persional_Projects/ChronoViet/packages/shared-spec). Never duplicate schemas/interfaces across child packages. Module-internal private types should remain encapsulated within their respective package.

3. **Production-Ready & Anti-Overfitting:**
   - All solutions, algorithms, prompt framings, and code logic must ensure generality, performance optimization, and compliance with Production standards.
   - Strictly **DO NOT hardcode logic**, make narrow assumptions, or relax testing just to force test cases/fixtures to pass.

4. **Stateless Codebase & Evaluation:**
   - The codebase is completely Stateless (Production data is stored in PostgreSQL, Redis, and Volume Mount `/media`).
   - Any logic changes or refactoring must be evaluated via local benchmarks in `packages/<module>/eval/` (e.g., `packages/remotion-engine/eval/`) or targeted unit tests (`npx vitest`) where available.

---

## 2. CodeGraph Usage Guidelines (Mandatory)

* **Index Directory:** `.codegraph/` (Auto-updated, fast retrieval, saves context tokens).
* **Golden Rule:** **Always use CodeGraph before** `view_file` or `grep_search` to locate codebase structure, search for symbols, trace execution call graphs, and analyze blast radius before modifying code.
* **Scope of Use:**
  * **Should be used for:** Searching classes, functions, interfaces, Zod schemas, API routes, Remotion components; tracing data flow between packages (`packages/shared-spec`, `packages/remotion-engine`, Agent/RAG services); preparing code refactoring.
  * **Do NOT use for:** Reading configuration files (`.env`, `package.json`), Markdown documentation (`docs/*.md`), or standard file system operations.
* **MCP Tools Priority:** `codegraph_explore` (Priority #1, returns verbatim source + call paths) → `codegraph_node`.
* **CLI Commands Priority:** `codegraph explore "<query>"` (Priority #1) → `codegraph node <symbol-or-file>` → `codegraph query <search>`.

---

## 3. Core Agent Behaviors

* **Plan Approval Before Execution:** Present a summary of the solution (affected files, approach, risks) for User approval before executing non-trivial code edits or architectural changes.
* **Clarify When Uncertain:** Stop and ask the User if requirements are ambiguous or designs are unclear; do not make arbitrary assumptions.
* **Simple Solutions First & Scope Discipline:** Prioritize simple, easily maintainable solutions. Modify only files within the requested scope; do not refactor arbitrarily.
* **Targeted Testing Only:** Run only test runners or scripts directly related to the module being worked on (e.g., `pnpm --filter @chronoviet/remotion-engine eval` or `npx vitest ...`) to conserve system resources.
* **Documentation Synchronization:** When modifying public APIs, architecture, data schemas, or core workflows in `packages/` or `services/`, Agents MUST immediately update the corresponding technical documentation in `docs/`.

---

## 4. Multi-Tier Verification Protocol & Debugging

* **Multi-Tier Verification Protocol:**
  1. **Tier 1:** `pnpm typecheck` (mandatory 0 TypeScript errors monorepo-wide).
  2. **Tier 2:** `pnpm --filter @chronoviet/shared-spec typecheck` (Zod Contract Validation).
  3. **Tier 3:** `pnpm lint` (Code formatting & lint checks).
  4. **Tier 4:** `pnpm eval:all` or `pnpm --filter <package> eval` (Module eval & unit tests).
* **Protect Test Suite Integrity:** Strictly do not relax or modify test cases solely to force tests to pass.
* **Log-First Debugging:** Read detailed logs before editing code to correctly distinguish failure axes:
  - *Infrastructure/System Axis (Database, Redis, Network, Service Worker, Render Engines):* Fix issues in `services/`, `packages/`, or retry policies.
  - *AI/Prompt/Reasoning Axis (Zod Schema Validation failure, hallucination):* Optimize Prompt Framing, Constraints, Structured Output / JSON Schema Enforcement.

---

## 5. Quick Reference Commands

```bash
# ----- CODEGRAPH COMMANDS -----
# Check CodeGraph index status
codegraph status

# Force sync CodeGraph index (if auto-sync daemon is disabled/stale)
codegraph sync

# Query symbol or architectural questions
codegraph explore "RemotionRenderEngine"

# ----- BUILD & VERIFICATION COMMANDS -----
# Check TypeScript monorepo-wide (Mandatory 0 errors)
pnpm typecheck

# Check Lint monorepo-wide
pnpm lint

# Build all packages
pnpm build

# Launch Remotion Studio UI preview
pnpm remotion:studio

# ----- EVALUATION COMMANDS -----
# Run eval suite monorepo-wide
pnpm eval:all

# Run eval runner for Remotion Engine specifically
pnpm --filter @chronoviet/remotion-engine eval
```
