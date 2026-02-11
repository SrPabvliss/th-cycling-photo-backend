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
