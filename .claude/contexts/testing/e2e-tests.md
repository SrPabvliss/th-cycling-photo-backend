# E2E Tests

> ⚠️ **OUT OF SCOPE FOR BACKEND MVP**

## Decision

E2E tests are **not included** in the backend testing strategy for this project.

## Reasons

1. **Different tooling** - E2E requires Playwright/Cypress, different setup
2. **Frontend dependency** - True E2E tests UI + backend together
3. **Separate project** - E2E is typically a separate test project
4. **Resource optimization** - Focus on integration tests for backend validation

## What We Use Instead

| Instead of E2E | We Use |
|----------------|--------|
| HTTP flow validation | Integration tests with Supertest |
| Response format checks | Integration tests |
| Full flow testing | Will be added with frontend |

## Future

When frontend is developed, E2E tests will be:
- A separate project
- Using Playwright or Cypress
- Testing UI + backend together
- Covering critical user journeys

## See Also

- `testing/integration-tests.md` - Current priority for flow testing
- `testing/test-guidelines.md` - Testing philosophy
