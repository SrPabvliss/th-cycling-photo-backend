import { ApiProperty } from '@nestjs/swagger'

export class BulkClassifyResultProjection {
  @ApiProperty({ description: 'Number of photos classified', example: 5 })
  classifiedCount: number
}
