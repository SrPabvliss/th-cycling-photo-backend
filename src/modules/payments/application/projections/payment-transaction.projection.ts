import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentDeliveryProjection } from './payment-delivery.projection'

export class PaymentTransactionProjection {
  @ApiProperty()
  clientTransactionId: string

  @ApiProperty()
  status: string

  @ApiProperty()
  amountCents: number

  @ApiProperty({ type: [String] })
  orderIds: string[]

  @ApiPropertyOptional({ nullable: true })
  failureMessage: string | null

  @ApiProperty({ type: [PaymentDeliveryProjection] })
  deliveries: PaymentDeliveryProjection[]
}
