import { Inject, Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import type {
  EventDetailProjection,
  EventListProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
} from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

const COVER_IMAGE_ASSET_SELECT = {
  select: { storage_key: true },
  where: { asset_type: 'cover_image' as const },
  take: 1,
}

const EVENT_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  event_date: true,
  location: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  is_featured: true,
  status: true,
  _count: { select: { photos: true } },
  assets: COVER_IMAGE_ASSET_SELECT,
} as const

const EVENT_DETAIL_SELECT = {
  ...EVENT_LIST_SELECT,
  province_id: true,
  canton_id: true,
  created_at: true,
  updated_at: true,
} as const

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

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
        select: EVENT_LIST_SELECT,
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
      select: EVENT_DETAIL_SELECT,
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
        select: {
          id: true,
          name: true,
          event_date: true,
          location: true,
          province: { select: { name: true } },
          canton: { select: { name: true } },
          is_featured: true,
          _count: { select: { photos: true } },
          assets: { select: { asset_type: true, storage_key: true } },
        },
        orderBy: { event_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    const items: PublicEventListProjection[] = events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.event_date,
      location: e.location,
      provinceName: e.province?.name ?? null,
      cantonName: e.canton?.name ?? null,
      isFeatured: e.is_featured,
      photoCount: e._count.photos,
      assets: e.assets.map((a) => ({
        assetType: a.asset_type,
        url: this.storage.getPublicUrl(a.storage_key),
      })),
    }))

    return new PaginatedResult(items, total, pagination)
  }

  /** Retrieves a single active event's public detail with photo categories. */
  async getPublicEventDetail(eventId: string): Promise<PublicEventDetailProjection | null> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deleted_at: null, status: 'active' },
      select: {
        id: true,
        name: true,
        description: true,
        event_date: true,
        location: true,
        province: { select: { name: true } },
        canton: { select: { name: true } },
        is_featured: true,
        _count: { select: { photos: true } },
        assets: { select: { asset_type: true, storage_key: true } },
        photo_categories: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
    })

    if (!event) return null

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      date: event.event_date,
      location: event.location,
      provinceName: event.province?.name ?? null,
      cantonName: event.canton?.name ?? null,
      isFeatured: event.is_featured,
      photoCount: event._count.photos,
      assets: event.assets.map((a) => ({
        assetType: a.asset_type,
        url: this.storage.getPublicUrl(a.storage_key),
      })),
      photoCategories: event.photo_categories.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    }
  }
}
