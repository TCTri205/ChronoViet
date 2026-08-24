FROM node:26-alpine AS runner

WORKDIR /app

# Install pnpm (matching packageManager in package.json)
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

# Layer 1: Copy package manifests for optimal Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-spec/package.json ./packages/shared-spec/
COPY packages/infra/package.json ./packages/infra/
COPY packages/data-ingestion/package.json ./packages/data-ingestion/
COPY packages/rag-engine/package.json ./packages/rag-engine/
COPY packages/remotion-engine/package.json ./packages/remotion-engine/
COPY packages/vlm-inspector/package.json ./packages/vlm-inspector/
COPY packages/agent-orchestrator/package.json ./packages/agent-orchestrator/
COPY apps/web/package.json ./apps/web/
COPY apps/render-worker/package.json ./apps/render-worker/

# Install dependencies (cached when source files change)
RUN pnpm install --frozen-lockfile

# Layer 2: Copy source code
COPY packages ./packages
COPY apps ./apps

# Build monorepo packages
RUN pnpm --recursive --workspace-concurrency=4 run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/healthz || exit 1

CMD ["node", "apps/web/dist/server.js"]
