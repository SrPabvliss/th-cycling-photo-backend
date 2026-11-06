import { ApiProperty } from '@nestjs/swagger'
import {
  PaymentMethod,
  type PaymentMethodType,
} from '@orders/domain/value-objects/payment-method.vo'

export class PreviewOrderCreatedProjection {
  @ApiProperty({ format: 'uuid' }) id: string
  @ApiProperty() subtotal: number
  @ApiProperty() currency: string
  @ApiProperty() photoCount: number
  @ApiProperty({ enum: Object.values(PaymentMethod) }) method: PaymentMethodType
}
