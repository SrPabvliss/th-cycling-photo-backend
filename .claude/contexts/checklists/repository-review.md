# Repository Review Checklist

Use when reviewing repository implementations.

## General

- [ ] Correctly placed in `infrastructure/repositories/`
- [ ] Injects PrismaService
- [ ] Uses Mapper functions (no inline mapping)
- [ ] No business logic

## Write Repository

- [ ] Named `{Entity}WriteRepository`
- [ ] `save()` uses Mapper.toPersistence()
- [ ] `save()` returns Entity via Mapper.toEntity()
- [ ] `delete()` returns void
- [ ] `delete()` is soft delete: updates `deleted_at` timestamp, not hard delete
- [ ] Uses `upsert` for create/update

## Read Repository

- [ ] Named `{Entity}ReadRepository`
- [ ] Query methods return Projections
- [ ] `findById(id)` returns `Entity | null` (used by command handlers for update/delete)
- [ ] Uses `findFirst` (not `findUnique`) for compound filter `{ id, deleted_at: null }`
- [ ] Uses `select` (specific fields)
- [ ] NOT using `include` (avoid overfetching)
- [ ] Uses Mapper.to{X}Projection()
- [ ] Pagination with `skip`/`take` from `Pagination` class
- [ ] Always filters `deleted_at: null` (soft-delete pattern)
- [ ] `orderBy` on list queries (e.g., `event_date: 'desc'`)

## Mapper

Mapper is a **module of exported functions** (not a class with static methods).

- [ ] File in `infrastructure/mappers/`, named `{entity}.mapper.ts`
- [ ] Imported as `import * as EventMapper from '../mappers/event.mapper'`
- [ ] `toPersistence(entity)` — Entity to Prisma create input
- [ ] `toEntity(record)` — Prisma record to Entity via `Entity.fromPersistence()`
- [ ] `to{X}Projection(record)` — Prisma selected record to Projection
- [ ] Handles snake_case ↔ camelCase mapping
- [ ] Internal type helpers for select shapes (e.g., `EventListSelect`, `EventDetailSelect`)

## Error Handling

**Current state:** Prisma errors are not caught in repositories. They propagate to `GlobalExceptionFilter` which returns them as generic HTTP 500. The system is functional and secure — no errors are lost.

**Tech debt (TTV-13):** Implement specific `PrismaClientKnownRequestError` handling (P2002 → 409 Conflict, P2025 → 404 Not Found) when modules with complex constraints are added.

## Tests

<!-- TODO: agregar cuando se implementen integration tests de repositorio -->

- [ ] Integration test for save/findById
- [ ] Integration test for queries with filters
- [ ] Integration test for pagination
- [ ] Tests clean up data

## Anti-Patterns Check

- [ ] NO business logic in repository
- [ ] NO inline mapping (uses Mapper)
- [ ] NO overfetching with `include`
- [ ] NO returning Entity from Read Repository query methods
- [ ] NO validation logic

---

## See Also

- `patterns/repositories.md` - Repository patterns
- `infrastructure/prisma-setup.md` - Prisma usage
- `testing/integration-tests.md` - Test patterns
