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
  return this.repository.findById(query.id)
}

// CC = 5 → NEEDS TEST
static create(data: { name: string; date: Date; location: string | null }): Event {
  Event.validateName(data.name)   // 2 branches (length < 3 || length > 200)
  Event.validateDate(data.date)   // 1 branch (date < today)
  return new Event(
    crypto.randomUUID(), data.name, data.date, data.location,
    EventStatus.DRAFT, 0, 0, AuditFields.initialize(),
  )
}
```

---

## Test Types (MVP Scope)

| Type | Purpose | Location | Priority |
|------|---------|----------|----------|
| Unit | Complex logic (CC ≥ 5) | `*.spec.ts` next to source | Selective |
| Integration | Real DB flows | `*.integration.spec.ts` *(planned)* | **HIGH** |

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

## Existing Tests (Sprint 0)

Unit tests currently exist for:

| File | What it tests |
|------|---------------|
| `event.entity.spec.ts` | Entity create/update/softDelete/fromPersistence |
| `create-event.handler.spec.ts` | Command handler with mocked interface |
| `delete-event.handler.spec.ts` | Delete handler with 404 guard |
| `audit-fields.spec.ts` | AuditFields composition class |
| `app.exception.spec.ts` | AppException factory methods |
| `global-exception.filter.spec.ts` | ADR-002 error envelope formatting |
| `swagger-i18n.transformer.spec.ts` | Swagger bilingual translation |

**Key testing patterns in real code:**
- Mock interfaces, not concrete classes: `jest.Mocked<IEventWriteRepository>`
- Use `Event.fromPersistence()` to create entities with specific states in tests (not `as any` casts)
- Use dynamic future dates: `futureDate.setFullYear(futureDate.getFullYear() + 1)` (not hardcoded dates)

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
it('should create and save event, returning id', async () => {
  // Arrange
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)
  const command = new CreateEventCommand('Test Event', futureDate, 'Ambato')

  // Act
  const result = await handler.execute(command)

  // Assert
  expect(result).toHaveProperty('id')
  expect(typeof result.id).toBe('string')
})
```

---

## Naming Conventions

### Test Files
```
event.entity.spec.ts                        # Unit (only if CC ≥ 5)
event-write.repository.integration.spec.ts  # Integration (planned convention)
```

> **Note:** The `*.integration.spec.ts` convention will be used when integration tests are implemented. Currently only `*.spec.ts` unit tests exist.

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
pnpm test:watch           # Unit tests in watch mode
pnpm test:cov             # Unit tests with coverage
pnpm test:e2e             # E2E tests (default NestJS scaffold only)
```

---

## See Also

- `testing/unit-tests.md` - Unit test patterns (when CC ≥ 5)
- `testing/integration-tests.md` - Integration patterns (priority)
- `infrastructure/jest-config.md` - Jest configuration
