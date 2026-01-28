# Test Guidelines

> **Philosophy:** Quality over coverage. Test what matters.

---

## Cyclomatic Complexity - When to Unit Test

**Cyclomatic Complexity (CC)** = número de paths independientes en el código.

| CC | Branches | Decision |
|----|----------|----------|
| 1-2 | 0-1 if/else | ❌ NO unit test |
| 3-4 | 2-3 branches | ⚠️ Evaluate case by case |
| 5+ | 4+ branches | ✅ Unit test REQUIRED |

### Examples

```typescript
// CC = 1 → NO TEST
async execute(query: GetEventQuery) {
  return this.repository.findById(query.id);
}

// CC = 6 → NEEDS TEST
static create(props: CreateEventProps): Event {
  if (!props.name || props.name.length < 3) throw new AppException('...');
  if (props.date < new Date()) throw new AppException('...');
  if (!VALID_CATEGORIES.includes(props.category)) throw new AppException('...');
  if (props.maxPhotos && props.maxPhotos > 10000) throw new AppException('...');
  return new Event(props);
}
```

---

## Test Types (MVP Scope)

| Type | Purpose | Location | Priority |
|------|---------|----------|----------|
| Unit | Complex logic (CC ≥ 5) | `*.spec.ts` next to source | Selective |
| Integration | Real DB flows | `*.integration.spec.ts` | **HIGH** |

**E2E tests are OUT OF SCOPE** for backend MVP. Will be added with frontend.

---

## Priority

```
Integration Tests > Selective Unit Tests
```

**Integration tests** prove the system works end-to-end with real database.
**Unit tests** only for complex business logic that justifies isolation.

---

## What to Test

### Always Test (Integration)
- Repositories against real DB
- Command handlers (full flow)
- Query handlers with filters/pagination

### Test if Complex (Unit, CC ≥ 5)
- Entity factory methods with validations
- State transitions
- Business rule calculations

### Never Test (Unit)
- Simple getters/setters
- Handlers that only delegate
- Code with CC ≤ 2

---

## Quality Metrics (NOT Coverage %)

Instead of chasing coverage:

| Metric | Target |
|--------|--------|
| All critical paths tested | 100% |
| Integration tests for repos | Required |
| Flaky tests | 0 |
| Test execution time | <30s unit, <2min integration |

---

## Test Structure (AAA Pattern)

```typescript
it('should create event with valid data', async () => {
  // Arrange
  const command = new CreateEventCommand('Test', new Date('2026-05-01'), 'ROAD');

  // Act
  const result = await handler.execute(command);

  // Assert
  expect(result).toHaveProperty('id');
});
```

---

## Naming Conventions

### Test Files
```
event.entity.spec.ts                        # Unit (only if CC ≥ 5)
event-write.repository.integration.spec.ts  # Integration
```

### Test Descriptions
```typescript
describe('Event Entity', () => {
  describe('create', () => {
    it('should create event with valid data', () => {});
    it('should throw for past date', () => {});
  });
});
```

---

## Commands

```bash
pnpm test                 # Unit tests
pnpm test:integration     # Integration tests
pnpm test:all             # All tests
```

---

## See Also

- `testing/unit-tests.md` - Unit test patterns (when CC ≥ 5)
- `testing/integration-tests.md` - Integration patterns (priority)
- `infrastructure/jest-config.md` - Jest configuration
