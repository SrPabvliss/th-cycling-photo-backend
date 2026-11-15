import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentDeliveryProjection } from './payment-delivery.projection'

export class PaymentRefundProjection {
  @ApiProperty({ enum: ['order_paid', 'order_cancelled', 'order_gifted'] })
  reason: 'order_paid' | 'order_cancelled' | 'order_gifted'
}

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

  /**
   * Set when the gateway charged the buyer for an order that could no longer take the payment, so
   * the charge will be refunded: the order was already paid some other way, cancelled or gifted.
   * Every confirmation of the same charge answers it, a reload included. Null otherwise, including
   * when an earlier confirmation of this same charge already paid the order.
   */
  @ApiPropertyOptional({ type: PaymentRefundProjection, nullable: true })
  refund: PaymentRefundProjection | null
}
