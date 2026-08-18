import { assertEnvironmentMatchesDeployment } from '@shared/payment-gateways'
import { plainToInstance } from 'class-transformer'
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator'

export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'preview', 'production'])
  NODE_ENV: string

  @IsNumber()
  @Min(1)
  PORT: number

  @IsString()
  @IsNotEmpty()
  DB_HOST: string

  @IsNumber()
  DB_PORT: number

  @IsString()
  @IsNotEmpty()
  DB_USER: string

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string

  @IsString()
  @IsNotEmpty()
  DB_NAME: string

  @IsOptional()
  @IsString()
  DB_SSL_MODE?: string

  // Backblaze B2
  @IsString()
  @IsNotEmpty()
  B2_APPLICATION_KEY_ID: string

  @IsString()
  @IsNotEmpty()
  B2_APPLICATION_KEY: string

  @IsString()
  @IsNotEmpty()
  B2_BUCKET_ID: string

  @IsString()
  @IsNotEmpty()
  B2_BUCKET_NAME: string

  @IsString()
  @IsNotEmpty()
  B2_REGION: string

  // Cloudflare CDN
  @IsOptional()
  @IsString()
  CLOUDFLARE_CDN_URL?: string

  // Cloudflare KV (for slug→path mapping)
  @IsOptional()
  @IsString()
  CLOUDFLARE_ACCOUNT_ID?: string

  @IsOptional()
  @IsString()
  CLOUDFLARE_KV_NAMESPACE_ID?: string

  @IsOptional()
  @IsString()
  CLOUDFLARE_API_TOKEN?: string

  @IsOptional()
  @IsString()
  CLOUDFLARE_HMAC_SECRET?: string

  // Voyage AI
  @IsOptional()
  @IsString()
  VOYAGE_API_KEY?: string

  // Auth
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string

  @IsString()
  @IsNotEmpty()
  MAIL_HOST: string

  @IsNumber()
  MAIL_PORT: number

  @IsString()
  @IsNotEmpty()
  MAIL_USER: string

  @IsString()
  @IsNotEmpty()
  MAIL_PASSWORD: string

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_NAME: string

  @IsString()
  @IsNotEmpty()
  MAIL_REPLY_TO: string

  @IsOptional()
  @IsString()
  MAIL_REDIRECT_TO?: string

  @IsOptional()
  @IsEnum(['api', 'smtp'])
  MAIL_TRANSPORT?: string

  @IsString()
  @IsNotEmpty()
  PASSWORD_RESET_HMAC_SECRET: string

  @IsString()
  @IsNotEmpty()
  APP_WEB_BASE_URL: string

  // Watermark / Preview
  @IsOptional()
  @IsString()
  WATERMARK_BASE_URL?: string

  @IsOptional()
  @IsString()
  PREVIEW_BASE_URL?: string

  @IsOptional()
  @IsString()
  DELIVERY_BASE_URL?: string

  // Redis
  @IsOptional()
  @IsString()
  REDIS_HOST?: string

  @IsOptional()
  @IsNumber()
  REDIS_PORT?: number

  // AI Pipeline
  @IsOptional()
  @IsString()
  AI_PIPELINE_BASE_URL?: string

  @IsOptional()
  @IsNumber()
  AI_PIPELINE_TIMEOUT_MS?: number

  // Payphone
  @IsEnum(['test', 'production'])
  PAYPHONE_ENVIRONMENT: string

  @IsString()
  @IsNotEmpty()
  PAYPHONE_TOKEN: string

  @IsString()
  @IsNotEmpty()
  PAYPHONE_STORE_ID: string

  @IsString()
  @IsNotEmpty()
  CREDENTIAL_ENCRYPTION_KEY: string

  @IsOptional()
  @IsString()
  PAYPHONE_SPLIT_ENCRYPTION_PASSWORD?: string

  @IsOptional()
  @IsString()
  PAYPHONE_API_TOKEN?: string

  @IsOptional()
  @IsString()
  PAYPHONE_API_STORE_ID?: string

  @IsOptional()
  @IsNumber()
  PAYMENT_EXPIRY_SWEEP_DELAY_MS?: number

  @IsString()
  @IsNotEmpty()
  PAYMENT_SYSTEM_USER_ID: string
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  })
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`)
  }
  if (validatedConfig.NODE_ENV === 'production' && validatedConfig.MAIL_REDIRECT_TO) {
    throw new Error(
      'Environment validation failed:\nMAIL_REDIRECT_TO must be empty when NODE_ENV=production',
    )
  }
  assertEnvironmentMatchesDeployment(validatedConfig.NODE_ENV, validatedConfig.PAYPHONE_ENVIRONMENT)
  return validatedConfig
}
