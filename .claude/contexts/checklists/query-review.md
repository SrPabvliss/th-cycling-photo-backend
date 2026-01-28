# Query Review Checklist

Use when reviewing query implementations.

## Query Params DTO

- [ ] Uses class-validator for params
- [ ] Has `@Type(() => Number)` for numeric params
- [ ] Default values for pagination
- [ ] Optional filters marked `@IsOptional()`

## Query Class

- [ ] All properties `readonly`
- [ ] Constructor with all params
- [ ] Default values for pagination
- [ ] No methods
- [ ] Named `Get{Noun}Query`

## Handler

- [ ] `@QueryHandler()` decorator present
- [ ] Implements `IQueryHandler<Query>`
- [ ] Very thin (just calls repository)
- [ ] No data transformation
- [ ] Returns Projection type
- [ ] Uses Read Repository
- [ ] Named `{Query}Handler`

## Projection

- [ ] Only fields needed by consumer
- [ ] Flat structure (no nested objects)
- [ ] No Entity methods
- [ ] Named `{Noun}Projection`

## Read Repository

- [ ] Uses `select` (not `include`)
- [ ] Only fetches needed fields
- [ ] Uses Mapper.to{X}Projection()
- [ ] Pagination implemented correctly
- [ ] Filters use indexed columns

## Anti-Patterns Check

- [ ] NOT returning full Entity
- [ ] NOT using `include` with relations
- [ ] NOT fetching more than needed
- [ ] NOT transforming in handler

## Tests

- [ ] Handler unit test exists
- [ ] Repository integration test exists
- [ ] Tests pagination
- [ ] Tests filters

---

## See Also

- `patterns/cqrs.md` - Query patterns
- `patterns/repositories.md` - Read repository
