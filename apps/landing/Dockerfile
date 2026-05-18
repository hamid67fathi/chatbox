# syntax=docker/dockerfile:1
# Build from repo root: docker build -f apps/landing/Dockerfile -t chatbox-landing .
# Static export served by nginx on port 3002.

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/

RUN pnpm install --frozen-lockfile

COPY apps/landing ./apps/landing

ARG NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WORKSPACE_SLUG=demo
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WORKSPACE_SLUG=$NEXT_PUBLIC_WORKSPACE_SLUG

RUN pnpm --filter landing build

FROM nginx:1.27-alpine AS runner
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/landing/out /usr/share/nginx/html

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3002/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
