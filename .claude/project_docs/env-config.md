# Environment Configuration

## Overview

Environment variables are separated (not a single DATABASE_URL) and validated on startup.

## Required Variables

| Variable | Type | Description |
|----------|------|-------------|
| `NODE_ENV` | string | `development` \| `test` \| `preview` \| `production` |
| `PORT` | number | App port (default: 3000) |
| `DB_HOST` | string | Database host |
| `DB_PORT` | number | Database port (default: 5432) |
| `DB_USER` | string | Database user |
| `DB_PASSWORD` | string | Database password |
| `DB_NAME` | string | Database name |

## Environment-Specific Values

### Development (`.env.development`)
```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cycling_photo_dev
```

### Test (`.env.test`)
```env
NODE_ENV=test
PORT=3001

DB_HOST=<cloud-host>
DB_PORT=5432
DB_USER=<cloud-user>
DB_PASSWORD=<cloud-password>
DB_NAME=cycling_photo_test
```

### Preview / Production
Configured when deploying to those environments.

## DATABASE_URL Construction

Build from parts in ConfigService:

```typescript
const DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
```

Prisma receives the constructed URL.

## Validation

Use `@nestjs/config` + `class-validator`:

```typescript
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';

export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'preview', 'production'])
  NODE_ENV: string;

  @IsNumber()
  @Min(1)
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;
}
```

## Startup Behavior

1. Load `.env.{NODE_ENV}` file
2. Validate all required variables
3. Fail fast with clear error if missing
4. Log current environment on startup

## Files

| File | Git | Purpose |
|------|-----|---------|
| `.env.example` | ✓ Tracked | Template for developers |
| `.env.development` | ✗ Ignored | Local dev values |
| `.env.test` | ✗ Ignored | Test environment values |
