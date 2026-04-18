import type { Event } from '../entities'

export interface IEventWriteRepository {
  save(event: Event): Promise<Event>
  setFeatured(eventId: string, isFeatured: boolean): Promise<void>
}

export const EVENT_WRITE_REPOSITORY = Symbol('EVENT_WRITE_REPOSITORY')
