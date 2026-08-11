FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-spec ./packages/shared-spec
COPY services/vieneu-tts ./services/vieneu-tts

# Install dependencies and build shared-spec & vieneu-tts
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @chronoviet/shared-spec build
RUN pnpm --filter @chronoviet/vieneu-tts build

# Create media directory for audio caching
RUN mkdir -p media/audio-cache

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "services/vieneu-tts/dist/server.js"]
