import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetReviewQueueDto {
  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 50, max 100)', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ description: 'Filter only photos pending review (defaults to true)' })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = obj[key]
    if (raw === 'false' || raw === false) return false
    if (raw === 'true' || raw === true) return true
    return undefined
  })
  @IsBoolean()
  onlyPending?: boolean
}
