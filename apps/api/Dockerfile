# syntax=docker/dockerfile:1
# Build from repo root: docker build -f apps/api/Dockerfile -t chatbox-api .

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/widget/package.json ./apps/widget/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY packages/config ./packages/config
COPY apps/widget ./apps/widget
COPY apps/api ./apps/api

RUN pnpm --filter widget build && pnpm --filter api build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile --prod --filter api...

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/public ./apps/api/public
COPY --from=builder /app/apps/widget/dist ./apps/widget/dist

RUN mkdir -p /app/apps/api/uploads
VOLUME ["/app/apps/api/uploads"]

WORKDIR /app/apps/api
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/index.js"]
