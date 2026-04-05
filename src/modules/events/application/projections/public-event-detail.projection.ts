import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PublicEventAssetProjection } from './public-event-list.projection'

export class PublicPhotoCategoryProjection {
  @ApiProperty({ description: 'Category ID' })
  id: number

  @ApiProperty({ description: 'Category name' })
  name: string
}

export class PublicEventDetailProjection {
  @ApiProperty({ description: 'Event UUID' })
  id: string

  @ApiProperty({ description: 'Event name' })
  name: string

  @ApiPropertyOptional({ description: 'Event description' })
  description: string | null

  @ApiProperty({ description: 'Event date' })
  date: Date

  @ApiPropertyOptional({ description: 'Location' })
  location: string | null

  @ApiPropertyOptional({ description: 'Province name' })
  provinceName: string | null

  @ApiPropertyOptional({ description: 'Canton name' })
  cantonName: string | null

  @ApiProperty({ description: 'Whether this event is featured' })
  isFeatured: boolean

  @ApiProperty({ description: 'Number of photos' })
  photoCount: number

  @ApiProperty({ description: 'Event assets with CDN URLs', type: [PublicEventAssetProjection] })
  assets: PublicEventAssetProjection[]

  @ApiProperty({ description: 'Photo categories', type: [PublicPhotoCategoryProjection] })
  photoCategories: PublicPhotoCategoryProjection[]
}
