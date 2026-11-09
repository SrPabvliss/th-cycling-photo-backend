import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import {
  BillingIdType,
  type BillingIdTypeValue,
} from '../../../domain/value-objects/billing-id-type.vo'

export class CreateBillingAccountDto {
  @ApiProperty({
    description: 'Identification type',
    enum: Object.values(BillingIdType),
    example: BillingIdType.NATIONAL_ID,
  })
  @IsIn(Object.values(BillingIdType))
  idType: BillingIdTypeValue

  @ApiProperty({ description: 'Cédula, RUC or passport number', example: '1710034065' })
  @IsString()
  @MaxLength(30)
  idNumber: string

  @ApiProperty({ description: 'Full name or company name', example: 'Juan Pérez' })
  @IsString()
  @MaxLength(300)
  legalName: string

  @ApiProperty({ description: 'Email the invoice is sent to', example: 'juan@correo.com' })
  @IsEmail()
  @MaxLength(255)
  email: string

  @ApiPropertyOptional({ description: 'Address', example: 'Av. Amazonas N24-03, Quito' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string
}
