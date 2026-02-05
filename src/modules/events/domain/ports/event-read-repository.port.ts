import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import type { Pagination } from '@shared/application'
import type { Event } from '../entities'

export interface IEventReadRepository {
  findById(id: string): Promise<Event | null>
  getEventsList(pagination: Pagination): Promise<EventListProjection[]>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
