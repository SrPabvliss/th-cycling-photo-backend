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
| `@prisma/client` | Database ORM |
| `@nestjs/bullmq` | Job queues |
| `bullmq` | BullMQ core |
| `ioredis` | Redis client |
| `class-validator` | DTO validation |
| `class-transformer` | DTO transformation |

---

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| `@biomejs/biome` | Linting & formatting |
| `@nestjs/cli` | CLI tools |
| `@nestjs/testing` | Test utilities |
| `jest` | Test runner |
| `ts-jest` | TypeScript support for Jest |
| `prisma` | Prisma CLI |
| `husky` | Git hooks |
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

## AI Service SDKs (To Be Added)

```bash
# Roboflow
pnpm add axios  # HTTP calls to Roboflow API

# Google Cloud Vision
pnpm add @google-cloud/vision

# Clarifai
pnpm add clarifai
```

---

## Storage SDKs (To Be Added)

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
    "build": "nest build",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "check": "biome check --write .",
    "check:ci": "biome ci .",
    "lint": "biome lint --write .",
    "format": "biome format --write .",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
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
