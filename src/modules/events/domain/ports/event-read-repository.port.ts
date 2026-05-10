import type {
  EventDetailProjection,
  EventListProjection,
  EventSummaryProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '@events/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Event } from '../entities'

export type AssignedEventStatus = 'active' | 'completed'

export interface IEventReadRepository {
  findById(id: string, includeArchived?: boolean): Promise<Event | null>
  getEventsList(
    pagination: Pagination,
    includeArchived?: boolean,
    search?: string,
  ): Promise<PaginatedResult<EventListProjection>>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
  getEventDetailBySlug(slug: string): Promise<EventDetailProjection | null>
  getAssignedEventsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
    pagination: Pagination,
  ): Promise<PaginatedResult<EventSummaryProjection>>
  countAssignedEventsByStatus(operatorId: string, status: AssignedEventStatus): Promise<number>
  getAssignedEventIdsByStatus(operatorId: string, status: AssignedEventStatus): Promise<string[]>
  countAll(): Promise<number>
  getPublicEventsList(pagination: Pagination): Promise<PaginatedResult<PublicEventListProjection>>
  getPublicEventDetail(slug: string): Promise<PublicEventDetailProjection | null>
  getPublicPhotos(
    eventId: string,
    pagination: Pagination,
    photoCategoryId?: number | null,
  ): Promise<PaginatedResult<PublicPhotoProjection>>
  existsActiveEvent(eventId: string): Promise<{ id: string; name: string } | null>
  existsActiveEventBySlug(slug: string): Promise<{ id: string; name: string } | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
