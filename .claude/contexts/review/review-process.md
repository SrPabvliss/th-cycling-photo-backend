# Review Process

## Overview

Code review validates architecture, patterns, and quality before merge.

## Review Checklist

### Structure
- [ ] File in correct folder (Feature-Sliced)
- [ ] Naming conventions respected
- [ ] Commands/Queries separated correctly
- [ ] Layers respected (domain/application/infrastructure/presentation)

### Patterns
- [ ] Handler is thin (<30 lines)
- [ ] Entity has factory method with validations
- [ ] Repository uses Mapper (no inline mapping)
- [ ] Controller only does DTO → Command/Query conversion
- [ ] Projections used for queries (not entities)
- [ ] Ports & Adapters: `@Inject(TOKEN)` with Symbol tokens + interface types
- [ ] Barrel alias imports (`@events/...`, `@shared/...`) — no deep relative paths

### Swagger & HTTP
- [ ] `@ApiOperation`, `@ApiEnvelopeResponse`, `@ApiParam` on every endpoint
- [ ] `@ApiEnvelopeErrorResponse` for each error case (400, 404, etc.)
- [ ] `@SuccessMessage()` decorator on every controller endpoint

### Soft Delete Consistency
- [ ] Entity has `softDelete()` → `this.audit.markDeleted()`
- [ ] WriteRepository `delete()` does `prisma.update({ deleted_at })`, NOT `prisma.delete()`
- [ ] ReadRepository filters `deleted_at: null` on all queries

### Error Handling
- [ ] Uses AppException factory methods
- [ ] No generic Error throws
- [ ] No NestJS exceptions in domain/application

### Testing
- [ ] Unit tests for entities
- [ ] Unit tests for handlers
- [ ] Tests follow AAA pattern
- [ ] Integration tests for repositories *(aspirational — not yet implemented)*

### Code Quality
- [ ] No linting errors (`pnpm check`)
- [ ] JSDoc on public methods
- [ ] No commented-out code
- [ ] No console.log statements

---

## Review Report Format

```markdown
## Review: [PR Title]

### Summary
Brief description of changes reviewed.

### Structure ✅/❌
- [x] Correct folder placement
- [x] Naming conventions
- [ ] Issue: Handler in wrong folder

### Patterns ✅/❌
- [x] Thin handler
- [x] Entity validations
- [ ] Issue: Mapping inside repository

### Issues Found

#### Critical (Blocking)
1. **[File:Line]** Description
   ```typescript
   // Current code
   ```
   **Should be:**
   ```typescript
   // Corrected code
   ```

#### Suggestions (Non-blocking)
1. Consider extracting X to Y

### Verdict
- [ ] Approved
- [ ] Approved with suggestions
- [x] Changes requested
```

---

## Common Issues

### Architecture Violations

| Issue | Location | Fix |
|-------|----------|-----|
| Business logic in handler | Handler | Move to Entity |
| Validation in handler | Handler | Move to DTO or Entity |
| Mapping in repository | Repository | Create mapper functions (not class) |
| Logic in controller | Controller | Move to Handler |

### CQRS Violations

| Issue | Fix |
|-------|-----|
| Query returning Entity | Return Projection |
| Command with SELECT * | Use specific select |
| Handler > 30 lines | Extract to Entity methods or private handler methods |

### Testing Gaps

| Missing | Required For |
|---------|--------------|
| Entity unit test | Any entity change |
| Handler unit test | Any handler |
| Integration test | Repository changes |

---

## Review Priorities

1. **Critical**: Architecture violations, security issues
2. **High**: Pattern violations, missing tests
3. **Medium**: Code style, documentation
4. **Low**: Suggestions, optimizations

---

## See Also

- `conventions/anti-patterns.md` - What to look for
- `checklists/*.md` - Detailed verification lists
- `patterns/*.md` - Expected patterns
