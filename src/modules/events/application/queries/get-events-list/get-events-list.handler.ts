import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  EVENT_READ_REPOSITORY,
  type IEventReadRepository,
} from '../../../domain/ports/event-read-repository.port.js'
import type { EventListProjection } from '../../projections/event-list.projection.js'
import { GetEventsListQuery } from './get-events-list.query.js'

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  /** Retrieves a paginated list of events. */
  async execute(query: GetEventsListQuery): Promise<EventListProjection[]> {
    return this.readRepo.getEventsList(query.pagination)
  }
}
