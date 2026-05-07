# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Generate Prisma client + Build
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN pnpm build

# Stage 3: Production dependencies only
FROM node:22-slim AS prod-deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Stage 4: Runtime
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

# Copy production dependencies
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# Copy Prisma generated client
COPY --from=build --chown=nestjs:nodejs /app/src/generated ./src/generated

# Copy Prisma schema + migrations (for migrate deploy)
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

# Copy Prisma config (root level, needed by Prisma CLI)
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy i18n assets
COPY --from=build --chown=nestjs:nodejs /app/dist/src/i18n ./dist/src/i18n

# Copy package.json (needed for prisma seed)
COPY --from=build --chown=nestjs:nodejs /app/package.json ./

# Copy entrypoint script
COPY --from=build --chown=nestjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "scripts/docker-entrypoint.sh"]
