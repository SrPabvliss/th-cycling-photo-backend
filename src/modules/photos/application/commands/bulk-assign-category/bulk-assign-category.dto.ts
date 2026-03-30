import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator'

export class BulkAssignCategoryDto {
  @ApiProperty({ description: 'Photo UUIDs to update', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  photoIds: string[]

  @ApiPropertyOptional({
    description: 'Category UUID to assign, or null to unassign',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  photoCategoryId?: string | null
}
