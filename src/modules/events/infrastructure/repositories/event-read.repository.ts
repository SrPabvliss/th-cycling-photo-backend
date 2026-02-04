import { Injectable } from '@nestjs/common'
import type { EventListProjection } from '../../application/projections/event-list.projection.js'
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js'
import { EventMapper } from '../mappers/event.mapper.js'

@Injectable()
export class EventReadRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Retrieves a paginated list of events as projections. */
	async getEventsList(filters: {
		page: number
		limit: number
	}): Promise<EventListProjection[]> {
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
}
