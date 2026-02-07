# Query Review Checklist

Use when reviewing query implementations.

## Query Params DTO

- [ ] Uses class-validator for params
- [ ] Optional filters marked `@IsOptional()`
- [ ] Pagination fields are optional (`page?: number`, `limit?: number`)
- [ ] Pagination defaults handled in controller (`dto.page ?? 1, dto.limit ?? 20`), not in DTO
- [ ] Not all queries need a DTO (e.g., get-by-id only needs route param)

## Query Class

- [ ] All properties `readonly`
- [ ] Constructor with all params
- [ ] No methods
- [ ] Named `Get{Noun}Query` (e.g., `GetEventsListQuery`, `GetEventDetailQuery`)
- [ ] List queries receive `Pagination` object (already constructed by controller)

## Handler

- [ ] `@QueryHandler()` decorator present
- [ ] Implements `IQueryHandler<Query>`
- [ ] Very thin (just calls repository)
- [ ] Detail handler throws `AppException.notFound()` if result is null
- [ ] Returns Projection type
- [ ] Uses Read Repository via `@Inject(SYMBOL_TOKEN)`
- [ ] Named `{Query}Handler` (e.g., `GetEventsListHandler`)

## Projection

- [ ] Only fields needed by consumer
- [ ] Flat structure (no nested objects)
- [ ] No Entity methods
- [ ] Named `{Noun}Projection` (e.g., `EventListProjection`, `EventDetailProjection`)
- [ ] Lives in `application/projections/` (separate from queries/)
- [ ] `EntityIdProjection` in `@shared/application` for command returns

## Read Repository

- [ ] Uses `select` (not `include`)
- [ ] Only fetches needed fields
- [ ] Uses Mapper.to{X}Projection()
- [ ] Pagination implemented correctly (`skip`/`take` from `Pagination` class)
- [ ] `findById(id)` returns `Entity | null` (used by command handlers)
- [ ] Uses `findFirst` (not `findUnique`) for compound filter `{ id, deleted_at: null }`
- [ ] Always filters `deleted_at: null` (soft-delete pattern)
- [ ] `orderBy` on list queries (e.g., `event_date: 'desc'`)

## Anti-Patterns Check

- [ ] NOT returning full Entity from query methods
- [ ] NOT using `include` with relations
- [ ] NOT fetching more than needed
- [ ] NOT transforming in handler

## Tests

<!-- TODO: agregar cuando se implementen query handler tests -->

- [ ] Handler unit test exists
- [ ] Repository integration test exists
- [ ] Tests pagination
- [ ] Tests filters

---

## See Also

- `patterns/cqrs.md` - Query patterns
- `patterns/repositories.md` - Read repository
