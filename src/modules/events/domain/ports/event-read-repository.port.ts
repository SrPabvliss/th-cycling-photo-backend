import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Event } from '../entities'

export interface IEventReadRepository {
  findById(id: string, includeArchived?: boolean): Promise<Event | null>
  getEventsList(
    pagination: Pagination,
    includeArchived?: boolean,
  ): Promise<PaginatedResult<EventListProjection>>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
  countAll(): Promise<number>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
