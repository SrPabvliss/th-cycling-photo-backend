import type { Prisma } from '@generated/prisma/client'
import type { EventPayoutMethod } from '../entities/event-payout-method.entity'

export const EVENT_PAYOUT_METHOD_REPOSITORY = Symbol('EVENT_PAYOUT_METHOD_REPOSITORY')

export interface IEventPayoutMethodRepository {
  findByEventId(eventId: string): Promise<EventPayoutMethod[]>
  replaceForEvent(
    eventId: string,
    methods: EventPayoutMethod[],
    tx?: Prisma.TransactionClient,
  ): Promise<void>
}
