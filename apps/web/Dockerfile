# ── Stage 1: install & build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy ALL workspace package.json files so pnpm can resolve the full lockfile
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/

# Install dependencies (shamefully-hoist ensures symlinks work in Alpine)
RUN echo "shamefully-hoist=true" > .npmrc && pnpm install --frozen-lockfile

# Copy source code (only what web needs)
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# Build args for Next.js (needed at build time)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the web app
RUN pnpm --filter @turnia/web build

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
