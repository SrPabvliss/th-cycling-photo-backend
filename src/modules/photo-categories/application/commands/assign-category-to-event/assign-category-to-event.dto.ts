import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

export class AssignCategoryToEventDto {
  @ApiProperty({ description: 'Global photo category ID to assign', example: 1 })
  @IsInt()
  @Min(1)
  photoCategoryId: number
}
