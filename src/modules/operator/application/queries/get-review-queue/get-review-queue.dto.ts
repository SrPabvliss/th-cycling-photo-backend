import { ApiPropertyOptional } from '@nestjs/swagger'
import { REVIEW_QUEUE_STATUS_FILTERS, type ReviewQueueStatusFilter } from '@photos/domain/ports'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional, IsString } from 'class-validator'

export class GetOperatorReviewQueueDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: REVIEW_QUEUE_STATUS_FILTERS,
    description: 'Review status filter (defaults to "all")',
  })
  @IsOptional()
  @IsIn(REVIEW_QUEUE_STATUS_FILTERS)
  status?: ReviewQueueStatusFilter

  @ApiPropertyOptional({ description: 'Restrict the queue to a single event (slug)' })
  @IsOptional()
  @IsString()
  eventSlug?: string
}
