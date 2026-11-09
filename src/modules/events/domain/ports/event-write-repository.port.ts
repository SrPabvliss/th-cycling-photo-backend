import type { Prisma } from '@generated/prisma/client'
import type { Event } from '../entities'

export interface IEventWriteRepository {
  save(event: Event, tx?: Prisma.TransactionClient): Promise<Event>
  updatePhotoQuota(eventId: string, quota: number | null): Promise<void>
}

export const EVENT_WRITE_REPOSITORY = Symbol('EVENT_WRITE_REPOSITORY')
