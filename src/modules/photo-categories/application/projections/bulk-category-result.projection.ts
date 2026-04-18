import { ApiProperty } from '@nestjs/swagger'

export class BulkCategoryResultProjection {
  @ApiProperty({ description: 'Number of photos updated' })
  updated: number
}
