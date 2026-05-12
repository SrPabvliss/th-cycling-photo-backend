import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional, IsString } from 'class-validator'

export const RETOUCH_ORDER_SCOPES = ['pending', 'completed'] as const

export class GetOperatorRetouchOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: RETOUCH_ORDER_SCOPES,
    description: 'Filter scope (defaults to "pending")',
  })
  @IsOptional()
  @IsIn(RETOUCH_ORDER_SCOPES)
  scope?: 'pending' | 'completed'

  @ApiPropertyOptional({ description: 'Restrict the queue to a single event (slug)' })
  @IsOptional()
  @IsString()
  eventSlug?: string
}
