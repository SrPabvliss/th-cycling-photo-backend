---
name: write-tests
description: >
  Write valuable tests for the codebase.
  Use when creating unit tests (for complex logic) or integration tests.
  E2E tests are OUT OF SCOPE for this backend project.
---

# Write Tests

Create **valuable** tests - quality over coverage percentage.

## Philosophy

- ❌ NO: Chase coverage percentages
- ✅ YES: Test complex logic that matters
- Priority: **Integration > Selective Unit Tests**

## When to Use

- Writing unit tests for **complex** entities or handlers (CC ≥ 5)
- Creating integration tests for repositories
- Testing business logic with multiple branches

## When NOT to Write Unit Tests

- Simple getters/setters
- Handlers that only delegate to repository
- Code with Cyclomatic Complexity ≤ 2
- CRUD without business logic

## Required Context

Read before writing tests:

- `contexts/testing/test-guidelines.md` - Complexity criteria, when to test
- `contexts/testing/unit-tests.md` - Entity and handler test patterns
- `contexts/testing/integration-tests.md` - Repository tests with real DB
- `contexts/infrastructure/jest-config.md` - Jest configuration

## Test Types (MVP Scope)

| Type | Purpose | File Pattern | When |
|------|---------|--------------|------|
| Unit | Complex logic | `*.spec.ts` | CC ≥ 5 |
| Integration | Real DB flows | `*.integration.spec.ts` | Always for repos |

**E2E is OUT OF SCOPE** - Will be implemented with frontend later.

## Complexity Criteria (Cyclomatic Complexity)

| CC | Decision |
|----|----------|
| 1-2 | NO unit test needed |
| 3-4 | Evaluate - only if important edge cases |
| 5+ | Unit test REQUIRED |

## What Deserves Unit Tests

### Entities (if CC ≥ 5)
- Factory method with multiple validations ✓
- State machine transitions ✓
- Complex business rules ✓

### Handlers (if has logic)
- Business rule orchestration ✓
- Multiple repository calls ✓
- Conditional flows ✓

### What to Skip
- `findById()` that just calls repository ✗
- Simple property access ✗
- Delegations without logic ✗

## Commands

```bash
pnpm test                    # Unit tests
pnpm test:integration        # Integration tests
pnpm test -- file.spec.ts    # Specific file
```

## Checklist

- [ ] Evaluated complexity before writing test
- [ ] Tests follow AAA pattern
- [ ] Only testing valuable logic (CC ≥ 5 or integration)
- [ ] No tests for trivial code
- [ ] Tests are independent
