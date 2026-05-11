import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'

export class GetPublicEventPhotosDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by photo category ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  photoCategoryId?: number
}
