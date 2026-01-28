---
name: implement-feature
description: >
  Implement features following project patterns.
  Use when writing commands, queries, entities, repositories, or controllers.
---

# Implement Feature

Write code following established patterns and conventions.

## When to Use

- Implementing a planned feature
- Creating new commands or queries
- Adding entities or repositories
- Writing controller endpoints

## Required Context

**Always read before implementing:**

| Area | Files |
|------|-------|
| Patterns | `contexts/patterns/cqrs.md`, `contexts/patterns/entities.md`, `contexts/patterns/repositories.md`, `contexts/patterns/controllers.md` |
| Structure | `contexts/structure/feature-sliced.md` |
| Conventions | `contexts/conventions/naming.md`, `contexts/conventions/validations.md`, `contexts/conventions/error-handling.md` |
| Infrastructure | `contexts/infrastructure/prisma-setup.md` |
| Checklist | `contexts/checklists/implementation.md` |

## Implementation Order

### For Commands (Write Operations)

1. **Entity** (`domain/entities/`)
   - Factory method `create()` with business validations
   - `fromPersistence()` for DB reconstitution
   - Behavior methods for state changes
   - Use `AppException.businessRule()` for violations

2. **DTO** (`application/commands/{feature}/`)
   - class-validator decorators
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
   - Static methods, no dependencies

6. **Repository** (`infrastructure/repositories/`)
   - Uses Mapper for conversions
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

## Validation Checklist

Before completing, verify:

- [ ] Entity has factory method with validations
- [ ] Handler is thin (<30 lines)
- [ ] Mapper is separate class (not inline)
- [ ] Repository uses Mapper
- [ ] Controller has `@SuccessMessage()`
- [ ] No linting errors (`pnpm check`)
- [ ] Naming conventions followed
