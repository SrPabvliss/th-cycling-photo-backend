import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type { EventDetailProjection, EventListProjection } from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

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
        select: {
          id: true,
          name: true,
          event_date: true,
          location: true,
          status: true,
          total_photos: true,
          processed_photos: true,
        },
        orderBy: { event_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    return new PaginatedResult(events.map(EventMapper.toListProjection), total, pagination)
  }

  /** Retrieves a single event's detail by ID (including archived). */
  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        event_date: true,
        location: true,
        status: true,
        total_photos: true,
        processed_photos: true,
        created_at: true,
        updated_at: true,
      },
    })

    return record ? EventMapper.toDetailProjection(record) : null
  }
}
