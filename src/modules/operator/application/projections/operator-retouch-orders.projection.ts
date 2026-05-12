import { ApiProperty } from '@nestjs/swagger'

export class OperatorRetouchOrderPreviewPhotoProjection {
  @ApiProperty() photoId: string
  @ApiProperty() publicSlug: string
  @ApiProperty() thumbnailUrl: string
  @ApiProperty() filename: string
}

export class OperatorRetouchOrderProjection {
  @ApiProperty() orderId: string
  @ApiProperty() buyerName: string
  @ApiProperty() eventId: string
  @ApiProperty() eventName: string
  @ApiProperty() createdAt: string
  @ApiProperty() pendingPhotosCount: number
  @ApiProperty() totalPhotosCount: number
  @ApiProperty() retouchedPhotosCount: number
  @ApiProperty({ type: [OperatorRetouchOrderPreviewPhotoProjection] })
  previewPhotos: OperatorRetouchOrderPreviewPhotoProjection[]
}
