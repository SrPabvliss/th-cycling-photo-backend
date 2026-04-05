import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PublicPhotoProjection {
  @ApiProperty({ description: 'Photo UUID' })
  id: string

  @ApiProperty({ description: 'Watermarked photo URL' })
  url: string

  @ApiPropertyOptional({ description: 'Photo width in pixels' })
  width: number | null

  @ApiPropertyOptional({ description: 'Photo height in pixels' })
  height: number | null
}
