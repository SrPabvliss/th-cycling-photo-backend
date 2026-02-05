import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js'
import type { Event } from '../../domain/entities/event.entity.js'
import type { IEventWriteRepository } from '../../domain/ports/event-write-repository.port.js'
import * as EventMapper from '../mappers/event.mapper.js'

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

  /** Deletes an event by its ID. */
  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } })
  }
}
