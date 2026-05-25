import { ApiProperty } from '@nestjs/swagger'

export class PublicPhotoProjection {
  @ApiProperty({ description: 'Photo UUID' })
  id: string

  @ApiProperty({ description: 'Public slug for building CDN gallery URLs' })
  publicSlug: string

  @ApiProperty({ description: 'Natural width in pixels', nullable: true })
  width: number | null

  @ApiProperty({ description: 'Natural height in pixels', nullable: true })
  height: number | null
}
