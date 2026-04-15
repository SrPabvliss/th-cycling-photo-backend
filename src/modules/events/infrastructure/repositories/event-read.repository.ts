import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import type {
  EventDetailProjection,
  EventListProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async findById(id: string, includeArchived = false): Promise<Event | null> {
    const where = includeArchived ? { id } : { id, deleted_at: null }
    const record = await this.prisma.event.findFirst({ where })
    return record ? EventMapper.toEntity(record) : null
  }

  async getEventsList(
    pagination: Pagination,
    includeArchived = false,
    search?: string,
  ): Promise<PaginatedResult<EventListProjection>> {
    const where: Record<string, unknown> = includeArchived ? {} : { deleted_at: null }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: EventMapper.eventListSelectConfig,
        orderBy: { event_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    return new PaginatedResult(
      events.map((e) => EventMapper.toListProjection(e, this.cdn)),
      total,
      pagination,
    )
  }

  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findFirst({
      where: { id },
      select: EventMapper.eventDetailSelectConfig,
    })

    if (!record) return null

    return EventMapper.toDetailProjection(record, this.cdn)
  }

  async countAll(): Promise<number> {
    return this.prisma.event.count()
  }

  async getPublicEventsList(
    pagination: Pagination,
  ): Promise<PaginatedResult<PublicEventListProjection>> {
    // Public listings require a cover_image asset — no cover means the event is
    // still in "setup incomplete" state and must not be visible to buyers.
    const where: Prisma.EventWhereInput = {
      deleted_at: null,
      status: 'active',
      assets: { some: { asset_type: 'cover_image' } },
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: EventMapper.publicEventListSelectConfig,
        orderBy: { event_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    const items = events.map((e) => EventMapper.toPublicListProjection(e))

    return new PaginatedResult(items, total, pagination)
  }

  async getPublicEventDetail(slug: string): Promise<PublicEventDetailProjection | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        slug,
        deleted_at: null,
        status: 'active',
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: EventMapper.publicEventDetailSelectConfig,
    })

    if (!event) return null

    return EventMapper.toPublicDetailProjection(event, this.cdn)
  }

  async getPublicPhotos(
    eventId: string,
    pagination: Pagination,
    photoCategoryId?: number | null,
  ): Promise<PaginatedResult<PublicPhotoProjection>> {
    const where: Prisma.PhotoWhereInput = { event_id: eventId }

    if (photoCategoryId) {
      where.photo_category_id = photoCategoryId
    }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: { id: true, public_slug: true, width: true, height: true },
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(
      photos.map((p) => ({
        id: p.id,
        url: this.cdn.galleryUrl(p.public_slug),
        width: p.width,
        height: p.height,
      })),
      total,
      pagination,
    )
  }

  async existsActiveEvent(eventId: string): Promise<{ id: string; name: string } | null> {
    // An event is considered "active" (publicly usable) only if it has a cover_image.
    // This blocks order creation and gallery browsing for events without a cover.
    return this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: 'active',
        deleted_at: null,
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: { id: true, name: true },
    })
  }

  async existsActiveEventBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.event.findFirst({
      where: {
        slug,
        status: 'active',
        deleted_at: null,
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: { id: true, name: true },
    })
  }
}
