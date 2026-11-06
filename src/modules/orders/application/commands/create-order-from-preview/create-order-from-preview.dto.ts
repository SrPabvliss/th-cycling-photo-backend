import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  PaymentMethod,
  type PaymentMethodType,
} from '@orders/domain/value-objects/payment-method.vo'
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreateOrderFromPreviewDto {
  @ApiProperty({
    description: 'Photo IDs to order (must be subset of preview photos)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds: string[]

  @ApiPropertyOptional({
    description: 'Order notes',
    example: 'Quiero las fotos del segundo grupo',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string

  @ApiPropertyOptional({
    description: 'Bib number visible in the photos',
    example: '1234',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  bibNumber?: string

  @ApiPropertyOptional({
    description: 'Category name snapshot for the order',
    example: 'Ciclismo de montaña',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  snapCategoryName?: string

  @ApiProperty({ description: 'Billing account the invoice is issued to', format: 'uuid' })
  @IsUUID('4')
  billingAccountId: string

  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsIn(Object.values(PaymentMethod))
  method: PaymentMethodType
}
