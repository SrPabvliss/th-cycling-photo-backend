# Jest Configuration

## File Structure

```
├── jest.config.js          # Unit tests config
├── test/
│   └── jest-e2e.json       # E2E tests config
└── src/
    └── **/*.spec.ts        # Unit test files
```

---

## Unit Tests Configuration

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

---

## E2E Tests Configuration

```json
// test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"
  }
}
```

---

## Commands

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e

# Run specific test file
pnpm test -- --testPathPattern=event.entity.spec.ts

# Run tests matching pattern
pnpm test -- --testNamePattern="should create"
```

---

## Test File Naming

| Type | Pattern | Location |
|------|---------|----------|
| Unit test | `{name}.spec.ts` | Same folder as source |
| Integration test | `{name}.integration.spec.ts` | Same folder as source |
| E2E test | `{name}.e2e-spec.ts` | `test/` folder |

Examples:
```
src/modules/events/domain/entities/
├── event.entity.ts
└── event.entity.spec.ts           # Unit test

src/modules/events/infrastructure/repositories/
├── event-write.repository.ts
└── event-write.repository.integration.spec.ts  # Integration test

test/
└── events.e2e-spec.ts             # E2E test
```

---

## Coverage Thresholds (Optional)

```javascript
// jest.config.js
module.exports = {
  // ... other config
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## Path Alias Setup

For `@/` imports to work in tests, ensure `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

And Jest config has matching `moduleNameMapper`.

---

## See Also

- `testing/unit-tests.md` - Unit test patterns
- `testing/integration-tests.md` - Integration test patterns
- `testing/e2e-tests.md` - E2E test patterns
