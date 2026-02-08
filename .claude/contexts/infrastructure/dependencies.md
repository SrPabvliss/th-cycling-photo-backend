# Dependencies

## Package Manager

**pnpm** is enforced via `package.json`:

```json
{
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "packageManager": "pnpm@10.28.1"
}
```

---

## Core Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | NestJS core |
| `@nestjs/core` | NestJS core |
| `@nestjs/platform-express` | HTTP adapter |
| `@nestjs/config` | Environment config |
| `@nestjs/cqrs` | CQRS pattern |
| `@nestjs/swagger` | OpenAPI/Swagger documentation |
| `@prisma/client` | Database ORM (Prisma 7) |
| `@prisma/adapter-pg` | Prisma driver adapter for PostgreSQL |
| `pg` | PostgreSQL client (used by adapter) |
| `nestjs-i18n` | Internationalization (i18n) |
| `class-validator` | DTO validation |
| `class-transformer` | DTO transformation |
| `dotenv` | Environment variable loading |
| `reflect-metadata` | Decorator metadata |
| `rxjs` | Reactive extensions |

> **Note:** `@nestjs/bullmq`, `bullmq`, and `ioredis` are installed but **NOT used** currently. They are kept for the future Processing module implementation.

---

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| `@biomejs/biome` | Linting & formatting |
| `@nestjs/cli` | CLI tools |
| `@nestjs/schematics` | NestJS code generation |
| `@nestjs/testing` | Test utilities |
| `@types/express` | Express type definitions |
| `@types/jest` | Jest type definitions |
| `@types/node` | Node.js type definitions |
| `@types/pg` | PostgreSQL type definitions |
| `@types/supertest` | Supertest type definitions |
| `jest` | Test runner |
| `ts-jest` | TypeScript support for Jest |
| `prisma` | Prisma CLI |
| `husky` | Git hooks |
| `supertest` | HTTP assertion library |
| `source-map-support` | Source map support for debugging |
| `ts-loader` | TypeScript loader |
| `ts-node` | TypeScript execution |
| `tsconfig-paths` | Path alias resolution at runtime |
| `tsx` | TypeScript execution (used by Prisma seed) |
| `typescript` | TypeScript compiler |

---

## Adding Dependencies

```bash
# Production dependency
pnpm add package-name

# Dev dependency
pnpm add -D package-name

# Specific version
pnpm add package-name@1.2.3
```

---

## AI Service SDKs

> ⚠️ **NO IMPLEMENTADO** — Estos paquetes se instalarán cuando se desarrollen los módulos correspondientes.

```bash
# Roboflow
pnpm add axios  # HTTP calls to Roboflow API

# Google Cloud Vision
pnpm add @google-cloud/vision

# Clarifai
pnpm add clarifai
```

---

## Storage SDKs

> ⚠️ **NO IMPLEMENTADO** — Se instalará cuando se desarrolle el módulo de Storage.

```bash
# Backblaze B2
pnpm add backblaze-b2

# Or AWS SDK compatible
pnpm add @aws-sdk/client-s3
```

---

## Scripts Reference

```json
{
  "scripts": {
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "build": "nest build",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:seed": "prisma db seed",
    "prisma:studio": "prisma studio",
    "prisma:reset": "prisma migrate reset",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "lint": "biome lint --write .",
    "lint:check": "biome lint .",
    "check": "biome check --write .",
    "check:ci": "biome ci .",
    "start": "nest start",
    "start:dev": "NODE_ENV=development nest start --watch",
    "start:debug": "NODE_ENV=development nest start --debug --watch",
    "start:test": "NODE_ENV=test nest start",
    "start:prod": "node -r tsconfig-paths/register dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prepare": "husky"
  }
}
```

---

## Version Pinning

For stability, consider pinning major versions:

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@prisma/client": "^7.0.0"
  }
}
```

Use `^` for minor updates, exact version for critical packages.

---

## See Also

- `CLAUDE.md` - Command reference
- `infrastructure/env-config.md` - Environment setup
