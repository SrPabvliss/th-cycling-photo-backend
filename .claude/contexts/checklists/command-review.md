# Command Review Checklist

Use when reviewing command implementations.

## DTO

- [ ] Uses class-validator decorators
- [ ] Has `@Type()` for Date fields
- [ ] Optional fields marked with `@IsOptional()`
- [ ] Constraints match business rules
- [ ] No business logic

## Command Class

- [ ] All properties `readonly`
- [ ] Constructor accepts all params
- [ ] No methods (pure data)
- [ ] No validation logic
- [ ] Named `{Verb}{Noun}Command`

## Handler

- [ ] `@CommandHandler()` decorator present
- [ ] Implements `ICommandHandler<Command>`
- [ ] Thin (<30 lines)
- [ ] Only orchestration, no business logic
- [ ] Uses Entity factory method
- [ ] Returns minimal result (id, not full entity)
- [ ] No validation (validation in Entity)
- [ ] Uses Write Repository
- [ ] Named `{Command}Handler`

## Entity (if modified)

- [ ] Factory method `create()` exists
- [ ] Business validations in factory method
- [ ] Throws `AppException.businessRule()`
- [ ] Behavior methods for state changes
- [ ] Guard methods (`canX()`) where needed

## Repository

- [ ] Uses Mapper.toPersistence()
- [ ] Uses Mapper.toEntity()
- [ ] No inline mapping
- [ ] No business logic

## Tests

- [ ] Entity unit test exists
- [ ] Handler unit test exists
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests use AAA pattern

---

## See Also

- `patterns/cqrs.md` - Command patterns
- `patterns/entities.md` - Entity patterns
