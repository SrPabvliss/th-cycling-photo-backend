import type { Event } from '@events/domain/entities'
import type { IEventWriteRepository } from '@events/domain/ports'
import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { nanoid } from 'nanoid'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventWriteRepository implements IEventWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an event entity (create or update). Appends a suffix if slug collides. */
  async save(event: Event, tx?: Prisma.TransactionClient): Promise<Event> {
    const client = tx ?? this.prisma
    await this.ensureUniqueSlug(event, client)
    const data = EventMapper.toPersistence(event)

    const saved = await client.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    })

    return EventMapper.toEntity(saved)
  }

  /** Ensures event.slug is unique, appending a short random suffix if it collides. */
  private async ensureUniqueSlug(event: Event, client: Prisma.TransactionClient): Promise<void> {
    const existing = await client.event.findFirst({
      where: { slug: event.slug, id: { not: event.id } },
      select: { id: true },
    })

    if (existing) {
      event.slug = `${event.slug}-${nanoid(6)}`
    }
  }

  async updatePhotoQuota(eventId: string, quota: number | null): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: { photo_quota: quota },
    })
  }
}
