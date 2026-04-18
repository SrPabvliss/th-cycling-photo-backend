import { ApiProperty } from '@nestjs/swagger'

export class AssetPresignedUrlProjection {
  @ApiProperty({ description: 'Presigned URL for direct upload to B2', example: 'https://...' })
  url: string

  @ApiProperty({
    description: 'Storage key to use in confirm request',
    example: 'events/uuid/assets/cover_image/uuid-banner.jpg',
  })
  objectKey: string

  @ApiProperty({ description: 'URL expiration time in seconds', example: 300 })
  expiresIn: number
}
