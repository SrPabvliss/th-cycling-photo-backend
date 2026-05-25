import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator'

export class GetPublicEventPhotosDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by photo category ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  photoCategoryId?: number

  @ApiPropertyOptional({ description: 'Partial bib match (starts-with)', example: '14' })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{1,10}$/)
  bibNumber?: string

  @ApiPropertyOptional({
    description: 'Match mode for bib search (default: exact)',
    enum: ['exact', 'starts', 'contains'],
    example: 'exact',
  })
  @IsIn(['exact', 'starts', 'contains'])
  @IsOptional()
  bibMatch?: 'exact' | 'starts' | 'contains'
}
