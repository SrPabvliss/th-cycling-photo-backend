import { ApiProperty } from '@nestjs/swagger'

export class RetouchQueueItemProjection {
  @ApiProperty() photoId: string
  @ApiProperty() thumbnailUrl: string
  @ApiProperty() isRetouched: boolean
}

export class RetouchQueueOrderProjection {
  @ApiProperty() orderId: string
  @ApiProperty() buyerName: string
  @ApiProperty() createdAt: string
  @ApiProperty() totalItems: number
  @ApiProperty() retouchedItems: number
  @ApiProperty({ type: [RetouchQueueItemProjection] }) items: RetouchQueueItemProjection[]
}

export class RetouchQueueProjection {
  @ApiProperty({ type: [RetouchQueueOrderProjection] }) orders: RetouchQueueOrderProjection[]
}
