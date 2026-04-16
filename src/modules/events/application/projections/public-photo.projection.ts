import { ApiProperty } from '@nestjs/swagger'

export class PublicPhotoProjection {
  @ApiProperty({ description: 'Photo UUID' })
  id: string

  @ApiProperty({ description: 'Public slug for building CDN gallery URLs' })
  publicSlug: string
}
