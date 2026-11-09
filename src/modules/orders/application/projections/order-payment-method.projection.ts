import { ApiProperty } from '@nestjs/swagger'

export class OrderPaymentMethodProjection {
  @ApiProperty({ type: [String] })
  orderIds: string[]
}
