# Jest Configuration

## File Structure

```
├── package.json            # Jest config inline under "jest" key
├── test/
│   └── jest-e2e.json       # E2E tests config
└── src/
    └── **/*.spec.ts        # Unit test files
```

> **Note:** There is no separate `jest.config.js` file. Jest configuration lives inline in `package.json`.

---

## Unit Tests Configuration

Jest config is defined in `package.json` under the `"jest"` key:

```json
// package.json → "jest"
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "^@generated/(.*)$": "<rootDir>/generated/$1",
    "^@events/(.*)$": "<rootDir>/modules/events/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

**Key points:**
- `moduleNameMapper` maps path aliases (`@shared/*`, `@generated/*`, `@events/*`) to match `tsconfig.json` paths
- The `.js` extension mapper (`^(\\.{1,2}/.*)\\.js$` → `$1`) strips `.js` from relative imports for CJS/ESM compatibility safety
- New module aliases must be added to both `tsconfig.json` and `package.json` jest config

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
    "^@shared/(.*)$": "<rootDir>/../src/shared/$1",
    "^@generated/(.*)$": "<rootDir>/../src/generated/$1",
    "^@events/(.*)$": "<rootDir>/../src/modules/events/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
}
```

> **Note:** E2E aliases use `<rootDir>/../src/` prefix since E2E rootDir is `test/`.

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

## Path Alias Setup

Path aliases in `tsconfig.json` must match the Jest `moduleNameMapper`:

```json
// tsconfig.json → "compilerOptions"
{
  "baseUrl": "./",
  "paths": {
    "@shared/*": ["src/shared/*"],
    "@generated/*": ["src/generated/*"],
    "@events/*": ["src/modules/events/*"]
  }
}
```

When adding a new module alias (e.g., `@photos/*`), update **three** places:
1. `tsconfig.json` → `paths`
2. `package.json` → `jest.moduleNameMapper`
3. `test/jest-e2e.json` → `moduleNameMapper`

---

## See Also

- `testing/unit-tests.md` - Unit test patterns
- `testing/integration-tests.md` - Integration test patterns
- `testing/e2e-tests.md` - E2E test patterns
