import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator'
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
  @MaxLength(100)
  bankName?: string

  @ApiPropertyOptional({ example: '2201234567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  accountNumber?: string

  @ApiPropertyOptional({ example: 'Ahorros' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  accountType?: string

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  accountHolder?: string

  @ApiPropertyOptional({ example: '1801234567' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  holderIdentification?: string
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
  @MaxLength(100)
  bankName?: string

  @ApiPropertyOptional({ example: '2201234567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  accountNumber?: string

  @ApiPropertyOptional({ example: 'Ahorros' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  accountType?: string

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  accountHolder?: string

  @ApiPropertyOptional({ example: '1801234567' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  holderIdentification?: string

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number
}
