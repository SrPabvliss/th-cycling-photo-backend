import 'reflect-metadata'
import { validate } from './env.validation'

const validEnv = {
  NODE_ENV: 'development',
  PORT: 3000,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'test_db',
  B2_APPLICATION_KEY_ID: 'test-key-id',
  B2_APPLICATION_KEY: 'test-key-secret',
  B2_BUCKET_ID: 'test-bucket-id',
  B2_BUCKET_NAME: 'test-bucket',
  B2_REGION: 'us-east-005',
  JWT_SECRET: 'test-jwt-secret',
  MAIL_HOST: 'smtp.mx.cloudflare.net',
  MAIL_PORT: 465,
  MAIL_USER: 'api_token',
  MAIL_PASSWORD: 'test-mail-password',
  MAIL_FROM: 'no-reply@titantv.com.ec',
  MAIL_FROM_NAME: 'TitanTV',
  MAIL_REPLY_TO: 'info@titantv.com.ec',
  PASSWORD_RESET_HMAC_SECRET: 'test-reset-secret',
  APP_WEB_BASE_URL: 'http://localhost:5173',
  PAYPHONE_ENVIRONMENT: 'test',
  PAYPHONE_TOKEN: 'test-payphone-token',
  PAYPHONE_STORE_ID: 'test-store-id',
  CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
  PAYMENT_SYSTEM_USER_ID: 'system-user-id',
}

describe('Environment Validation', () => {
  it('should pass with all required variables', () => {
    expect(() => validate(validEnv)).not.toThrow()
  })

  it('should pass with optional CLOUDFLARE_CDN_URL', () => {
    const env = { ...validEnv, CLOUDFLARE_CDN_URL: 'https://cdn.example.com' }
    expect(() => validate(env)).not.toThrow()
  })

  it('should pass without CLOUDFLARE_CDN_URL', () => {
    expect(() => validate(validEnv)).not.toThrow()
  })

  it.each([
    'B2_APPLICATION_KEY_ID',
    'B2_APPLICATION_KEY',
    'B2_BUCKET_ID',
    'B2_BUCKET_NAME',
    'B2_REGION',
  ])('should fail if %s is missing', (key) => {
    const env = { ...validEnv }
    delete env[key as keyof typeof env]
    expect(() => validate(env)).toThrow('Environment validation failed')
  })

  it.each([
    'B2_APPLICATION_KEY_ID',
    'B2_APPLICATION_KEY',
    'B2_BUCKET_ID',
    'B2_BUCKET_NAME',
    'B2_REGION',
  ])('should fail if %s is empty string', (key) => {
    const env = { ...validEnv, [key]: '' }
    expect(() => validate(env)).toThrow('Environment validation failed')
  })
})

describe('MAIL_REDIRECT_TO production guard', () => {
  const baseEnv = {
    NODE_ENV: 'production',
    PORT: 3000,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
    DB_NAME: 'db',
    B2_APPLICATION_KEY_ID: 'id',
    B2_APPLICATION_KEY: 'key',
    B2_BUCKET_ID: 'bucket-id',
    B2_BUCKET_NAME: 'bucket',
    B2_REGION: 'us-west',
    JWT_SECRET: 'jwt-secret',
    PASSWORD_RESET_HMAC_SECRET: 'reset-secret',
    APP_WEB_BASE_URL: 'https://titantv.com.ec',
    MAIL_HOST: 'smtp.mx.cloudflare.net',
    MAIL_PORT: 465,
    MAIL_USER: 'api_token',
    MAIL_PASSWORD: 'token',
    MAIL_FROM: 'no-reply@titantv.com.ec',
    MAIL_FROM_NAME: 'TitanTV',
    MAIL_REPLY_TO: 'info@titantv.com.ec',
    PAYPHONE_ENVIRONMENT: 'production',
    PAYPHONE_TOKEN: 'prod-payphone-token',
    PAYPHONE_STORE_ID: 'prod-store-id',
    CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
    PAYMENT_SYSTEM_USER_ID: 'system-user-id',
  }

  it('should reject MAIL_REDIRECT_TO in production', () => {
    expect(() => validate({ ...baseEnv, MAIL_REDIRECT_TO: 'dev@personal.com' })).toThrow(
      'MAIL_REDIRECT_TO must be empty when NODE_ENV=production',
    )
  })

  it('should allow MAIL_REDIRECT_TO outside production', () => {
    expect(() =>
      validate({
        ...baseEnv,
        NODE_ENV: 'development',
        PAYPHONE_ENVIRONMENT: 'test',
        MAIL_REDIRECT_TO: 'dev@personal.com',
      }),
    ).not.toThrow()
  })

  it('should allow production with no redirect', () => {
    expect(() => validate({ ...baseEnv, MAIL_REDIRECT_TO: '' })).not.toThrow()
  })
})

describe('PAYPHONE_ENVIRONMENT deployment guard', () => {
  const baseEnv = {
    NODE_ENV: 'production',
    PORT: 3000,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
    DB_NAME: 'db',
    B2_APPLICATION_KEY_ID: 'id',
    B2_APPLICATION_KEY: 'key',
    B2_BUCKET_ID: 'bucket-id',
    B2_BUCKET_NAME: 'bucket',
    B2_REGION: 'us-west',
    JWT_SECRET: 'jwt-secret',
    PASSWORD_RESET_HMAC_SECRET: 'reset-secret',
    APP_WEB_BASE_URL: 'https://titantv.com.ec',
    MAIL_HOST: 'smtp.mx.cloudflare.net',
    MAIL_PORT: 465,
    MAIL_USER: 'api_token',
    MAIL_PASSWORD: 'token',
    MAIL_FROM: 'no-reply@titantv.com.ec',
    MAIL_FROM_NAME: 'TitanTV',
    MAIL_REPLY_TO: 'info@titantv.com.ec',
    PAYPHONE_TOKEN: 'prod-payphone-token',
    PAYPHONE_STORE_ID: 'prod-store-id',
    CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
    PAYMENT_SYSTEM_USER_ID: 'system-user-id',
  }

  it('should reject a production deployment pointed at the test gateway', () => {
    expect(() =>
      validate({ ...baseEnv, NODE_ENV: 'production', PAYPHONE_ENVIRONMENT: 'test' }),
    ).toThrow(
      'PAYPHONE_ENVIRONMENT is set to test while NODE_ENV is production. Payments would be approved without charging anyone.',
    )
  })

  it('should reject a non-production deployment pointed at the production gateway', () => {
    expect(() =>
      validate({ ...baseEnv, NODE_ENV: 'development', PAYPHONE_ENVIRONMENT: 'production' }),
    ).toThrow(
      'PAYPHONE_ENVIRONMENT is set to production outside a production deployment. Real cards would be charged.',
    )
  })
})
