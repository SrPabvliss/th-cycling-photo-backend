# Implementation Checklist

Use before marking a feature as complete.

## Command Implementation

- [ ] DTO with class-validator decorators
- [ ] Command class (immutable, readonly)
- [ ] Handler thin (<30 lines)
- [ ] Handler uses Entity factory method
- [ ] Entity has business validations
- [ ] Entity throws AppException.businessRule()
- [ ] Write Repository uses Mapper
- [ ] Controller converts DTO → Command
- [ ] Unit test for Entity
- [ ] Unit test for Handler
- [ ] Registered in module providers

## Query Implementation

- [ ] Query params DTO
- [ ] Query class (immutable)
- [ ] Handler thin
- [ ] Projection class defined
- [ ] Read Repository returns Projection
- [ ] Read Repository uses Mapper
- [ ] Uses `select` not `include` (no overfetching)
- [ ] Controller converts DTO → Query
- [ ] Unit test for Handler
- [ ] Registered in module providers

## General

- [ ] Files in correct folders
- [ ] Naming conventions followed
- [ ] No linting errors (`pnpm check`)
- [ ] JSDoc on public methods
- [ ] No TODO comments left
- [ ] No console.log statements

---

## See Also

- `patterns/cqrs.md` - CQRS patterns
- `conventions/naming.md` - Naming rules
- `review/review-process.md` - Review checklist
