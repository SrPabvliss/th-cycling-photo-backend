import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsIn, IsString, MaxLength, ValidateIf } from 'class-validator'
import {
  BillingIdType,
  type BillingIdTypeValue,
} from '../../../domain/value-objects/billing-id-type.vo'

const sendsIdentification = (dto: UpdateBillingAccountDto) =>
  dto.idType !== undefined || dto.idNumber !== undefined

export class UpdateBillingAccountDto {
  @ApiPropertyOptional({
    description: 'Identification type. Must be sent together with idNumber',
    enum: Object.values(BillingIdType),
    example: BillingIdType.NATIONAL_ID,
  })
  @ValidateIf(sendsIdentification)
  @IsIn(Object.values(BillingIdType))
  idType?: BillingIdTypeValue

  @ApiPropertyOptional({
    description: 'Cédula, RUC or passport number. Must be sent together with idType',
    example: '1710034065',
  })
  @ValidateIf(sendsIdentification)
  @IsString()
  @MaxLength(30)
  idNumber?: string

  @ApiPropertyOptional({ description: 'Full name or company name', example: 'Juan Pérez' })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @MaxLength(300)
  legalName?: string

  @ApiPropertyOptional({ description: 'Email the invoice is sent to', example: 'juan@correo.com' })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsEmail()
  @MaxLength(255)
  email?: string

  @ApiPropertyOptional({
    description: 'Address. Send null to clear it',
    example: 'Av. Amazonas N24-03, Quito',
    nullable: true,
  })
  @ValidateIf((_dto, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null
}
