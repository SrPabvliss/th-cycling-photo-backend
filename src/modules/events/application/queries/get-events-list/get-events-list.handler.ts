import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { EventListProjection } from '../../projections/event-list.projection.js'
import { EventReadRepository } from '../../../infrastructure/repositories/event-read.repository.js'
import { GetEventsListQuery } from './get-events-list.query.js'

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
	constructor(private readonly eventReadRepository: EventReadRepository) {}

	/** Retrieves a paginated list of events. */
	async execute(query: GetEventsListQuery): Promise<EventListProjection[]> {
		return this.eventReadRepository.getEventsList({
			page: query.page,
			limit: query.limit,
		})
	}
}
