import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetPublicEventPhotosDto {
  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 20, max 100)', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number

  @ApiPropertyOptional({ description: 'Filter by photo category ID', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  photoCategoryId?: number
}
