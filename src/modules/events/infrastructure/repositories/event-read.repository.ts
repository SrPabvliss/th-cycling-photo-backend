import { Injectable } from '@nestjs/common'
import type { Pagination } from '../../../../shared/application/pagination.js'
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js'
import type { EventDetailProjection } from '../../application/projections/event-detail.projection.js'
import type { EventListProjection } from '../../application/projections/event-list.projection.js'
import type { Event } from '../../domain/entities/event.entity.js'
import type { IEventReadRepository } from '../../domain/ports/event-read-repository.port.js'
import * as EventMapper from '../mappers/event.mapper.js'

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a non-deleted event entity by ID for command operations. */
  async findById(id: string): Promise<Event | null> {
    const record = await this.prisma.event.findFirst({ where: { id, deleted_at: null } })
    return record ? EventMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of events as projections. */
  async getEventsList(pagination: Pagination): Promise<EventListProjection[]> {
    const events = await this.prisma.event.findMany({
      where: { deleted_at: null },
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
    })

    return events.map(EventMapper.toListProjection)
  }

  /** Retrieves a single non-deleted event's detail by ID. */
  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findFirst({
      where: { id, deleted_at: null },
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
