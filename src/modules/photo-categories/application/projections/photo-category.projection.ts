import { ApiProperty } from '@nestjs/swagger'

export type PhotoCategoryScope = 'base' | 'own'

export class PhotoCategoryProjection {
  @ApiProperty({ description: 'Category ID' })
  id: number

  @ApiProperty({ description: 'Category name' })
  name: string

  @ApiProperty({
    enum: ['base', 'own'],
    description: "base: global, picked by any organizer; own: the organizer's own category",
  })
  scope: PhotoCategoryScope

  @ApiProperty({ description: 'Number of photos in this category' })
  photoCount: number
}
