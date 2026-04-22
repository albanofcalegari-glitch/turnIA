# ── Stage 1: install & build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy only the packages needed by the API
COPY apps/api/package.json apps/api/
COPY apps/api/nest-cli.json apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/database/ packages/database/
COPY apps/api/ apps/api/

# Generate Prisma client
RUN pnpm --filter @turnia/database db:generate

# Build the API
RUN pnpm --filter @turnia/api build

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for workspace resolution
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema + generated client
COPY --from=builder /app/packages/database/prisma packages/database/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma

# Copy shared package source
COPY packages/shared/ packages/shared/

# Copy built API
COPY --from=builder /app/apps/api/dist apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
