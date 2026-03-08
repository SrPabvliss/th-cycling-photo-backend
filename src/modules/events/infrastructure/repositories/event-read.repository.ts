import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type { EventDetailProjection, EventListProjection } from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

const EVENT_LIST_SELECT = {
  id: true,
  name: true,
  event_date: true,
  location: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  cover_image_url: true,
  status: true,
  _count: { select: { photos: true } },
} as const

const EVENT_DETAIL_SELECT = {
  ...EVENT_LIST_SELECT,
  province_id: true,
  canton_id: true,
  cover_image_storage_key: true,
  created_at: true,
  updated_at: true,
} as const

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<PaginatedResult<EventListProjection>> {
    const where = includeArchived ? {} : { deleted_at: null }

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
      events.map((e) => EventMapper.toListProjection(e)),
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

    return record ? EventMapper.toDetailProjection(record) : null
  }

  /** Counts all events (including archived). */
  async countAll(): Promise<number> {
    return this.prisma.event.count()
  }
}
