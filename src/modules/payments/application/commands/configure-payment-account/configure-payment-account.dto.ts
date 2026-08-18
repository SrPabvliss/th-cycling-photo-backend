import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class ConfigurePaymentAccountDto {
  @ApiProperty({ description: 'Payment routing mode', enum: Object.values(PaymentMode) })
  @IsEnum(PaymentMode)
  mode: PaymentModeType

  @ApiPropertyOptional({ description: 'Payphone Personal phone number', example: '0984112233' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string

  @ApiPropertyOptional({ description: 'Payphone Developer application token' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  token?: string

  @ApiPropertyOptional({ description: 'Payphone store identifier' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  storeId?: string
}
