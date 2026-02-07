# Prisma Setup

## File Structure

```
prisma/
├── schema.prisma
├── migrations/
└── seed.ts

prisma.config.ts                    # Datasource config (uses dotenv)

src/generated/prisma/               # Generated client (gitignored)
├── client.ts
├── models/
└── ...

src/shared/infrastructure/prisma/
├── prisma.service.ts
└── prisma.module.ts
```

---

## Generator Configuration

```prisma
// prisma/schema.prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

**Critical settings:**
- `output` → `../src/generated/prisma` (not default `node_modules`)
- `moduleFormat = "cjs"` → Avoids `import.meta.url` errors in CJS compilation

### prisma.config.ts

```typescript
import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
let databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
if (DB_SSL_MODE) databaseUrl += `?sslmode=${DB_SSL_MODE}`

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: databaseUrl },
})
```

---

## Import Rules

⚠️ **Import from generated path using `@generated` alias, NOT from `@prisma/client`:**

```typescript
// ✅ Correct (path alias)
import { PrismaClient } from '@generated/prisma/client'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

// ✅ Also correct (relative path, no .js extension needed in CJS)
import type { Prisma } from '../../../../generated/prisma/client'

// ❌ Wrong (old Prisma pattern)
import { PrismaClient } from '@prisma/client'
```

> **Note:** The project compiles as CJS (no `"type": "module"` in package.json), so `.js` extensions are NOT required on imports.

⚠️ **Prisma 7 namespace types:**
Input types (e.g., `EventCreateInput`) must be accessed via `Prisma` namespace:

```typescript
import type { Prisma } from '@generated/prisma/client'

function toPersistence(entity: Event): Prisma.EventCreateInput { ... }
```

---

## PrismaService & PrismaModule

```typescript
// shared/infrastructure/prisma/prisma.service.ts
import { PrismaClient } from '@generated/prisma/client'
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('database.url')
    const adapter = new PrismaPg({ connectionString })
    super({ adapter })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

> **Note:** Uses `@prisma/adapter-pg` (Prisma 7 driver adapter) with the `pg` package. The connection string comes from `ConfigService` key `'database.url'` (built by `src/config/configuration.ts`). The `datasource db` block in `schema.prisma` does NOT include a `url` — it's provided at runtime via the adapter.

```typescript
// shared/infrastructure/prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Why `@Global()`

`PrismaModule` is decorated with `@Global()` and imported **once** in `AppModule`. This makes `PrismaService` available in all modules without re-importing. Feature modules (e.g., `EventsModule`) do NOT import `PrismaModule` — their repositories receive `PrismaService` via standard constructor injection.

### PrismaService vs Symbol Token Injection

| Concern | Pattern | Example |
|---------|---------|---------|
| `PrismaService` | Direct class injection (no Symbol) | `constructor(private readonly prisma: PrismaService)` (receives `ConfigService` in its own constructor) |
| Repositories | Symbol token + interface (Ports & Adapters) | `@Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository` |

`PrismaService` does NOT use a Symbol token because it's infrastructure — repositories are the abstraction boundary. Handlers never inject `PrismaService` directly; they inject repository interfaces.

---

## Commands

```bash
npx prisma generate          # Generate client to src/generated/prisma
npx prisma migrate dev       # Create/apply migration (dev)
npx prisma migrate deploy    # Apply migrations (prod)
npx prisma studio            # Open visual DB editor
npx prisma format            # Format schema file
```

---

## Schema Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Model name | PascalCase | `DetectedCyclist` |
| Table name | snake_case via @@map | `@@map("detected_cyclists")` |
| Column name | snake_case | `plate_number`, `event_date` |
| Foreign key | `{table}_id` | `event_id` |

---

## .gitignore

```
src/generated/prisma
```

The generated client is **not committed**. CI runs `prisma generate` before build/test.

---

## Troubleshooting

### `import.meta.url` error
**Cause:** Default Prisma client uses ESM but NestJS compiles to CJS.
**Fix:** Add `moduleFormat = "cjs"` to generator config.

### Types not found after schema change
**Fix:** Run `npx prisma generate` to regenerate client.

### `Prisma.EventCreateInput` not found
**Cause:** Prisma 7 doesn't export input types directly.
**Fix:** Use `Prisma` namespace: `Prisma.EventCreateInput` (not `EventCreateInput`).

---

## See Also

- `patterns/repositories.md` - Repository and Mapper patterns
- `infrastructure/ci-pipeline.md` - CI requires `prisma generate`
- `infrastructure/env-config.md` - Environment variables
