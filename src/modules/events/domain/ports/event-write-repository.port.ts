import type { Event } from '../entities/event.entity.js'

export interface IEventWriteRepository {
  save(event: Event): Promise<Event>
  delete(id: string): Promise<void>
}

export const EVENT_WRITE_REPOSITORY = Symbol('EVENT_WRITE_REPOSITORY')
