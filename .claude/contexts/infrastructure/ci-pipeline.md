# CI Pipeline

## Overview

GitHub Actions pipeline runs on PRs to `develop` and `main`. Three jobs: **Lint → Build + Test** (parallel).

## File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:ci

  build:
    name: Build
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate    # Required before tsc
      - run: pnpm build

  test:
    name: Test
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate    # Required for type imports
      - run: pnpm test --passWithNoTests
```

## Job Dependency Graph

```
Lint ──┬──→ Build
       └──→ Test
```

Build and Test run **in parallel** after Lint passes. Both need `prisma generate`.

## Key Points

- **`prisma generate` is mandatory** before build and test (generates client types)
- **`--passWithNoTests`** prevents test failure when no test files exist
- **`concurrency` with `cancel-in-progress`** stops old runs when new commits push
- Build catches TypeScript compilation errors
- Lint catches Biome formatting and linting issues

## Local Verification (before pushing)

```bash
pnpm check:ci        # Same as CI lint step
npx prisma generate  # Generate client
pnpm build           # Verify compilation
pnpm test            # Run tests
```

## See Also

- `conventions/git.md` - Commit and branch conventions
