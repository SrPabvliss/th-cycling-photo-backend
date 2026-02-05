import type { Pagination } from '../../../../shared/application/pagination.js'
import type { EventDetailProjection } from '../../application/projections/event-detail.projection.js'
import type { EventListProjection } from '../../application/projections/event-list.projection.js'
import type { Event } from '../entities/event.entity.js'

export interface IEventReadRepository {
  findById(id: string): Promise<Event | null>
  getEventsList(pagination: Pagination): Promise<EventListProjection[]>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
