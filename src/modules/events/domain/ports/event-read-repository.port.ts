import type {
  EventDetailProjection,
  EventListProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
} from '@events/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Event } from '../entities'

export interface IEventReadRepository {
  findById(id: string, includeArchived?: boolean): Promise<Event | null>
  getEventsList(
    pagination: Pagination,
    includeArchived?: boolean,
    search?: string,
  ): Promise<PaginatedResult<EventListProjection>>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
  countAll(): Promise<number>
  getPublicEventsList(pagination: Pagination): Promise<PaginatedResult<PublicEventListProjection>>
  getPublicEventDetail(eventId: string): Promise<PublicEventDetailProjection | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
