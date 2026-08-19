import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentDeliveryProjection } from './payment-delivery.projection'

export class PaymentResultProjection {
  @ApiProperty()
  approved: boolean

  @ApiProperty({ type: [String] })
  orderIds: string[]

  @ApiPropertyOptional({ nullable: true })
  message: string | null

  @ApiProperty({ type: [PaymentDeliveryProjection] })
  deliveries: PaymentDeliveryProjection[]
}
