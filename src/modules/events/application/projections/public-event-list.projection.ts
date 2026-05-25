import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PublicEventAssetProjection {
  @ApiProperty({ description: 'Asset type', example: 'cover_image' })
  assetType: string

  @ApiProperty({ description: 'Public CDN URL (already points to /assets/)' })
  url: string

  @ApiProperty({ description: 'Public slug for Worker-handled transform presets' })
  publicSlug: string
}

export class PublicEventListProjection {
  @ApiProperty({ description: 'URL-friendly slug for public navigation' })
  slug: string

  @ApiProperty({ description: 'Event name' })
  name: string

  @ApiProperty({ description: 'First day of the event (inclusive)' })
  startDate: Date

  @ApiProperty({ description: 'Last day of the event (inclusive)' })
  endDate: Date

  @ApiPropertyOptional({ description: 'Province name' })
  provinceName: string | null

  @ApiPropertyOptional({ description: 'Canton name' })
  cantonName: string | null

  @ApiProperty({ description: 'Number of photos' })
  photoCount: number

  @ApiPropertyOptional({ description: 'Cover image slug for CDN transform URLs' })
  coverSlug: string | null
}
