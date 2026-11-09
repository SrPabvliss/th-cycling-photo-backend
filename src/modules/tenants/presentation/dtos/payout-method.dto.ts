import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ACCOUNT_NUMBER_PATTERN,
  ACCOUNT_TYPES,
  HOLDER_IDENTIFICATION_PATTERN,
  MAX_ACCOUNT_HOLDER_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
  MAX_ACCOUNT_TYPE_LENGTH,
  MAX_BANK_NAME_LENGTH,
  MAX_HOLDER_IDENTIFICATION_LENGTH,
  MIN_ACCOUNT_HOLDER_LENGTH,
  MIN_BANK_NAME_LENGTH,
  normalizeAccountType,
} from '@shared/constants/payout.constants'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'
import {
  PayoutProvider,
  type PayoutProviderType,
} from '../../domain/value-objects/payout-provider.vo'

export class CreatePayoutMethodDto {
  @ApiProperty({ enum: Object.values(PayoutProvider) })
  @IsEnum(PayoutProvider)
  provider: PayoutProviderType

  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  phone?: string

  @ApiPropertyOptional({ example: 'Banco Pichincha' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_BANK_NAME_LENGTH)
  @MaxLength(MAX_BANK_NAME_LENGTH)
  bankName?: string

  @ApiPropertyOptional({ example: '2201234567' })
  @IsString()
  @IsOptional()
  @Matches(ACCOUNT_NUMBER_PATTERN)
  @MaxLength(MAX_ACCOUNT_NUMBER_LENGTH)
  accountNumber?: string

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeAccountType(value))
  @IsIn(ACCOUNT_TYPES)
  @MaxLength(MAX_ACCOUNT_TYPE_LENGTH)
  accountType?: string

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_ACCOUNT_HOLDER_LENGTH)
  @MaxLength(MAX_ACCOUNT_HOLDER_LENGTH)
  accountHolder?: string

  @ApiPropertyOptional({ example: '1801234567' })
  @IsString()
  @IsOptional()
  @Matches(HOLDER_IDENTIFICATION_PATTERN)
  @MaxLength(MAX_HOLDER_IDENTIFICATION_LENGTH)
  holderIdentification?: string

  @ApiProperty({ description: 'Account password, re-entered to confirm a payout change' })
  @IsString()
  @MaxLength(200)
  password: string
}

export class UpdatePayoutMethodDto {
  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  phone?: string

  @ApiPropertyOptional({ example: 'Banco Pichincha' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_BANK_NAME_LENGTH)
  @MaxLength(MAX_BANK_NAME_LENGTH)
  bankName?: string

  @ApiPropertyOptional({ example: '2201234567' })
  @IsString()
  @IsOptional()
  @Matches(ACCOUNT_NUMBER_PATTERN)
  @MaxLength(MAX_ACCOUNT_NUMBER_LENGTH)
  accountNumber?: string

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeAccountType(value))
  @IsIn(ACCOUNT_TYPES)
  @MaxLength(MAX_ACCOUNT_TYPE_LENGTH)
  accountType?: string

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_ACCOUNT_HOLDER_LENGTH)
  @MaxLength(MAX_ACCOUNT_HOLDER_LENGTH)
  accountHolder?: string

  @ApiPropertyOptional({ example: '1801234567' })
  @IsString()
  @IsOptional()
  @Matches(HOLDER_IDENTIFICATION_PATTERN)
  @MaxLength(MAX_HOLDER_IDENTIFICATION_LENGTH)
  holderIdentification?: string

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @ApiProperty({ description: 'Account password, re-entered to confirm a payout change' })
  @IsString()
  @MaxLength(200)
  password: string
}

export class UpdatePayoutMethodSortOrderDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  sortOrder: number
}

export class ConfirmPasswordDto {
  @ApiProperty({ description: 'Account password, re-entered to confirm a payout change' })
  @IsString()
  @MaxLength(200)
  password: string
}

export class VerifyReceiverDto {
  @ApiProperty({ example: '+593987654321' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phone: string
}

export class VerifyReceiverProjection {
  @ApiProperty() registered: boolean
}
