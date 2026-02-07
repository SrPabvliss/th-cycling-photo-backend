# Common Errors & Troubleshooting

## Import Type vs Value Import (NestJS DI + Swagger)

**Problem:** Using `import type` for classes injected via NestJS DI or used in Swagger causes runtime failures.

```typescript
// ❌ BAD - disappears at runtime, DI can't resolve
import type { PrismaService } from '...'
import type { CommandBus } from '@nestjs/cqrs'

// ✅ GOOD - class reference preserved at runtime
import { PrismaService } from '...'
import { CommandBus } from '@nestjs/cqrs'
```

**Why:** TypeScript's `emitDecoratorMetadata` needs class references at runtime for:
- Constructor parameter injection (NestJS DI)
- `@Body()` / `@Query()` parameter types (Swagger schema generation)

**Project config:** Biome `useImportType` is **OFF** to prevent auto-converting to `import type`.

**When `import type` IS correct:**
- Interfaces: `import type { IEventWriteRepository } from '...'`
- Types used only in type positions: `import type { EventStatusType } from '...'`

---

## Prisma 7 ESM/CJS Conflict

**Problem:** `import.meta.url is not supported in CJS` error at runtime.

**Cause:** Default Prisma client generates ESM code, but NestJS compiles to CJS.

**Fix:** In `schema.prisma`:
```prisma
generator client {
  provider     = "prisma-client-js"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

---

## Prisma 7 Input Types

**Problem:** `Cannot find name 'EventCreateInput'` - direct imports don't work.

**Fix:** Use `Prisma` namespace:
```typescript
import type { Prisma } from '../../../../generated/prisma/client.js'

function toPersistence(entity: Event): Prisma.EventCreateInput { ... }
```

---

## i18n Files Not Found at Runtime

**Problem:** `Error: ENOENT: no such file or directory 'dist/.../i18n/es/swagger.json'`

**Cause:** JSON files not copied to `dist/` during build.

**Fix:** In `nest-cli.json`:
```json
{
  "compilerOptions": {
    "assets": [{ "include": "i18n/**/*.json", "outDir": "dist/src" }]
  }
}
```

---

## Swagger Shows Empty Request Body

**Problem:** Swagger UI shows request body schema as `{}` for DTOs.

**Cause:** DTOs imported with `import type` → class reference erased at runtime.

**Fix:** Use value imports for DTOs used in `@Body()` or `@Query()`:
```typescript
import { CreateEventDto } from '...'  // ✅ Not import type
```

---

## NestJS Module Resolution Errors

**Problem:** `Nest can't resolve dependencies of...`

**Common causes:**
1. Missing `@Inject(TOKEN)` when using Symbol-based DI
2. Provider not registered in module
3. `import type` used for injected class

**Fix checklist:**
```typescript
// 1. Port has Symbol token
export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')

// 2. Module registers with token
{ provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository }

// 3. Handler uses @Inject with token
@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository
```

---

## Biome Changes Disappearing

**Problem:** Biome auto-fix converts `import` to `import type`, breaking DI.

**Fix:** Disable `useImportType` in `biome.json`:
```json
{
  "linter": {
    "rules": {
      "style": {
        "useImportType": "off"
      }
    }
  }
}
```

---

## Test Failures After Schema Change

**Problem:** Tests fail with type errors after modifying Prisma schema.

**Fix:** Regenerate client before running tests:
```bash
npx prisma generate
pnpm test
```

CI pipeline already does this automatically.

---

## See Also

- `infrastructure/prisma-setup.md` - Prisma configuration
- `infrastructure/swagger-setup.md` - Swagger setup details
- `infrastructure/ci-pipeline.md` - CI pipeline steps
