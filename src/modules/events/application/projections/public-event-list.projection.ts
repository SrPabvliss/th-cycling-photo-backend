import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PublicEventAssetProjection {
  @ApiProperty({ description: 'Asset type', example: 'cover_image' })
  assetType: string

  @ApiProperty({ description: 'Public CDN URL (already points to /assets/)' })
  url: string

  @ApiProperty({ description: 'Public slug — use to build cdn-cgi/image transform URLs' })
  publicSlug: string
}

export class PublicEventListProjection {
  @ApiProperty({ description: 'URL-friendly slug for public navigation' })
  slug: string

  @ApiProperty({ description: 'Event name' })
  name: string

  @ApiProperty({ description: 'Event date' })
  date: Date

  @ApiPropertyOptional({ description: 'Province name' })
  provinceName: string | null

  @ApiPropertyOptional({ description: 'Canton name' })
  cantonName: string | null

  @ApiProperty({ description: 'Whether this event is featured' })
  isFeatured: boolean

  @ApiProperty({ description: 'Number of photos' })
  photoCount: number

  @ApiPropertyOptional({ description: 'Cover image slug for CDN transform URLs' })
  coverSlug: string | null
}
