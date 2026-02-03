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
