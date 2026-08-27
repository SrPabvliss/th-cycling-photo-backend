import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type IOrganizerReadRepository,
  ORGANIZER_READ_REPOSITORY,
} from '../../../domain/ports/organizer-read-repository.port'
import type { OrganizersStatsProjection } from '../../projections/organizers-stats.projection'
import { GetOrganizersStatsQuery } from './get-organizers-stats.query'

@QueryHandler(GetOrganizersStatsQuery)
export class GetOrganizersStatsHandler implements IQueryHandler<GetOrganizersStatsQuery> {
  constructor(
    @Inject(ORGANIZER_READ_REPOSITORY)
    private readonly organizerReadRepo: IOrganizerReadRepository,
  ) {}

  async execute(query: GetOrganizersStatsQuery): Promise<OrganizersStatsProjection> {
    return this.organizerReadRepo.getOrganizersStats(query.filters)
  }
}
