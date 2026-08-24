## Description
<!-- Provide a brief, concise summary of the changes introduced by this PR. -->

## Scope of Changes
- [ ] Core / Shared Contracts (`packages/shared-spec`)
- [ ] Infrastructure / Data Layer (`packages/infra`, `packages/data-ingestion`)
- [ ] AI / RAG / VLM (`packages/rag-engine`, `packages/vlm-inspector`, `packages/agent-orchestrator`)
- [ ] Remotion Video Engine (`packages/remotion-engine`, `apps/render-worker`)
- [ ] Web Application (`apps/web`)
- [ ] Service / Pipeline (`services/vieneu-tts`, `scripts/`)
- [ ] CI/CD & DevOps (`.github/`, Docker, Compose)

## Verification Quality Gates (AGENTS.md)
<!-- Ensure all required tiers pass locally before opening/merging PR -->
- [ ] **Tier 1 (Contract Check):** `pnpm --filter @chronoviet/shared-spec typecheck`
- [ ] **Tier 2 (Monorepo Typecheck):** `pnpm typecheck && pnpm typecheck:extras` (0 errors)
- [ ] **Tier 3 (Linting):** `pnpm lint`
- [ ] **Tier 4 (Deterministic Tests):** `pnpm test` (100% pass)
- [ ] **Build Validation:** `pnpm build` (All apps & packages compile cleanly)

## Key Checklist
- [ ] **SSOT Compliance:** No duplicated Zod schemas or cross-module type contracts outside `packages/shared-spec`.
- [ ] **Language Boundary:** Code/comments/commits in English; historical domain content in Vietnamese.
- [ ] **No Eval in CI:** Evaluation suites (`pnpm eval:*`, `pnpm test:eval`) remain local/benchmark-only.
- [ ] **Documentation:** Public APIs and architectural specs in `docs/` updated if affected.
