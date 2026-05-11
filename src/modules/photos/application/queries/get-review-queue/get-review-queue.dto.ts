import { ApiPropertyOptional } from '@nestjs/swagger'
import { REVIEW_QUEUE_STATUS_FILTERS, type ReviewQueueStatusFilter } from '@photos/domain/ports'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional } from 'class-validator'

export class GetReviewQueueDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: REVIEW_QUEUE_STATUS_FILTERS,
    description: 'Review status filter (defaults to "all")',
  })
  @IsOptional()
  @IsIn(REVIEW_QUEUE_STATUS_FILTERS)
  status?: ReviewQueueStatusFilter
}
