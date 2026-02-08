import type { Event } from '@events/domain/entities'
import type { IEventWriteRepository } from '@events/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventWriteRepository implements IEventWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an event entity (create or update). */
  async save(event: Event): Promise<Event> {
    const data = EventMapper.toPersistence(event)

    const saved = await this.prisma.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    })

    return EventMapper.toEntity(saved)
  }

  /** Soft-deletes an event by setting its deleted_at timestamp. */
  async delete(id: string): Promise<void> {
    await this.prisma.event.update({
      where: { id },
      data: { deleted_at: new Date() },
    })
  }
}
