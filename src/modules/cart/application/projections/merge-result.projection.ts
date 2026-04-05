import { ApiProperty } from '@nestjs/swagger'

export class MergeResultProjection {
  @ApiProperty({ description: 'Number of items merged from anonymous cart' })
  mergedCount: number
}
