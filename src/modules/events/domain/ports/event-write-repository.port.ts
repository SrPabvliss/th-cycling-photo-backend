import type { Event } from '../entities'

export interface IEventWriteRepository {
  save(event: Event): Promise<Event>
}

export const EVENT_WRITE_REPOSITORY = Symbol('EVENT_WRITE_REPOSITORY')
