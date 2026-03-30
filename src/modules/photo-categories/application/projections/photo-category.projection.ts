import { ApiProperty } from '@nestjs/swagger'

export class PhotoCategoryProjection {
  @ApiProperty({ description: 'Category UUID' })
  id: string

  @ApiProperty({ description: 'Category name' })
  name: string

  @ApiProperty({ description: 'Number of photos in this category' })
  photoCount: number
}
