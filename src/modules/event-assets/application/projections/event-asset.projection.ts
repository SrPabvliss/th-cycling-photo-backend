import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class EventAssetProjection {
  @ApiProperty({ description: 'EventAsset UUID' })
  id: string

  @ApiProperty({ description: 'Asset type', example: 'cover_image' })
  assetType: string

  @ApiProperty({ description: 'Public CDN URL for the asset' })
  url: string

  @ApiPropertyOptional({ description: 'File size in bytes', type: Number })
  fileSize: number | null

  @ApiPropertyOptional({ description: 'MIME type', example: 'image/jpeg' })
  mimeType: string | null

  @ApiProperty({ description: 'When the asset was uploaded' })
  uploadedAt: Date
}
