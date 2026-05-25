import type { EventTypeProjection } from '../../application/projections'

export interface IEventTypeReadRepository {
  findAll(): Promise<EventTypeProjection[]>
}

export const EVENT_TYPE_READ_REPOSITORY = Symbol('EVENT_TYPE_READ_REPOSITORY')
