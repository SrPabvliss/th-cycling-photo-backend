# Repository Review Checklist

Use when reviewing repository implementations.

## General

- [ ] Correctly placed in `infrastructure/repositories/`
- [ ] Injects PrismaService
- [ ] Uses Mapper class (no inline mapping)
- [ ] No business logic
- [ ] Proper error handling

## Write Repository

- [ ] Named `{Entity}WriteRepository`
- [ ] `save()` uses Mapper.toPersistence()
- [ ] `save()` returns Entity via Mapper.toEntity()
- [ ] `findById()` returns Entity or null
- [ ] `delete()` returns void
- [ ] Uses `upsert` for create/update

## Read Repository

- [ ] Named `{Entity}ReadRepository`
- [ ] Methods return Projections
- [ ] Uses `select` (specific fields)
- [ ] NOT using `include` (avoid overfetching)
- [ ] Uses Mapper.to{X}Projection()
- [ ] Pagination with skip/take
- [ ] Filters use indexed columns

## Mapper

- [ ] Mapper in `infrastructure/mappers/`
- [ ] Named `{Entity}Mapper`
- [ ] All methods static
- [ ] `toPersistence(entity)` - Entity to DB
- [ ] `toEntity(record)` - DB to Entity
- [ ] `to{X}Projection(record)` - DB to Projection
- [ ] Handles snake_case ↔ camelCase

## Error Handling

- [ ] Catches PrismaClientKnownRequestError
- [ ] P2002 → AppException.businessRule()
- [ ] P2025 → AppException.notFound()
- [ ] Unknown errors re-thrown

## Tests

- [ ] Integration test for save/findById
- [ ] Integration test for queries with filters
- [ ] Integration test for pagination
- [ ] Tests clean up data

## Anti-Patterns Check

- [ ] NO business logic in repository
- [ ] NO inline mapping (uses Mapper)
- [ ] NO overfetching with `include`
- [ ] NO returning Entity from Read Repository
- [ ] NO validation logic

---

## See Also

- `patterns/repositories.md` - Repository patterns
- `infrastructure/prisma-setup.md` - Prisma usage
- `testing/integration-tests.md` - Test patterns
