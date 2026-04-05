import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator'

export class BulkAssignCategoryDto {
  @ApiProperty({ description: 'Photo UUIDs to update', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  photoIds: string[]

  @ApiPropertyOptional({
    description: 'Category ID to assign, or null to unassign',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  photoCategoryId?: number | null
}
