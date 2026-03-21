# Environment Configuration

> Updated: Sprint 5 (March 2026). See also: `project_docs/env-config.md` for the complete variable reference table.

## File Structure

```
├── .env.example              # Template (committed to git)
├── .env.development          # Local development
├── .env.test                 # Test environment
├── .env.preview              # Preview/staging
└── .env.production           # Production (never commit!)
```

---

## .env.example (current — Sprint 5)

```env
# App
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5498
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cycling_photo_dev
# DB_SSL_MODE=require  # Uncomment for cloud databases

# Backblaze B2
B2_APPLICATION_KEY_ID=your_application_key_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_ID=your_bucket_id
B2_BUCKET_NAME=your_bucket_name
B2_REGION=your_region

# Cloudflare CDN
CLOUDFLARE_CDN_URL=your_cdn_url

# Voyage AI
VOYAGE_API_KEY=your_voyage_api_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6394

# Auth
JWT_SECRET=your_jwt_secret_change_me
JWT_ACCESS_EXPIRATION_SECONDS=900
JWT_REFRESH_EXPIRY_DAYS=30
CORS_ORIGIN=http://localhost:5173

# Seed
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=test123
```

> **Note:** Database uses individual vars (`DB_HOST`, `DB_PORT`, etc.) instead of a single `DATABASE_URL`. The connection string is built at runtime by `src/config/configuration.ts`.

---

## Configuration Factory

```typescript
// src/config/configuration.ts
export default () => {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env

  let databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) {
    databaseUrl += `?sslmode=${DB_SSL_MODE}`
  }

  return {
    port: Number.parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV,
    database: {
      host: DB_HOST,
      port: Number.parseInt(DB_PORT || '5432', 10),
      user: DB_USER,
      password: DB_PASSWORD,
      name: DB_NAME,
      sslMode: DB_SSL_MODE,
      url: databaseUrl,
    },
  }
}
```

This factory is loaded via `ConfigModule.forRoot({ load: [configuration] })`. Access values with dot notation:

```typescript
configService.get<number>('port')           // 3000
configService.get<string>('nodeEnv')        // 'development'
configService.get<string>('database.url')   // full connection string
configService.get<string>('database.host')  // 'localhost'
```

---

## ConfigModule Setup

```typescript
// app.module.ts
import configuration from './config/configuration'
import { validate } from './config/env.validation'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validate,
      load: [configuration],
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

**Key points:**
- `envFilePath` is an **array** — first match wins, `.env` serves as fallback
- `validate` runs environment validation on startup (see below)
- `load: [configuration]` registers the factory for typed config access
- `isGlobal: true` makes `ConfigService` available everywhere without importing `ConfigModule`

---

## Using ConfigService

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.getOrThrow<string>('B2_BUCKET_NAME');
  }
}
```

### Methods

| Method | Behavior |
|--------|----------|
| `get<T>(key)` | Returns value or undefined |
| `get<T>(key, default)` | Returns value or default |
| `getOrThrow<T>(key)` | Returns value or throws error |

---

## Environment Validation

Environment variables are validated on startup using `class-validator`. **When adding new env vars, add them here too:**

```typescript
// src/config/env.validation.ts
export class EnvironmentVariables {
  // App
  @IsEnum(['development', 'test', 'preview', 'production'])
  NODE_ENV: string

  @IsNumber()
  @Min(1)
  PORT: number

  // Database
  @IsString() @IsNotEmpty()
  DB_HOST: string
  @IsNumber()
  DB_PORT: number
  @IsString() @IsNotEmpty()
  DB_USER: string
  @IsString() @IsNotEmpty()
  DB_PASSWORD: string
  @IsString() @IsNotEmpty()
  DB_NAME: string
  @IsOptional() @IsString()
  DB_SSL_MODE?: string

  // Backblaze B2
  @IsString() @IsNotEmpty()
  B2_APPLICATION_KEY_ID: string
  @IsString() @IsNotEmpty()
  B2_APPLICATION_KEY: string
  @IsString() @IsNotEmpty()
  B2_BUCKET_ID: string
  @IsString() @IsNotEmpty()
  B2_BUCKET_NAME: string
  @IsString() @IsNotEmpty()
  B2_REGION: string

  // Cloudflare
  @IsString() @IsNotEmpty()
  CLOUDFLARE_CDN_URL: string

  // Voyage AI
  @IsString() @IsNotEmpty()
  VOYAGE_API_KEY: string

  // Redis
  @IsString() @IsNotEmpty()
  REDIS_HOST: string
  @IsNumber()
  REDIS_PORT: number

  // Auth
  @IsString() @IsNotEmpty()
  JWT_SECRET: string
  @IsNumber()
  JWT_ACCESS_EXPIRATION_SECONDS: number
  @IsNumber()
  JWT_REFRESH_EXPIRY_DAYS: number
  @IsString() @IsNotEmpty()
  CORS_ORIGIN: string

  // Seed
  @IsString() @IsNotEmpty()
  ADMIN_SEED_EMAIL: string
  @IsString() @IsNotEmpty()
  ADMIN_SEED_PASSWORD: string
}
```

If any required variable is missing or invalid, the app will **fail to start** with a descriptive error.

---

## Docker Compose (Local Development)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5498:5432"    # Mapped to non-standard port
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: cycling_photo_dev

  redis:
    image: redis:7-alpine
    ports:
      - "6394:6379"    # Mapped to non-standard port
    command: redis-server --appendonly yes
```

```bash
pnpm docker:up     # Start PostgreSQL + Redis
pnpm docker:down   # Stop services
```

---

## Security Rules

- ✅ Commit `.env.example` with placeholder values
- ❌ Never commit real `.env.*` files (add to .gitignore)
- ✅ Use `getOrThrow()` for required variables
- ✅ Validate environment on startup
- ❌ Never log sensitive values

---

## See Also

- `project_docs/env-config.md` - Complete variable reference table
- `infrastructure/nestjs-bootstrap.md` - Main app configuration
- `infrastructure/prisma-setup.md` - Database connection via adapter
