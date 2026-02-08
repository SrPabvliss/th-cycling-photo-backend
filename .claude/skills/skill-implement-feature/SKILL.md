---
name: implement-feature
description: >
  Implement features following project patterns.
  Use when writing commands, queries, entities, repositories, or controllers.
---

# Implement Feature

Write code following established patterns and conventions.

## When to Use

- Implementing a planned feature (after plan-task)
- Creating new commands or queries
- Adding entities or repositories
- Writing controller endpoints

## Pre-Implementation Checklist (MANDATORY)

**Before writing ANY code:**

1. **Check Research Cache**
   ```bash
   # Verify technology docs are available
   cat .claude/ledger/research/prisma.md
   cat .claude/ledger/research/nestjs.md
   ```
   If missing → STOP → invoke `skill:research-external`

2. **Load Required Contexts**

   | Area | Files |
   |------|-------|
   | Patterns | `contexts/patterns/cqrs.md`, `entities.md`, `repositories.md`, `controllers.md` |
   | Structure | `contexts/structure/feature-sliced.md` |
   | Conventions | `contexts/conventions/naming.md`, `validations.md`, `error-handling.md` |
   | Infrastructure | `contexts/infrastructure/prisma-setup.md` |
   | Checklist | `contexts/checklists/implementation.md` |

3. **Load Project-Specific Docs**
   ```bash
   # Check for ticket-specific documentation
   ls .claude/project_docs/
   ```

## Implementation Order

### For Commands (Write Operations)

1. **Entity** (`domain/entities/`)
   - Factory method `create()` with business validations
   - `fromPersistence()` for DB reconstitution
   - Behavior methods for state changes
   - Use `AppException.businessRule()` for violations

2. **DTO** (`application/commands/{feature}/`)
   - class-validator decorators (check research cache for syntax)
   - `@Type()` for Date fields

3. **Command** (`application/commands/{feature}/`)
   - Immutable, readonly properties
   - No logic

4. **Handler** (`application/commands/{feature}/`)
   - Thin (<30 lines)
   - Uses Entity factory method
   - Returns `{ id: string }` or Projection

5. **Mapper** (`infrastructure/mappers/`)
   - `toPersistence()` and `toEntity()`
   - Exported functions, no class, no dependencies

6. **Repository** (`infrastructure/repositories/`)
   - Uses Mapper for conversions
   - Check research cache for Prisma client syntax
   - No inline mapping

7. **Controller** (`presentation/controllers/`)
   - `@SuccessMessage()` decorator
   - DTO → Command conversion only

8. **Module registration**

### For Queries (Read Operations)

1. **Projection** (`application/projections/`)
2. **Query DTO** (`application/queries/{feature}/`)
3. **Query** (`application/queries/{feature}/`)
4. **Handler** (`application/queries/{feature}/`)
5. **Mapper** (add `to{X}Projection()` methods)
6. **Read Repository** (`infrastructure/repositories/`)
7. **Controller endpoint**

## When Unsure About API Syntax

**NEVER guess.** If you don't know the exact syntax:

1. Check `.claude/ledger/research/{technology}.md`
2. If not there → Context7 MCP query
3. Update research cache with finding
4. Then implement

**Example:**
```
Unsure: Prisma 7 relation syntax
→ Check: .claude/ledger/research/prisma.md
→ Not found: Context7 "Prisma 7 relation syntax one-to-many"
→ Update research cache
→ Implement with verified syntax
```

## Commit Checkpoints

After each logical unit, commit:

```bash
# After entity
git commit -m "feat({domain}): add {Entity} entity"

# After command/handler
git commit -m "feat({domain}): add {Feature}Command"

# After repository
git commit -m "feat({domain}): add {Entity} repository"
```

## Validation Checklist

Before completing, validate against `checklists/implementation.md`.

Quick self-check:
- [ ] Research cache consulted for external APIs
- [ ] Mapper is separate file with exported functions (not inline)
- [ ] No linting errors (`pnpm check`)
- [ ] Commits made at checkpoints
