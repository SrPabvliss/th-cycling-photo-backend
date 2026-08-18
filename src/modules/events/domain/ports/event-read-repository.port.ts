import type {
  EventBriefProjection,
  EventDetailProjection,
  EventListProjection,
  EventSummaryProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '@events/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Event } from '../entities'

export type AssignedEventStatus = 'active' | 'completed'

export interface IEventReadRepository {
  findById(id: string, includeArchived?: boolean): Promise<Event | null>
  /**
   * Scoped load — the tenant-boundary check for every mutation in this
   * module. `findById` alone is not a safe basis for `authz.assert()`:
   * `assert` only tests whether the caller holds the permission key
   * (template/grants), never whether the target row belongs to the
   * caller's tenant. Loading through this method means an out-of-scope id
   * resolves to `null` (404), the same non-disclosure behaviour as
   * `getEventDetailBySlug`.
   */
  findByIdInScope(id: string, scope: EventScope, includeArchived?: boolean): Promise<Event | null>
  getEventsList(
    pagination: Pagination,
    includeArchived: boolean,
    search: string | undefined,
    scope: EventScope,
  ): Promise<PaginatedResult<EventListProjection>>
  getEventDetailBySlug(slug: string, scope: EventScope): Promise<EventDetailProjection | null>
  getAssignedEventsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
    pagination: Pagination,
  ): Promise<PaginatedResult<EventSummaryProjection>>
  countAssignedEventsByStatus(operatorId: string, status: AssignedEventStatus): Promise<number>
  getAssignedEventIdsByStatus(operatorId: string, status: AssignedEventStatus): Promise<string[]>
  getAllAssignedEventIds(operatorId: string): Promise<string[]>
  getEventBriefsByIds(ids: string[]): Promise<EventBriefProjection[]>
  countAll(scope: EventScope): Promise<number>
  getPublicEventsList(pagination: Pagination): Promise<PaginatedResult<PublicEventListProjection>>
  getPublicEventDetail(slug: string): Promise<PublicEventDetailProjection | null>
  getPublicPhotos(
    eventId: string,
    pagination: Pagination,
    options: {
      photoCategoryId: number | null
      bibNumber: string | null
      bibMatch: 'exact' | 'starts' | 'contains'
      section: 'matched' | 'no_bib' | null
    },
  ): Promise<PaginatedResult<PublicPhotoProjection>>
  existsActiveEvent(eventId: string): Promise<{ id: string; name: string } | null>
  existsActiveEventBySlug(slug: string): Promise<{ id: string; name: string } | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
