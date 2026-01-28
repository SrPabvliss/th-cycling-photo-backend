---
name: review-code
description: >
  Review code for quality and pattern compliance.
  Use when reviewing PRs, validating implementations, or checking for anti-patterns.
---

# Review Code

Review code against project patterns and conventions.

## When to Use

- Reviewing pull requests
- Validating feature implementations
- Checking for anti-patterns
- Pre-merge quality checks

## Required Context

Read before reviewing:

- `contexts/review/review-process.md` - Review checklist and report format
- `contexts/conventions/anti-patterns.md` - Common mistakes to catch
- `contexts/checklists/command-review.md` - Command-specific checks
- `contexts/checklists/query-review.md` - Query-specific checks
- `contexts/checklists/repository-review.md` - Repository-specific checks

## Review Priorities

1. **Critical** (Blocking): Architecture violations, security issues
2. **High**: Pattern violations, missing tests
3. **Medium**: Code style, documentation
4. **Low**: Suggestions, optimizations

## Quick Checklist

### Structure
- [ ] Files in correct folders (Feature-Sliced)
- [ ] Naming conventions respected
- [ ] Layers respected (domain → application → infrastructure → presentation)

### Patterns
- [ ] Handler is thin (<30 lines)
- [ ] Entity has factory method with validations
- [ ] Repository uses Mapper (no inline mapping)
- [ ] Controller has `@SuccessMessage()`
- [ ] Projections used for queries

### Exceptions
- [ ] Uses `AppException` factory methods
- [ ] No generic `Error` throws
- [ ] No NestJS exceptions in domain/application

### Testing
- [ ] Unit tests for entities
- [ ] Unit tests for handlers
- [ ] Tests follow AAA pattern

### Code Quality
- [ ] No linting errors
- [ ] No commented-out code
- [ ] No console.log statements

## Common Issues to Catch

| Issue | Location | Severity |
|-------|----------|----------|
| Business logic in handler | Handler | Critical |
| Mapping inside repository | Repository | High |
| Missing `@SuccessMessage()` | Controller | Medium |
| Fat handler (>30 lines) | Handler | High |
| Entity without factory method | Entity | Critical |
| Overfetching with `include` | Repository | High |

## Review Report Format

```markdown
## Review: [PR Title]

### Summary
Brief description of changes reviewed.

### Issues Found

#### Critical
1. **[File:Line]** Description
   - Current: `code`
   - Should be: `corrected code`

#### Suggestions
1. Consider extracting X to Y

### Verdict
- [ ] Approved
- [ ] Approved with suggestions
- [ ] Changes requested
```
