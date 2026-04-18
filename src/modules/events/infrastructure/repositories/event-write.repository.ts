import type { Event } from '@events/domain/entities'
import type { IEventWriteRepository } from '@events/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { nanoid } from 'nanoid'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventWriteRepository implements IEventWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an event entity (create or update). Appends a suffix if slug collides. */
  async save(event: Event): Promise<Event> {
    await this.ensureUniqueSlug(event)
    const data = EventMapper.toPersistence(event)

    const saved = await this.prisma.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    })

    return EventMapper.toEntity(saved)
  }

  /** Sets featured status atomically — unfeatures all others when setting true. */
  async setFeatured(eventId: string, isFeatured: boolean): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (isFeatured) {
        await tx.event.updateMany({
          where: { is_featured: true },
          data: { is_featured: false },
        })
      }

      await tx.event.update({
        where: { id: eventId },
        data: { is_featured: isFeatured },
      })
    })
  }

  /** Ensures event.slug is unique, appending a short random suffix if it collides. */
  private async ensureUniqueSlug(event: Event): Promise<void> {
    const existing = await this.prisma.event.findFirst({
      where: { slug: event.slug, id: { not: event.id } },
      select: { id: true },
    })

    if (existing) {
      event.slug = `${event.slug}-${nanoid(6)}`
    }
  }
}
