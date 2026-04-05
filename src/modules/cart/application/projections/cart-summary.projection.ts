import { ApiProperty } from '@nestjs/swagger'

export class CartSummaryProjection {
  @ApiProperty({ description: 'Number of items in the cart' })
  itemCount: number

  @ApiProperty({ description: 'Number of distinct events in the cart' })
  eventCount: number
}
