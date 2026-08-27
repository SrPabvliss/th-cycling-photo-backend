import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaginatedResult } from '@shared/application'
import {
  type IOrganizerReadRepository,
  ORGANIZER_READ_REPOSITORY,
} from '../../../domain/ports/organizer-read-repository.port'
import type { OrganizerEventProjection } from '../../projections/organizer-event.projection'
import { GetOrganizerEventsQuery } from './get-organizer-events.query'

@QueryHandler(GetOrganizerEventsQuery)
export class GetOrganizerEventsHandler implements IQueryHandler<GetOrganizerEventsQuery> {
  constructor(
    @Inject(ORGANIZER_READ_REPOSITORY)
    private readonly organizerReadRepo: IOrganizerReadRepository,
  ) {}

  async execute(
    query: GetOrganizerEventsQuery,
  ): Promise<PaginatedResult<OrganizerEventProjection>> {
    return this.organizerReadRepo.getOrganizerEvents(query.id, query.pagination)
  }
}
