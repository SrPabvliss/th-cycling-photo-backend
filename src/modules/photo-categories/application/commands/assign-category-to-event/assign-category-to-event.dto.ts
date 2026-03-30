import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class AssignCategoryToEventDto {
  @ApiProperty({ description: 'Global photo category UUID to assign', format: 'uuid' })
  @IsUUID()
  photoCategoryId: string
}
