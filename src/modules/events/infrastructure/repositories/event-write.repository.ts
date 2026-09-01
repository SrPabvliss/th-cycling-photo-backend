import type { Event } from '@events/domain/entities'
import type { IEventWriteRepository } from '@events/domain/ports'
import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { customAlphabet } from 'nanoid'
import * as EventMapper from '../mappers/event.mapper'

// Slugs travel in public URLs and the lookup matches them exactly, so the suffix stays lowercase
// and drops look-alike characters. nanoid's default alphabet is mixed case and includes `_`.
const slugSuffix = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 6)

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
      event.slug = `${event.slug}-${slugSuffix()}`
    }
  }

  async updatePhotoQuota(eventId: string, quota: number | null): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: { photo_quota: quota },
    })
  }
}
