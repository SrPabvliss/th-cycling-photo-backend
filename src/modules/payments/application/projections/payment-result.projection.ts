import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentDeliveryProjection } from './payment-delivery.projection'

export class PaymentResultProjection {
  @ApiProperty()
  approved: boolean

  @ApiProperty({ type: [String] })
  orderIds: string[]

  @ApiPropertyOptional({ nullable: true })
  message: string | null

  /**
   * Whether every order behind the payment actually became a paid, delivered order. An approved
   * charge that could not settle is money taken with nothing handed over, and the buyer must not be
   * shown a confirmation for it.
   */
  @ApiProperty()
  settled: boolean

  @ApiProperty({ type: [PaymentDeliveryProjection] })
  deliveries: PaymentDeliveryProjection[]
}
