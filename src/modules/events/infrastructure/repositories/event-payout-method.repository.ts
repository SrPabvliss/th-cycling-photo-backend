import type { EventPayoutMethod } from '@events/domain/entities'
import type { IEventPayoutMethodRepository } from '@events/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as EventPayoutMethodMapper from '../mappers/event-payout-method.mapper'

@Injectable()
export class EventPayoutMethodRepository implements IEventPayoutMethodRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEventId(eventId: string): Promise<EventPayoutMethod[]> {
    const records = await this.prisma.eventPayoutMethod.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    })
    return records.map(EventPayoutMethodMapper.toEntity)
  }

  async replaceForEvent(eventId: string, methods: EventPayoutMethod[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.eventPayoutMethod.deleteMany({ where: { event_id: eventId } }),
      this.prisma.eventPayoutMethod.createMany({
        data: methods.map(EventPayoutMethodMapper.toPersistence),
      }),
    ])
  }
}
