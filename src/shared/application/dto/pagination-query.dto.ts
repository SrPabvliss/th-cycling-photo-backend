import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/**
 * Base DTO for paginated list endpoints. Extend it from feature-specific
 * query DTOs to inherit page/limit handling without repeating decorators.
 *
 * Defaults:
 * - page: 1
 * - limit: 20 (callers typically apply this default in the controller)
 *
 * Bounds:
 * - page >= 1
 * - 1 <= limit <= 50
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (max 50)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}
