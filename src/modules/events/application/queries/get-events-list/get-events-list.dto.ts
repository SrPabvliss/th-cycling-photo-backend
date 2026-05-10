import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class GetEventsListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Include archived events in the list (defaults to false)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeArchived?: boolean

  @ApiPropertyOptional({ description: 'Search events by name', example: 'MTB' })
  @IsString()
  @IsOptional()
  search?: string
}
