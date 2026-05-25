import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PublicEventAssetProjection } from './public-event-list.projection'

export class PublicPhotoCategoryProjection {
  @ApiProperty({ description: 'Category ID' })
  id: number

  @ApiProperty({ description: 'Category name' })
  name: string
}

export class PublicEventDetailProjection {
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

  @ApiProperty({ description: 'Event assets with CDN URLs', type: [PublicEventAssetProjection] })
  assets: PublicEventAssetProjection[]

  @ApiProperty({ description: 'Photo categories', type: [PublicPhotoCategoryProjection] })
  photoCategories: PublicPhotoCategoryProjection[]
}
