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
  return validatedConfig
}
