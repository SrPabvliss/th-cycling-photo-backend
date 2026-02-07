# Implementation Checklist

Use before marking a feature as complete.

## Command Implementation

- [ ] DTO with class-validator decorators (delete has no DTO — ID from route param)
- [ ] Command class (immutable, readonly)
- [ ] Handler thin (<30 lines)
- [ ] Handler uses Entity factory method (`create()`) or behavior method (`update()`, `softDelete()`)
- [ ] Handler returns `EntityIdProjection` (`{ id }`) from `@shared/application`
- [ ] Handler uses `@Inject(SYMBOL_TOKEN)` for repository injection
- [ ] Entity has business validations in `private static` methods
- [ ] Entity throws `AppException.businessRule()`
- [ ] Entity uses `AuditFields` composition (`readonly audit: AuditFields`)
- [ ] Entity has `softDelete()` and `fromPersistence()` methods
- [ ] Write Repository uses Mapper
- [ ] Controller converts DTO → Command
- [ ] Unit test for Entity
- [ ] Unit test for Handler
- [ ] Registered in module providers

## Query Implementation

- [ ] Query params DTO (not all queries need one — detail uses route param)
- [ ] Query class (immutable)
- [ ] Handler thin
- [ ] Detail handler throws `AppException.notFound()` if result is null
- [ ] Projection class defined in `application/projections/` (separate from queries/)
- [ ] Read Repository returns Projection
- [ ] Read Repository uses Mapper
- [ ] Uses `select` not `include` (no overfetching)
- [ ] Pagination via `Pagination` class from `@shared/application`, defaults in controller
- [ ] Controller converts DTO → Query
- [ ] Registered in module providers

<!-- TODO: query handler unit tests pending -->

## General

- [ ] Files in correct folders
- [ ] Naming conventions followed
- [ ] No linting errors (`pnpm check` — Biome)
- [ ] Barrel files (`index.ts`) at each layer exporting public API
- [ ] Swagger decorators on controller (`@ApiOperation`, `@ApiTags`, `@ApiParam`)
- [ ] `@SuccessMessage()` decorator on controller methods
- [ ] `@ApiEnvelopeResponse()` / `@ApiEnvelopeErrorResponse()` on controller methods
- [ ] JSDoc on public methods
- [ ] No TODO comments left
- [ ] No console.log statements

---

## See Also

- `patterns/cqrs.md` - CQRS patterns
- `conventions/naming.md` - Naming rules
- `review/review-process.md` - Review checklist
