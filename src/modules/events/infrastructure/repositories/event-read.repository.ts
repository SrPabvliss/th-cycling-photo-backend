import { Injectable } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js'
import type { EventDetailProjection } from '../../application/projections/event-detail.projection.js'
import type { EventListProjection } from '../../application/projections/event-list.projection.js'
import * as EventMapper from '../mappers/event.mapper.js'

@Injectable()
export class EventReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Retrieves a paginated list of events as projections. */
  async getEventsList(filters: { page: number; limit: number }): Promise<EventListProjection[]> {
    const skip = (filters.page - 1) * filters.limit

    const events = await this.prisma.event.findMany({
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
      skip,
      take: filters.limit,
    })

    return events.map(EventMapper.toListProjection)
  }

  /** Retrieves a single event's detail by ID. */
  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findUnique({
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
