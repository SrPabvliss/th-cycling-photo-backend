/**
 * Placeholder env for the unit project.
 *
 * `app.module.spec.ts` and `route-classification.spec.ts` import `AppModule` to read its decorator
 * metadata. They never boot it, but `ConfigModule.forRoot({ validate })` runs at module-definition
 * time, so the import alone fails without a complete environment. Filling these in here keeps unit
 * tests independent of any `.env` file — the same run happens locally and on a bare CI runner.
 *
 * Only unset variables are filled, so a real local `.env` still wins. Nothing here reaches a
 * network: no unit spec resolves a provider that would use these.
 */
const PLACEHOLDERS: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'placeholder',
  DB_PASSWORD: 'placeholder',
  DB_NAME: 'placeholder',
  B2_APPLICATION_KEY_ID: 'test-key-id',
  B2_APPLICATION_KEY: 'placeholder',
  B2_BUCKET_ID: 'placeholder',
  B2_BUCKET_NAME: 'placeholder',
  B2_REGION: 'placeholder',
  JWT_SECRET: 'placeholder-jwt-secret',
  MAIL_HOST: 'smtp.mx.cloudflare.net',
  MAIL_PORT: '465',
  MAIL_USER: 'placeholder',
  MAIL_PASSWORD: 'placeholder',
  MAIL_FROM: 'no-reply@example.com',
  MAIL_FROM_NAME: 'Placeholder',
  MAIL_REPLY_TO: 'no-reply@example.com',
  PASSWORD_RESET_HMAC_SECRET: 'placeholder-hmac-secret',
  APP_WEB_BASE_URL: 'http://localhost:5173',
  PAYPHONE_ENVIRONMENT: 'test',
  PAYPHONE_TOKEN: 'placeholder',
  PAYPHONE_STORE_ID: 'placeholder',
  CREDENTIAL_ENCRYPTION_KEY: '0'.repeat(64),
  PAYMENT_SYSTEM_USER_ID: '00000000-0000-0000-0000-000000000000',
}

for (const [key, value] of Object.entries(PLACEHOLDERS)) {
  if (!process.env[key]) process.env[key] = value
}
