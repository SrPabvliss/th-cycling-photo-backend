import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export const EVENT_TABS = ['all', 'active', 'no_cover', 'frozen', 'archived'] as const
export type EventTab = (typeof EVENT_TABS)[number]

export const EVENT_SORTS = [
  'activity',
  'event_date',
  'quota',
  'pending_review',
  'revenue',
  'name',
] as const
export type EventSort = (typeof EVENT_SORTS)[number]

export interface EventListFilters {
  search?: string
  tab?: EventTab
  organizerId?: string
  sort?: EventSort
}

export class GetEventsListDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search events by name', example: 'MTB' })
  @IsString()
  @IsOptional()
  search?: string

  @ApiPropertyOptional({ enum: EVENT_TABS })
  @IsIn(EVENT_TABS)
  @IsOptional()
  tab?: EventTab

  @ApiPropertyOptional({ description: 'Filter by organizer UUID' })
  @IsUUID()
  @IsOptional()
  organizerId?: string

  @ApiPropertyOptional({ enum: EVENT_SORTS })
  @IsIn(EVENT_SORTS)
  @IsOptional()
  sort?: EventSort
}
