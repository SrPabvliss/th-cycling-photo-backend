import { ApiProperty } from '@nestjs/swagger'

export class OperatorRetouchOrderDetailPhotoProjection {
  @ApiProperty() photoId: string
  @ApiProperty() publicSlug: string
  @ApiProperty() filename: string
  @ApiProperty() thumbnailUrl: string
  @ApiProperty() isRetouched: boolean
}

export class OperatorRetouchOrderDetailProjection {
  @ApiProperty() orderId: string
  @ApiProperty() buyerName: string
  @ApiProperty() eventId: string
  @ApiProperty() eventName: string
  @ApiProperty() createdAt: string
  @ApiProperty({ type: [OperatorRetouchOrderDetailPhotoProjection] })
  photos: OperatorRetouchOrderDetailPhotoProjection[]
}
