import { ApiProperty } from '@nestjs/swagger'

export class PaymentDeliveryProjection {
  @ApiProperty()
  orderId: string

  @ApiProperty()
  eventName: string

  @ApiProperty()
  token: string
}
