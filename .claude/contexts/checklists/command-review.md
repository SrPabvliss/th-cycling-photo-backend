# Command Review Checklist

Use when reviewing command implementations.

## DTO

- [ ] Uses class-validator decorators
- [ ] Has `@Type()` for Date fields
- [ ] Optional fields marked with `@IsOptional()`
- [ ] Constraints match business rules
- [ ] No business logic
- [ ] Delete command has no DTO — ID comes from route param

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
- [ ] Uses Entity factory method (create) or Entity behavior method (update/delete)
- [ ] Returns `EntityIdProjection` (`{ id }`) from `@shared/application`
- [ ] No validation (validation in Entity)
- [ ] Uses `@Inject(SYMBOL_TOKEN)` for repository injection
- [ ] Uses Write Repository (create) or both Write + Read repositories (update/delete)
- [ ] Named `{VerbNoun}Handler` (e.g., `CreateEventHandler`)

## Entity (if modified)

- [ ] Factory method `create()` exists
- [ ] Business validations in `private static` methods (e.g., `validateName`, `validateDate`) called from `create()` and `update()`
- [ ] Throws `AppException.businessRule()`
- [ ] Uses `AuditFields` composition (`readonly audit: AuditFields`) instead of direct `createdAt`/`updatedAt`
- [ ] `update()` method for partial updates with field-level validation, calls `this.audit.markUpdated()`
- [ ] `softDelete()` method calls `this.audit.markDeleted()`
- [ ] `fromPersistence()` static method for DB reconstitution (no validations applied)
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

> **Note:** `update-event.handler.spec.ts` pending (low cyclomatic complexity).

---

## See Also

- `patterns/cqrs.md` - Command patterns
- `patterns/entities.md` - Entity patterns
