import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
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
  private readonly watermarkBaseUrl: string

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    config: ConfigService,
  ) {
    this.watermarkBaseUrl = config.getOrThrow<string>('watermark.baseUrl')
  }

  /** Finds an event entity by ID. Excludes archived by default. */
  async findById(id: string, includeArchived = false): Promise<Event | null> {
    const where = includeArchived ? { id } : { id, deleted_at: null }
    const record = await this.prisma.event.findFirst({ where })
    return record ? EventMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of events as projections. */
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
      events.map((e) => EventMapper.toListProjection(e, (key) => this.storage.getPublicUrl(key))),
      total,
      pagination,
    )
  }

  /** Retrieves a single event's detail by ID (including archived). */
  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findFirst({
      where: { id },
      select: EventMapper.eventDetailSelectConfig,
    })

    return record
      ? EventMapper.toDetailProjection(record, (key) => this.storage.getPublicUrl(key))
      : null
  }

  /** Counts all events (including archived). */
  async countAll(): Promise<number> {
    return this.prisma.event.count()
  }

  /** Retrieves a paginated list of active events for the public gallery. */
  async getPublicEventsList(
    pagination: Pagination,
  ): Promise<PaginatedResult<PublicEventListProjection>> {
    const where = { deleted_at: null, status: 'active' as const }

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

    const items = events.map((e) =>
      EventMapper.toPublicListProjection(e, (key) => this.storage.getPublicUrl(key)),
    )

    return new PaginatedResult(items, total, pagination)
  }

  /** Retrieves a single active event's public detail with photo categories. */
  async getPublicEventDetail(eventId: string): Promise<PublicEventDetailProjection | null> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deleted_at: null, status: 'active' },
      select: EventMapper.publicEventDetailSelectConfig,
    })

    if (!event) return null

    return EventMapper.toPublicDetailProjection(event, (key) => this.storage.getPublicUrl(key))
  }

  /** Returns watermarked public photos for a given active event, paginated. */
  async getPublicPhotos(
    eventId: string,
    pagination: Pagination,
    photoCategoryId?: number | null,
  ): Promise<PaginatedResult<PublicPhotoProjection>> {
    const where: Prisma.PhotoWhereInput = {
      event_id: eventId,
    }

    if (photoCategoryId) {
      where.photo_category_id = photoCategoryId
    }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: { id: true, storage_key: true, width: true, height: true },
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(
      photos.map((p) => ({
        id: p.id,
        url: `${this.watermarkBaseUrl}/${p.storage_key}`,
        width: p.width,
        height: p.height,
      })),
      total,
      pagination,
    )
  }

  /** Checks if an active event exists and returns its id and name. */
  async existsActiveEvent(eventId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.event.findFirst({
      where: { id: eventId, status: 'active', deleted_at: null },
      select: { id: true, name: true },
    })
  }
}
