import * as path from 'node:path'
import * as dotenv from 'dotenv'

/**
 * Environment for the suites that hit the test database (integration and e2e).
 *
 * The local `.env.test` is not versioned, so it lags behind every time the application starts
 * requiring a new variable, and the whole suite then dies in `ConfigModule` before a single test
 * runs. The files are loaded first, in the same order `ConfigModule` uses, so anything they define
 * wins; only what is still unset is filled with a value that is obviously not a credential.
 *
 * Database coordinates are deliberately not filled in: a suite that truncates tables must never
 * guess where to connect. `.env.test` has to provide them (see README, "Testing").
 */
const nodeEnv = process.env.NODE_ENV || 'test'
dotenv.config({ path: path.resolve(__dirname, `../.env.${nodeEnv}`), quiet: true })
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const PLACEHOLDERS: Record<string, string> = {
  PAYPHONE_ENVIRONMENT: 'test',
  PAYPHONE_TOKEN: 'placeholder-not-a-real-token',
  PAYPHONE_STORE_ID: 'placeholder-not-a-real-store',
  CREDENTIAL_ENCRYPTION_KEY: '0'.repeat(64),
  PAYMENT_SYSTEM_USER_EMAIL: 'system@titantv.test',
}

for (const [key, value] of Object.entries(PLACEHOLDERS)) {
  if (!process.env[key]) process.env[key] = value
}
