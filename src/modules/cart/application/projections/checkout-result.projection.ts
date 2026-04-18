import { ApiProperty } from '@nestjs/swagger'

class CheckoutOrderProjection {
  @ApiProperty({ description: 'Order ID' })
  orderId: string

  @ApiProperty({ description: 'Event name' })
  eventName: string

  @ApiProperty({ description: 'Number of photos in the order' })
  photoCount: number
}

export class CheckoutResultProjection {
  @ApiProperty({ description: 'Orders created from checkout', type: [CheckoutOrderProjection] })
  orders: CheckoutOrderProjection[]
}
