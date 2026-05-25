import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional } from 'class-validator'

export const RETOUCH_QUEUE_SCOPES = ['pending', 'completed'] as const

export class GetRetouchQueueDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: RETOUCH_QUEUE_SCOPES,
    description: 'Filter scope (defaults to "pending")',
  })
  @IsOptional()
  @IsIn(RETOUCH_QUEUE_SCOPES)
  scope?: 'pending' | 'completed'
}
