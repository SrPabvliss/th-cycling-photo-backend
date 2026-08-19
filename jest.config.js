const path = require('node:path')

/**
 * Two Jest projects, split on the `*.integration.spec.ts` naming convention
 * that (almost) already existed before this file did:
 *
 * - `unit` — everything under `src/**\/*.spec.ts` except `*.integration.spec.ts`.
 *   No Postgres, no Redis, no `CREATEDB` role, no `--experimental-vm-modules`.
 *   This is what `pnpm test` runs.
 * - `integration` — only `*.integration.spec.ts`. Hits a real database (and,
 *   for one spec, a real Redis via a full `AppModule` boot) and needs
 *   `--experimental-vm-modules` for Prisma 7's client to run real queries
 *   under Jest. This is what `pnpm test:integration` runs.
 *
 * `test/jest-e2e.json` remains a separate, pre-existing project (its own
 * config file, run via `pnpm test:e2e`) and is untouched by this split.
 */
const moduleNameMapper = {
  '^@shared/(.*)$': '<rootDir>/shared/$1',
  '^@generated/(.*)$': '<rootDir>/generated/$1',
  '^@event-assets/(.*)$': '<rootDir>/modules/event-assets/$1',
  '^@events/(.*)$': '<rootDir>/modules/events/$1',
  '^@photo-categories/(.*)$': '<rootDir>/modules/photo-categories/$1',
  '^@photos/(.*)$': '<rootDir>/modules/photos/$1',
  '^@classifications/(.*)$': '<rootDir>/modules/classifications/$1',
  '^@locations/(.*)$': '<rootDir>/modules/locations/$1',
  '^@mail/(.*)$': '<rootDir>/modules/mail/$1',
  '^@users/(.*)$': '<rootDir>/modules/users/$1',
  '^@previews/(.*)$': '<rootDir>/modules/previews/$1',
  '^@deliveries/(.*)$': '<rootDir>/modules/deliveries/$1',
  '^@orders/(.*)$': '<rootDir>/modules/orders/$1',
  '^@notifications/(.*)$': '<rootDir>/modules/notifications/$1',
  '^@auth/(.*)$': '<rootDir>/modules/auth/$1',
  '^@cart/(.*)$': '<rootDir>/modules/cart/$1',
  '^@pricing/(.*)$': '<rootDir>/modules/pricing/$1',
  '^@payments/(.*)$': '<rootDir>/modules/payments/$1',
  '^(\\.{1,2}/.*)\\.js$': '$1',
}

const baseProject = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: path.join(__dirname, 'src'),
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper,
  testEnvironment: 'node',
}

module.exports = {
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: path.join(__dirname, 'coverage'),
  projects: [
    {
      ...baseProject,
      displayName: 'unit',
      testRegex: '.*\\.spec\\.ts$',
      testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
      setupFiles: [path.join(__dirname, 'test/setup-unit-env.ts')],
    },
    {
      ...baseProject,
      displayName: 'integration',
      testRegex: '.*\\.integration\\.spec\\.ts$',
    },
  ],
}
